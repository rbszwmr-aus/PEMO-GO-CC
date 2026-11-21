/**
 * THE PARITY HARNESS, tested without a database and without a seeded world.
 *
 * This proves the DERIVATION, which is the part that has to survive the corpus
 * reconciliation. Reproducing bodies is Step 4's job and needs the merge; proving
 * that the mechanism is rename-proof does not, and waiting for the merge to find
 * out would be finding out at the worst moment.
 *
 * The strongest claim available before the merge is made here directly: apply the
 * rename to a fixture IN MEMORY and assert the derived request follows it, with
 * no line of this file mentioning either the old identifier or the new one as a
 * routing constant.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFixture, readManifest } from '../../apps/api/dist/testing/harness.js';
import { loadContractValidator } from '../../apps/api/dist/testing/contract-validator.js';
import { derive, deriveRequest, DerivationError } from '../../apps/api/dist/testing/parity-harness.js';

const validator = await loadContractValidator('management');
const manifest = await readManifest('management');
/**
 * RESPONSE fixtures only.
 *
 * This harness asks whether a fixture can state the request that produced it, and
 * that question presupposes the fixture IS a response — it derives the subject and
 * the correlation identifier from the body. `GEN-047` added REQUEST fixtures for
 * the eleven write operations `GEN-042` shipped without any (`UI-045` G1), and a
 * request body has neither a `meta.correlationId` nor a subject to derive: it is
 * the input, not the echo.
 *
 * They are EXCLUDED BY A DECLARED PROPERTY, `bodyKind: "request"`, not by a name
 * pattern — a filename convention is a rule nobody can see from the manifest, and
 * the next person to add `foo-request.json` for some other reason would be
 * silently exempted. The count assertion below still holds them to being a closed
 * set rather than a growing one.
 */
const served = manifest.fixtures.filter(
  (e) => e.file !== null && e.operationId !== undefined
      && (e as { bodyKind?: string }).bodyKind !== 'request');

/**
 * TWO KINDS OF EXCEPTION, KEPT APART ON PURPOSE.
 *
 * One is legitimate and permanent; the other is a finding. Merging them into a
 * single `OVERRIDES` map would let the finding be maintained instead of fixed,
 * which is how a defect becomes a convention.
 */

/**
 * REFUSED SUBJECT — legitimate. A Problem body describes a request that was
 * REFUSED, and RFC 9457 gives it nowhere to name the identifier that was refused.
 * No fixture change could fix this; the value must come from the caller.
 */
const REFUSED_SUBJECT: Record<string, Record<string, string>> = {
  'problems/restricted-projection.json': { eventId: 'evt_unreachable' },
  'problems/record-not-found.json': { noticeId: 'ntc_missing' },
  'problems/communications-unavailable.json': { chargeId: 'chg_unavailable' },
  // GEN-047 recorded a refusal per write surface, so the refusals stopped living
  // only under `problems/`. See `isProblemBody` — the exemption is now decided by
  // what the body IS, not by where the file sits.
  'notices/refusal-stale-version.json': { noticeId: 'ntc_stale' },
  'notices/refusal-wrong-state.json': { noticeId: 'ntc_wrong_state' },
  'notices/refusal-out-of-scope.json': { noticeId: 'ntc_out_of_scope' },
  // GEN-052 D1: one fixture per notice Problem type.
  'notices/refusal-approval-required.json': { noticeId: 'ntc_gated' },
  'notices/refusal-incomplete-translation.json': { noticeId: 'ntc_half' },
  'notices/refusal-not-found.json': { noticeId: 'ntc_does_not_exist' },
  'notices/refusal-retargeting-forbidden.json': { noticeId: 'ntc_live' },
  'notices/refusal-schedule-inverted.json': { noticeId: 'ntc_inverted' },
  'notices/refusal-empty-audience.json': { noticeId: 'ntc_empty' },
};

/**
 * A Problem is recognised BY ITS SHAPE, not by its path.
 *
 * The exemption above is legitimate for exactly one reason: RFC 9457 gives a
 * Problem nowhere to name the identifier that was refused. That reason is a fact
 * about the BODY, and keying it on a `problems/` filename made it a fact about
 * the directory instead — so `GEN-047`'s per-operation refusal fixtures, which
 * are Problems living beside the operation they refuse, were treated as
 * success fixtures that had failed to name their subject.
 */
const isProblemBody = (body: unknown): boolean =>
  typeof body === 'object' && body !== null
  && typeof (body as { type?: unknown }).type === 'string'
  && typeof (body as { status?: unknown }).status === 'number';

/**
 * UNSTATED SUBJECT — F-parity-1, a corpus finding this harness produced on its
 * first run.
 *
 * These are 200 responses to `/safety/events/{eventId}/…` that never name the
 * event they belong to. Their sibling `mob-s1-safety/detail.json` — the same
 * event, the parent resource — does carry `event.eventId`, so this is an
 * inconsistency within one screen's corpus rather than a property of the shape.
 *
 * WHY IT MATTERS, and it is not pedantry: a sub-resource fixture that does not
 * name its parent is green for WHATEVER event the test chooses. The bytes match;
 * the claim that they are the delivery record OF THAT EVENT is asserted nowhere.
 * That is the third instance of one shape this PID has recorded — a value and its
 * stated basis, `window.returned` against its event array, identifiers across
 * corpora — two assertions with nothing comparing them.
 *
 * The value used is `detail.json`'s event, DERIVED rather than typed, so this
 * stop-gap is itself rename-proof and cannot drift from the corpus while it
 * stands. It is a stop-gap: the fix is the contract track adding the identifier
 * to these three bodies, and the assertion below stops the set growing meanwhile.
 */
const UNSTATED_SUBJECT = ['mob-s1-safety/delivery.json', 'mob-s1-safety/source.json', 'mob-s1-safety/source-unmapped.json'];

const detail = await readFixture('mob-s1-safety/detail.json', 'management');
const SUBJECT_EVENT = derive(detail, 'eventId', 'mob-s1-safety/detail.json').value;

const overridesFor = (file: string): Record<string, string> =>
  REFUSED_SUBJECT[file] ?? (UNSTATED_SUBJECT.includes(file) ? { eventId: SUBJECT_EVENT } : {});

test('every management fixture states its own request', async () => {
  const report: string[] = [];
  for (const entry of served) {
    const body = await readFixture(entry.file!, 'management');
    const operation = validator.operations.get(entry.operationId!);
    assert.ok(operation, `${entry.file}: the contract has no operation ${entry.operationId}`);

    const request = deriveRequest(operation, entry, body, overridesFor(entry.file!));

    assert.equal(request.method, operation.method.toUpperCase());
    assert.doesNotMatch(request.url, /[{}]/, `${entry.file}: unsubstituted parameter`);
    assert.ok(request.correlationId.length > 0);
    report.push(`${entry.file} → ${request.method} ${request.url}`);
  }
  assert.equal(report.length, served.length);
  for (const line of report) console.log(`      ${line}`);
});

test('every exception is counted, and the finding cannot grow quietly', async () => {
  // A named exception that nobody counts becomes a default.
  for (const file of Object.keys(REFUSED_SUBJECT)) {
    const body = await readFixture(file, 'management');
    assert.ok(isProblemBody(body),
      `${file} is not a Problem body and must derive its own inputs`);
    assert.ok(served.some((e) => e.file === file), `${file} is not in the manifest`);
  }

  // F-parity-1 pinned to exactly the fixtures found, so a fourth one arriving is
  // a failure rather than one more line in a list.
  const unstated: string[] = [];
  for (const entry of served) {
    const operation = validator.operations.get(entry.operationId!)!;
    const body = await readFixture(entry.file!, 'management');
    // A Problem cannot name its refused subject; it is not an unstated SUCCESS.
    // Decided by the body, not the directory — see `isProblemBody`.
    if (isProblemBody(body)) continue;
    for (const parameter of operation.parameters) {
      if (parameter.in !== 'path') continue;
      try {
        derive(body, parameter.name, entry.file!);
      } catch {
        unstated.push(entry.file!);
      }
    }
  }
  assert.deepEqual(
    unstated.sort(),
    [...UNSTATED_SUBJECT].sort(),
    'a success fixture that does not name its own subject is F-parity-1; fix the fixture rather than extending the list',
  );

  console.log(
    `      ${Object.keys(REFUSED_SUBJECT).length} legitimate (Problem bodies), ${UNSTATED_SUBJECT.length} F-parity-1 (corpus finding)`,
  );
});

test('THE RECONCILIATION LANDED — and this is what the merge-property test became', async () => {
  /**
   * HISTORY, KEPT BECAUSE THE RETIREMENT IS THE INTERESTING PART.
   *
   * Before the merge this position held `THE MERGE PROPERTY`: it applied the
   * pending rename to each fixture in memory and asserted the derived request
   * followed. It ended with a guard — *"the rename must actually touch this
   * corpus, or the test proves nothing"*.
   *
   * On the first run after pinning `55512245`, that guard **fired**. The old
   * identifiers were gone, so the substitution matched nothing, and rather than
   * passing over an empty loop the test went red. That is the assertion working
   * at the one moment it could be checked: a test whose subject has been fixed
   * must stop passing, not start passing for free. The alternative — a green run
   * over zero fixtures — is how a check quietly stops checking.
   *
   * Its durable half is `the derivation is TOTAL`, below, which renames EVERY
   * minted identifier and depends on no particular merge. So the merge-specific
   * half is not deleted but replaced by the claim that outlived it: the
   * reconciliation happened and must not come back.
   */
  const OLD = ['unt_a_12_a1', 'est_wfg', 'org_wfp'];
  const seen: string[] = [];

  for (const entry of served) {
    const raw = JSON.stringify(await readFixture(entry.file!, 'management'));
    for (const identifier of OLD) {
      // `est_wfg` is a prefix of nothing in the new scheme, but check on a word
      // boundary anyway: a substring match would make this fail for the wrong
      // reason the moment somebody mints `est_wfg_annexe`.
      if (new RegExp(`"[^"]*\\b${identifier}\\b[^"]*"`).test(raw)) seen.push(`${entry.file}:${identifier}`);
    }
  }

  assert.deepEqual(
    seen,
    [],
    'the management corpus named the same company differently from the seeded world; that was reconciled by API-020-ST and must not return',
  );
  console.log(`      ${served.length} fixtures carry none of the ${OLD.length} superseded identifiers`);
});

test('the derivation is TOTAL, not merely adequate for this one merge', async () => {
  /**
   * The test above proves the harness survives THE rename that is coming. It is
   * thin on its own: that map moves exactly one derived URL, because the other
   * two identifiers never appear in a path position. One moving request is a
   * weak basis for a claim about a mechanism.
   *
   * So this asserts the general property instead — rename EVERY minted identifier
   * in every fixture, and every derived URL that carries one must move. A harness
   * that had transcribed even one path identifier would leave a URL behind here,
   * whether or not the actual merge happened to touch it.
   */
  const MINTED = /"([a-z]{3,4}_[a-z0-9_]+)"/g;
  let checked = 0;

  for (const entry of served) {
    const operation = validator.operations.get(entry.operationId!)!;
    if (!operation.route.includes('{')) continue;

    const original = await readFixture(entry.file!, 'management');
    if (isProblemBody(original)) continue;
    const rewritten = JSON.parse(JSON.stringify(original).replace(MINTED, '"$1_moved"'));

    // The stop-gap identifier for F-parity-1 is derived from detail.json, which
    // this mutation does not rewrite, so those three are excluded from the claim
    // rather than passing on a constant. Naming that here is the point of the
    // exclusion: an unstated subject cannot demonstrate rename-safety.
    if (UNSTATED_SUBJECT.includes(entry.file!)) continue;

    const before = deriveRequest(operation, entry, original);
    const after = deriveRequest(operation, entry, rewritten);
    assert.notEqual(after.url, before.url, `${entry.file}: the derived URL did not move — an identifier is transcribed somewhere`);
    // The suffix used to be asserted as `${before.url}_moved`, which quietly
    // assumed the identifier is the LAST segment of the route. Every fixture this
    // harness had until GEN-047 was a read whose parameter ended the path
    // (`/safety/events/{eventId}`); the notice write routes are the first where it
    // does not (`/notices/{noticeId}/revise`), and the assertion failed for the
    // route's shape rather than for anything being transcribed. Stripping the
    // marker and requiring the original back is the same claim without the
    // positional assumption: every identifier moved, and nothing else did.
    assert.equal(after.url.replaceAll('_moved', ''), before.url,
      `${entry.file}: the derived URL changed by more than the rename`);
    checked += 1;
  }

  assert.ok(checked >= 2, `only ${checked} path-parameterised fixtures could be checked`);
  console.log(`      ${checked} path-parameterised fixtures, every derived URL followed a total rename`);
});

test('RED — a missing input throws and names it, rather than defaulting', () => {
  const operation = validator.operations.get('getUnitDetail')!;
  const entry = { file: 'mutant/no-unit.json', screen: 'mob-s3-properties', state: 'mutant' };
  const body = { meta: { correlationId: '2b3c4d5e-0000-4000-8000-000000000011' }, unit: { label: {} } };

  assert.throws(
    () => deriveRequest(operation, entry, body),
    (error: unknown) =>
      error instanceof DerivationError &&
      error.parameter === 'unitId' &&
      /does not carry it/.test(error.message),
    'a fixture that cannot state its own request must fail loudly',
  );

  // Control, after the mutation: the real fixture still derives.
  assert.ok(deriveRequest(operation, entry, {
    meta: { correlationId: 'c' },
    unit: { unitId: 'unt_x' },
  }).url.endsWith('unt_x'));
});

test('RED — two different values for one name is ambiguous, not shallowest-wins', () => {
  const body = {
    meta: { correlationId: 'c' },
    unit: { unitId: 'unt_a' },
    related: { other: { unitId: 'unt_b' } },
  };
  assert.throws(
    () => derive(body, 'unitId', 'mutant/ambiguous.json'),
    (error: unknown) =>
      error instanceof DerivationError && /2 different values/.test(error.message) && /unt_a/.test(error.message),
  );

  // Agreeing repetition is NOT ambiguous — that is the ordinary case and must
  // keep working, or the guard would reject every list fixture.
  const agreeing = { unit: { unitId: 'unt_a' }, rows: [{ unitId: 'unt_a' }, { unitId: 'unt_a' }] };
  assert.equal(derive(agreeing, 'unitId', 'f.json').value, 'unt_a');
});

test('RED — a fixture with no correlation identifier is refused', () => {
  const operation = validator.operations.get('getOverview')!;
  assert.throws(
    () => deriveRequest(operation, { file: 'f.json', screen: 's', state: 'x' }, { meta: {} }),
    (error: unknown) => error instanceof DerivationError && error.parameter === 'correlationId',
  );
  // Both declared envelopes are accepted, neither is invented.
  assert.equal(
    deriveRequest(operation, { file: 'f.json', screen: 's', state: 'x' }, { correlationId: 'p' }).correlationId,
    'p',
  );
});

test('the harness reads path-level parameters, not only operation-level ones', () => {
  // A required path parameter declared once for the path applies to every method
  // under it. Missing them produces a URL with a literal brace, which reads like
  // a routing bug rather than a contract-reading bug.
  const withPathParams = [...validator.operations.values()].filter((o) => o.route.includes('{'));
  assert.ok(withPathParams.length > 0);
  for (const operation of withPathParams) {
    const names = operation.parameters.filter((p) => p.in === 'path').map((p) => p.name);
    for (const declared of operation.route.matchAll(/\{(\w+)\}/g)) {
      assert.ok(
        names.includes(declared[1]!),
        `${operation.operationId}: {${declared[1]}} is in the route but not in the parameter list`,
      );
    }
  }
});
