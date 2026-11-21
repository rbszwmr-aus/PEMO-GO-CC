package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// The standalone demo server end to end over HTTP (no database).
func TestDemoServerHTTP(t *testing.T) {
	cfg := testConfig()
	cfg.RateLimitPerMinute = 0
	srv := httptest.NewServer(NewDemoOnly(context.Background(), cfg, ""))
	defer srv.Close()
	do := func(method, path, body string, bearer bool) (int, map[string]any) {
		req, _ := http.NewRequest(method, srv.URL+path, strings.NewReader(body))
		if body != "" {
			req.Header.Set("content-type", "application/json")
		}
		if bearer {
			req.Header.Set("authorization", "Bearer demo")
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		var m map[string]any
		_ = json.NewDecoder(res.Body).Decode(&m)
		return res.StatusCode, m
	}
	if st, _ := do("GET", "/api/management-web/v0/helpdesk/queue?demo=1", "", false); st != 401 {
		t.Fatalf("no bearer: %d", st)
	}
	st, q := do("GET", "/api/management-web/v0/helpdesk/queue?demo=1", "", true)
	if st != 200 || len(q["rows"].([]any)) != 3 {
		t.Fatalf("queue: %d %v", st, q)
	}
	if st, _ := do("POST", "/api/resident-portal/v0/tickets", `{"subject":" "}`, false); st != 400 {
		t.Fatalf("blank subject: %d", st)
	}
	st, c := do("POST", "/api/resident-portal/v0/tickets", `{"subject":"Door"}`, false)
	id := c["ticket"].(map[string]any)["id"].(string)
	if st != 201 {
		t.Fatalf("create: %d", st)
	}
	if st, _ := do("POST", "/api/management-web/v0/helpdesk/contacts/"+id+"/status", `{"status":"in_progress"}`, true); st != 200 {
		t.Fatalf("status: %d", st)
	}
	if st, _ := do("GET", "/api/resident-portal/v0/invoices", "", false); st != 401 {
		t.Fatalf("invoices need a bearer: %d", st)
	}
	if st, _ := do("GET", "/api/resident-portal/v0/invoices?status=nope", "", true); st != 400 {
		t.Fatalf("bad status filter: %d", st)
	}
	st, v := do("GET", "/api/resident-portal/v0/visitors", "", false)
	if st != 200 || v["visitors"].([]any)[0].(map[string]any)["pass"] == nil {
		t.Fatalf("visitors carry a pass: %d %v", st, v)
	}
	if st, _ := do("GET", "/nope", "", false); st != 404 {
		t.Fatalf("unknown route: %d", st)
	}
	if st, _ := do("POST", "/api/resident-portal/v0/tickets", `{"__proto__":{"x":1}}`, false); st != 400 {
		t.Fatalf("__proto__ body: %d", st)
	}
}
