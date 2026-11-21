import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type ProxyOptions } from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// No @vitejs/plugin-react: it costs 48 packages, almost all Babel, and buys
// Fast Refresh. esbuild compiles JSX with the automatic runtime on its own.
//
// __PEMO_DEV_TOOLBAR__ is the BUILD-TIME exclusion for the screen/state pickers.
// `command === 'serve'` is true for the dev server and false for `vite build`,
// so the production bundle receives the literal `false`, the branch folds, and
// src/shell/DevStateToolbar.tsx becomes unreferenced and is tree-shaken out.
// Nothing in the artefact decides this at run time ??see that file, and
// test/artefact/dev-affordance-excluded.test.ts, which asserts it over the output.

function ticketsDemoProxy(): Record<string, ProxyOptions> {
  const target = process.env['PEMO_LIVE_BASE_URL'] ?? process.env['PEMO_DEMO_BASE_URL'] ?? 'http://127.0.0.1:23283';
  const to: ProxyOptions = { target, changeOrigin: true };
  return {
    '/api/resident-portal/v0/tickets': to,
    '/api/resident-portal/v0/notices': to,
    '/api/resident-portal/v0/visitors': to,
    '/api/resident-portal/v0/invoices': to,
  };
}

export default defineConfig(({ command }) => {
  const proxy = ticketsDemoProxy();
  return {
    esbuild: { jsx: 'automatic' },
    define: { __PEMO_DEV_TOOLBAR__: JSON.stringify(command === 'serve') },
    resolve: {
      alias: {
        // Types/adapters only ??do not add @pemo/tickets-demo-store to package.json.
        '@pemo/tickets-demo-store': path.resolve(
          rootDir,
          '../../packages/tickets-demo-store/src/index.ts',
        ),
        '@pemo/notices-visitors-demo-store': path.resolve(
          rootDir,
          '../../packages/notices-visitors-demo-store/src/index.ts',
        ),
      },
    },
    build: { outDir: 'dist', sourcemap: true },
    server: {
      host: '0.0.0.0',
      // 23282: clear of the Node build's 5176 and every other project's ports.
      port: 23282,
      strictPort: true,
      // A repo on a Windows drive under WSL (/mnt/<drive>) gets no file-change events, so edits made from
      // Windows never reach the dev server. Poll there; everywhere else keep native watching.
      watch: process.cwd().startsWith('/mnt/') ? { usePolling: true, interval: 500 } : undefined,
      proxy,
    },
    preview: { proxy, host: '127.0.0.1' },
  };
});

