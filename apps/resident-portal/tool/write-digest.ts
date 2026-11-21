/**
 * Records the corpus digest snapshot (corpus-digest.json). A SEPARATE, manual
 * step (`pnpm run digest`) — never folded into `generate`, so the digest check
 * in corpus-source.ts fails loudly when the contract track changes a fixture,
 * rather than being silently re-blessed on every build.
 */

import { writeFileSync } from 'node:fs';
import { DIGEST_FILE, loadCorpus } from './corpus-source.ts';

const { manifest, digests } = loadCorpus({ skipDigestCheck: true });
const out = {
  $comment: 'Digest snapshot of the READ-ONLY resident-portal fixtures. Re-run `pnpm run digest` only after a deliberate contract-track change.',
  surface: manifest.surface,
  contractVersion: manifest.contractVersion,
  digests: Object.fromEntries([...digests].sort(([a], [b]) => a.localeCompare(b))),
};
writeFileSync(DIGEST_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`wrote corpus-digest.json (${digests.size} entries)`);
