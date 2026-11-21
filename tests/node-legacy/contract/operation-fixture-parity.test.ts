/**
 * EVERY OPERATION A CONTRACT DECLARES HAS A FIXTURE (GEN-047 D3, closing UI-045 G1).
 *
 * ─── WHY ─────────────────────────────────────────────────────────────────────
 *
 * `GEN-042` shipped eleven notice write routes plus R1 and R3 with no fixtures.
 * Its own report said so — *"No fixtures were added for the new operations"* —
 * `GEN-043` repeated the sentence, and neither close ruling caught it. `UI-045`
 * then found it the expensive way: it could not build the outstanding-acknowledgement
 * screen, because a render path no fixture can reach is untested code that looks
 * finished, and the only way to exercise it would have been to invent who was told
 * what. A fixture is what lets a client be built against an operation before the
 * server is reachable, so an operation without one is uncontracted in practice
 * while looking contracted on paper.
 *
 * The gap survived because it was reported in PROSE. This is the same fact as an
 * assertion: AN OPERATION WITHOUT A FIXTURE IS A RED, NOT A REPORT LINE.
 *
 * ─── DERIVED FROM THE CONTRACT, NOT FROM A LIST ──────────────────────────────
 *
 * The subject is every `operationId` in the OpenAPI document, so an operation is
 * covered by this check the moment it is declared — there is no list to remember
 * to extend, which is `[correlated-lists-certify-nothing]`: the person who forgets
 * the fixture is the person who would have kept the list.
 *
 * `fixture-debt.json` names the operations that predate the check, each with an
 * owing PID and a reason. It is a debt with a creditor, not a permission — a NEW
 * operation shipping without a fixture is still a red, which is the case that
 * actually matters.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SURFACES = ['management-web', 'resident-mobile'] as const;

const read = (p: string) => readFileSync(resolve(REPO, p), 'utf8');

const declaredOperations = (surface: string): string[] => {
  const doc = parse(read(`packages/api-contracts/${surface}/openapi.yaml`)) as {
    paths: Record<string, Record<string, { operationId?: string }>>;
  };
  const out: string[] = [];
  for (const methods of Object.values(doc.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      if (op && typeof op === 'object' && typeof op.operationId === 'string') out.push(op.operationId);
    }
  }
  return out;
};

const coveredOperations = (surface: string): Set<string> => {
  const idx = JSON.parse(read(`tests/fixtures/${surface}/index.json`)) as {
    fixtures: { operationId?: string }[];
  };
  return new Set(idx.fixtures.map((f) => f.operationId).filter((o): o is string => typeof o === 'string'));
};

interface Debt { surface: string; operationId: string; owedBy: string; reason: string }
const debts = (JSON.parse(read('tests/fixtures/fixture-debt.json')) as { debts: Debt[] }).debts;

test('every declared operation has a fixture, or a named debt', () => {
  const undeclared: string[] = [];
  let checked = 0;
  for (const surface of SURFACES) {
    const declared = declaredOperations(surface);
    const covered = coveredOperations(surface);
    const owed = new Set(debts.filter((d) => d.surface === surface).map((d) => d.operationId));
    for (const op of declared) {
      checked++;
      if (covered.has(op) || owed.has(op)) continue;
      undeclared.push(`${surface}:${op}`);
    }
  }
  // VACUITY REFUSAL. A check that reads no operations passes forever.
  assert.ok(checked > 20, `only ${checked} operations were read — this check is not seeing the contracts`);
  assert.deepEqual(undeclared, [],
    'these operations are declared by a contract, have no fixture, and are not in '
    + 'fixture-debt.json. A client cannot be built against them, and an operation '
    + 'without a fixture is a RED, not a report line (GEN-047 D3).');
});

test('the debt list is honest: nothing in it already has a fixture', () => {
  const stale = debts.filter((d) => coveredOperations(d.surface).has(d.operationId));
  assert.deepEqual(stale.map((d) => `${d.surface}:${d.operationId}`), [],
    'a debt that has been paid must leave the list, or the list stops describing '
    + 'anything and starts excusing everything');
});

test('every debt names an owner and a reason', () => {
  for (const d of debts) {
    assert.ok(d.owedBy && d.reason, `${d.surface}:${d.operationId} is owed by nobody, for no reason`);
  }
});

test('GEN-042 operations are covered — the breach UI-045 G1 found is closed', () => {
  const notices = [
    ...['composeNotice', 'reviseNotice', 'submitNotice', 'approveNotice', 'declineNotice',
        'publishNotice', 'correctNotice', 'withdrawNotice', 'getNoticeOutstanding']
      .map((o) => ['management-web', o] as const),
    ...['getMyNotices', 'markNoticeRead', 'acknowledgeNotice', 'respondToNotice']
      .map((o) => ['resident-mobile', o] as const),
  ];
  const missing = notices.filter(([s, o]) => !coveredOperations(s).has(o)).map(([s, o]) => `${s}:${o}`);
  assert.deepEqual(missing, [],
    'these are the operations GEN-042 shipped without fixtures; they are the reason '
    + 'this check exists and must not regress');
});

test('A5 — the container list is fixtured in BOTH states: a node with acts and a node without', () => {
  // Amendment 1, A5. A fixture that showed only the populated state would let a
  // client never render the empty one, and a fixture that showed only the empty
  // state is indistinguishable from a field nobody fills in.
  const scope = JSON.parse(read('tests/fixtures/management-web/scope/default.json')) as {
    nodes: { permittedActions?: string[] }[];
  };
  const populated = scope.nodes.filter((n) => (n.permittedActions ?? []).length > 0).length;
  const empty = scope.nodes.filter((n) => n.permittedActions !== undefined && n.permittedActions.length === 0).length;
  assert.ok(populated >= 1, 'no scope node carries a permitted creation act');
  assert.ok(empty >= 1, 'no scope node shows the empty list — the field would be indistinguishable from unfilled');
});

// ─── PROBLEM-TYPE PARITY (GEN-052 D1, from UI-051 G1) ──────────────────────
// Operation parity let G1 through: `notice-incomplete-translation` was DECLARED
// and no fixture in the corpus carried it, because parity asked "does every
// operation have a fixture?" and never "does every refusal?". A client cannot
// render a refusal state it has never seen. Same shape as the operation rule:
// derived from the contract text, with a named debt list for what predates it.
const declaredProblemTypes = (surface: string): string[] =>
  [...new Set([...read(`packages/api-contracts/${surface}/openapi.yaml`)
    .matchAll(/https:\/\/pemo\.local\/problems\/([a-z0-9-]+)/g)].map((m) => m[1]!))].sort();

const fixturedProblemTypes = (surface: string): Set<string> => {
  const idx = JSON.parse(read(`tests/fixtures/${surface}/index.json`)) as { fixtures: { file?: string | null }[] };
  const out = new Set<string>();
  for (const f of idx.fixtures) {
    if (!f.file) continue;
    try {
      const body = JSON.parse(read(`tests/fixtures/${surface}/${f.file}`)) as { type?: unknown };
      if (typeof body.type === 'string' && body.type.includes('/problems/')) out.add(body.type.split('/').pop()!);
    } catch { /* not a JSON body */ }
  }
  return out;
};
interface ProblemDebt { surface: string; problemType: string; owedBy: string; reason: string }
const problemDebts = (JSON.parse(read('tests/fixtures/problem-debt.json')) as { debts: ProblemDebt[] }).debts;

test('every declared Problem type has a fixture, or a named debt (UI-051 G1)', () => {
  const declared = declaredProblemTypes('management-web');
  assert.ok(declared.length > 10, `only ${declared.length} Problem types read — this check is not seeing the contract`);
  const have = fixturedProblemTypes('management-web');
  const owed = new Set(problemDebts.map((d) => d.problemType));
  const missing = declared.filter((t) => !have.has(t) && !owed.has(t));
  assert.deepEqual(missing, [], 'a declared refusal no client has ever seen is a screen state nobody can build');
});
test('the Problem debt list is honest: nothing in it is fixtured', () => {
  const have = fixturedProblemTypes('management-web');
  assert.deepEqual(problemDebts.filter((d) => have.has(d.problemType)).map((d) => d.problemType), []);
});
test('the notice refusals UI-051 named are fixtured', () => {
  const have = fixturedProblemTypes('management-web');
  for (const t of ['notice-incomplete-translation', 'notice-wrong-state', 'notice-stale-version'])
    assert.ok(have.has(t), `${t} has no fixture`);
});
test('a refusal fixture is named for the Problem it carries (UI-051 G2)', () => {
  const idx = JSON.parse(read('tests/fixtures/management-web/index.json')) as { fixtures: { file?: string | null }[] };
  for (const f of idx.fixtures) {
    if (!f.file || !/\/refusal-/.test(f.file)) continue;
    const body = JSON.parse(read(`tests/fixtures/management-web/${f.file}`)) as { type: string };
    const named = f.file.replace(/^.*\/refusal-/, '').replace(/\.json$/, '');
    const carried = body.type.split('/').pop()!.replace(/^notice-/, '');
    assert.equal(named, carried, `${f.file} carries ${body.type}`);
  }
});
