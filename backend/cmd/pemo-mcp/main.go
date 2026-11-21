// Command pemo-mcp is the PEMO management read MCP server.
//
//	pemo-mcp          HTTP (+SSE) on PEMO_MCP_HOST:PEMO_MCP_PORT (default 127.0.0.1:23284)
//	pemo-mcp -stdio   Content-Length framed stdio (staff Bearer from PEMO_STAFF_TOKEN)
package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"pemo/internal/mcp"
)

func main() {
	stdio := flag.Bool("stdio", false, "serve over stdin/stdout instead of HTTP")
	flag.Parse()
	cfg, err := mcp.LoadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if *stdio {
		fmt.Fprintf(os.Stderr, "pemo-mcp stdio mode=%s (staff Bearer via PEMO_STAFF_TOKEN)\n", cfg.Mode)
		if err := mcp.ServeStdio(ctx, cfg, os.Stdin, os.Stdout); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	addr := net.JoinHostPort(cfg.HTTPHost, strconv.Itoa(cfg.HTTPPort))
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot listen on %s (is the port in use by another project?): %v\n", addr, err)
		os.Exit(1)
	}
	hs := &http.Server{Handler: mcp.NewServer(cfg), ReadHeaderTimeout: 10 * time.Second}
	go func() { <-ctx.Done(); _ = hs.Close() }()
	fmt.Fprintf(os.Stderr, "pemo-mcp listening http://%s mode=%s (ParkCore MCP is separate; do not bind 3300)\n", addr, cfg.Mode)
	if err := hs.Serve(ln); err != nil && err != http.ErrServerClosed {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
