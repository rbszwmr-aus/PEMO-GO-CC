import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type ProxyOptions } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// @pemo/tickets-demo-store is Vite-aliased only — not a package.json dependency.
// Help desk demo paths always proxy to the Go demo server :23283 (or PEMO_LIVE_BASE_URL) so assign/
// status round-trip shares the API in-memory store. Broader live reads still
// require PEMO_LIVE_BASE_URL for scope/tree/strata/notices.

function liveProxy(): Record<string, ProxyOptions> | undefined {
  const target = process.env['PEMO_LIVE_BASE_URL'];
  if (!target) return undefined;
  const to: ProxyOptions = { target, changeOrigin: true };
  return {
    '/api/management-web/v0/scope': to,
    '/api/management-web/v0/properties/tree': to,
    // Help desk reads — allowlisted; Backend 200 proved @ 96caed2 (live wire is UI chrome; normalized in helpdesk-live.ts).
    '/api/management-web/v0/helpdesk/queue': to,
    '/api/management-web/v0/helpdesk/contacts': to,
    '/api/management-web/v0/helpdesk/portal-tickets': to,
    '/api/management-web/v0/strata': to,
    '/api/management-web/v0/notices': to,
    '/api/management-web/v0/admin/email': to,
  };
}

function ticketsDemoProxy(): Record<string, ProxyOptions> {
  const target = process.env['PEMO_LIVE_BASE_URL'] ?? process.env['PEMO_DEMO_BASE_URL'] ?? 'http://127.0.0.1:23283';
  const to: ProxyOptions = { target, changeOrigin: true };
  return {
    '/api/management-web/v0/helpdesk/queue': to,
    '/api/management-web/v0/helpdesk/contacts': to,
    '/api/management-web/v0/helpdesk/portal-tickets': to,
    // QR pass demo verify (Backend feat/qr-pass-v0-visitor).
    '/api/demo/qr-pass': to,
    // Front counter: always proxied to the demo server (or PEMO_LIVE_BASE_URL) so ?source=live works the moment Backend restarts it.
    '/api/management-web/v0/front-counter': to,
    // Managed lookup lists (Backend feat/front-counter-visitors): read and admin CRUD.
    '/api/management-web/v0/lookups': to,
    '/api/management-web/v0/admin/lookups': to,
    '/api/management-web/v0/admin/audit-log': to,
    // Integration status (Backend feat/s05-integration-status): the Hub's reports as PEMO reads them.
    '/api/management-web/v0/integration-status': to,
  };
}

export default defineConfig((_env) => {
  const proxy = { ...ticketsDemoProxy(), ...(liveProxy() ?? {}) };
  const toolbar = process.env['PEMO_DEV_TOOLBAR'] === '1';
  return {
    esbuild: { jsx: 'automatic' },
    define: { __PEMO_DEV_TOOLBAR__: JSON.stringify(toolbar) },
    resolve: {
      alias: {
        '@pemo/tickets-demo-store': path.resolve(
          rootDir,
          '../../packages/tickets-demo-store/src/index.ts',
        ),
      },
    },
    build: { outDir: 'dist', sourcemap: true },
    server: {
      host: '0.0.0.0',
      // 23281: clear of the Node build's 5175 and every other project's ports.
      port: 23281,
      strictPort: true,
      // A repo on a Windows drive under WSL (/mnt/<drive>) gets no file-change events, so edits made from
      // Windows never reach the dev server. Poll there; everywhere else keep native watching.
      watch: process.cwd().startsWith('/mnt/') ? { usePolling: true, interval: 500 } : undefined,
      proxy,
    },
    preview: { proxy, host: '127.0.0.1' },
  };
});
