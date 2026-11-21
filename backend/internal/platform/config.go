// Package platform owns configuration, logging, problems, health, the event
// envelope, the outbox, the audited-write primitives and the migration runner.
// It owns no business workflow. It is the only package every module may import.
package platform

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// DatabaseConfig is one login to the one PEMO database.
type DatabaseConfig struct {
	Host     string
	Port     int
	Database string
	User     string
	Password string
}

// ModuleLoginSchemas are the schemas that have their own login and pool.
// service_case and integration have none: they are written only through
// SECURITY DEFINER commands (service_case) or are a library (integration).
var ModuleLoginSchemas = []string{
	"platform", "property", "resident", "home_safety", "access",
	"notices", "helpdesk", "strata", "dev_scaffold",
}

// AllSchemas is the one declaration of every schema the migrations may own.
var AllSchemas = []string{
	"platform", "property", "resident", "home_safety", "integration", "access",
	"notices", "helpdesk", "service_case", "strata", "dev_scaffold",
}

// PoolSettings bound every module pool.
type PoolSettings struct {
	Max                    int
	ConnectTimeout         time.Duration
	StatementTimeoutMillis int
	AdminStatementTimeout  int
	ReplicaCount           int
}

// Config is the whole process configuration, read once from the environment.
type Config struct {
	Environment                  string
	ServiceName                  string
	HTTPHost                     string
	HTTPPort                     int
	LogLevel                     string
	SafetyFreshnessWindowSeconds int
	DevTokenSecret               string
	DevTokenTTLSeconds           int
	Database                     DatabaseConfig
	ModuleDatabases              map[string]DatabaseConfig
	DatabaseOwner                DatabaseConfig
	DBPool                       PoolSettings
	EmailBatchSize               int
	// EnableDemoRoutes registers the in-memory demo routes (tickets, invoices,
	// notices/visitors, QR pass). Off by default: they are an unaudited write
	// path and never part of the product (code review S2, C1).
	EnableDemoRoutes bool
	// TimeZone is the organisation's display time zone. It replaces the
	// 'Asia/Hong_Kong' literal the Node build repeated in 18 files (review:
	// Flexibility). Default Asia/Hong_Kong keeps behaviour identical.
	TimeZone *time.Location
	// AllowedOrigins is the CORS allow-list (review S4). Empty = same-origin only.
	AllowedOrigins []string
	// RateLimitPerMinute bounds requests per client IP (review S3). 0 disables.
	RateLimitPerMinute int
	// MailWorker drains queued outbox rows in the background (PEMO_MAIL_WORKER=1).
	MailWorker bool
}

// ConfigurationError names the missing or malformed setting.
type ConfigurationError struct{ Msg string }

func (e *ConfigurationError) Error() string { return e.Msg }

type envReader func(string) (string, bool)

func required(get envReader, key string) (string, error) {
	v, ok := get(key)
	if !ok || strings.TrimSpace(v) == "" {
		return "", &ConfigurationError{"Missing required configuration: " + key}
	}
	return v, nil
}

func optionalNumber(get envReader, key string, fallback int) (int, error) {
	raw, ok := get(key)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return 0, &ConfigurationError{fmt.Sprintf("Configuration %s must be a positive integer, received %q", key, raw)}
	}
	return n, nil
}

// ReadAdminStatementTimeoutMillis: 0 (no timeout) unless set; migrations and
// seeds may legitimately run long.
func ReadAdminStatementTimeoutMillis(get envReader) (int, error) {
	raw, ok := get("PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS")
	if !ok || strings.TrimSpace(raw) == "" {
		return 0, nil
	}
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n < 0 {
		return 0, &ConfigurationError{fmt.Sprintf("Configuration PEMO_DB_ADMIN_STATEMENT_TIMEOUT_MS must be a non-negative integer, received %q", raw)}
	}
	return n, nil
}

// LoadConfig reads the process environment.
func LoadConfig() (*Config, error) { return LoadConfigFrom(os.LookupEnv) }

// LoadConfigFrom reads configuration through get (tests inject a map).
func LoadConfigFrom(get func(string) (string, bool)) (*Config, error) {
	env, _ := get("PEMO_ENV")
	if env != "development" {
		shown := "<unset>"
		if _, ok := get("PEMO_ENV"); ok {
			shown = strconv.Quote(env)
		}
		return nil, &ConfigurationError{"PEMO_ENV must be exactly \"development\"; received " + shown + ". " +
			"This build contains a development-only authentication stub and a development-only fault seam. " +
			"It must never run against a real environment."}
	}
	c := &Config{Environment: "development"}
	var err error
	str := func(key, def string) string {
		if v, ok := get(key); ok {
			return v
		}
		return def
	}
	c.ServiceName = str("PEMO_SERVICE_NAME", "pemo-api")
	c.HTTPHost = str("PEMO_HTTP_HOST", "127.0.0.1")
	if c.HTTPPort, err = optionalNumber(get, "PEMO_HTTP_PORT", 23280); err != nil {
		return nil, err
	}
	c.LogLevel = str("PEMO_LOG_LEVEL", "info")
	switch c.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return nil, &ConfigurationError{fmt.Sprintf("PEMO_LOG_LEVEL must be debug, info, warn or error; received %q", c.LogLevel)}
	}
	if c.SafetyFreshnessWindowSeconds, err = optionalNumber(get, "PEMO_SAFETY_FRESHNESS_WINDOW_SECONDS", 3600); err != nil {
		return nil, err
	}
	if c.DevTokenSecret, err = required(get, "PEMO_DEV_TOKEN_SECRET"); err != nil {
		return nil, err
	}
	if c.DevTokenTTLSeconds, err = optionalNumber(get, "PEMO_DEV_TOKEN_TTL_SECONDS", 3600); err != nil {
		return nil, err
	}
	host := str("PEMO_DB_HOST", "127.0.0.1")
	port, err := optionalNumber(get, "PEMO_DB_PORT", 25480)
	if err != nil {
		return nil, err
	}
	name, err := required(get, "PEMO_DB_NAME")
	if err != nil {
		return nil, err
	}
	user, err := required(get, "PEMO_DB_USER")
	if err != nil {
		return nil, err
	}
	pass, err := required(get, "PEMO_DB_PASSWORD")
	if err != nil {
		return nil, err
	}
	c.Database = DatabaseConfig{host, port, name, user, pass}
	c.ModuleDatabases = map[string]DatabaseConfig{}
	prefix := str("PEMO_DB_LOGIN_PREFIX", "pemo_app_")
	for _, s := range ModuleLoginSchemas {
		key := strings.ToUpper(s)
		u := str("PEMO_DB_USER_"+key, prefix+s)
		p, ok := get("PEMO_DB_PASSWORD_" + key)
		if !ok {
			p, ok = get("PEMO_DB_MODULE_PASSWORD")
		}
		if !ok {
			p = pass
		}
		c.ModuleDatabases[s] = DatabaseConfig{host, port, name, u, p}
	}
	ou, err := required(get, "PEMO_DB_OWNER_USER")
	if err != nil {
		return nil, err
	}
	op, err := required(get, "PEMO_DB_OWNER_PASSWORD")
	if err != nil {
		return nil, err
	}
	c.DatabaseOwner = DatabaseConfig{host, port, name, ou, op}
	if c.DBPool.Max, err = optionalNumber(get, "PEMO_DB_POOL_MAX", 5); err != nil {
		return nil, err
	}
	ct, err := optionalNumber(get, "PEMO_DB_CONNECT_TIMEOUT_MS", 2000)
	if err != nil {
		return nil, err
	}
	c.DBPool.ConnectTimeout = time.Duration(ct) * time.Millisecond
	if c.DBPool.StatementTimeoutMillis, err = optionalNumber(get, "PEMO_DB_STATEMENT_TIMEOUT_MS", 5000); err != nil {
		return nil, err
	}
	if c.DBPool.AdminStatementTimeout, err = ReadAdminStatementTimeoutMillis(get); err != nil {
		return nil, err
	}
	if c.DBPool.ReplicaCount, err = optionalNumber(get, "PEMO_DB_REPLICA_COUNT", 1); err != nil {
		return nil, err
	}
	if c.EmailBatchSize, err = optionalNumber(get, "PEMO_EMAIL_BATCH_SIZE", 50); err != nil {
		return nil, err
	}
	c.EnableDemoRoutes = str("PEMO_ENABLE_DEMO_ROUTES", "") == "1"
	c.MailWorker = str("PEMO_MAIL_WORKER", "") == "1"
	tz := str("PEMO_TIME_ZONE", "Asia/Hong_Kong")
	loc, lerr := time.LoadLocation(tz)
	if lerr != nil {
		return nil, &ConfigurationError{fmt.Sprintf("PEMO_TIME_ZONE %q is not a known IANA time zone", tz)}
	}
	c.TimeZone = loc
	if o := strings.TrimSpace(str("PEMO_ALLOWED_ORIGINS", "")); o != "" {
		for _, s := range strings.Split(o, ",") {
			if s = strings.TrimSpace(s); s != "" {
				c.AllowedOrigins = append(c.AllowedOrigins, s)
			}
		}
	}
	rl := str("PEMO_RATE_LIMIT_PER_MINUTE", "600")
	if n, e := strconv.Atoi(rl); e == nil && n >= 0 {
		c.RateLimitPerMinute = n
	} else {
		return nil, &ConfigurationError{fmt.Sprintf("PEMO_RATE_LIMIT_PER_MINUTE must be a non-negative integer, received %q", rl)}
	}
	return c, nil
}
