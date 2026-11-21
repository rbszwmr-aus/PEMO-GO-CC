/**
 * Serving and reaching the built app.
 *
 * An in-process static server rather than `vite preview`: the preview command
 * spawns a grandchild that outlives kill(), which left orphaned servers holding
 * ports during step 3.
 */

import { test as base } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

import { APP_ROOT } from '../../../tool/corpus-source.ts';

const DIST = join(APP_ROOT, 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
};

let server: Server | undefined;
let origin: string | undefined;

export async function appOrigin(): Promise<string> {
  if (origin) return origin;
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error(
      'dist/index.html is missing. The browser suite runs against the PRODUCTION build, ' +
        'so run `pnpm run build` first. Testing a build that does not exist would be a suite ' +
        'that proves nothing about what ships.',
    );
  }
  server = createServer(async (req, res) => {
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const file = path === '/' ? 'index.html' : path.slice(1);
    try {
      const body = await readFile(join(DIST, file));
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', () => r()));
  const addr = server!.address();
  if (addr === null || typeof addr === 'string') throw new Error('server did not bind a port');
  origin = `http://127.0.0.1:${addr.port}`;
  return origin;
}

export const FONT_STACK =
  '"Libre Franklin","Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif';

/**
 * `source=fixture` is on every test URL: with no source the Front counter and Visitor log probe the API
 * and go live when it answers (a static test host never does, but the probe would log a failed request).
 * Pass `null` to leave the source off, or 'live' to force live.
 */
export const urlFor = (base: string, screen: string, state: string, lang: string, source: string | null = 'fixture'): string =>
  `${base}/?screen=${screen}&state=${state}&lang=${lang}${source === null ? '' : `&source=${source}`}`;

/** A page that fails the test on any console error or uncaught exception. */
export const test = base.extend<{ strictPage: import('@playwright/test').Page }>({
  strictPage: async ({ page }, use) => {
    const problems: string[] = [];
    // The convention above, kept for every page this fixture hands out: an address with no `source=` gets
    // `source=fixture`, so nothing on the page asks an API a static host cannot answer (the Nav’s 403 check
    // and the sourced screens would each log a failed request). A test that names a source keeps it.
    const goto = page.goto.bind(page);
    // The app now mounts after its corpus and the first screen's chunks arrive (a dynamic import, which the window `load`
    // event does not wait for), so a navigation is settled only once the app has mounted its first screen.
    const mounted = () => page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root === null || (root.childElementCount > 0 && root.querySelector('[data-testid="screen-loading"]') === null);
    }, undefined, { timeout: 10_000 }).catch((e: unknown) => {
      throw new Error(`the app did not mount its first screen within 10 s of load (#root stayed empty or still showed the loading marker): ${String(e)}`);
    });
    page.goto = (async (url: string, options?: Parameters<typeof goto>[1]) => {
      const res = await goto(/[?&]source=/.test(url) || !url.includes('?') ? url : `${url}&source=fixture`, options);
      await mounted();
      return res;
    }) as typeof page.goto;
    // The app rewrites its own address as the reader moves and the rewrite drops `source`, so a reload puts it back.
    const reload = page.reload.bind(page);
    page.reload = (async (options?: Parameters<typeof reload>[0]) => {
      const res = /[?&]source=/.test(page.url()) ? await reload(options) : await goto(`${page.url()}${page.url().includes('?') ? '&' : '?'}source=fixture`, options);
      await mounted();
      return res;
    }) as typeof page.reload;
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    // The Help desk asks the demo help-desk API for its portal tickets and queue; a static test host answers 404 and the
    // screen falls back to its fixture. Those answers are expected: each one is let through once, nothing else is.
    let expected404 = 0;
    page.on('response', (res) => {
      if (res.status() === 404 && new URL(res.url()).pathname.startsWith('/api/management-web/v0/helpdesk/')) expected404 += 1;
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
    });
    await use(page);
    const notFound = problems.filter((p) => /Failed to load resource: the server responded with a status of 404/.test(p));
    const unexpected = problems.filter((p) => !notFound.includes(p));
    if (notFound.length > expected404) unexpected.push(...notFound.slice(expected404));
    if (unexpected.length) throw new Error(`the page reported errors:\n  ${unexpected.join('\n  ')}`);
  },
});

/**
 * A narrow filter bar keeps its dropdowns behind a Filters button. Open that panel when it is closed;
 * do nothing when the bar is one row, so a test reads the same at either width.
 */
export async function revealFilters(page: import('@playwright/test').Page, barTestId: string): Promise<void> {
  const toggle = page.getByTestId(`${barTestId}-toggle`);
  if ((await toggle.count()) > 0 && (await page.getByTestId(`${barTestId}-panel`).count()) === 0) await toggle.click();
}

export { expect } from '@playwright/test';
