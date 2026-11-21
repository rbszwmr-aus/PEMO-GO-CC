/**
 * THE SUITE-RESULT PARSER READS ANY FORMAT AND NEVER GUESSES (GEN-048 F1).
 * `[a-parser-that-cannot-read-the-result-must-not-report-one]`.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const PARSER = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/governance/bin/parse-suite-result.mjs');
const parse = (input: string) => spawnSync('node', [PARSER], { input, encoding: 'utf8' }).stdout.trim();

test('tap format (CI) — the format that was misread as "did not run"', () => {
  assert.equal(parse('# tests 62\n# pass 62\n# fail 0\n# duration_ms 251\n'), 'RAN 62 0 0');
});
test('spec format (local TTY)', () => {
  assert.equal(parse('ℹ tests 62\nℹ pass 62\nℹ fail 0\nℹ skipped 0\nℹ duration_ms 251\n'), 'RAN 62 0 0');
});
test('a suite that RAN but whose counts are unreadable is an EXTRACTOR error, not a suite verdict', () => {
  // exactly the CI symptom: a duration and a skipped line, but no pass/fail the parser recognises
  assert.match(parse('# skipped 3\n# duration_ms 5361\n'), /^EXTRACTOR-ERROR/);
});
test('a suite that genuinely did not run is DID-NOT-RUN', () => {
  assert.equal(parse('some unrelated stderr noise\n'), 'DID-NOT-RUN');
});
test('the two must NEVER be conflated — a red suite must not read as green', () => {
  assert.equal(parse('# tests 62\n# pass 60\n# fail 2\n# duration_ms 251\n'), 'RAN 60 2 0',
    'a real failure count must survive the parser, in either format');
});
