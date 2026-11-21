/**
 * The cross-schema discriminator, tested as a DECISION.
 *
 * GEN-011 extended boundary verification from `modules/` to `apps/` too. The
 * naive extension would have failed loudly and uselessly: `apps/api/src` holds
 * nine textual `<schema>.<name>` matches and all nine are benign — eight are
 * property access on a variable called `resident`, the ninth is a hostile input
 * string in the provocation corpus. Opening at a 100% false-positive rate is how
 * a guard gets switched off, which this repository has already paid for twice.
 *
 * So these tests assert BOTH directions on real files: a planted crossing is
 * caught, and the known-benign nine stay silent. Asserting only that the scan
 * runs would test the read; asserting both directions tests the decision.
 */

import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  EXEMPTIONS,
  UNSCANNED_ROOTS,
  findCrossSchemaSql,
  schemaForModuleDir,
  sqlStrings,
} from '../../apps/api/dist/cli/cross-schema-scan.js';
import { REPO_ROOT } from '../../apps/api/dist/testing/harness.js';

const read = (rel: string): Promise<string> => readFile(path.join(REPO_ROOT, rel), 'utf8');

/** The eight benign matches, by the file that holds them. Derived, not guessed. */
const BENIGN_PROPERTY_ACCESS = [
  'apps/api/src/context.ts',
  'apps/api/src/composition/account-projection.ts',
  'apps/api/src/composition/home-projection.ts',
];

test('the benign property accesses in apps/api are NOT reported', async () => {
  for (const rel of BENIGN_PROPERTY_ACCESS) {
    const body = await read(rel);
    // The file really does contain the text the naive check matched on: if this
    // stops being true the test below has become vacuous and must be re-aimed.
    assert.match(body, /\bresident\.[a-zA-Z]/, `${rel} no longer holds the shape under test`);
    assert.deepEqual(findCrossSchemaSql(rel, body, null), [], `${rel} was reported`);
  }
});

test('the provocation corpus is exempted BY NAME, and the exemption is what silences it', async () => {
  const rel = 'apps/api/src/testing/provocations.ts';
  const body = await read(rel);
  assert.match(body, /DROP TABLE home_safety\./, 'the provocation string has moved');

  // Silent as shipped...
  assert.deepEqual(findCrossSchemaSql(rel, body, null), []);
  // ...and silent because of the exemption, not because the discriminator is
  // blind to DDL. Scanned under any other path, the same bytes are reported.
  const unexempted = findCrossSchemaSql('apps/api/src/testing/elsewhere.ts', body, null);
  assert.equal(unexempted.length, 1, 'DDL crossing not caught when unexempted');
  assert.equal(unexempted[0]?.schema, 'home_safety');
});

test('a PLANTED crossing is caught — the check can go red', async () => {
  const planted = `
    export const leak = async (db: ModuleDb) =>
      db.query('SELECT event_id FROM home_safety.safety_event LIMIT 1');
  `;
  const findings = findCrossSchemaSql('apps/api/src/composition/leak.ts', planted, null);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.schema, 'home_safety');
  assert.equal(findings[0]?.match, 'home_safety.safety_event');
});

test('a planted crossing is caught in a MODULE too, and its own schema is not a crossing', () => {
  const planted = `const q = 'SELECT 1 FROM access.staff_principal';`;
  assert.equal(findCrossSchemaSql('modules/resident/src/x.ts', planted, schemaForModuleDir('resident')).length, 1);

  const own = `const q = 'SELECT 1 FROM resident.household';`;
  assert.deepEqual(findCrossSchemaSql('modules/resident/src/x.ts', own, schemaForModuleDir('resident')), []);

  // home-safety → home_safety. A dash/underscore slip here would make every
  // Home Safety file report a crossing into its own schema.
  const ownHs = `const q = 'SELECT 1 FROM home_safety.safety_event';`;
  assert.deepEqual(findCrossSchemaSql('modules/home-safety/src/x.ts', ownHs, schemaForModuleDir('home-safety')), []);
});

test('the sanctioned crossing is exempted NARROWLY — the file is not blanket-exempt', async () => {
  const rel = 'modules/platform/src/audit/audited-write.ts';
  const body = await read(rel);
  assert.match(body, /access\.append_audit_event/, 'the primitive no longer writes the audit table');
  assert.deepEqual(findCrossSchemaSql(rel, body, 'platform'), [], 'the sanctioned crossing was reported');

  // The exemption is (file, schema). A crossing into a DIFFERENT schema from the
  // same file is still caught — otherwise the primitive would be a hole rather
  // than a door.
  const smuggled = body + `\nconst x = 'SELECT * FROM resident.household';\n`;
  const findings = findCrossSchemaSql(rel, smuggled, 'platform');
  assert.equal(findings.length, 1, 'a second crossing from the exempted file went unseen');
  assert.equal(findings[0]?.schema, 'resident');
});

test('exemptions are a closed, named list', () => {
  assert.deepEqual(
    EXEMPTIONS.map((e) => `${e.file} → ${e.schema}`).sort(),
    [
      'apps/api/src/testing/provocations.ts → home_safety',
      'modules/platform/src/audit/audited-write.ts → access',
    ],
    'the sanctioned-crossing list changed — that is a boundary decision, not a refactor',
  );
  for (const e of EXEMPTIONS) assert.ok(e.reason.length > 40, `${e.file} has no stated reason`);
});

test('the tokeniser does not mistake code, comments or non-SQL strings for SQL', () => {
  // A comment is not code.
  assert.deepEqual(findCrossSchemaSql('x.ts', `// SELECT * FROM access.audit_event\n`, null), []);
  assert.deepEqual(findCrossSchemaSql('x.ts', `/* SELECT FROM access.audit_event */`, null), []);
  // A string with no SQL verb is not a statement.
  assert.deepEqual(findCrossSchemaSql('x.ts', `const k = 'access.audit_event';`, null), []);
  // Bare property access is never SQL, however SQL-ish the surrounding file.
  assert.deepEqual(findCrossSchemaSql('x.ts', `const q='SELECT 1'; return access.audit_event;`, null), []);
  // An apostrophe inside a double-quoted string must not desynchronise the scan.
  assert.deepEqual(sqlStrings(`const a = "it's fine"; const b = 'SELECT 1 FROM t';`), ["'SELECT 1 FROM t'"]);
  // A template literal is scanned, including one carrying an interpolation.
  const tpl = 'const q = `SELECT * FROM access.audit_event WHERE id = ${id}`;';
  assert.equal(findCrossSchemaSql('x.ts', tpl, null).length, 1);
  // Quoted identifiers are the same reach by another spelling.
  assert.equal(findCrossSchemaSql('x.ts', `const q = 'SELECT 1 FROM "access"."audit_event"';`, null).length, 1);
});

test('[probe-must-bite] UI-054 exact line — a printed x.notices.length is NOT a crossing (GEN-059)', () => {
  // The line that reddened main at 9063278. It runs no SQL; `notices.length` is a
  // JS property access on `l.data.notices`, spliced into a log template. The word
  // "from" ("from this run") is the only SQL verb, and it is prose.
  const line =
    "say(`${who}: ${l.data.notices.length} notices visible, ${mine.length} from this run`);";
  assert.deepEqual(
    findCrossSchemaSql('apps/management-web/tool/live-exercise.ts', line, null), [],
    'a printed interpolated x.notices.length must not be read as a cross-schema SQL statement',
  );
});

test('[probe-must-bite] the same qualified name as LITERAL SQL text still reds — the control (GEN-059)', () => {
  // Instrument control for the test above: change only WHERE the token sits.
  // Interpolated `${x.notices.length}` -> silent; written into the SQL text -> caught.
  const real = "const q = 'SELECT count FROM notices.notice WHERE id = 1';";
  const findings = findCrossSchemaSql('apps/management-web/tool/live-exercise.ts', real, null);
  assert.equal(findings.length, 1, 'a real crossing written as literal SQL text must still red');
  assert.equal(findings[0]?.schema, 'notices');
});

test('a SQL verb that appears only inside an interpolation cannot promote a bare property access (GEN-059)', () => {
  // `${sql.SELECT}` carries the word SELECT, but it is a JS member access evaluated
  // to a value. The static text is "print  access.foo", which has no verb, so the
  // qualified name is not a statement. Reading the verb from static text is what
  // makes this silent rather than a fresh false positive.
  const src = 'const m = `print ${sql.SELECT} access.foo`;';
  assert.deepEqual(findCrossSchemaSql('x.ts', src, null), []);
});

test('what the ban does NOT cover is recorded, with reasons', () => {
  // A tree nobody scans and nobody documents is indistinguishable from a tree
  // nobody thought about. tests/** in particular is a decision (fixtures are
  // owner work, GEN-010), and it carries a residual that must stay visible.
  const roots = UNSCANNED_ROOTS.map((u) => u.root);
  assert.ok(roots.includes('tests/**'), 'the tests/** exemption is no longer recorded');
  for (const u of UNSCANNED_ROOTS) assert.ok(u.reason.length > 40, `${u.root} has no stated reason`);
  const tests = UNSCANNED_ROOTS.find((u) => u.root === 'tests/**');
  assert.match(tests?.reason ?? '', /RESIDUAL/, 'the tests/** residual is no longer stated');
});
