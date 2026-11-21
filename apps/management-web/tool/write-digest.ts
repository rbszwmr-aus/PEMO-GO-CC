/**
 * Records the corpus digest. Run deliberately, never automatically.
 *
 * The corpus is READ-ONLY to this PID. If it changes — for example when the
 * contract track resolves UI-019-ST finding F1 — the guard fails and says so,
 * and re-recording is a decision a person takes after reading the change.
 * Re-recording on every run would turn the guard into a rubber stamp.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ROOT, CORPUS_DIR, loadCorpus } from './corpus-source.ts';

// skipDigestCheck: this tool exists to re-record a digest that no longer matches,
// so it must not be blocked by the mismatch it is being run to resolve. Every
// other guard — structure, manifest agreement, the positive content assertions —
// still runs, so this cannot bless a stubbed corpus.
const { digests, manifest } = loadCorpus({ skipDigestCheck: true });
const body =
  JSON.stringify(
    {
      $comment:
        'Digest of the management-web fixture corpus, recorded by tool/write-digest.ts. ' +
        'The corpus is read-only to UI-019-ST; a mismatch means it changed underneath this app ' +
        'and must be re-read, not re-recorded blindly. Version-INDEPENDENT (UI-066): the ' +
        'stamped contractVersion is excluded from every hash, so a contract bump does not move it.',
      // Repo-relative, never worktree-relative. This recorded the path from the
      // WORKTREE name down, so re-recording in a different worktree produced a
      // spurious diff — a committed artefact carrying a fact about the machine
      // it was made on. Found when a restore-verification compared the file
      // before and after and they differed for no substantive reason.
      recordedFrom: CORPUS_DIR.slice(CORPUS_DIR.indexOf('tests/fixtures')),
      // No contractVersion here (UI-066): the digest is now version-INDEPENDENT — the
      // stamped contractVersion is excluded from every hash — so recording one version
      // number would be a stale, misleading note, the very stamped-field-as-if-authored
      // coupling this PID removes. Nothing reads it (loadCorpus reads only `.digests`).
      versionIndependent: true,
      surface: manifest.surface,
      algorithm: 'sha256',
      fileCount: digests.size,
      digests: Object.fromEntries([...digests].sort(([a], [b]) => a.localeCompare(b))),
    },
    null,
    2,
  ) + '\n';

writeFileSync(join(APP_ROOT, 'corpus-digest.json'), body, 'utf8');
console.log(`recorded ${digests.size} digests to corpus-digest.json`);
