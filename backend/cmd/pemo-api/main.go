// Command pemo-api is the PEMO API (Go port of apps/api).
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
	_ "time/tzdata" // IANA zones on hosts without zoneinfo (Windows)

	"pemo/internal/api"
	"pemo/internal/platform"
)

func main() {
	envFile := flag.String("env-file", "database/dev/.env", "KEY=VALUE file loaded before configuration (existing environment wins)")
	root := flag.String("root", "", "repository root (default: found by walking up from the working directory)")
	flag.Parse()
	if err := run(*envFile, *root); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(envFile, root string) error {
	if root == "" {
		r, err := platform.FindRepoRoot(".")
		if err != nil {
			return err
		}
		root = r
	}
	if !isAbs(envFile) {
		envFile = root + string(os.PathSeparator) + envFile
	}
	_ = platform.LoadEnvFile(envFile)
	if err := platform.Preflight(envFile); err != nil {
		return err
	}
	cfg, err := platform.LoadConfig()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	srv, err := api.New(ctx, cfg, root)
	if err != nil {
		return err
	}
	defer srv.Close()
	log := platform.NewLogger(cfg.LogLevel, cfg.ServiceName)
	addr := net.JoinHostPort(cfg.HTTPHost, strconv.Itoa(cfg.HTTPPort))
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return fmt.Errorf("cannot listen on %s (is the port in use by another project?): %w", addr, err)
	}
	hs := &http.Server{Handler: srv, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second,
		WriteTimeout: 60 * time.Second, IdleTimeout: 120 * time.Second, MaxHeaderBytes: 64 << 10}
	if cfg.MailWorker {
		go srv.RunMailWorker(ctx, 30*time.Second)
	}
	errc := make(chan error, 1)
	go func() { errc <- hs.Serve(ln) }()
	log.Info("pemo api listening", map[string]any{"host": cfg.HTTPHost, "port": cfg.HTTPPort, "environment": cfg.Environment,
		"demoRoutes": cfg.EnableDemoRoutes})
	select {
	case err := <-errc:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		log.Info("shutting down", map[string]any{"signal": "interrupt"})
		sctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = hs.Shutdown(sctx)
	}
	return nil
}

func isAbs(p string) bool { return len(p) > 0 && (p[0] == '/' || (len(p) > 1 && p[1] == ':')) }
