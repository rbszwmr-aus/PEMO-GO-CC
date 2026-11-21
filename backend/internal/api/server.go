package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"pemo/internal/access"
	"pemo/internal/helpdesk"
	"pemo/internal/homesafety"
	"pemo/internal/notices"
	"pemo/internal/platform"
	"pemo/internal/property"
	"pemo/internal/resident"
	"pemo/internal/strata"
)

// MaxBodyBytes is the request body limit (1 MiB, as before).
const MaxBodyBytes = 1 << 20

// Server is the composition root: one handle per module pool, every
// cross-module port bound here and nowhere else.
type Server struct {
	cfg *platform.Config
	log *platform.Logger

	devAuth   *DevAuth
	staffAuth *StaffAuth

	platformDB, propertyDB, accessDB, residentDB, homeSafetyDB platform.DB
	noticesDB, helpdeskDB, strataDB, scaffoldDB                platform.DB

	prop     *property.Property
	acc      *access.Access
	res      *resident.Resident
	hs       *homesafety.HomeSafety
	notices  *notices.Notices
	helpdesk *helpdesk.Helpdesk
	strata   *strata.Strata
	comms    CommunicationsPort

	noticeAudience *notices.AudienceResolver

	residentContract, managementContract string

	limiter  *rateLimiter
	mux      *http.ServeMux
	demo     *demoState
	demoOnly bool
}

// New wires every module to its own pool (its own login) and builds routes.
func New(ctx context.Context, cfg *platform.Config, repoRoot string) (*Server, error) {
	s := &Server{cfg: cfg, log: platform.NewLogger(cfg.LogLevel, cfg.ServiceName)}
	s.devAuth = NewDevAuth(cfg)
	s.staffAuth = &StaffAuth{s.devAuth}
	open := func(schema string) (platform.DB, error) {
		return platform.NewModuleDB(ctx, schema, cfg.ModuleDatabases[schema], cfg.DBPool)
	}
	var err error
	for _, p := range []struct {
		dst    *platform.DB
		schema string
	}{{&s.platformDB, "platform"}, {&s.propertyDB, "property"}, {&s.accessDB, "access"}, {&s.residentDB, "resident"},
		{&s.homeSafetyDB, "home_safety"}, {&s.noticesDB, "notices"}, {&s.helpdeskDB, "helpdesk"}, {&s.strataDB, "strata"},
		{&s.scaffoldDB, "dev_scaffold"}} {
		if *p.dst, err = open(p.schema); err != nil {
			return nil, fmt.Errorf("open %s pool: %w", p.schema, err)
		}
	}
	s.prop = property.New(s.propertyDB)
	s.acc = access.New(s.accessDB)
	s.res = resident.New(s.residentDB)
	s.hs = homesafety.New(s.homeSafetyDB)
	s.helpdesk = helpdesk.New(s.helpdeskDB)
	s.strata = strata.New(s.strataDB)
	s.notices = &notices.Notices{DB: s.noticesDB, VisibleLocations: func(ctx context.Context, org string, keys []string) ([]string, error) {
		return s.prop.LocationsServingNodes(ctx, org, keys)
	}}
	s.noticeAudience = &notices.AudienceResolver{
		Units: func(ctx context.Context, org string, nodes [][2]string) ([]string, error) {
			ns := make([]property.ScopeNode, len(nodes))
			for i, n := range nodes {
				ns[i] = property.ScopeNode{Kind: n[0], ID: n[1]}
			}
			e, err := s.prop.Expand(ctx, org, ns)
			return e.UnitIDs, err
		},
		Served: func(ctx context.Context, org string, ids []string) (map[string][]string, error) {
			return s.prop.ResolveServedUnitsMany(ctx, org, ids)
		},
		Occupants: func(ctx context.Context, units []string, asAt time.Time) ([]notices.Recipient, error) {
			occ, err := s.res.OccupantsOfUnits(ctx, units, asAt)
			out := make([]notices.Recipient, len(occ))
			for i, o := range occ {
				out[i] = notices.Recipient{ResidentID: o.ResidentID, HouseholdID: o.HouseholdID, UnitID: o.UnitID}
			}
			return out, err
		},
	}
	s.comms = newStrataCommunicationsAdapter(s.strata)
	if s.residentContract, err = ReadContractVersion(repoRoot, "resident-mobile"); err != nil {
		return nil, err
	}
	if s.managementContract, err = ReadContractVersion(repoRoot, "management-web"); err != nil {
		return nil, err
	}
	s.limiter = newRateLimiter(cfg.RateLimitPerMinute)
	if cfg.EnableDemoRoutes {
		s.demo = newDemoState()
	}
	s.routes()
	return s, nil
}

// Close releases every pool.
func (s *Server) Close() {
	for _, d := range s.pools() {
		d.db.Close()
	}
}

type namedPool struct {
	name string
	db   platform.DB
}

func (s *Server) pools() []namedPool {
	return []namedPool{{"platform", s.platformDB}, {"property", s.propertyDB}, {"access", s.accessDB}, {"resident", s.residentDB},
		{"home_safety", s.homeSafetyDB}, {"notices", s.noticesDB}, {"helpdesk", s.helpdeskDB}, {"strata", s.strataDB}, {"dev_scaffold", s.scaffoldDB}}
}

// ---- request plumbing ----

type ctxKey int

const correlationKey ctxKey = 0

func correlationOf(r *http.Request) string {
	if v, ok := r.Context().Value(correlationKey).(string); ok {
		return v
	}
	return ResolveCorrelationID(r.Header.Get("x-correlation-id"))
}

func isManagement(r *http.Request) bool { return strings.HasPrefix(r.URL.Path, "/api/management-web/") }

func (s *Server) writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("content-type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	b, err := marshalValue(body)
	if err != nil {
		b = []byte(`{}`)
	}
	_, _ = w.Write(b)
}

func (s *Server) sendProblem(w http.ResponseWriter, r *http.Request, p *platform.Problem) {
	w.Header().Set("content-type", "application/problem+json; charset=utf-8")
	w.WriteHeader(p.Status)
	b, _ := marshalNoEscape(orderedProblem(p.Body(correlationOf(r))))
	_, _ = w.Write(b)
}

func (s *Server) sendStaffProblem(w http.ResponseWriter, r *http.Request, p *StaffProblem) {
	w.Header().Set("content-type", "application/problem+json; charset=utf-8")
	w.WriteHeader(p.Status)
	b, _ := marshalNoEscape(orderedProblem(p.Body(correlationOf(r))))
	_, _ = w.Write(b)
}

var problemOrder = []string{"type", "title", "status", "correlationId", "detail", "residentMessage", "staffMessage", "supersededBy", "retryable"}

func orderedProblem(m map[string]any) O {
	o := O{}
	for _, k := range problemOrder {
		if v, ok := m[k]; ok {
			o = append(o, KV{k, v})
		}
	}
	return o
}

// bodyError classifies a rejected body.
type bodyError struct{ kind string } // malformed | refused | too-large

func (e *bodyError) Error() string { return "request body rejected: " + e.kind }

// readJSONBody parses a JSON body (≤ 1 MiB), refusing any __proto__ key and
// returning an empty object when there is no body.
func readJSONBody(r *http.Request) (map[string]any, error) {
	if r.Body == nil {
		return map[string]any{}, nil
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, MaxBodyBytes+1))
	if err != nil {
		return nil, &bodyError{"malformed"}
	}
	if len(raw) > MaxBodyBytes {
		return nil, &bodyError{"too-large"}
	}
	ct := r.Header.Get("content-type")
	if len(raw) == 0 {
		if strings.Contains(ct, "application/json") {
			return nil, &bodyError{"malformed"}
		}
		return map[string]any{}, nil
	}
	if !strings.Contains(strings.ToLower(ct), "application/json") {
		return nil, &bodyError{"malformed"} // Fastify refused other media types too
	}
	if hasProtoKey(raw) {
		return nil, &bodyError{"refused"}
	}
	var v any
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&v); err != nil {
		return nil, &bodyError{"malformed"}
	}
	// Exactly one JSON value: `{}}` or `{"a":1}]` is malformed, as JSON.parse says.
	// (dec.More() is false before a stray `}` or `]`, so it cannot be the check.)
	if _, err := dec.Token(); err != io.EOF {
		return nil, &bodyError{"malformed"}
	}
	m, ok := v.(map[string]any)
	if !ok {
		return map[string]any{"__nonObject": v}, nil
	}
	return m, nil
}

// hasProtoKey reports whether any object key, at any depth and however
// escaped, is "__proto__" (prototype-pollution guard; values may contain it).
func hasProtoKey(raw []byte) bool {
	type frame struct{ obj, wantKey bool }
	dec := json.NewDecoder(bytes.NewReader(raw))
	var st []frame
	valueDone := func() {
		if n := len(st); n > 0 && st[n-1].obj {
			st[n-1].wantKey = true
		}
	}
	for {
		t, err := dec.Token()
		if err != nil {
			return false
		}
		if n := len(st); n > 0 && st[n-1].obj && st[n-1].wantKey {
			if k, ok := t.(string); ok {
				if k == "__proto__" {
					return true
				}
				st[n-1].wantKey = false
				continue
			}
		}
		switch v := t.(type) {
		case json.Delim:
			switch v {
			case '{':
				st = append(st, frame{true, true})
			case '[':
				st = append(st, frame{false, false})
			default:
				st = st[:len(st)-1]
				valueDone()
			}
		default:
			valueDone()
		}
	}
}

func (s *Server) bodyProblem(w http.ResponseWriter, r *http.Request, kind string) {
	mgmt := isManagement(r)
	switch kind {
	case "too-large":
		if mgmt {
			s.sendStaffProblem(w, r, staffProblems.RequestTooLarge())
		} else {
			s.sendProblem(w, r, problems.RequestTooLarge())
		}
	case "refused":
		if mgmt {
			s.sendStaffProblem(w, r, staffProblems.Refused())
		} else {
			s.sendProblem(w, r, problems.Refused())
		}
	default:
		if mgmt {
			s.sendStaffProblem(w, r, staffProblems.BadRequest(platform.LocalizedText{En: "The request body could not be read.", ZhHant: "無法讀取請求內容。"}))
		} else {
			s.sendProblem(w, r, problems.BadRequest("the request body could not be read"))
		}
	}
	s.log.Warn("request body was rejected", map[string]any{"correlationId": correlationOf(r), "route": trunc(r.URL.Path, 120), "kind": kind})
}

func trunc(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// handler adapts a route function: it parses the body once and turns a
// body error into the right problem.
type routeFunc func(w http.ResponseWriter, r *http.Request, body map[string]any)

func (s *Server) handle(method, pattern string, fn routeFunc) {
	s.mux.HandleFunc(method+" "+pattern, func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if method == http.MethodPost || method == http.MethodPut || method == http.MethodPatch {
			b, err := readJSONBody(r)
			var be *bodyError
			if errors.As(err, &be) {
				s.bodyProblem(w, r, be.kind)
				return
			}
			body = b
		}
		if body == nil {
			body = map[string]any{}
		}
		fn(w, r, body)
	})
}

// ServeHTTP runs the edge middleware: correlation id, security headers,
// CORS allow-list, rate limit, panic recovery and the 404 problem.
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	cid := ResolveCorrelationID(r.Header.Get("x-correlation-id"))
	r = r.WithContext(context.WithValue(r.Context(), correlationKey, cid))
	h := w.Header()
	// Security headers (review S4). The API serves JSON only.
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
	h.Set("Cache-Control", "no-store")
	if origin := r.Header.Get("Origin"); origin != "" && s.originAllowed(origin) {
		h.Set("Access-Control-Allow-Origin", origin)
		h.Set("Vary", "Origin")
		h.Set("Access-Control-Allow-Headers", "authorization, content-type, idempotency-key, if-match, accept-language, x-correlation-id")
		h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}
	if len(r.URL.Path) > 2048 {
		s.sendProblem(w, r, problems.EventNotFound())
		return
	}
	if !isProbe(r) && !s.limiter.allow(s.clientKey(r)) {
		w.Header().Set("Retry-After", "60")
		if isManagement(r) {
			s.sendStaffProblem(w, r, staffProblems.TooManyRequests())
		} else {
			s.sendProblem(w, r, problems.TooManyRequests())
		}
		return
	}
	defer func() {
		if rec := recover(); rec != nil {
			s.log.Error("unhandled request failure", map[string]any{"correlationId": cid, "route": r.URL.Path, "method": r.Method, "error": fmt.Sprint(rec)})
			if isManagement(r) {
				s.sendStaffProblem(w, r, staffProblems.InternalError())
			} else {
				s.sendProblem(w, r, problems.InternalError())
			}
		}
	}()
	if _, pattern := s.mux.Handler(r); pattern == "" {
		s.sendProblem(w, r, problems.EventNotFound())
		return
	}
	s.mux.ServeHTTP(w, r)
}

func (s *Server) originAllowed(origin string) bool {
	for _, o := range s.cfg.AllowedOrigins {
		if o == origin || o == "*" {
			return true
		}
	}
	return false
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// isProbe: liveness and readiness are never rate limited (a busy UI must not
// make a load balancer think the API is down).
func isProbe(r *http.Request) bool { return r.URL.Path == "/health" || r.URL.Path == "/ready" }

// clientKey is the rate-limit bucket for a request. A request from a trusted
// proxy (PEMO_TRUSTED_PROXIES, default loopback: the Vite dev proxies) is keyed
// by the client it names in X-Forwarded-For; X-Forwarded-For from anyone else
// is ignored, so it cannot be used to dodge the limit. A trusted proxy that
// names no client (Vite does not add the header) is keyed by its own address
// plus the bearer credential, so users behind one proxy do not share a bucket.
func (s *Server) clientKey(r *http.Request) string {
	ip := clientIP(r)
	if !s.trustedProxy(ip) {
		return ip
	}
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		for i := len(parts) - 1; i >= 0; i-- {
			if c := strings.TrimSpace(parts[i]); c != "" && !s.trustedProxy(c) {
				return c
			}
		}
	}
	if auth := r.Header.Get("authorization"); auth != "" {
		return ip + "|" + platform.DeriveRequestFingerprint(auth)
	}
	return ip
}

func (s *Server) trustedProxy(ip string) bool {
	addr := net.ParseIP(ip)
	if addr == nil {
		return false
	}
	if len(s.cfg.TrustedProxies) == 0 {
		return addr.IsLoopback()
	}
	for _, n := range s.cfg.TrustedProxies {
		if n.Contains(addr) {
			return true
		}
	}
	return false
}

// ---- rate limiting (review S3) ----

type rateLimiter struct {
	perMinute int
	mu        sync.Mutex
	buckets   map[string]*bucket
}

type bucket struct {
	tokens float64
	last   time.Time
}

func newRateLimiter(perMinute int) *rateLimiter {
	return &rateLimiter{perMinute: perMinute, buckets: map[string]*bucket{}}
}

func (l *rateLimiter) allow(key string) bool {
	if l.perMinute <= 0 {
		return true
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	b, ok := l.buckets[key]
	if !ok {
		if len(l.buckets) > 100_000 {
			l.buckets = map[string]*bucket{}
		}
		b = &bucket{tokens: float64(l.perMinute), last: now}
		l.buckets[key] = b
	}
	b.tokens += now.Sub(b.last).Minutes() * float64(l.perMinute)
	if b.tokens > float64(l.perMinute) {
		b.tokens = float64(l.perMinute)
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}
