/**
 * The fixture corpus source, and the guard that proves it is genuine.
 *
 * WHY THE GUARD LIVES HERE AND NOT IN A TEST FILE
 *
 * UI-011-ST produced an entirely green live suite that reached no server. It
 * survived because a suite of negative tests cannot detect its own
 * disconnection: disconnection looks exactly like failure. The same hazard
 * exists here in a different costume — this surface renders loading, empty and
 * error states, and ABSENT DATA LOOKS EXACTLY LIKE THE EMPTY STATE. A stubbed
 * corpus would leave every one of those assertions green.
 *
 * So the guard is not a test. It is in the data path, and it runs on every
 * load. Anything that reads a fixture runs it first, which means a stubbed
 * source fails loudly at the point of use rather than passing quietly.
 *
 * The guard is proven to fire rather than assumed to: point
 * PEMO_MGMT_FIXTURE_DIR at any other directory and every consumer throws.
 * The evidence is captured in the UI-019-ST step 2 report.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = resolve(HERE, '..');
export const REPO_ROOT = resolve(HERE, '../../..');

/** The real corpus. The env override exists ONLY so the guard can be proven to fire. */
export const CORPUS_DIR =
  process.env.PEMO_MGMT_FIXTURE_DIR ?? join(REPO_ROOT, 'tests/fixtures/management-web');

export const SEVERITY_JSON = join(
  REPO_ROOT,
  'packages/api-contracts/resident-mobile/severity.json',
);
export const MGMT_CONTRACT_DIR = join(REPO_ROOT, 'packages/api-contracts/management-web');
export const DIGEST_FILE = join(APP_ROOT, 'corpus-digest.json');

const FAIL = 'PEMO FIXTURE SOURCE GUARD';

class CorpusGuardError extends Error {
  override name = 'CorpusGuardError';
}

function die(what: string, detail: string): never {
  throw new CorpusGuardError(
    `\n\n${'='.repeat(72)}\n${FAIL} FAILED — ${what}\n${'='.repeat(72)}\n` +
      `${detail}\n\n` +
      `corpus dir : ${CORPUS_DIR}\n` +
      `override    : ${process.env.PEMO_MGMT_FIXTURE_DIR ? 'PEMO_MGMT_FIXTURE_DIR is SET' : 'not set'}\n\n` +
      `This guard exists because a stubbed fixture source is indistinguishable\n` +
      `from an empty, loading or error state, and would leave the whole state\n` +
      `matrix green while rendering nothing real. Nothing is safe to run until\n` +
      `the corpus is genuine.\n${'='.repeat(72)}\n`,
  );
}

/** Declared shape of a fixture manifest entry. */
export interface ManifestEntry {
  file: string | null;
  screen: string;
  state: string;
  schema?: string;
  operationId?: string;
  httpStatus?: number;
  clientOnly?: boolean;
  reason?: string;
  notes?: string;
}

export interface Corpus {
  manifest: { contractVersion: string; surface: string; pid: string; fixtures: ManifestEntry[] };
  /** Parsed fixture bodies, keyed by manifest-relative path such as `mob-s1-safety/default.json`. */
  files: Map<string, unknown>;
  /** Manifest entries with no file — the client-only states. */
  clientOnly: ManifestEntry[];
  digests: Map<string, string>;
}

/**
 * The corpus digest hashes what UI CC AUTHORED, not what another tool STAMPED.
 *
 * `contractVersion` is not authored corpus: packages/api-contracts/stamp-version.mjs
 * writes it into every fixture (and index.json) from openapi.yaml's info.version. UI CC
 * neither writes nor owns it. Hashing it made a backend contract bump — a number that
 * has nothing to do with whether any screen's data changed — red this guard with pure
 * version-stamp noise (GEN-064's 2.2.0->2.3.0 tripped ~29 fixtures), a false alarm
 * indistinguishable from a real one and recurring on every bump.
 *
 * So the stamped value is NEUTRALISED before hashing. This mirrors stamp-version's own
 * substitution — the SAME field, a targeted byte replacement, never a JSON round-trip
 * (which would renormalise hand-authored bilingual copy) — so the digest and the stamper
 * stay in lock-step: stamp-version writes ONLY `contractVersion` into a fixture, and that
 * is exactly what this removes. A contract version bump can no longer, by itself, trip
 * the guard, while any authored change still moves the hash.
 *
 * Ruling: RULING-corpus-digest-hashes-authored-not-stamped-2026-09-06 (decision b).
 * Principle: a-digest-must-hash-what-is-authored-not-what-is-stamped.
 * test/guard/digest-version-independent.test.ts proves both directions and that
 * stamp-version stamps no fixture field beyond contractVersion.
 */
const STAMPED_CONTRACT_VERSION = /("contractVersion"\s*:\s*")[^"]*(")/g;

/** Replace the stamped contractVersion value with a fixed sentinel — version-independent. */
export const stripStampedVersion = (buf: Buffer): Buffer =>
  Buffer.from(buf.toString('utf8').replace(STAMPED_CONTRACT_VERSION, '$1(stamped)$2'), 'utf8');

const sha256 = (buf: Buffer): string =>
  createHash('sha256').update(stripStampedVersion(buf)).digest('hex');

/**
 * Content only the genuine corpus can satisfy.
 *
 * These are deliberately NOT counts or shapes. A stub can satisfy a count. Each
 * of these is an exact value that had to be authored by the contract track, and
 * two of them are bilingual, so a Latin-only stub cannot fake them either.
 */
function assertPositiveContent(files: Map<string, unknown>): void {
  const get = (p: string): any => {
    const v = files.get(p);
    if (v === undefined) die('a declared fixture is missing', `${p} is not in the corpus.`);
    return v;
  };

  const s1 = get('mob-s1-safety/default.json');
  const smoke = (s1.events ?? []).find((e: any) => e?.reference === 'HS-2026-08-12-004417');
  if (!smoke) {
    die(
      'the positive assertion did not hold',
      'mob-s1-safety/default.json carries no event with reference HS-2026-08-12-004417.\n' +
        'That row is authored contract data; no stub, mock or empty corpus produces it.',
    );
  }
  if (smoke.title?.['zh-Hant'] !== '單位偵測到煙霧') {
    die(
      'the positive assertion did not hold',
      'Event HS-2026-08-12-004417 does not carry its Traditional Chinese title 單位偵測到煙霧.\n' +
        'A Latin-only stub reaches this line and fails here.',
    );
  }
  if (smoke.severity !== 'critical') {
    die('the positive assertion did not hold', 'HS-2026-08-12-004417 is not severity "critical".');
  }

  // The 2IoThub naming correction — ADR-007 D7 and AG-002-AG rule 3. If the corpus
  // ever regresses to the retired IoT2Hub spelling, this is where it is caught.
  const s2 = get('mob-s2-overview/default.json');
  const hub = (s2.integrationHealth ?? []).find((f: any) => f?.key === 'twoiothub');
  if (hub?.name !== '2IoThub') {
    die(
      'the positive assertion did not hold',
      `The 2IoThub integration feed is named ${JSON.stringify(hub?.name)}, expected "2IoThub".`,
    );
  }

  // The stuck approval S5 exists to carry. If this disappears, the most concrete
  // argument the project has for deciding the role list has been smoothed over.
  //
  // RE-POINTED AT UI-045, AND ONLY RE-POINTED. GEN-043 reshaped these fixtures to
  // the ADR-019 model, which retired `notice.approval.steps` and the
  // `awaiting-approval` spelling; the assertion this replaces was written against
  // the pre-ADR-019 placeholder and had become false about the frozen corpus, so
  // the app could not be generated at all. The EVIDENCE did not disappear — it
  // moved. A notice sitting at `pending_approval` that no role in any current
  // design can approve is still in the corpus, now in lifecycle.json, and the
  // approval concept still appears in detail.json as a disposition on the
  // assertion chain (ADR-019 D4: state is computed from that chain, never stored).
  // Both halves are asserted, because either one alone could be smoothed over
  // while the other survived.
  const s5cycle = get('mob-s5-notices/lifecycle.json');
  const stuck = (s5cycle.notices ?? []).find((n: any) => n?.lifecycleState === 'pending_approval');
  if (!stuck) {
    die(
      'the positive assertion did not hold',
      'mob-s5-notices/lifecycle.json carries no notice at lifecycleState "pending_approval".\n' +
        'That row is the project\'s most concrete argument for deciding the role list,\n' +
        'and it is evidence, not decoration.',
    );
  }
  const s5 = get('mob-s5-notices/detail.json');
  const approved = (s5.notice?.history ?? []).some((h: any) => h?.disposition === 'approval_granted');
  if (!approved) {
    die(
      'the positive assertion did not hold',
      'mob-s5-notices/detail.json has no approval_granted disposition in its history chain.\n' +
        'ADR-019 D4 makes that chain the whole answer to "what happened to this notice".',
    );
  }

  const src = get('mob-s1-safety/source.json');
  if (src.classification?.pemo?.policyVersion !== 'sev-policy-2026.08') {
    die('the positive assertion did not hold', 'source.json lost its ADR-006 C5 policy version.');
  }
}

let cached: Corpus | undefined;

export interface LoadOptions {
  /**
   * Skip ONLY the digest comparison. Every other guard still runs — structure,
   * manifest agreement, and the positive content assertions.
   *
   * Exactly one caller may pass this: tool/write-digest.ts. Found by a re-pin
   * dry run — the recorder called loadCorpus(), the digest check ran, and the
   * tool that exists to re-record a stale digest could not run BECAUSE the
   * digest was stale. A repair tool that is disabled by the condition it
   * repairs is not a repair tool.
   *
   * It is a narrow hole on purpose: skipping the digest still leaves the
   * positive assertions in force, so `pnpm run digest` cannot be used to bless a
   * stubbed or hollow corpus.
   */
  skipDigestCheck?: boolean;
}

/** Load the corpus, running the guard first. Throws rather than degrading. */
export function loadCorpus(options: LoadOptions = {}): Corpus {
  if (cached && !options.skipDigestCheck) return cached;

  if (!existsSync(CORPUS_DIR) || !statSync(CORPUS_DIR).isDirectory()) {
    die('the corpus directory does not exist', `${CORPUS_DIR} is not a directory.`);
  }

  const indexPath = join(CORPUS_DIR, 'index.json');
  if (!existsSync(indexPath)) {
    die('the fixture manifest is missing', `${indexPath} does not exist.`);
  }

  let manifest: Corpus['manifest'];
  try {
    manifest = JSON.parse(readFileSync(indexPath, 'utf8'));
  } catch (e) {
    die('the fixture manifest does not parse', String(e));
  }

  if (manifest.surface !== 'management') {
    die(
      'the corpus is not the management surface',
      `index.json declares surface ${JSON.stringify(manifest.surface)}, expected "management".\n` +
        'Pointing this app at the resident corpus would render plausible but wrong screens.',
    );
  }
  if (!Array.isArray(manifest.fixtures) || manifest.fixtures.length === 0) {
    die('the fixture manifest is empty', 'index.json declares no fixtures.');
  }

  const files = new Map<string, unknown>();
  const digests = new Map<string, string>();
  const clientOnly: ManifestEntry[] = [];

  for (const entry of manifest.fixtures) {
    if (entry.file === null || entry.file === undefined) {
      clientOnly.push(entry);
      continue;
    }
    const p = join(CORPUS_DIR, entry.file);
    if (!existsSync(p)) {
      die('a declared fixture does not exist', `${entry.file} is declared in index.json but absent.`);
    }
    const buf = readFileSync(p);
    if (buf.byteLength === 0) {
      die('a declared fixture is empty', `${entry.file} is a zero-byte file.`);
    }
    try {
      files.set(entry.file, JSON.parse(buf.toString('utf8')));
    } catch (e) {
      die('a declared fixture does not parse', `${entry.file}: ${String(e)}`);
    }
    digests.set(entry.file, sha256(buf));
  }

  digests.set('index.json', sha256(readFileSync(indexPath)));

  assertPositiveContent(files);

  // The committed digest file. Absent on the very first generation run, which is
  // why this is tolerant of absence and strict about mismatch.
  if (existsSync(DIGEST_FILE) && !options.skipDigestCheck) {
    const recorded: Record<string, string> = JSON.parse(readFileSync(DIGEST_FILE, 'utf8')).digests;
    const drifted: string[] = [];
    for (const [file, digest] of digests) {
      const was = recorded[file];
      if (was === undefined) drifted.push(`${file}: NEW, not in the recorded digest`);
      else if (was !== digest) drifted.push(`${file}: content changed`);
    }
    for (const file of Object.keys(recorded)) {
      if (!digests.has(file)) drifted.push(`${file}: RECORDED BUT NOW MISSING`);
    }
    if (drifted.length > 0) {
      die(
        'the corpus has changed since it was recorded',
        `${drifted.length} difference(s):\n  ${drifted.join('\n  ')}\n\n` +
          'The corpus is read-only to this PID. If the contract track changed it — for\n' +
          'example to resolve UI-019-ST finding F1 — re-run `pnpm run digest`, re-read the\n' +
          'change and re-verify the screens against it. Do not re-record it blindly.',
      );
    }
  }

  cached = { manifest, files, clientOnly, digests };
  return cached;
}

/** A fixture body by manifest-relative path. Throws if it is not declared. */
export function fixture(path: string): unknown {
  const { files } = loadCorpus();
  const v = files.get(path);
  if (v === undefined) die('a fixture was requested that is not declared', `${path} is not in index.json.`);
  return v;
}

export function readSeverityJson(): any {
  if (!existsSync(SEVERITY_JSON)) {
    die('severity.json is missing', `${SEVERITY_JSON} does not exist. Design tokens cannot be generated.`);
  }
  return JSON.parse(readFileSync(SEVERITY_JSON, 'utf8'));
}
