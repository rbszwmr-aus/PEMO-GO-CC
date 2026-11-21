/**
 * A MALFORMED TARGET IS REFUSED WITH A PROBLEM, NEVER A 500 (GEN-053 D3).
 * The three CHECKs on notice_target (0127) — kind enum, kind↔id pairing, node-or-
 * location — each get an act-level refusal ahead of them, seen over HTTP.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
const MGMT = '/api/management-web/v0';
let harness: Harness;
const staff = () => ({ authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}`, 'idempotency-key': randomUUID() });
const compose = (targets: unknown) => harness.app.inject({ method: 'POST', url: `${MGMT}/notices`, headers: staff(), payload: {
  noticeType: 'general', titleEn: 'T', titleZhHant: '標', bodyEn: 'B', bodyZhHant: '內', targets } });
test.before(async () => { harness = await startHarness(); });
test.after(async () => { await harness.close(); });
for (const [name, targets] of [
  ['a node kind the schema does not carry (portfolio)', [{ nodeKind: 'portfolio', nodeId: 'pf_wingfu_residential' }]],
  ['a kind without an id', [{ nodeKind: 'building' }]],
  ['neither node nor location', [{}]],
] as const) {
  test(`${name} → 400 bad-request, not the CHECK's 500`, async () => {
    const r = await compose(targets);
    assert.equal(r.statusCode, 400, r.body);
    assert.match(r.body, /problems\/bad-request/);
  });
}
