// Package mcp is the PEMO management read MCP server (Go port of
// apps/mcp-server): JSON-RPC over HTTP (+SSE) and stdio, fixture or live mode.
// It never imports a domain module; live mode reads the PEMO API over HTTP.
package mcp

import (
	"bufio"
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"crypto/rand"
)

//go:embed fixtures.json
var fixturesRaw []byte

var fixtures struct {
	Health     json.RawMessage `json:"health"`
	ScopeTree  json.RawMessage `json:"scopeTree"`
	Households json.RawMessage `json:"households"`
	Notices    json.RawMessage `json:"notices"`
	Charges    json.RawMessage `json:"charges"`
}

func init() {
	if err := json.Unmarshal(fixturesRaw, &fixtures); err != nil {
		panic(err)
	}
}

// Config is the MCP server configuration.
type Config struct {
	Mode       string // fixture | live
	APIBaseURL string
	HTTPHost   string
	HTTPPort   int
	StaffToken string
}

// LoadConfig reads PEMO_MCP_* from the environment.
func LoadConfig() (Config, error) {
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("PEMO_MCP_MODE")))
	if mode != "live" {
		mode = "fixture"
	}
	portRaw := os.Getenv("PEMO_MCP_PORT")
	if portRaw == "" {
		portRaw = "23284"
	}
	port, err := strconv.Atoi(portRaw)
	// Ports other projects own (ParkCore, Smart Toilet, the Node stack).
	stolen := map[int]bool{3100: true, 3200: true, 3201: true, 3210: true, 3300: true, 5173: true, 5174: true, 5175: true, 5176: true,
		5177: true, 5179: true, 5185: true, 5186: true, 5432: true, 18120: true, 18121: true, 55432: true, 55433: true, 55434: true}
	if err != nil || port <= 0 || port > 65535 || stolen[port] {
		return Config{}, fmt.Errorf("PEMO_MCP_PORT must be a positive integer and must not steal another project's port (got %s)", portRaw)
	}
	base := os.Getenv("PEMO_API_BASE_URL")
	if base == "" {
		base = "http://127.0.0.1:23280"
	}
	host := os.Getenv("PEMO_MCP_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	return Config{mode, strings.TrimRight(base, "/"), host, port, os.Getenv("PEMO_STAFF_TOKEN")}, nil
}

// ---- data source ----

type envelope struct {
	Mode            string          `json:"mode"`
	Source          string          `json:"source"`
	LiveUnavailable bool            `json:"liveUnavailable"`
	Reason          *string         `json:"reason"`
	Data            json.RawMessage `json:"data"`
}

type outcome struct {
	env    *envelope
	status int
	body   any
}

const (
	liveHouseholdsReason = "No live households list on management-web v0 freeze (see docs/contracts/proposed-households-read-ops.md). Serving MCP fixture."
	liveChargesReason    = "No live charges/finance GET on management-web v0 freeze. Serving MCP fixture. ParkCore parking fees stay out of this MCP."
)

func fixture(source string, data json.RawMessage, unavailable bool, reason string) outcome {
	var r *string
	if reason != "" {
		r = &reason
	}
	return outcome{env: &envelope{"fixture", "apps/mcp-server fixtures: " + source, unavailable, r, data}}
}

type source struct {
	cfg    Config
	token  string
	client *http.Client
}

func (s *source) liveGet(ctx context.Context, path string) outcome {
	url := s.cfg.APIBaseURL + path
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token)
	resp, err := s.client.Do(req)
	if err != nil {
		return outcome{status: 503, body: map[string]any{"type": "https://pemo.local/problems/internal-error", "title": "PEMO API unreachable", "status": 503, "detail": err.Error()}}
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	var body any = json.RawMessage(b)
	if !json.Valid(b) {
		body = map[string]any{"status": resp.StatusCode, "title": "non-json body"}
		b, _ = json.Marshal(body)
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return outcome{status: resp.StatusCode, body: body}
	}
	return outcome{env: &envelope{"live", "GET " + url, false, nil, b}}
}

func (s *source) call(ctx context.Context, tool string) outcome {
	live := s.cfg.Mode == "live"
	switch tool {
	case "pemo.get_health":
		if live {
			return s.liveGet(ctx, "/health")
		}
		return fixture("health", fixtures.Health, false, "")
	case "pemo.get_scope_tree":
		if live {
			return s.liveGet(ctx, "/api/management-web/v0/scope")
		}
		return fixture("scope-tree", fixtures.ScopeTree, false, "")
	case "pemo.list_notices":
		if live {
			return s.liveGet(ctx, "/api/management-web/v0/notices")
		}
		return fixture("notices", fixtures.Notices, false, "")
	case "pemo.list_households":
		if live {
			return fixture("households", fixtures.Households, true, liveHouseholdsReason)
		}
		return fixture("households", fixtures.Households, false, "")
	case "pemo.list_charges":
		// The Go API serves GET /strata/charges; the Node MCP never read it.
		if live {
			return s.liveGet(ctx, "/api/management-web/v0/strata/charges")
		}
		return fixture("charges", fixtures.Charges, false, "")
	}
	return outcome{status: 404, body: map[string]any{"title": "Unknown tool", "name": tool}}
}

var _ = liveChargesReason

// ---- tools ----

type toolDef struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
}

func emptyInput() map[string]any {
	return map[string]any{"type": "object", "properties": map[string]any{}, "additionalProperties": false}
}

var Tools = []toolDef{
	{"pemo.get_health", "PEMO API liveness (GET /health). Envelope.mode is fixture or live.", emptyInput()},
	{"pemo.get_scope_tree", "Staff scope tree this principal may address (GET /api/management-web/v0/scope when live).", emptyInput()},
	{"pemo.list_households", "Household list for the demo estate. Live API is not on v0 freeze — fixture with liveUnavailable when mode=live.", emptyInput()},
	{"pemo.list_notices", "Staff notice list (GET /api/management-web/v0/notices when live).", emptyInput()},
	{"pemo.list_charges", "Management-fee charges (GET /api/management-web/v0/strata/charges when live). ParkCore parking fees are not included.", emptyInput()},
}

// ---- JSON-RPC ----

const (
	ProtocolVersion = "2024-11-05"
	ServerName      = "pemo-mcp"
	ServerVersion   = "0.1.0"
)

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

type response struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

var bearerRe = regexp.MustCompile(`(?i)^Bearer\s+(\S+)`)

func validID(raw json.RawMessage) bool {
	if raw == nil {
		return false
	}
	t := bytes.TrimSpace(raw)
	if string(t) == "null" {
		return true
	}
	var s string
	if json.Unmarshal(t, &s) == nil {
		return true
	}
	var f float64
	return json.Unmarshal(t, &f) == nil
}

func toolResult(id json.RawMessage, payload any, isErr bool) *response {
	b, _ := json.Marshal(payload)
	return &response{JSONRPC: "2.0", ID: id, Result: map[string]any{"content": []map[string]any{{"type": "text", "text": string(b)}}, "isError": isErr}}
}

// Handle answers one raw JSON-RPC message; nil means "no reply" (a notification).
func Handle(ctx context.Context, raw json.RawMessage, authorization string, cfg Config, client *http.Client) *response {
	var msg map[string]json.RawMessage
	null := json.RawMessage("null")
	if err := json.Unmarshal(raw, &msg); err != nil || msg == nil {
		return &response{JSONRPC: "2.0", ID: null, Error: &rpcError{Code: -32600, Message: "invalid request"}}
	}
	var version, method string
	_ = json.Unmarshal(msg["jsonrpc"], &version)
	idRaw, hasID := msg["id"]
	if version != "2.0" || json.Unmarshal(msg["method"], &method) != nil {
		id := null
		if hasID && validID(idRaw) {
			id = idRaw
		}
		return &response{JSONRPC: "2.0", ID: id, Error: &rpcError{Code: -32600, Message: "invalid request"}}
	}
	notification := !hasID
	id := null
	if hasID && validID(idRaw) {
		id = idRaw
	}
	noAuth := method == "initialize" || method == "notifications/initialized" || method == "ping"
	m := bearerRe.FindStringSubmatch(strings.TrimSpace(authorization))
	if !noAuth && !notification && m == nil {
		return &response{JSONRPC: "2.0", ID: id, Error: &rpcError{-32001, "unauthorized: Authorization Bearer staff token required",
			map[string]any{"status": 401, "type": "https://pemo.local/problems/invalid-credential", "title": "Missing staff Bearer token"}}}
	}
	token := ""
	if m != nil {
		token = m[1]
	}
	switch method {
	case "initialize":
		return &response{JSONRPC: "2.0", ID: id, Result: map[string]any{"protocolVersion": ProtocolVersion,
			"capabilities": map[string]any{"tools": map[string]any{"listChanged": false}},
			"serverInfo":   map[string]any{"name": ServerName, "version": ServerVersion},
			"instructions": "PEMO management read MCP v0. Isolated from ParkCore. Dual-buy: attach ParkCore MCP separately. Staff Bearer required for tools."}}
	case "notifications/initialized":
		return nil
	case "ping":
		return &response{JSONRPC: "2.0", ID: id, Result: map[string]any{}}
	case "tools/list":
		return &response{JSONRPC: "2.0", ID: id, Result: map[string]any{"tools": Tools}}
	case "tools/call":
		var p struct {
			Name *string `json:"name"`
		}
		if json.Unmarshal(msg["params"], &p) != nil || p.Name == nil {
			return &response{JSONRPC: "2.0", ID: id, Error: &rpcError{Code: -32602, Message: "invalid params: name required"}}
		}
		known := false
		for _, t := range Tools {
			known = known || t.Name == *p.Name
		}
		if !known {
			return toolResult(id, map[string]any{"title": "Unknown tool", "name": *p.Name}, true)
		}
		o := (&source{cfg, token, client}).call(ctx, *p.Name)
		if o.env == nil {
			return toolResult(id, o.body, true)
		}
		return toolResult(id, o.env, false)
	case "resources/list":
		return &response{JSONRPC: "2.0", ID: id, Result: map[string]any{"resources": []any{}}}
	case "prompts/list":
		return &response{JSONRPC: "2.0", ID: id, Result: map[string]any{"prompts": []any{}}}
	}
	if notification {
		return nil
	}
	return &response{JSONRPC: "2.0", ID: id, Error: &rpcError{Code: -32601, Message: "method not found: " + method}}
}

// ---- HTTP (+SSE) ----

type Server struct {
	cfg      Config
	client   *http.Client
	mu       sync.Mutex
	sessions map[string]chan []byte
}

func NewServer(cfg Config) *Server {
	return &Server{cfg: cfg, client: &http.Client{Timeout: 15 * time.Second}, sessions: map[string]chan []byte{}}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	b, _ := json.Marshal(v)
	w.Header().Set("content-type", "application/json; charset=utf-8")
	w.Header().Set("content-length", strconv.Itoa(len(b)))
	w.WriteHeader(status)
	_, _ = w.Write(b)
}

func uuid() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6], b[8] = b[6]&0x0f|0x40, b[8]&0x3f|0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/health":
		writeJSON(w, 200, map[string]any{"status": "ok", "service": ServerName, "mode": s.cfg.Mode, "port": s.cfg.HTTPPort})
	case r.Method == http.MethodGet && r.URL.Path == "/sse":
		fl, ok := w.(http.Flusher)
		if !ok {
			writeJSON(w, 500, map[string]any{"title": "streaming unsupported"})
			return
		}
		id := uuid()
		ch := make(chan []byte, 16)
		s.mu.Lock()
		s.sessions[id] = ch
		s.mu.Unlock()
		defer func() { s.mu.Lock(); delete(s.sessions, id); s.mu.Unlock() }()
		w.Header().Set("content-type", "text/event-stream")
		w.Header().Set("cache-control", "no-cache")
		w.Header().Set("connection", "keep-alive")
		w.WriteHeader(200)
		fmt.Fprintf(w, "event: endpoint\ndata: /messages?sessionId=%s\n\n", id)
		fl.Flush()
		for {
			select {
			case <-r.Context().Done():
				return
			case m := <-ch:
				fmt.Fprintf(w, "event: message\ndata: %s\n\n", m)
				fl.Flush()
			}
		}
	case r.Method == http.MethodPost && (r.URL.Path == "/mcp" || r.URL.Path == "/messages"):
		s.mu.Lock()
		sse := s.sessions[r.URL.Query().Get("sessionId")]
		s.mu.Unlock()
		raw, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
		if err != nil || (len(bytes.TrimSpace(raw)) > 0 && !json.Valid(raw)) {
			writeJSON(w, 400, map[string]any{"jsonrpc": "2.0", "id": nil, "error": map[string]any{"code": -32700, "message": "parse error"}})
			return
		}
		if len(bytes.TrimSpace(raw)) == 0 {
			raw = []byte("null")
		}
		resp := Handle(r.Context(), raw, r.Header.Get("authorization"), s.cfg, s.client)
		if sse != nil {
			if resp != nil {
				b, _ := json.Marshal(resp)
				select {
				case sse <- b:
				default:
				}
			}
			w.WriteHeader(202)
			return
		}
		if resp == nil {
			w.WriteHeader(202)
			return
		}
		status := 200
		if resp.Error != nil && resp.Error.Code == -32001 {
			status = 401
		}
		writeJSON(w, status, resp)
	default:
		writeJSON(w, 404, map[string]any{"title": "not found", "path": r.URL.Path})
	}
}

// ---- stdio (Content-Length framing) ----

var errFrame = errors.New("stdio frame missing Content-Length")

// ServeStdio reads framed messages from in and writes framed replies to out.
func ServeStdio(ctx context.Context, cfg Config, in io.Reader, out io.Writer) error {
	auth := strings.TrimSpace(cfg.StaffToken)
	if auth != "" && !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		auth = "Bearer " + auth
	}
	client := &http.Client{Timeout: 15 * time.Second}
	br := bufio.NewReader(in)
	for {
		length := -1
		for {
			line, err := br.ReadString('\n')
			if err != nil {
				if errors.Is(err, io.EOF) {
					return nil
				}
				return err
			}
			line = strings.TrimRight(line, "\r\n")
			if line == "" {
				break
			}
			if k, v, ok := strings.Cut(line, ":"); ok && strings.EqualFold(strings.TrimSpace(k), "content-length") {
				length, _ = strconv.Atoi(strings.TrimSpace(v))
			}
		}
		if length < 0 {
			return errFrame
		}
		body := make([]byte, length)
		if _, err := io.ReadFull(br, body); err != nil {
			return err
		}
		resp := Handle(ctx, body, auth, cfg, client)
		if resp != nil {
			b, _ := json.Marshal(resp)
			fmt.Fprintf(out, "Content-Length: %d\r\n\r\n%s", len(b), b)
		}
	}
}
