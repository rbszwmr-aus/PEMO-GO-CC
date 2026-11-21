// Command pemo-demo is the standalone in-memory demo server (no database):
// help-desk tickets, invoices, notices and visitors, and QR passes. It is the
// Go port of apps/api/src/demo/tickets-demo-server.ts.
package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"
	_ "time/tzdata" // IANA zones on hosts without zoneinfo (Windows)

	"pemo/internal/api"
	"pemo/internal/platform"
)

func main() {
	port := 23283
	if v := os.Getenv("PEMO_DEMO_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n < 65536 {
			port = n
		}
	}
	host := os.Getenv("PEMO_DEMO_HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	loc, err := time.LoadLocation("Asia/Hong_Kong")
	if err != nil {
		loc = time.FixedZone("HKT", 8*3600)
	}
	cfg := &platform.Config{ServiceName: "pemo-demo", LogLevel: "info", TimeZone: loc, RateLimitPerMinute: 600,
		Environment: "development", AllowedOrigins: []string{"http://127.0.0.1:23281", "http://127.0.0.1:23282", "http://localhost:23281", "http://localhost:23282"}}
	root, _ := platform.FindRepoRoot(".")
	srv := api.NewDemoOnly(context.Background(), cfg, root)
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot listen on %s (is the port in use by another project?): %v\n", addr, err)
		os.Exit(1)
	}
	fmt.Printf("pemo demo listening host=%s port=%d (in-memory, no DB)\n", host, port)
	hs := &http.Server{Handler: srv, ReadHeaderTimeout: 10 * time.Second}
	if err := hs.Serve(ln); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
