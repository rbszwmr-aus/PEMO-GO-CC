/**
 * Serving and reaching the built app.
 *
 * An in-process static server over dist/ rather than `vite preview` (whose
 * grandchild outlives kill()). The suite runs against the PRODUCTION build, so
 * the dev toolbar is genuinely absent — states are reached by URL, which is what
 * makes them testable without it.
 */

import { test as base } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

import { APP_ROOT } from '../../../tool/tokens-source.ts';

const DIST = join(APP_ROOT, 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json',
  '.png': 'image/png',
};

let server: Server | undefined;
let origin: string | undefined;

export async function appOrigin(): Promise<string> {
  if (origin) return origin;
  if (!existsSync(join(DIST, 'index.html'))) {
    throw new Error(
      'dist/index.html is missing. The browser suite runs against the PRODUCTION build, ' +
        'so run `pnpm run build` first — testing a build that does not exist proves nothing.',
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

export function urlFor(
  base: string,
  q: { service?: string; tab?: string; state?: string; lang?: string },
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined) p.set(k, v);
  return `${base}/?${p.toString()}`;
}

/** A page that fails the test on any console error or uncaught exception. */
export const test = base.extend<{ strictPage: import('@playwright/test').Page }>({
  strictPage: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
    });
    await use(page);
    if (problems.length) throw new Error(`the page reported errors:\n  ${problems.join('\n  ')}`);
  },
});

export { expect } from '@playwright/test';
