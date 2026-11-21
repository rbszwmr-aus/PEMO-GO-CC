#!/usr/bin/env node
/**
 * Stamp the contract version from its single authored source.
 *
 * ADR-005 Option D, adopted by ADR-008 Decision 3 and implemented by API-016-ST.
 *
 * `openapi.yaml` `info.version` is the ONLY authored declaration. Everything else —
 * the Meta const, three package files and 44 fixture envelopes — is derived from it.
 *
 * Why this exists rather than a bump script: ADR-008 makes every change to the
 * contract package a version bump, with no exempt class, because an exempt class is
 * what destroys the property that two artifacts claiming one version are identical.
 * An unconditional bump rule is only survivable if a bump is cheap. 49 hand-maintained
 * declarations is not cheap, and ceremony disproportionate to the change is what gets
 * bypassed — a bypassed bump being exactly the undetectable drift versioning prevents.
 *
 * A script that edits 49 declarations automates RESTATING the version. This removes the
 * restatement: one place authors it, 48 derive.
 *
 *   node packages/api-contracts/stamp-version.mjs --check   verify; exit 1 on drift
 *   node packages/api-contracts/stamp-version.mjs           write the derived values
 *
 * Substitution is TARGETED — the version field only, asserted byte-for-byte against the
 * rest of the file — never a JSON round-trip, which would silently renormalise
 * hand-authored bilingual copy if the corpus ever stopped being canonical.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
/**
 * One entry per surface. API-020-ST: until then this file knew only `resident`, so the
 * management package's contractVersion declarations derived from NOTHING and were
 * hand-maintained — the same hole as the management contract-lock, which validate.mjs
 * also never asserted. ADR-005 Option D was implemented for one surface and read as
 * though it covered the package.
 *
 * `extra` is per-surface because a file belongs to one surface's version or the other's.
 * problem-types.json is the exception and stays with `resident` for now: ADR-007 D2 makes
 * the registry SHARED, so a single contractVersion on it cannot derive from either
 * surface honestly. Reported by API-020-ST rather than silently reassigned.
 */
const SURFACES = {
  resident: {
    openapi: path.join(HERE, 'resident-mobile/openapi.yaml'),
    constRe: /(^ {10}const: ')[0-9][^']*(')/m,
    fixtures: path.join(ROOT, 'tests/fixtures/resident-mobile'),
    extra: [
      [path.join(HERE, 'problem-types.json'), /("contractVersion": ")[^"]*(")/],
      [path.join(HERE, 'resident-mobile/severity.json'), /("contractVersion": ")[^"]*(")/],
      [path.join(HERE, 'resident-mobile/forbidden-terms.json'), /("contractVersion": ")[^"]*(")/],
    ],
  },
  management: {
    openapi: path.join(HERE, 'management-web/openapi.yaml'),
    constRe: /(contractVersion: \{ type: string, const: ')[^']*(')/,
    fixtures: path.join(ROOT, 'tests/fixtures/management-web'),
    extra: [
      [path.join(HERE, 'management-web/forbidden-terms.json'), /("contractVersion": ")[^"]*(")/],
    ],
  },
  'resident-portal': {
    openapi: path.join(HERE, 'resident-portal/openapi.yaml'),
    constRe: /(contractVersion: \{ type: string, const: ')[^']*(')/,
    fixtures: path.join(ROOT, 'tests/fixtures/resident-portal'),
    extra: [
      [path.join(HERE, 'resident-portal/forbidden-terms.json'), /("contractVersion": ")[^"]*(")/],
    ],
  },
};

const read = (p) => fs.readFileSync(p, 'utf8');
const rel = (p) => path.relative(ROOT, p);

/** The single authored declaration, per surface. */
export const authoredVersion = (surface = 'resident') => {
  const openapi = SURFACES[surface].openapi;
  const m = read(openapi).match(/^ {2}version: (.+)$/m);
  if (!m) throw new Error(`${rel(openapi)} declares no info.version`);
  return m[1].trim();
};

/** Every derived declaration for one surface: [file, regex with two anchoring groups]. */
const derived = (surface) => {
  const cfg = SURFACES[surface];
  const targets = [
    [cfg.openapi, cfg.constRe],
    ...cfg.extra.filter(([f]) => fs.existsSync(f)),
    [path.join(cfg.fixtures, 'index.json'), /("contractVersion": ")[^"]*(")/],
  ];
  for (const screen of fs.readdirSync(cfg.fixtures, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of fs.readdirSync(path.join(cfg.fixtures, screen.name)).filter((f) => f.endsWith('.json'))) {
      const p = path.join(cfg.fixtures, screen.name, f);
      if (/"contractVersion"/.test(read(p))) targets.push([p, /("contractVersion": ")[^"]*(")/]);
    }
  }
  return targets.map(([file, re]) => ({ file, re }));
};

const runSurface = (surface, write) => {
  const version = authoredVersion(surface);
  const targets = derived(surface);
  const drift = [];
  let changed = 0;

  for (const { file, re } of targets) {
    const before = read(file);
    const m = before.match(re);
    if (!m) { drift.push({ file: rel(file), found: '(no declaration)' }); continue; }
    const current = m[0].slice(m[1].length, m[0].length - m[2].length);
    if (current === version) continue;

    if (!write) { drift.push({ file: rel(file), found: current }); continue; }

    const after = before.replace(re, `$1${version}$2`);
    // Targeted: exactly one substring differs, and it is the version.
    if (after.length - before.length !== version.length - current.length) {
      throw new Error(`${rel(file)}: substitution changed more than the version field`);
    }
    fs.writeFileSync(file, after);
    changed += 1;
  }

  console.log(`${surface.padEnd(11)} authored ${version}   ${targets.length} derived declaration(s)` +
    (write ? `, ${changed} updated` : ''));
  for (const d of drift) console.log(`  DRIFT  ${d.file}  declares ${d.found}`);
  return drift.length;
};

const run = (write) => {
  let drift = 0;
  for (const surface of Object.keys(SURFACES)) {
    if (!fs.existsSync(SURFACES[surface].openapi)) continue;
    drift += runSurface(surface, write);
  }
  if (write) return 0;
  if (drift === 0) { console.log('\nPASS — every declaration derives exactly from its surface\'s authored source.'); return 0; }
  console.log(`\nFAIL — ${drift} declaration(s) do not match. This is drift, not a value to update by hand.`);
  return 1;
};

const write = process.argv.includes('--write') || !process.argv.includes('--check');
process.exit(run(write));
