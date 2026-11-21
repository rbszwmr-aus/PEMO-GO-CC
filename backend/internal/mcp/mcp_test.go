package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestJSONRPC(t *testing.T) {
	cfg := Config{Mode: "fixture"}
	call := func(body, auth string) *response {
		return Handle(context.Background(), json.RawMessage(body), auth, cfg, http.DefaultClient)
	}
	if r := call(`{"jsonrpc":"2.0","id":1,"method":"initialize"}`, ""); r.Error != nil {
		t.Fatal("initialize needs no token")
	}
	if r := call(`{"jsonrpc":"2.0","id":2,"method":"tools/list"}`, ""); r.Error == nil || r.Error.Code != -32001 {
		t.Fatal("tools need a staff bearer")
	}
	r := call(`{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"pemo.list_charges"}}`, "Bearer x")
	b, _ := json.Marshal(r.Result)
	if !strings.Contains(string(b), `\"mode\":\"fixture\"`) {
		t.Fatalf("fixture envelope: %s", b)
	}
	if r := call(`{"jsonrpc":"2.0","method":"notifications/initialized"}`, ""); r != nil {
		t.Fatal("notifications get no reply")
	}
	if r := call(`{"id":4}`, ""); r.Error == nil || r.Error.Code != -32600 {
		t.Fatal("invalid request")
	}
	if r := call(`{"jsonrpc":"2.0","id":5,"method":"nope"}`, "Bearer x"); r.Error.Code != -32601 {
		t.Fatal("method not found")
	}
}

func TestStdioFraming(t *testing.T) {
	msg := `{"jsonrpc":"2.0","id":1,"method":"ping"}`
	in := strings.NewReader("Content-Length: " + itoa(len(msg)) + "\r\n\r\n" + msg)
	var out bytes.Buffer
	if err := ServeStdio(context.Background(), Config{Mode: "fixture"}, in, &out); err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out.String(), "Content-Length: ") || !strings.Contains(out.String(), `"result":{}`) {
		t.Fatalf("got %q", out.String())
	}
}

func itoa(n int) string { b, _ := json.Marshal(n); return string(b) }
