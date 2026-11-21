/**
 * The staff-context plumbing: token → scope → context, and the boundary that
 * makes the management surface safe before any endpoint consults it.
 *
 * Every management operation resolves its context through this one function, so
 * the properties asserted here hold for all of them at once:
 *   - a staff token resolves to that principal's scope, at one instant;
 *   - a RESIDENT token is refused — the namespace crossing fails;
 *   - a de-provisioned principal (no active grants) is NOT a 401; it resolves to
 *     an empty scope, because "may see nothing" is an authorization state.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { resolveStaffContext } from '../../apps/api/dist/management/staff-context.js';

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.close();
});

const CORRELATION = '2b3c4d5e-0000-4000-8000-000000000001';
const AT = new Date('2026-08-12T09:56:00+08:00');

const resolve = (header: string | undefined) =>
  resolveStaffContext(harness.modules.staffAuth, harness.modules.scope, header, CORRELATION, AT);

test('an estate-manager token resolves to that estate scope, at one instant', async () => {
  const token = `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}`;
  const result = await resolve(token);

  assert.ok(result.ok, 'a valid staff token resolves');
  assert.equal(result.context.principalId, 'stf_wfg_manager');
  assert.equal(result.context.organizationId, 'org_wingfu_holdings');
  assert.equal(result.context.correlationId, CORRELATION);
  assert.equal(result.context.now.toISOString(), AT.toISOString(), 'the presentation clock is the supplied one');

  // The grant is the estate. One grant, resolved once.
  assert.equal(result.context.scope.grants.length, 1);
  assert.equal(result.context.scope.grants[0]!.node.id, 'est_wing_fu_garden');
});

test('a RESIDENT token is refused — the namespace crossing fails', async () => {
  // Issued by the resident stub, cryptographically valid, and still not a staff
  // credential. This is the cross-surface guard the whole two-stub design exists
  // for.
  const residentToken = `Bearer ${harness.modules.auth.issue('res_wfg_000412')}`;
  const result = await resolve(residentToken);

  assert.ok(!result.ok, 'a resident token must not authenticate a staff request');
  assert.equal(result.reason, 'unauthenticated', 'and the reason is indistinguishable from any other credential failure');
});

test('the two credential failures are exactly two, and both are 401-shaped', async () => {
  // Absent and malformed both collapse to unauthenticated — the resident surface's
  // rule that the caller cannot tell which check failed.
  for (const header of [undefined, 'Bearer not-a-token', 'garbage']) {
    const result = await resolve(header);
    assert.ok(!result.ok);
    assert.equal(result.reason, 'unauthenticated', `${header ?? 'absent'} is unauthenticated`);
  }
});

test('a verified principal the world does not know is no-principal, not a crash', async () => {
  const ghost = `Bearer ${harness.modules.staffAuth.issue('stf_does_not_exist')}`;
  const result = await resolve(ghost);
  assert.ok(!result.ok);
  assert.equal(result.reason, 'no-principal', 'a credential for a non-existent principal is not a credential');
});

test('a de-provisioned principal resolves to an EMPTY scope, not a 401', async () => {
  // The former manager's grant ended in the past. Resolved at now, they have no
  // active grants — but they exist, so this is "may see nothing", not
  // "not authenticated". Collapsing the two would hide that their access lapsed.
  const token = `Bearer ${harness.modules.staffAuth.issue('stf_wfg_former')}`;
  const result = await resolve(token);

  assert.ok(result.ok, 'a known principal with no active grants still resolves');
  assert.equal(result.context.scope.grants.length, 0, 'to an empty scope');
});

test('cross-organization isolation is carried in the resolved context', async () => {
  // Org B's manager resolves to Org B, never Org A. The tenancy root travels with
  // the context so no downstream query has to re-derive it.
  const token = `Bearer ${harness.modules.staffAuth.issue('stf_hbv_manager')}`;
  const result = await resolve(token);
  assert.ok(result.ok);
  assert.equal(result.context.organizationId, 'org_harbour_property');
  assert.notEqual(result.context.organizationId, 'org_wingfu_holdings');
});
