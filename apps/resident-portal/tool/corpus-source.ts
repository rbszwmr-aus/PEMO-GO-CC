/**
 * The resident-portal fixture corpus, and the guard that proves it is genuine.
 *
 * UI-028-ST rendered no data, so it had no corpus and no such guard. This is the
 * first time the portal renders data, and the hazard UI-011-ST named returns in a
 * new costume: this surface renders loading, empty and error states, and ABSENT
 * DATA LOOKS EXACTLY LIKE THE EMPTY STATE. A stubbed corpus would leave every one
 * of those assertions green.
 *
 * So the guard is not a test — it is in the data path and runs on every load, and
 * it asserts EXACT authored values (two of them bilingual) that no stub, mock or
 * empty corpus can fake. It is proven to fire: point PEMO_PORTAL_FIXTURE_DIR at
 * any other directory and every consumer throws.
 *
 * The fixtures are READ-ONLY to this PID. If one appears wrong, that is a finding
 * for the contract track and a stop — never an edit. (Finding A, the facet `basis`
 * prose, is exactly such a finding: reported, not edited, and never rendered.)
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ROOT, REPO_ROOT } from './tokens-source.ts';

export { APP_ROOT, REPO_ROOT };

/** The real corpus. The env override exists ONLY so the guard can be proven to fire. */
export const CORPUS_DIR =
  process.env.PEMO_PORTAL_FIXTURE_DIR ?? join(REPO_ROOT, 'tests/fixtures/resident-portal');

export const PORTAL_CONTRACT_DIR = join(REPO_ROOT, 'packages/api-contracts/resident-portal');
export const DIGEST_FILE = join(APP_ROOT, 'corpus-digest.json');

const FAIL = 'PEMO RESIDENT-PORTAL FIXTURE SOURCE GUARD';

class CorpusGuardError extends Error {
  override name = 'CorpusGuardError';
}

function die(what: string, detail: string): never {
  throw new CorpusGuardError(
    `\n\n${'='.repeat(72)}\n${FAIL} FAILED — ${what}\n${'='.repeat(72)}\n` +
      `${detail}\n\ncorpus dir : ${CORPUS_DIR}\n` +
      `override    : ${process.env.PEMO_PORTAL_FIXTURE_DIR ? 'PEMO_PORTAL_FIXTURE_DIR is SET' : 'not set'}\n\n` +
      `A stubbed fixture source is indistinguishable from an empty, loading or\n` +
      `error state, and would leave the whole state matrix green while rendering\n` +
      `nothing real. Nothing is safe to run until the corpus is genuine.\n${'='.repeat(72)}\n`,
  );
}

export interface ManifestEntry {
  file: string;
  screen: string;
  state: string;
  schema?: string;
  operationId?: string;
  httpStatus?: number;
  world?: string;
}

export interface Corpus {
  manifest: { contractVersion: string; surface: string; pid: string; fixtures: ManifestEntry[] };
  files: Map<string, unknown>;
  digests: Map<string, string>;
}

const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

/**
 * Content only the genuine corpus can satisfy — the three behaviours this PID
 * exists to render, each pinned to an EXACT authored value, two bilingual.
 */
function assertPositiveContent(files: Map<string, unknown>): void {
  const get = (p: string): any => {
    const v = files.get(p);
    if (v === undefined) die('a declared fixture is missing', `${p} is not in the corpus.`);
    return v;
  };

  // Eligibility inversion: the ineligible gym is PRESENT in the Explore list.
  const explore = get('explore/default.json');
  const gym = (explore.results ?? []).find((r: any) => r?.facilityId === 'fac_wfg_gym');
  if (!gym) die('the positive assertion did not hold', 'explore/default.json carries no fac_wfg_gym result.');
  if (gym.eligibility?.eligible !== false || gym.eligibility?.reason !== 'membership-required') {
    die('the positive assertion did not hold',
      'fac_wfg_gym is not present with eligible:false, reason "membership-required" — the inversion the contract carries.');
  }

  // Facet counts are world-scoped: the empty page reports non-zero categories.
  const empty = get('explore/empty.json');
  if ((empty.results ?? []).length !== 0) die('the positive assertion did not hold', 'explore/empty.json is not empty.');
  const cat = (empty.facets?.categories ?? []).find((c: any) => c?.key === 'function-and-event');
  if (cat?.count !== 3 || empty.facets?.scope !== 'world') {
    die('the positive assertion did not hold',
      'explore/empty.json lost its world-scoped facet counts (function-and-event == 3, scope == world) — the oracle.');
  }

  // Absence is not zero: function-room null quota vs party-room zero quota.
  if (get('facility/function-room.json').rules?.perPersonQuotaPerMonth !== null) {
    die('the positive assertion did not hold', 'function-room no longer carries perPersonQuotaPerMonth: null (policy-absent).');
  }
  if (get('facility/party-room.json').rules?.perPersonQuotaPerMonth !== 0) {
    die('the positive assertion did not hold', 'party-room no longer carries perPersonQuotaPerMonth: 0 (policy-zero).');
  }

  // Closed facility with no expected return, its reason in Traditional Chinese.
  const sauna = get('facility/sauna.json');
  if (sauna.availability?.state !== 'closed' || sauna.availability?.expectedReturn !== null) {
    die('the positive assertion did not hold', 'sauna is not closed with expectedReturn: null.');
  }
  if (sauna.availability?.reason?.['zh-Hant'] !== '暫停開放進行維護') {
    die('the positive assertion did not hold', 'sauna lost its Traditional Chinese closure reason (a Latin-only stub fails here).');
  }
}

let cached: Corpus | undefined;

export function loadCorpus(options: { skipDigestCheck?: boolean } = {}): Corpus {
  if (cached && !options.skipDigestCheck) return cached;

  if (!existsSync(CORPUS_DIR) || !statSync(CORPUS_DIR).isDirectory()) {
    die('the corpus directory does not exist', `${CORPUS_DIR} is not a directory.`);
  }
  const indexPath = join(CORPUS_DIR, 'index.json');
  if (!existsSync(indexPath)) die('the fixture manifest is missing', `${indexPath} does not exist.`);

  let manifest: Corpus['manifest'];
  try {
    manifest = JSON.parse(readFileSync(indexPath, 'utf8'));
  } catch (e) {
    die('the fixture manifest does not parse', String(e));
  }
  if (manifest.surface !== 'resident-portal') {
    die('the corpus is not the resident-portal surface',
      `index.json declares surface ${JSON.stringify(manifest.surface)}, expected "resident-portal".`);
  }
  if (!Array.isArray(manifest.fixtures) || manifest.fixtures.length === 0) {
    die('the fixture manifest is empty', 'index.json declares no fixtures.');
  }

  const files = new Map<string, unknown>();
  const digests = new Map<string, string>();
  for (const entry of manifest.fixtures) {
    const p = join(CORPUS_DIR, entry.file);
    if (!existsSync(p)) die('a declared fixture does not exist', `${entry.file} is declared in index.json but absent.`);
    const buf = readFileSync(p);
    if (buf.byteLength === 0) die('a declared fixture is empty', `${entry.file} is a zero-byte file.`);
    try {
      files.set(entry.file, JSON.parse(buf.toString('utf8')));
    } catch (e) {
      die('a declared fixture does not parse', `${entry.file}: ${String(e)}`);
    }
    digests.set(entry.file, sha256(buf));
  }
  digests.set('index.json', sha256(readFileSync(indexPath)));

  assertPositiveContent(files);

  if (existsSync(DIGEST_FILE) && !options.skipDigestCheck) {
    const recorded: Record<string, string> = JSON.parse(readFileSync(DIGEST_FILE, 'utf8')).digests;
    const drifted: string[] = [];
    for (const [file, digest] of digests) {
      const was = recorded[file];
      if (was === undefined) drifted.push(`${file}: NEW, not in the recorded digest`);
      else if (was !== digest) drifted.push(`${file}: content changed`);
    }
    for (const file of Object.keys(recorded)) if (!digests.has(file)) drifted.push(`${file}: RECORDED BUT NOW MISSING`);
    if (drifted.length > 0) {
      die('the corpus has changed since it was recorded',
        `${drifted.length} difference(s):\n  ${drifted.join('\n  ')}\n\n` +
          'The corpus is read-only to this PID. If the contract track changed it, re-run `pnpm run digest`,\n' +
          're-read the change and re-verify the screens against it. Do not re-record it blindly.');
    }
  }

  cached = { manifest, files, digests };
  return cached;
}

export function fixture(path: string): unknown {
  const { files } = loadCorpus();
  const v = files.get(path);
  if (v === undefined) die('a fixture was requested that is not declared', `${path} is not in index.json.`);
  return v;
}
