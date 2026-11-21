/**
 * The harness's own isolation, tested where it is decided.
 *
 * Two debts, both of which have already cost this programme real time:
 *
 *   RESEED must survive rows that reference seeded data. `access.audit_event`
 *   points at `access.user_group`, which the seeds DELETE — so one audit row
 *   left behind made the NEXT run fail in setup. It bit GEN-009, GEN-011 and
 *   GEN-012, every time reading as a defect in whatever ran next.
 *
 *   A TEARDOWN PREFIX must not match seeded ids. GEN-014's `ctc_%` deleted the
 *   seeded estate contacts and surfaced as a domain rule failing to find a
 *   conflict that should have existed.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, assertTeardownPrefixIsScoped, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;

test.before(async () => { harness = await startHarness(); });
test.after(async () => {
  await harness.admin.query(`DELETE FROM access.audit_event WHERE audit_id LIKE 'aud\\_gen020\\_%' ESCAPE '\\'`);
  await harness.close();
});

/** An audit row referencing a SEEDED group — exactly what pinned reseed three times. */
const pinReseed = async (): Promise<void> => {
  await harness.admin.query(
    `INSERT INTO access.audit_event
       (audit_id, source, principal_id, group_id, role, node_kind, node_id, action, target_kind, target_id, occurred_at, correlation_id)
     SELECT 'aud_gen020_pin', 'principal', p.principal_id, g.group_id, 'estate_staff', 'estate', 'est_wing_fu_garden',
            'gen020_probe', 'probe', 'tgt', now(), '00000000-0000-4000-8000-0000000000b1'
       FROM access.staff_principal p, access.user_group g
      WHERE p.principal_id = 'stf_wfg_manager' AND g.group_id LIKE 'grp\\_%' ESCAPE '\\'
      LIMIT 1`);
};

test('THE 3x BITE — an audit row pinning a seeded group no longer breaks reseed', async () => {
  await pinReseed();
  const [before] = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM access.audit_event WHERE audit_id = 'aud_gen020_pin'`);
  assert.equal(Number(before?.n), 1, 'the probe did not plant the pinning row');

  // Before the fix this threw:
  //   update or delete on table "user_group" violates foreign key constraint
  //   "audit_event_group_id_fkey" on table "audit_event"
  await harness.reseed();

  // And the seeded world is intact afterwards, which is the other half: the fix
  // must clear the blocker, not the seeds.
  const [groups] = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM access.user_group WHERE group_id LIKE 'grp\\_%' ESCAPE '\\'`);
  assert.ok(Number(groups?.n) > 0, 'reseed cleared the blocker AND the seeded groups');
});

test('the blocker set is DERIVED — a test-created grant pins reseed too, and is also cleared', async () => {
  // The hazard is wider than the audit: scope_grant and group_membership also
  // reference user_group, and the seeds clear them only by PREFIX — so a grant a
  // test leaves behind pins reseed exactly as an audit row does.
  await harness.admin.query(
    `INSERT INTO access.user_group (group_id, organization_id, display_name)
     VALUES ('grp_gen020_probe', 'org_wingfu_holdings', 'GEN-020 probe') ON CONFLICT DO NOTHING`);
  await harness.admin.query(
    `INSERT INTO access.scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ('gnt_gen020_probe', 'grp_gen020_probe', 'estate_staff', 'estate', 'est_wing_fu_garden', now())
     ON CONFLICT DO NOTHING`);

  await harness.reseed();

  const [left] = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM access.scope_grant WHERE grant_id = 'gnt_gen020_probe'`);
  assert.equal(Number(left?.n), 0, 'a test-created grant survived reseed and would pin the next one');
});

// ───────────────────────────────────────────── the teardown-prefix convention
test('THE PREFIX GUARD — a prefix that matches seeded ids is REFUSED', async () => {
  // `ctc_` is GEN-014's actual mistake: the seeds mint ctc_wfg_office and the
  // route mints ctc_<uuid>, so the prefix takes both.
  const [seeded] = await harness.admin.query<{ id: string }>(
    `SELECT contact_id AS id FROM property.estate_contact WHERE contact_id LIKE 'ctc\\_%' ESCAPE '\\' ORDER BY 1 LIMIT 1`);
  assert.ok(seeded, 'the premise is gone: no seeded contact starts with ctc_');

  await assert.rejects(
    assertTeardownPrefixIsScoped(harness.admin, 'property.estate_contact', 'contact_id', 'ctc_'),
    /MATCHES SEEDED DATA/,
    'a colliding prefix was accepted');
});

test('THE PREFIX GUARD — a PID-scoped prefix passes', async () => {
  await assertTeardownPrefixIsScoped(harness.admin, 'property.estate_contact', 'contact_id', 'ctc_gen020_');
  await assertTeardownPrefixIsScoped(harness.admin, 'access.user_group', 'group_id', 'grp_gen020_');
  // And the guard reads the REAL data, so it refuses `grp_`, which the seeds mint.
  await assert.rejects(
    assertTeardownPrefixIsScoped(harness.admin, 'access.user_group', 'group_id', 'grp_'),
    /MATCHES SEEDED DATA/);
});
