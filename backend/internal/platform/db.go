package platform

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"net/url"
	"strconv"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Row is one result row. Values follow the node-postgres conventions the
// original build relied on, so translated logic behaves the same:
//   - int2/int4 -> int64, int8 and numeric -> string (node-pg returns strings)
//   - timestamptz/timestamp/date -> time.Time
//   - json/jsonb -> decoded any; arrays -> []any; NULL -> nil
type Row map[string]any

// Str returns the column as a string ("" for NULL).
func (r Row) Str(k string) string {
	switch v := r[k].(type) {
	case nil:
		return ""
	case string:
		return v
	case time.Time:
		return ISO(v)
	default:
		return fmt.Sprint(v)
	}
}

// StrPtr returns nil for NULL.
func (r Row) StrPtr(k string) *string {
	if r[k] == nil {
		return nil
	}
	s := r.Str(k)
	return &s
}

// Nullable returns the string or nil (as `any`) for JSON encoding.
func (r Row) Nullable(k string) any {
	if r[k] == nil {
		return nil
	}
	return r.Str(k)
}

// Time returns the column as a time (zero for NULL).
func (r Row) Time(k string) time.Time {
	if t, ok := r[k].(time.Time); ok {
		return t
	}
	return time.Time{}
}

// TimePtr returns nil for NULL.
func (r Row) TimePtr(k string) *time.Time {
	if t, ok := r[k].(time.Time); ok {
		return &t
	}
	return nil
}

// Int returns int2/int4/int8/numeric as an int64 (JavaScript Number()).
func (r Row) Int(k string) int64 {
	switch v := r[k].(type) {
	case int64:
		return v
	case string:
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return int64(f)
		}
	case float64:
		return int64(v)
	}
	return 0
}

// Float returns a numeric column as float64 (JavaScript Number()).
func (r Row) Float(k string) float64 {
	switch v := r[k].(type) {
	case int64:
		return float64(v)
	case float64:
		return v
	case string:
		f, _ := strconv.ParseFloat(v, 64)
		return f
	}
	return 0
}

// Bool returns the column as a bool (false for NULL).
func (r Row) Bool(k string) bool { b, _ := r[k].(bool); return b }

// Strings returns a text[] column.
func (r Row) Strings(k string) []string {
	arr, _ := r[k].([]any)
	out := make([]string, 0, len(arr))
	for _, a := range arr {
		if s, ok := a.(string); ok {
			out = append(out, s)
		} else if a != nil {
			out = append(out, fmt.Sprint(a))
		}
	}
	return out
}

// DB is a module's database handle: pool-backed, or bound to one open
// transaction. Every module gets its own, scoped to its own schema by
// search_path (boundary enforcement layer 4).
type DB interface {
	Schema() string
	InTx() bool
	Query(ctx context.Context, sql string, args ...any) ([]Row, error)
	QueryOne(ctx context.Context, sql string, args ...any) (Row, error)
	Exec(ctx context.Context, sql string, args ...any) error
	// Tx runs fn in a transaction. On a handle already inside a transaction it
	// runs fn on the same transaction (no savepoint), like the Node build.
	Tx(ctx context.Context, fn func(tx DB) error) error
	Close()
}

type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

func collect(rows pgx.Rows) ([]Row, error) {
	defer rows.Close()
	fields := rows.FieldDescriptions()
	var out []Row
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		r := make(Row, len(vals))
		for i, f := range fields {
			r[f.Name] = normalize(vals[i], f.DataTypeOID)
		}
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func normalize(v any, oid uint32) any {
	switch x := v.(type) {
	case nil:
		return nil
	case int16:
		return int64(x)
	case int32:
		return int64(x)
	case int64:
		if oid == pgtype.Int8OID {
			return strconv.FormatInt(x, 10)
		}
		return x
	case pgtype.Numeric:
		return numericString(x)
	case float32:
		return float64(x)
	case [16]byte: // uuid
		return fmt.Sprintf("%x-%x-%x-%x-%x", x[0:4], x[4:6], x[6:8], x[8:10], x[10:16])
	case []any:
		for i := range x {
			x[i] = normalize(x[i], 0)
		}
		return x
	case pgtype.Time:
		us := x.Microseconds
		h, m, s := us/3600e6, (us/60e6)%60, (us/1e6)%60
		return fmt.Sprintf("%02d:%02d:%02d", h, m, s)
	}
	return v
}

func numericString(n pgtype.Numeric) any {
	if !n.Valid {
		return nil
	}
	if n.NaN {
		return "NaN"
	}
	b, err := n.Value()
	if err == nil {
		if s, ok := b.(string); ok {
			return s
		}
	}
	f := new(big.Float).SetInt(n.Int)
	return f.String()
}

type handle struct {
	schema string
	q      querier
	pool   *pgxpool.Pool
	tx     pgx.Tx
}

func (h *handle) Schema() string { return h.schema }
func (h *handle) InTx() bool     { return h.tx != nil }

func (h *handle) Query(ctx context.Context, sql string, args ...any) ([]Row, error) {
	rows, err := h.q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return collect(rows)
}

func (h *handle) QueryOne(ctx context.Context, sql string, args ...any) (Row, error) {
	rows, err := h.Query(ctx, sql, args...)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0], nil
}

func (h *handle) Exec(ctx context.Context, sql string, args ...any) error {
	_, err := h.q.Exec(ctx, sql, args...)
	return err
}

func (h *handle) Tx(ctx context.Context, fn func(tx DB) error) error {
	if h.tx != nil {
		return fn(h)
	}
	return pgx.BeginFunc(ctx, h.pool, func(tx pgx.Tx) error {
		return fn(&handle{schema: h.schema, q: tx, tx: tx})
	})
}

func (h *handle) Close() {
	if h.pool != nil {
		untrack(h.pool)
		h.pool.Close()
	}
}

// TxOnSchema reaches another schema on the SAME open transaction, for the
// named SECURITY DEFINER commands only. It switches search_path for one
// statement and restores it.
func TxOnSchema(tx DB, schema string) (DB, error) {
	h, ok := tx.(*handle)
	if !ok || h.tx == nil {
		return nil, errors.New("TxOnSchema requires an open transaction handle")
	}
	return &schemaSwitch{inner: h, schema: schema}, nil
}

type schemaSwitch struct {
	inner  *handle
	schema string
}

func (s *schemaSwitch) Schema() string { return s.schema }
func (s *schemaSwitch) InTx() bool     { return true }
func (s *schemaSwitch) Close()         {}
func (s *schemaSwitch) Tx(ctx context.Context, fn func(tx DB) error) error {
	return fn(s)
}
func (s *schemaSwitch) run(ctx context.Context, fn func() error) error {
	if _, err := s.inner.tx.Exec(ctx, "SET LOCAL search_path TO "+pgx.Identifier{s.schema}.Sanitize()+", pg_catalog"); err != nil {
		return err
	}
	ferr := fn()
	_, rerr := s.inner.tx.Exec(ctx, "SET LOCAL search_path TO "+pgx.Identifier{s.inner.schema}.Sanitize()+", pg_catalog")
	if ferr != nil {
		return ferr
	}
	return rerr
}
func (s *schemaSwitch) Query(ctx context.Context, sql string, args ...any) (out []Row, err error) {
	err = s.run(ctx, func() error { var e error; out, e = s.inner.Query(ctx, sql, args...); return e })
	return
}
func (s *schemaSwitch) QueryOne(ctx context.Context, sql string, args ...any) (Row, error) {
	rows, err := s.Query(ctx, sql, args...)
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	return rows[0], nil
}
func (s *schemaSwitch) Exec(ctx context.Context, sql string, args ...any) error {
	return s.run(ctx, func() error { return s.inner.Exec(ctx, sql, args...) })
}

// PoolStat is one pool's live counters, reported by /health.
type PoolStat struct {
	Name         string `json:"name"`
	TotalCount   int32  `json:"totalCount"`
	IdleCount    int32  `json:"idleCount"`
	WaitingCount int64  `json:"waitingCount"`
	Max          int32  `json:"max"`
}

var (
	poolMu  sync.Mutex
	pools   = map[*pgxpool.Pool]string{}
	poolSeq int
)

func track(p *pgxpool.Pool, name string) {
	poolMu.Lock()
	defer poolMu.Unlock()
	poolSeq++
	pools[p] = fmt.Sprintf("%s:%d", name, poolSeq)
}
func untrack(p *pgxpool.Pool) { poolMu.Lock(); delete(pools, p); poolMu.Unlock() }

// PoolStats reports every open pool.
func PoolStats() []PoolStat {
	poolMu.Lock()
	defer poolMu.Unlock()
	out := []PoolStat{}
	for p, name := range pools {
		s := p.Stat()
		// pgxpool exposes no live waiter count; constructing connections is
		// the closest signal of callers waiting for one.
		out = append(out, PoolStat{name, s.TotalConns(), s.IdleConns(), int64(s.ConstructingConns()), s.MaxConns()})
	}
	return out
}

func buildPool(ctx context.Context, name string, d DatabaseConfig, schema string, max int, connectTimeout time.Duration, stmtTimeout int) (*pgxpool.Pool, error) {
	u := url.URL{Scheme: "postgres", User: url.UserPassword(d.User, d.Password),
		Host: fmt.Sprintf("%s:%d", d.Host, d.Port), Path: "/" + d.Database}
	cfg, err := pgxpool.ParseConfig(u.String())
	if err != nil {
		return nil, err
	}
	cfg.MaxConns = int32(max)
	cfg.MinConns = 0
	cfg.ConnConfig.ConnectTimeout = connectTimeout
	if schema != "" {
		cfg.ConnConfig.RuntimeParams["search_path"] = schema + ",pg_catalog"
	}
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = strconv.Itoa(stmtTimeout)
	cfg.ConnConfig.RuntimeParams["application_name"] = "pemo-go:" + name
	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	track(p, name)
	return p, nil
}

// NewModuleDB opens a module pool that connects as the module's own login.
func NewModuleDB(ctx context.Context, schema string, d DatabaseConfig, s PoolSettings) (DB, error) {
	p, err := buildPool(ctx, "module:"+schema, d, schema, s.Max, s.ConnectTimeout, s.StatementTimeoutMillis)
	if err != nil {
		return nil, err
	}
	return &handle{schema: schema, q: p, pool: p}, nil
}

// NewAdminDB opens the owner pool for migrations, seeds and tooling.
func NewAdminDB(ctx context.Context, d DatabaseConfig, s PoolSettings) (DB, error) {
	p, err := buildPool(ctx, "admin", d, "", 3, s.ConnectTimeout, s.AdminStatementTimeout)
	if err != nil {
		return nil, err
	}
	return &handle{schema: "platform", q: p, pool: p}, nil
}

// PgCode returns the SQLSTATE of a PostgreSQL error, or "".
func PgCode(err error) string {
	var pe *pgconn.PgError
	if errors.As(err, &pe) {
		return pe.Code
	}
	return ""
}

// PgConstraint returns the constraint name of a PostgreSQL error, or "".
func PgConstraint(err error) string {
	var pe *pgconn.PgError
	if errors.As(err, &pe) {
		return pe.ConstraintName
	}
	return ""
}
