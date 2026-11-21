/**
 * Loads the fixture chunk (`fixture-boot.ts`) once, before the first render, and hands it to the app. Nothing in the
 * entry bundle imports a corpus; everything reads it through `fixtures()` after `loadFixtures()` has resolved.
 *
 * @version 0.3.0
 * @changelog
 *   0.3.0 (2026-11-20) `lazyFixtures()`: the corpora are fetched only when a screen reads one of them.
 *   0.2.0 (2026-11-20) (superseded) live mode no longer loads the corpus at boot.
 *   0.1.0 (2026-11-20) New (initial-bundle work).
 */

import { use } from 'react';

type Boot = typeof import('./fixture-boot.ts');

let boot: Boot | null = null;
let loading: Promise<Boot> | null = null;

export function loadFixtures(): Promise<Boot> {
  loading ??= import('./fixture-boot.ts').then((m) => { boot = m; return m; });
  return loading;
}

/** The loaded corpora. Throws if read before `loadFixtures()` resolved — main.tsx renders only after it. */
export function fixtures(): Boot {
  if (!boot) throw new Error('fixtures() read before loadFixtures() resolved');
  return boot;
}

/**
 * The corpora, read on demand: nothing is fetched until a property is read, and reading one before the chunk is in
 * suspends the screen area. A live-mode screen that renders from none of them never loads them.
 */
export function lazyFixtures(): Boot {
  return boot ?? new Proxy({} as Boot, { get: (_target, key) => use(loadFixtures())[key as keyof Boot] });
}
