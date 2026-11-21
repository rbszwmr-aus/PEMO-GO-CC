#!/usr/bin/env node
/**
 * Compute the contract's content hashes — ADR-008 as amended by Amendment A4 (API-026-ST).
 *
 * TWO hashes per surface, with asymmetric roles (A4 D1, D2):
 *
 *   surfaceHash — over surface-determining content ONLY: openapi.yaml (version-normalised)
 *                 and the SURFACE PROJECTION of problem-types.json. PAIRED WITH THE VERSION.
 *                 A surface change moves it, and a moved surfaceHash is the objective form of
 *                 ADR-008's test: it says the contract changed, so the version must bump.
 *
 *   corpusHash  — over corpus content: the fixtures, forbidden-terms, severity.json,
 *                 severity.md, and the CORPUS PROJECTION of problem-types.json. INTEGRITY
 *                 ONLY, version-independent. Moving it does NOT require a bump.
 *
 * Before A4 there was ONE hash over both, paired with the version, so any corpus byte moved
 * the hash and forced a bump — churn a client cannot observe (A4 D2, D3). The three measured
 * data points, including one that manufactured false staleness in another session's artifact,
 * were all corpus changes moving the one hash.
 *
 * THE PARTITION IS BY WHAT AN ARTIFACT DETERMINES, NOT WHERE IT LIVES (A4 D6). Two files
 * carry both concerns at once and are classified PER FIELD, not per path:
 *
 *   problem-types.json — FIELD-SPLIT. Its httpStatus is surface content (a conforming
 *     implementation's permitted status codes) that lives ONLY here: openapi's Problem.type
 *     enum is URIs only, so httpStatus has no other authoritative home. Treating the file as
 *     wholly-corpus would let widening bad-request to [400,409] move no surface hash and never
 *     bump — the A4 stop condition, live. So its surface fields go to surfaceHash and its
 *     documentation goes to corpusHash. The classifier below is exhaustive (A4 D7): a field in
 *     neither set is a hard failure, because unknown->surface reintroduces churn and
 *     unknown->corpus ships a real surface change silently, so there is no safe default.
 *
 *   severity.json — WHOLLY CORPUS. Its only surface content — the level enum and the "client
 *     connectivity is never a severity" rule — is mirrored into openapi.yaml (the Severity
 *     enum, the connectivity/coverage rules) and GUARDED by validate.mjs's
 *     severity-enum-agreement check. The mirror carries the surface concern, so the file needs
 *     no field split. That makes severity-enum-agreement load-bearing, and it carries its own
 *     coverage in the D7 battery: defeat the agreement check and a severity surface change
 *     slips. A dual-nature file needs field-splitting IFF its surface content has no other
 *     authoritative home.
 *
 * Every version string is replaced by a placeholder before hashing (normalise), so neither
 * hash depends on the version it is paired with. Without that, surfaceHash would move whenever
 * the version does and degenerate into the tautology the lock was meant to replace; and a
 * surface bump — which restamps the version into corpus files — would spuriously move
 * corpusHash.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
export const LOCK = path.join(HERE, 'resident-mobile/contract-lock.json');
export const REGISTRY = path.join(HERE, 'problem-types.json');

const VERSION_PLACEHOLDER = '__CONTRACT_VERSION__';

const walk = (dir) => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
};

/**
 * Per-surface lock definitions — ADR-007 D2 gives each surface its own package and version.
 * `openapi` is the surface's one wholly-surface file; everything else in `dirs` is corpus.
 */
export const SURFACES = {
  resident: {
    dirs: [path.join(HERE, 'resident-mobile'), path.join(ROOT, 'tests/fixtures/resident-mobile')],
    lock: path.join(HERE, 'resident-mobile/contract-lock.json'),
    openapi: path.join(HERE, 'resident-mobile/openapi.yaml'),
  },
  management: {
    dirs: [path.join(HERE, 'management-web'), path.join(ROOT, 'tests/fixtures/management-web')],
    lock: path.join(HERE, 'management-web/contract-lock.json'),
    openapi: path.join(HERE, 'management-web/openapi.yaml'),
  },
  // Third line (API-027-ST). The map is the extension point A4/API-025 anticipated: a third
  // surface is covered the moment it is registered — surfaceHash/corpusHash, the two-hash
  // lock, the per-surface registry projection and the emittedOnlyBy filter all follow.
  'resident-portal': {
    dirs: [path.join(HERE, 'resident-portal'), path.join(ROOT, 'tests/fixtures/resident-portal')],
    lock: path.join(HERE, 'resident-portal/contract-lock.json'),
    openapi: path.join(HERE, 'resident-portal/openapi.yaml'),
  },
};

/** All files under a surface's dirs, minus its own lock. */
const surfaceDirFiles = (surface) => {
  const cfg = SURFACES[surface];
  const files = cfg.dirs.filter((d) => fs.existsSync(d)).flatMap(walk)
    .filter((p) => path.resolve(p) !== path.resolve(cfg.lock));
  return [...new Set(files)].sort();
};

/** Kept for compatibility with callers that want the full per-surface file set. */
export const hashedFiles = (surface = 'resident') => surfaceDirFiles(surface);

// ---------------------------------------------------------------- the classifier (A4 D6/D7)
//
// Every field a problem-types entry may carry is placed in exactly one role. This list is the
// classifier, and it is EXHAUSTIVE by assertion: unclassifiedRegistryFields() reports any
// field in none of the three sets, and validate.mjs fails on it. A new field cannot enter
// either hash silently — the suite stops until a human places it.
export const PT_SURFACE_FIELDS = ['uri', 'status', 'httpStatus', 'emittedOnlyBy'];
export const PT_CORPUS_FIELDS = ['summary', 'clientGuidance', 'note', 'since', 'declaredSince'];
// `surfaces` is neither hashed-surface nor corpus: it SELECTS which surface's projection an
// entry enters. Tagging an existing type as also applying elsewhere adds it to the other
// surface's projection and changes nothing for this one — the API-016-ST correction, one
// level down. So it is a filter, classified but not hashed as content.
export const PT_FILTER_FIELDS = ['surfaces'];
// Registry-level (not per-entry) documentation. All corpus; contractVersion is
// version-bookkeeping and is stripped by normalise, so it hashes to nothing either way.
const PT_TOP_CORPUS = ['$schema', '$id', 'title', 'owner', 'decidedBy', 'why', 'location', 'howToUse', 'addingAType'];

const readRegistry = () => JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));

/** Every entry field not classified into surface, corpus, or filter — the D7 hard-fail input. */
export const unclassifiedRegistryFields = () => {
  const known = new Set([...PT_SURFACE_FIELDS, ...PT_CORPUS_FIELDS, ...PT_FILTER_FIELDS]);
  const out = [];
  for (const [key, entry] of Object.entries(readRegistry().types)) {
    for (const field of Object.keys(entry)) {
      if (!known.has(field)) out.push({ type: key, field });
    }
  }
  return out;
};

/** operationIds declared in a surface's openapi — how an operation is bound to its surface. */
const operationIdsFor = (surface) => {
  const text = fs.readFileSync(SURFACES[surface].openapi, 'utf8');
  return new Set([...text.matchAll(/^\s*operationId:\s*(\S+)\s*$/gm)].map((m) => m[1]));
};

/** Present fields of `obj`, in the fixed order of `fields`, so JSON.stringify is canonical. */
const pick = (obj, fields) => {
  const out = {};
  for (const f of fields) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
};

/**
 * This surface's SURFACE projection of the registry: entries applicable to the surface, each
 * reduced to its surface fields. emittedOnlyBy is FILTERED to this surface's own operations —
 * a shared type (invalid-credential) lists resident operations while also applying to
 * management, and an unfiltered list would move the management surfaceHash for a resident-only
 * change, the exact cross-surface false positive API-016-ST removed for `surfaces`.
 */
export const registrySurfaceProjection = (surface = 'resident') => {
  const ops = operationIdsFor(surface);
  const applicable = Object.entries(readRegistry().types)
    .filter(([, v]) => Array.isArray(v.surfaces) && v.surfaces.includes(surface))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => {
      const picked = pick(v, PT_SURFACE_FIELDS);
      if (Array.isArray(picked.httpStatus)) picked.httpStatus = [...picked.httpStatus].sort((a, b) => a - b);
      if (Array.isArray(picked.emittedOnlyBy)) {
        picked.emittedOnlyBy = picked.emittedOnlyBy.filter((op) => ops.has(op)).sort();
      }
      return [k, picked];
    });
  return JSON.stringify(applicable);
};

/** This surface's CORPUS projection of the registry: applicable entries' documentation, plus
 *  the registry-level documentation. Integrity only; never moves the version. */
export const registryCorpusProjection = (surface = 'resident') => {
  const registry = readRegistry();
  const applicable = Object.entries(registry.types)
    .filter(([, v]) => Array.isArray(v.surfaces) && v.surfaces.includes(surface))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => [k, pick(v, PT_CORPUS_FIELDS)]);
  return JSON.stringify({ top: pick(registry, PT_TOP_CORPUS), entries: applicable });
};

/** Strip the version so neither hash depends on the version it is paired with. */
const normalise = (text) =>
  text
    .replace(/("contractVersion":\s*")[^"]*(")/g, `$1${VERSION_PLACEHOLDER}$2`)
    .replace(/(^ {2}version: ).*$/m, `$1${VERSION_PLACEHOLDER}`)
    .replace(/(^ {10}const: ').*(')/m, `$1${VERSION_PLACEHOLDER}$2`);

const hashFile = (h, file) => {
  h.update(path.relative(ROOT, file).replace(/\\/g, '/'));
  h.update('\0');
  h.update(normalise(fs.readFileSync(file, 'utf8')));
  h.update('\0');
};

/** Surface-determining content: openapi.yaml + the registry's surface projection. */
export const surfaceHash = (surface = 'resident') => {
  const h = crypto.createHash('sha256');
  h.update(`surface:${surface}\0`);
  h.update(registrySurfaceProjection(surface));
  h.update('\0');
  hashFile(h, SURFACES[surface].openapi);
  return `sha256:${h.digest('hex')}`;
};

/** Corpus content: everything in the surface dirs except openapi, plus the registry's corpus
 *  projection. Integrity only — never paired with the version. */
export const corpusHash = (surface = 'resident') => {
  const h = crypto.createHash('sha256');
  h.update(`corpus:${surface}\0`);
  h.update(registryCorpusProjection(surface));
  h.update('\0');
  const openapi = path.resolve(SURFACES[surface].openapi);
  for (const file of surfaceDirFiles(surface)) {
    if (path.resolve(file) === openapi) continue;
    hashFile(h, file);
  }
  return `sha256:${h.digest('hex')}`;
};

export const authoredVersion = (surface = 'resident') =>
  fs.readFileSync(SURFACES[surface].openapi, 'utf8').match(/^ {2}version: (.+)$/m)[1].trim();

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes('--write');
  const unknown = unclassifiedRegistryFields();
  if (unknown.length) {
    for (const u of unknown) console.error(`UNCLASSIFIED  problem-types ${u.type}.${u.field}`);
    console.error('Refusing to hash: an unclassified field would enter neither hash silently (A4 D7).');
    process.exit(1);
  }
  for (const surface of Object.keys(SURFACES)) {
    if (!fs.existsSync(SURFACES[surface].openapi)) continue;
    const lock = {
      contractVersion: authoredVersion(surface),
      surfaceHash: surfaceHash(surface),
      corpusHash: corpusHash(surface),
      $limitation:
        'Two hashes, one job each (Amendment A4). surfaceHash is paired with contractVersion: ' +
        'if it moved, the contract surface changed and the version must bump. corpusHash is ' +
        'integrity only and never moves the version. NEITHER covers the rule that computes ' +
        'them — contract-hash.mjs is in no hashed set and cannot be, so a change to the ' +
        'hashing or classification rule requires REVIEW of that diff, not a green check. The ' +
        'classifier is exhaustive: an unclassified registry field halts hashing rather than ' +
        'entering a hash silently.',
    };
    if (write) fs.writeFileSync(SURFACES[surface].lock, JSON.stringify(lock, null, 2) + '\n');
    console.log(`${surface.padEnd(11)} surface ${lock.surfaceHash.slice(0, 22)}  corpus ${lock.corpusHash.slice(0, 22)}  v${lock.contractVersion}`);
  }
}
