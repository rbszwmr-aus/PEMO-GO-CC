package platform

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

// ISO formats a time exactly as JavaScript's Date.prototype.toISOString does.
func ISO(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05.000Z") }

// ISOPtr formats a nullable time; nil stays nil (JSON null).
func ISOPtr(t *time.Time) any {
	if t == nil {
		return nil
	}
	return ISO(*t)
}

// ParseISO accepts RFC 3339 with or without fractional seconds.
func ParseISO(s string) (time.Time, error) { return time.Parse(time.RFC3339Nano, s) }

// ---- problems ----

// LocalizedText is the bilingual resident-facing message.
type LocalizedText struct {
	En     string `json:"en"`
	ZhHant string `json:"zh-Hant"`
}

// Problem is an RFC 9457 problem for the resident-mobile surface.
type Problem struct {
	Type            string
	Title           string
	Status          int
	Detail          string
	ResidentMessage *LocalizedText
	SupersededBy    string
	Retryable       *bool
}

func (p *Problem) Error() string { return fmt.Sprintf("%d %s", p.Status, p.Title) }

// Body renders the problem with its correlation id, omitting unset members.
func (p *Problem) Body(correlationID string) map[string]any {
	b := map[string]any{"type": p.Type, "title": p.Title, "status": p.Status, "correlationId": correlationID}
	if p.Detail != "" {
		b["detail"] = p.Detail
	}
	if p.ResidentMessage != nil {
		b["residentMessage"] = p.ResidentMessage
	}
	if p.SupersededBy != "" {
		b["supersededBy"] = p.SupersededBy
	}
	if p.Retryable != nil {
		b["retryable"] = *p.Retryable
	}
	return b
}

// ---- logging ----

// Logger writes one JSON object per line.
type Logger struct {
	level   int
	service string
	bound   map[string]any
	out     io.Writer
	mu      *sync.Mutex
}

var levelRank = map[string]int{"debug": 10, "info": 20, "warn": 30, "error": 40}

// NewLogger writes to stdout at level.
func NewLogger(level, service string) *Logger {
	return &Logger{level: levelRank[level], service: service, bound: map[string]any{}, out: os.Stdout, mu: &sync.Mutex{}}
}

// With returns a child logger with extra bound fields.
func (l *Logger) With(fields map[string]any) *Logger {
	b := map[string]any{}
	for k, v := range l.bound {
		b[k] = v
	}
	for k, v := range fields {
		b[k] = v
	}
	return &Logger{level: l.level, service: l.service, bound: b, out: l.out, mu: l.mu}
}

func (l *Logger) emit(level, msg string, fields map[string]any) {
	if levelRank[level] < l.level {
		return
	}
	line := map[string]any{"time": ISO(time.Now()), "level": level, "service": l.service, "message": msg}
	for k, v := range l.bound {
		line[k] = v
	}
	for k, v := range fields {
		line[k] = v
	}
	b, _ := json.Marshal(line)
	l.mu.Lock()
	_, _ = l.out.Write(append(b, '\n'))
	l.mu.Unlock()
}

func (l *Logger) Debug(m string, f map[string]any) { l.emit("debug", m, f) }
func (l *Logger) Info(m string, f map[string]any)  { l.emit("info", m, f) }
func (l *Logger) Warn(m string, f map[string]any)  { l.emit("warn", m, f) }
func (l *Logger) Error(m string, f map[string]any) { l.emit("error", m, f) }

// ---- envelope and outbox ----

// Envelope is the platform event envelope (contract-versioned).
type Envelope struct {
	MessageID       string
	ContractName    string
	ContractVersion string
	OccurredAt      string
	ReceivedAt      string
	Source          string
	CorrelationID   string
	CausationID     *string
	Scope           map[string]any
	Payload         any
}

var rfc3339 = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$`)

// IsRFC3339 reports whether value is RFC 3339 with an explicit offset.
func IsRFC3339(v string) bool { return rfc3339.MatchString(v) }

// Publish writes the envelope to platform.outbox_message through the named
// SECURITY DEFINER command, inside the caller's transaction when db is one.
func Publish(ctx context.Context, db DB, e Envelope) error {
	scope, _ := json.Marshal(e.Scope)
	payload, _ := json.Marshal(e.Payload)
	return db.Exec(ctx, `SELECT platform.enqueue_outbox_message($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb)`,
		e.MessageID, e.ContractName, e.ContractVersion, e.OccurredAt, e.ReceivedAt, e.Source,
		e.CorrelationID, e.CausationID, string(scope), string(payload))
}

// RecordDeadLetter keeps an integration exception for an operator.
func RecordDeadLetter(ctx context.Context, db DB, source, reason, correlationID string, detail any) error {
	d, _ := json.Marshal(detail)
	return db.Exec(ctx, `INSERT INTO integration_exception (source, reason, correlation_id, detail) VALUES ($1, $2, $3, $4::jsonb)`,
		source, reason, correlationID, string(d))
}

// ---- health ----

// DependencyStatus is one readiness check.
type DependencyStatus struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail,omitempty"`
}

// CheckDatabase runs SELECT 1 on db.
func CheckDatabase(ctx context.Context, db DB, name string) DependencyStatus {
	if err := db.Exec(ctx, "SELECT 1"); err != nil {
		return DependencyStatus{Name: name, OK: false, Detail: err.Error()}
	}
	return DependencyStatus{Name: name, OK: true}
}

// ---- LIKE patterns ----

// LikeEscapeClause pairs with the patterns below.
const LikeEscapeClause = `ESCAPE '\'`

// LikePattern escapes \, _ and % so a literal matches only itself.
func LikePattern(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return strings.ReplaceAll(s, `%`, `\%`)
}

// LikePrefix matches values that start with s.
func LikePrefix(s string) string { return LikePattern(s) + "%" }

// LikeContains matches values that contain s.
func LikeContains(s string) string { return "%" + LikePattern(s) + "%" }

// ---- latest assertion (ADR-013) ----

var identifierRe = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

// LatestAssertionQuery describes "current = MAX(version) per instance".
type LatestAssertionQuery struct {
	Table, InstanceKey string
	Columns            []string
	Filter             string
	AsOfParam          string
}

// LatestAssertionSQL builds the DISTINCT ON query. Identifiers are checked
// because they are interpolated.
func LatestAssertionSQL(q LatestAssertionQuery) string {
	check := func(v, what string) string {
		if !identifierRe.MatchString(v) {
			panic(fmt.Sprintf("LatestAssertionSQL: %s %q is not a plain unqualified identifier", what, v))
		}
		return v
	}
	table, key := check(q.Table, "table"), check(q.InstanceKey, "instanceKey")
	cols := []string{}
	hasVersion := false
	for _, c := range q.Columns {
		cols = append(cols, check(c, "column"))
		if c == "version" {
			hasVersion = true
		}
	}
	if !hasVersion {
		cols = append(cols, "version")
	}
	var preds []string
	if q.AsOfParam != "" {
		preds = append(preds, "recorded_at <= "+q.AsOfParam)
	}
	if strings.TrimSpace(q.Filter) != "" {
		preds = append(preds, "("+q.Filter+")")
	}
	where := ""
	if len(preds) > 0 {
		where = "\n   WHERE " + strings.Join(preds, "\n     AND ")
	}
	return fmt.Sprintf("SELECT DISTINCT ON (%s) %s\n    FROM %s%s\n   ORDER BY %s, version DESC", key, strings.Join(cols, ", "), table, where, key)
}
