/**
 * AFFORDANCES ARE READ, NEVER REASONED — asserted over the source (UI-051 D1).
 *
 * The rule: a control renders iff its operationId is in the server's
 * `permittedActions`. Four properties of the source make that rule hard to break
 * by accident, and each is checked here:
 *
 *   1. the act vocabulary the client compiles against IS the contract's enum;
 *   2. exactly one file renders an act control (`data-act=`);
 *   3. that file reasons about nothing — no lifecycle, disposition or role
 *      literal (all three vocabularies DERIVED from the contract), no
 *      `lifecycleState` read, no `.role`;
 *   4. `permittedActions` is read by the affordance module and the type layer
 *      only, so a second decision procedure cannot grow elsewhere.
 *
 * The other direction — that what the server permitted IS on screen and nothing
 * else is — is asserted by rendering, in the state matrix and notices-write.spec.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';

import { APP_ROOT, MGMT_CONTRACT_DIR } from '../../tool/corpus-source.ts';
import { ACT_OPERATION_IDS, NOTICE_TRANSITIONS } from '../../src/data/types.ts';

const SRC = join(APP_ROOT, 'src');
const ACT_FILE = 'src/screens/NoticeActions.tsx';
const AFFORDANCE_FILE = 'src/data/affordances.ts';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.tsx?$/.test(e) && !/\.g\.ts$/.test(e)) out.push(p);
  }
  return out;
}

/** Source with comments stripped — a vocabulary NAMED in prose is documentation, not a branch. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

const contract = () =>
  parseYaml(readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8')) as any;

test('the act vocabulary is the contract’s enum, not a hand-list', () => {
  const doc = contract();
  const onNotice = doc.components.schemas.StaffNoticeDetail.properties.permittedActions.items.enum as string[];
  const onList = doc.components.schemas.StaffNoticeListItem.properties.permittedActions.items.enum as string[];
  const onNode = doc.components.schemas.ScopeTreeNode.properties.permittedActions.items.enum as string[];
  assert.ok(onNotice.length >= 18, `only ${onNotice.length} acts in the contract — the extractor is measuring nothing`);
  assert.deepEqual([...ACT_OPERATION_IDS].sort(), [...onNotice].sort(), 'ACT_OPERATION_IDS has drifted from StaffNoticeDetail.permittedActions');
  assert.deepEqual([...onList].sort(), [...onNotice].sort(), 'list and detail carry different act enums');
  assert.deepEqual([...onNode].sort(), [...onNotice].sort(), 'the container carries a different act enum from the object');

  // Every act operationId is a POST operation in the document, and every notice
  // transition is one of them.
  const src = readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8');
  for (const op of ACT_OPERATION_IDS) {
    assert.ok(new RegExp(`operationId: ${op}\\b`).test(src), `${op} is in the enum but is not an operation`);
  }
  for (const op of NOTICE_TRANSITIONS) assert.ok((ACT_OPERATION_IDS as readonly string[]).includes(op));
});

test('exactly one file renders an act control', () => {
  const renderers = sourceFiles(SRC)
    .filter((f) => /\bdata-act=/.test(code(f)))
    .map((f) => relative(APP_ROOT, f))
    .sort();
  assert.deepEqual(renderers, [ACT_FILE], `data-act is rendered outside ${ACT_FILE}: ${renderers.join(', ')}`);
});

test('the act-control file reasons about nothing — no state, disposition, role or scope-kind literal, no lifecycleState or depth read', () => {
  const doc = contract();
  const s = doc.components.schemas;
  const lifecycle = s.StaffNoticeDetail.properties.lifecycleState.enum as string[];
  const dispositions = s.NoticeHistoryEntry.properties.disposition.enum as string[];
  const roles = s.ConferGrantRequest.properties.role.enum as string[];
  // UI-054 D1: a compose entry drawn from a node's KIND or DEPTH is the same
  // defect one container over — the scope-kind vocabulary and `depth` are refused
  // in the act file for the same reason the lifecycle vocabulary is.
  const scopeKinds = s.ScopeRef.properties.kind.enum as string[];
  assert.ok(lifecycle.length >= 7 && dispositions.length >= 5 && roles.length >= 4 && scopeKinds.length >= 5, 'a vocabulary failed to derive');

  const body = code(join(APP_ROOT, ACT_FILE));
  const offences: string[] = [];
  for (const v of [...lifecycle, ...dispositions, ...roles, ...scopeKinds]) {
    if (new RegExp(`(['"\`])${v}\\1`).test(body)) offences.push(`literal "${v}"`);
  }
  for (const token of ['lifecycleState', 'disposition', 'stateEnteredAt', 'depth']) {
    if (new RegExp(`\\b${token}\\b`).test(body)) offences.push(`reads ${token}`);
  }
  if (/\.role\b/.test(body)) offences.push('reads .role');
  if (/\bgrants\b/.test(body)) offences.push('reads grants');
  assert.deepEqual(offences, [], `${ACT_FILE} is deciding visibility from something other than permittedActions:\n  ${offences.join('\n  ')}`);

  // And it decides through the affordance module, not on its own.
  assert.match(body, /from '\.\.\/data\/affordances\.ts'/, 'the act-control file does not import the affordance module');
  assert.match(body, /\b(permits|permittedOf)\(/, 'the act-control file never calls the affordance lookup');
});

test('permittedActions is read by the affordance module and the type layer only', () => {
  const readers = sourceFiles(SRC)
    .filter((f) => /\bpermittedActions\b/.test(code(f)))
    .map((f) => relative(APP_ROOT, f))
    .sort();
  assert.deepEqual(readers, [AFFORDANCE_FILE, 'src/data/types.ts'], `permittedActions is read outside the affordance module: ${readers.join(', ')}`);
});

test('the affordance module is a lookup, not a table', () => {
  const doc = contract();
  const lifecycle = doc.components.schemas.StaffNoticeDetail.properties.lifecycleState.enum as string[];
  const body = code(join(APP_ROOT, AFFORDANCE_FILE));
  for (const v of lifecycle) assert.ok(!new RegExp(`(['"\`])${v}\\1`).test(body), `affordances.ts carries the lifecycle literal "${v}"`);
  assert.ok(!/\blifecycleState\b/.test(body), 'affordances.ts reads lifecycleState');
  assert.match(body, /\.permittedActions\.includes\(/, 'the lookup is not a membership test on permittedActions');
});
