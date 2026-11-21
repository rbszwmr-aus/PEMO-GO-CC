package api

import (
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"pemo/internal/platform"
	"strings"
	"testing"
	"time"
)

func TestOrderedJSONKeepsOrderAndDoesNotEscapeHTML(t *testing.T) {
	b, err := marshalValue(obj("z", 1, "a", "<b>&</b>", "m", obj("y", nil, "x", []int{1})))
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != `{"z":1,"a":"<b>&</b>","m":{"y":null,"x":[1]}}` {
		t.Fatalf("got %s", b)
	}
	ts := time.Date(2026, 8, 13, 2, 0, 0, 5e6, time.UTC)
	b, _ = marshalValue(obj("t", ts))
	if string(b) != `{"t":"2026-08-13T02:00:00.005Z"}` {
		t.Fatalf("time: %s", b)
	}
}

func TestProtoKeyGuardChecksKeysOnly(t *testing.T) {
	cases := map[string]bool{
		`{"__proto__":{}}`:                      true,
		`{"a":{"b":[{"__proto__":1}]}}`:         true,
		`{"__proto__":1}`:                       true,
		`{"a":"__proto__"}`:                     false,
		`{"a":["__proto__",{"k":"__proto__"}]}`: false,
		`[1,2]`:                                 false,
	}
	for in, want := range cases {
		if got := hasProtoKey([]byte(in)); got != want {
			t.Errorf("%s: got %v", in, got)
		}
	}
}

func TestFormatLocal(t *testing.T) {
	hk, _ := time.LoadLocation("Asia/Hong_Kong")
	at := time.Date(2026, 8, 12, 1, 56, 0, 0, time.UTC)
	if got := FormatLocal(at, hk); got != "2026-08-12T09:56:00+08:00" {
		t.Fatal(got)
	}
	if got := FormatLocal(at.Add(7*time.Millisecond), hk); got != "2026-08-12T09:56:00.007+08:00" {
		t.Fatal(got)
	}
}

func TestCorrelationIDMustBeUUID(t *testing.T) {
	if ResolveCorrelationID("1a2b3c4d-0000-4000-8000-00000000ffff") != "1a2b3c4d-0000-4000-8000-00000000ffff" {
		t.Fatal("valid id replaced")
	}
	for _, bad := range []string{"", "x", "<script>", strings.Repeat("a", 500)} {
		if got := ResolveCorrelationID(bad); got == bad {
			t.Fatalf("%q echoed back", bad)
		}
	}
}

func TestRateLimiter(t *testing.T) {
	l := newRateLimiter(3)
	for i := 0; i < 3; i++ {
		if !l.allow("ip") {
			t.Fatal("refused inside the budget")
		}
	}
	if l.allow("ip") {
		t.Fatal("allowed over the budget")
	}
	if !l.allow("other") {
		t.Fatal("budgets are per client")
	}
	if !newRateLimiter(0).allow("ip") {
		t.Fatal("0 disables")
	}
}

func TestTransportErrorClassification(t *testing.T) {
	if classifyTransportError(&textproto.Error{Code: 550, Msg: "no such user"}) != "failed" {
		t.Fatal("5xx refusal is failed")
	}
	if classifyTransportError(&errBeforeData{&net.OpError{Op: "dial", Err: errors.New("refused")}}) != "failed" {
		t.Fatal("dial failure is failed")
	}
	if classifyTransportError(errors.New("connection reset after DATA")) != "unknown" {
		t.Fatal("after DATA is unknown, never re-sent")
	}
}

func TestDevTokens(t *testing.T) {
	cfg := testConfig()
	a := NewDevAuth(cfg)
	now := time.Now()
	tok := a.Issue("res_x", now)
	if sub, f := a.Verify("Bearer "+tok, now); f != "" || sub != "res_x" {
		t.Fatalf("verify: %q %q", sub, f)
	}
	if _, f := a.Verify("Bearer "+tok, now.Add(2*time.Hour)); f != "expired" {
		t.Fatalf("expiry: %q", f)
	}
	if _, f := a.Verify("Bearer "+a.Issue("res_x", now.Add(10*time.Minute)), now); f == "" {
		t.Fatal("a token from the future must be refused")
	}
	if _, f := a.Verify("Bearer "+tok[:len(tok)-2]+"xx", now); f == "" {
		t.Fatal("tampered signature accepted")
	}
	st := NewStaffAuth(a)
	if _, f := st.Verify("Bearer "+tok, now); f == "" {
		t.Fatal("a resident token must not open staff routes")
	}
}

func testConfig() *platform.Config {
	hk, _ := time.LoadLocation("Asia/Hong_Kong")
	return &platform.Config{Environment: "development", DevTokenSecret: "test-secret", DevTokenTTLSeconds: 3600, TimeZone: hk, ServiceName: "t", LogLevel: "error"}
}

// Review finding 5: exactly one JSON value per body.
func TestBodyMustBeExactlyOneJSONValue(t *testing.T) {
	for in, ok := range map[string]bool{`{}`: true, `{"a":1}`: true, " {\"a\":1} \n": true, `{}}`: false, `{"a":1}]`: false, `{} {}`: false} {
		req := httptest.NewRequest("POST", "/x", strings.NewReader(in))
		req.Header.Set("content-type", "application/json")
		_, err := readJSONBody(req)
		if (err == nil) != ok {
			t.Errorf("%q: err=%v", in, err)
		}
	}
}

// Review finding 3: probes are never limited; proxied users get their own bucket;
// X-Forwarded-For is only believed from a trusted proxy.
func TestRateLimitKeys(t *testing.T) {
	s := &Server{cfg: testConfig()}
	req := func(remote, xff, auth string) *http.Request {
		r := httptest.NewRequest("GET", "/api/x", nil)
		r.RemoteAddr = remote
		if xff != "" {
			r.Header.Set("X-Forwarded-For", xff)
		}
		if auth != "" {
			r.Header.Set("authorization", auth)
		}
		return r
	}
	if s.clientKey(req("203.0.113.9:1", "198.51.100.1", "")) != "203.0.113.9" {
		t.Fatal("X-Forwarded-For from an untrusted address must be ignored")
	}
	if s.clientKey(req("127.0.0.1:1", "198.51.100.1", "")) != "198.51.100.1" {
		t.Fatal("a loopback proxy's client must be used")
	}
	if s.clientKey(req("127.0.0.1:1", "", "Bearer a")) == s.clientKey(req("127.0.0.1:1", "", "Bearer b")) {
		t.Fatal("two users behind the dev proxy must not share a bucket")
	}
	if !isProbe(httptest.NewRequest("GET", "/ready", nil)) {
		t.Fatal("/ready is a probe")
	}
}
