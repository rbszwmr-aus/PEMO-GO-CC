/**
 * The first scope-only write, and ADR-010 D1's four audit properties — each
 * proven by making its red fire.
 *
 * D1 releases 27 actions on scope alone ON CONDITION that the audit record
 * carries the weight the gate would have: "without all four, record rather than
 * restrict records nothing. This is a requirement on the write path, not a
 * logging preference." So this file is not a test of a management update. It is
 * the proof that the PATH is sound, once, so the other 26 inherit it.
 *
 * THE WORLD IS BUILT HERE, NOT ASSUMED. The safety event this writes to is
 * created by this file as the owner, because the seeded events come from the
 * `__default` scenario overlays that `startHarness`'s `reseed()` does not apply —
 * a dependency GEN-011 discovered the hard way, as a suite that passed only on a
 * database somebody had seeded out of band.
 *
 * AUDIT ROWS ARE CLEARED BEFORE EVERY RESEED. `access.audit_event.group_id`
 * references `access.user_group`, which the seeds replace, so one row left behind
 * fails every later run in `reseed` with a foreign key violation. That is a real
 * property of the design — you do not delete a group that has audit history — and
 * it is a fixture-lifecycle obligation, not a defect.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { loadConfig } from '../../modules/platform/dist/index.js';

const BASE = '/api/management-web/v0';

/** estate_staff at `estate est_wing_fu_garden` — in scope for the event below. */
const MANAGER = 'stf_wfg_manager';
/** estate_staff at `location loc_wfg_clubhouse`, SAME organization — out of scope. */
const COUNTER = 'stf_wfg_counter';

const EVENT = 'evt_gen009_scope_write';
const ESTATE = 'est_wing_fu_garden';
const ORG = 'org_wingfu_holdings';

let harness: Harness;

const staffAuth = (principalId: string): { authorization: string } => ({
  authorization: `Bearer ${harness.modules.staffAuth.issue(principalId)}`,
});

const publish = (principalId: string, body: unknown = { bodyEn: 'Lift restored.', bodyZhHant: '升降機已回復。' }) =>
  harness.app.inject({
    method: 'POST',
    url: `${BASE}/safety/events/${EVENT}/updates`,
    headers: staffAuth(principalId),
    payload: body as Record<string, unknown>,
  });

const auditRows = async (): Promise<
  { audit_id: string; principal_id: string; group_id: string; role: string; node_kind: string; node_id: string; action: string; target_id: string; occurred_at: Date }[]
> =>
  harness.admin.query(
    `SELECT audit_id, principal_id, group_id, role, node_kind, node_id, action, target_id, occurred_at
       FROM access.audit_event WHERE action = 'publish_management_update' ORDER BY recorded_at`,
  );

const updateCount = async (): Promise<number> => {
  const [r] = await harness.admin.query<{ n: string }>(
    `SELECT count(*) AS n FROM home_safety.management_update WHERE event_id = $1`,
    [EVENT],
  );
  return Number(r?.n ?? -1);
};

/** The event this PID writes to. Owner work — a fixture, not a runtime path. */
const createEvent = async (): Promise<void> => {
  await harness.admin.query(
    `INSERT INTO home_safety.safety_event
       (event_id, organization_id, estate_id, severity, title_en, title_zh_hant,
        location_label_en, location_label_zh_hant, location_class, audience_source,
        serving_scope_label_en, serving_scope_label_zh_hant,
        occurred_at, received_at, disclaimer_en, disclaimer_zh_hant)
     VALUES ($1, $2, $3, 'advisory', 'Lift out of service', '升降機暫停服務',
             'Block A lobby', 'A座大堂', 'common_area', 'serving_scope',
             'Block A', 'A座',
             now(), now(), 'Information only.', '僅供參考。')
     ON CONFLICT (event_id) DO NOTHING`,
    [EVENT, ORG, ESTATE],
  );
};

const clearWrites = async (): Promise<void> => {
  await harness.admin.query(`DELETE FROM access.audit_event WHERE action = 'publish_management_update'`);
  await harness.admin.query(`DELETE FROM home_safety.management_update WHERE event_id = $1`, [EVENT]);
};

test.before(async () => {
  harness = await startHarness();
  await createEvent();
  await clearWrites();
});

test.after(async () => {
  // Audit rows FIRST: they pin access.user_group against the next run's reseed.
  await clearWrites();
  await harness.admin.query(`DELETE FROM home_safety.safety_event WHERE event_id = $1`, [EVENT]);
  await harness.close();
});

test.beforeEach(clearWrites);

// ─────────────────────────────────────────────── the gate, both directions
test('THE GATE — a principal with estate_staff at the event\'s estate writes, and it persists', async () => {
  const response = await publish(MANAGER);
  assert.equal(response.statusCode, 201, response.body);
  const payload = JSON.parse(response.body) as { eventId: string; update: { updateId: string } };
  assert.equal(payload.eventId, EVENT);
  assert.match(payload.update.updateId, /^upd_/);
  assert.equal(await updateCount(), 1);
});

test('THE GATE, RED — out of scope is ABSENT: the identical act does not resolve the target', async () => {
  // Same organization, same event, a real estate_staff grant — but at a Location
  // that does not expand to this estate. The answer is 404, not 403: a distinct
  // refusal would confirm the event exists to someone with no scope over it.
  const response = await publish(COUNTER);
  assert.equal(response.statusCode, 404, response.body);
  const problem = JSON.parse(response.body) as { type: string };
  assert.match(problem.type, /event-not-found/);
  assert.equal(await updateCount(), 0, 'an out-of-scope act persisted');
  assert.equal((await auditRows()).length, 0, 'an out-of-scope act was audited');
});

test('THE GATE, RED — REMOVE the grant and the same principal loses the same target', async () => {
  // The truest form of the gate test: one principal, one act, the grant is the
  // only thing that changes. End-dating rather than deleting, because the grant
  // table is effective-dated and deletion would test a different mechanism.
  const before = await publish(MANAGER);
  assert.equal(before.statusCode, 201, 'precondition: the write works with the grant');
  await clearWrites();

  await harness.admin.query(
    `UPDATE access.scope_grant SET effective_to = now() - interval '1 day'
      WHERE group_id = 'grp_of_one_stf_wfg_manager'`,
  );
  try {
    const after = await publish(MANAGER);
    assert.equal(after.statusCode, 404, 'the grant was removed and the act still resolved');
    assert.equal(await updateCount(), 0);
  } finally {
    await harness.admin.query(
      `UPDATE access.scope_grant SET effective_to = NULL WHERE group_id = 'grp_of_one_stf_wfg_manager'`,
    );
  }
});

// ───────────────────────────────── D1 property 1 — same transaction as the act
test('D1.1 — the act and its audit are ONE transaction', async () => {
  await publish(MANAGER);
  assert.equal(await updateCount(), 1);
  const rows = await auditRows();
  assert.equal(rows.length, 1, 'the act was written without its audit');
  assert.equal(rows[0]?.target_id.startsWith('upd_'), true);
});

test('D1.1, RED — when the AUDIT cannot be written the ACT does not happen', async () => {
  // D1 makes the record the CONDITION of the write, so a write that cannot be
  // recorded is a write that must not happen.
  //
  // This is the inverse of what GEN-009 originally produced: 0 act rows and 1
  // audit row — an audit asserting an authorised act that never happened. The
  // injection is a CHECK on the audit table that this action violates, added as
  // the owner and removed again, so the audit insert fails AFTER the act has been
  // written in the same transaction. Nothing else in the request changes.
  await harness.admin.query(
    `ALTER TABLE access.audit_event
       ADD CONSTRAINT gen009_injected_audit_failure
       CHECK (action <> 'publish_management_update')`,
  );
  try {
    const response = await publish(MANAGER);
    assert.equal(response.statusCode, 500, 'a failed audit did not fail the request');
    assert.equal(await updateCount(), 0, 'THE ACT PERSISTED WITHOUT ITS AUDIT — D1.1 is violated');
    assert.equal((await auditRows()).length, 0);
  } finally {
    await harness.admin.query(
      'ALTER TABLE access.audit_event DROP CONSTRAINT gen009_injected_audit_failure',
    );
  }

  // And with the injection removed the identical request succeeds, so the red
  // above was caused by the injection and not by something incidental.
  const after = await publish(MANAGER);
  assert.equal(after.statusCode, 201, after.body);
  assert.equal(await updateCount(), 1);
});

// ───────────────────────────────────── D1 property 2 — attributable to a principal
test('D1.2 — the audit names the ACTOR and the AUTHORITY, and they are different columns', async () => {
  await publish(MANAGER);
  const [row] = await auditRows();
  assert.ok(row);
  assert.equal(row.principal_id, MANAGER, 'the actor is not the acting principal');
  assert.equal(row.group_id, 'grp_of_one_stf_wfg_manager', 'the authority is not the authorizing group');
  assert.equal(row.role, 'estate_staff');
  assert.equal(row.node_kind, 'estate');
  assert.equal(row.node_id, ESTATE);
  // ADR-012 D2 holds grants on a GROUP; ADR-010 D1 attributes the act to a
  // PRINCIPAL. Both are kept because "who did it" and "what let them" are
  // different questions, and an incident review needs both.
  assert.notEqual(row.principal_id, row.group_id);
});

test('D1.2, RED — the principal is a FOREIGN KEY, so an unknown actor cannot be audited', async () => {
  // Attribution that a bare text column could satisfy is not attribution. The
  // register must know the actor, and the database is what enforces it.
  await assert.rejects(
    harness.admin.query(
      `INSERT INTO access.audit_event
         (audit_id, source, principal_id, group_id, role, node_kind, node_id, action, target_kind, target_id, occurred_at, correlation_id)
       VALUES ('aud_gen009_ghost', 'principal', 'a-session-not-a-person', 'grp_of_one_stf_wfg_manager',
               'estate_staff', 'estate', $1, 'publish_management_update', 'management_update',
               'upd_ghost', now(), '00000000-0000-4000-8000-00000000cafe')`,
      [ESTATE],
    ),
    /violates foreign key constraint/,
    'an audit row was written against an identity the register does not know',
  );
});

// ──────────────── D1.2 continued — WHICH grant, when several authorized the act
/**
 * Grants the manager an EXTRA, BROADER authorizing grant through a second group.
 *
 * ADR-012 D4 keys the exclusion constraint per GROUP, so one principal holding
 * two grants covering one node is a legal state, not a contrived one — and it is
 * the state that makes "the authorizing grant" ill-posed.
 */
const addGroupGrant = async (group: string, grantId: string, kind: string, node: string): Promise<void> => {
  await harness.admin.query(
    `INSERT INTO access.user_group (group_id, organization_id, display_name)
     VALUES ($1, $2, $3) ON CONFLICT (group_id) DO NOTHING`,
    [group, ORG, `GEN-009 test group ${group}`],
  );
  await harness.admin.query(
    `INSERT INTO access.group_membership (membership_id, group_id, principal_id, effective_from)
     VALUES ($1, $2, $3, '2024-01-01T00:00:00Z') ON CONFLICT DO NOTHING`,
    [`mem_gen009_${group}`, group, MANAGER],
  );
  await harness.admin.query(
    `INSERT INTO access.scope_grant (grant_id, group_id, role, node_kind, node_id, effective_from)
     VALUES ($1, $2, 'estate_staff', $3, $4, '2024-01-01T00:00:00Z')`,
    [grantId, group, kind, node],
  );
};

const dropTestGroups = async (): Promise<void> => {
  // AUDIT ROWS FIRST, AND THIS IS THE DESIGN WORKING, not a nuisance:
  // audit_event.group_id references user_group, so a group with audit history
  // cannot be deleted while that history exists. In production that is exactly
  // right — you do not delete a group that has authorised acts on record, and the
  // foreign key forbids a dangling audit. Here it is a fixture-lifecycle
  // obligation, and forgetting it fails the teardown rather than the assertion,
  // which is how it was found both times.
  await clearWrites();
  await harness.admin.query(`DELETE FROM access.scope_grant WHERE grant_id LIKE 'gnt\\_gen009\\_%' ESCAPE '\\'`);
  await harness.admin.query(`DELETE FROM access.group_membership WHERE membership_id LIKE 'mem\\_gen009\\_%' ESCAPE '\\'`);
  await harness.admin.query(`DELETE FROM access.user_group WHERE group_id LIKE 'grp\\_gen009\\_%' ESCAPE '\\'`);
};

test('D1.2 NARROWEST — with two authorizing grants of different scope, the NARROWER is recorded', async () => {
  // The manager already holds estate_staff at ESTATE est_wing_fu_garden. Add a
  // PORTFOLIO grant that also covers it. Both authorize; the estate one is closer
  // to the act.
  await addGroupGrant('grp_gen009_broad', 'gnt_gen009_portfolio', 'portfolio', 'pf_wingfu_residential');
  try {
    const response = await publish(MANAGER);
    assert.equal(response.statusCode, 201, response.body);
    const [row] = await auditRows();
    assert.ok(row);
    assert.equal(row.node_kind, 'estate', 'the BROADER portfolio grant was recorded');
    assert.equal(row.node_id, ESTATE);
    assert.equal(row.group_id, 'grp_of_one_stf_wfg_manager');
  } finally {
    await dropTestGroups();
  }
});

test('D1.2 NARROWEST — the record names the narrowest, NOT the sole authority', async () => {
  // The semantics matter as much as the selection. Both grants authorized this
  // act; the record names one and does not claim it was the only one. What the
  // principal could ALSO do at that instant is not lost — it is reconstructable
  // from the effective-dated grant table as at the retained instant, which is
  // exactly why that instant is retained.
  await addGroupGrant('grp_gen009_broad', 'gnt_gen009_portfolio', 'portfolio', 'pf_wingfu_residential');
  try {
    await publish(MANAGER);
    const [row] = await auditRows();
    assert.ok(row);
    const asAt = await harness.modules.historicalScope.resolveAsAt(row.principal_id, new Date(row.occurred_at));
    const authorizing = (asAt?.grants ?? []).filter(
      (g) => g.role === 'estate_staff' && ['estate', 'portfolio'].includes(g.node.kind),
    );
    assert.equal(authorizing.length, 2, 'the premise is gone: the principal no longer holds two grants');
    // The recorded one is among them, and the others remain answerable.
    assert.ok(authorizing.some((g) => g.groupId === row.group_id && g.node.id === row.node_id));
  } finally {
    await dropTestGroups();
  }
});

/**
 * THE TIE-BREAK, TESTED AS A DECISION rather than through the route.
 *
 * The end-to-end tie test below proves the record is STABLE across runs — and
 * stability is not the rule. Removing the tie-break entirely left it green,
 * because the resolver's `ORDER BY node_kind, node_id` already returns a
 * consistent order, so "first seen" is stable too. A test that passes when the
 * thing it checks is deleted is an empty oracle; this is the same class GEN-011
 * found in its own suite.
 *
 * So the rule is exercised where it can be made to bite: candidates handed in an
 * order whose FIRST element is not the lowest grant id. Only a real tie-break
 * gets this right.
 */
test('D1.2 NARROWEST — the tie-break picks the lowest grant id, not the first candidate', async () => {
  // GEN-013 generalised this over the node KIND — its act is at a unit, not an
  // estate — so the target travels as { kind, id }. Same function, same ladder;
  // only the lookup stopped being pinned to estates.
  const { findAuthorizingGrant } = await import('../../apps/api/dist/management/authorizing-grant.js');

  const grant = (grantId: string, kind: string, id: string) => ({
    grantId,
    groupId: `grp_${grantId}`,
    role: 'estate_staff' as const,
    node: { kind, id },
    effectiveFrom: '2024-01-01T00:00:00.000Z',
    effectiveTo: null,
  });
  // Every candidate authorizes; the expansion is not what is under test here.
  const alwaysAdmits = {
    expand: async () => ({
      organizationIds: [], portfolioIds: [], estateIds: [ESTATE], phaseIds: [],
      buildingIds: [], floorIds: [], unitIds: [], locationIds: [],
    }),
  };

  // Equally narrow, and the LOWEST id is deliberately LAST.
  const tied = [grant('gnt_zzz', 'estate', ESTATE), grant('gnt_mmm', 'estate', ESTATE), grant('gnt_aaa', 'estate', ESTATE)];
  const won = await findAuthorizingGrant(alwaysAdmits as never, ORG, tied as never, { kind: 'estate', id: ESTATE });
  assert.equal(won?.grantId, 'gnt_aaa', 'the tie-break did not pick the lowest grant id');

  // Reversed input, same answer: the record does not depend on row order.
  const reversed = await findAuthorizingGrant(alwaysAdmits as never, ORG, [...tied].reverse() as never, { kind: 'estate', id: ESTATE });
  assert.equal(reversed?.grantId, 'gnt_aaa');

  // And narrowness still outranks the tie-break: a narrower grant with a HIGHER
  // id beats a broader one with a lower id.
  const mixed = [grant('gnt_aaa', 'portfolio', 'pf_wingfu_residential'), grant('gnt_zzz', 'estate', ESTATE)];
  const narrower = await findAuthorizingGrant(alwaysAdmits as never, ORG, mixed as never, { kind: 'estate', id: ESTATE });
  assert.equal(narrower?.grantId, 'gnt_zzz', 'the tie-break overrode narrowness');
});

test('D1.2 NARROWEST — equally narrow grants break the tie on grant id, stably', async () => {
  // Two groups granting estate_staff at the SAME estate is legal: ADR-012 D4 keys
  // the exclusion per group. Neither is narrower, so the tie-break decides — and
  // it must decide the SAME way every time, or the audit is not reproducible.
  await addGroupGrant('grp_gen009_tie_a', 'gnt_gen009_aaa', 'estate', ESTATE);
  await addGroupGrant('grp_gen009_tie_b', 'gnt_gen009_zzz', 'estate', ESTATE);
  try {
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      await clearWrites();
      const response = await publish(MANAGER);
      assert.equal(response.statusCode, 201, response.body);
      const [row] = await auditRows();
      assert.ok(row);
      seen.push(row.group_id);
    }
    assert.equal(new Set(seen).size, 1, `the tie-break is not stable: ${seen.join(', ')}`);
    // The manager's own grant id is `gnt_...`; whichever wins, it wins by the
    // lowest grant id among the equally narrow, and it wins every time.
    const grants = await harness.admin.query<{ grant_id: string; group_id: string }>(
      `SELECT g.grant_id, g.group_id FROM access.scope_grant g
         JOIN access.group_membership m ON m.group_id = g.group_id
        WHERE m.principal_id = $1 AND g.role = 'estate_staff'
          AND g.node_kind = 'estate' AND g.node_id = $2
        ORDER BY g.grant_id`,
      [MANAGER, ESTATE],
    );
    assert.ok(grants.length >= 3, 'the premise is gone: fewer than three equally narrow grants');
    assert.equal(seen[0], grants[0]?.group_id, 'the winner is not the lowest grant id');
  } finally {
    await dropTestGroups();
  }
});

// ────────────────────────────── D1 property 3 — effective-dated against the grant
test('D1.3 — the audit retains the instant its authority is answerable at', async () => {
  const before = new Date();
  await publish(MANAGER);
  const [row] = await auditRows();
  assert.ok(row);
  const occurred = new Date(row.occurred_at);
  assert.ok(Number.isFinite(occurred.getTime()), 'occurred_at is not a real instant');
  assert.ok(occurred.getTime() <= Date.now() + 1000, 'occurred_at is in the future');

  // THE POINT OF PROPERTY 3, and the reason it is not merely a timestamp: the
  // retained instant resolves against the grant in force AT THAT INSTANT.
  const resolved = await harness.modules.historicalScope.resolveAsAt(row.principal_id, occurred);
  assert.ok(resolved, 'the actor does not resolve at the instant their act was dated');
  assert.ok(
    resolved.grants.some(
      (g) => g.groupId === row.group_id && g.role === row.role && g.node.id === row.node_id,
    ),
    'the recorded authority is not in force at the recorded instant',
  );
  assert.ok(before.getTime() - 5000 <= occurred.getTime());
});

test('D1.3, RED — re-deriving authority LATER returns nobody; the retained record still answers', async () => {
  // GEN-006's §D finding, made to bite on a real audited act. Move the grant's
  // effective window so a resolution taken now returns NOTHING for the past act.
  // Re-derivation fails silently and confidently — which is why the authority is
  // RECORDED rather than recomputed.
  await publish(MANAGER);
  const [row] = await auditRows();
  assert.ok(row);
  const occurred = new Date(row.occurred_at);

  await harness.admin.query(
    `UPDATE access.group_membership SET effective_from = now() + interval '1 day'
      WHERE group_id = 'grp_of_one_stf_wfg_manager'`,
  );
  try {
    const rederived = await harness.modules.historicalScope.resolveAsAt(row.principal_id, occurred);
    assert.deepEqual(
      rederived?.grants ?? [],
      [],
      'the premise of this test no longer holds: re-derivation still finds the grant',
    );
    // Re-derivation now says this act had NO authority. The audit still names it.
    assert.equal(row.group_id, 'grp_of_one_stf_wfg_manager');
    assert.equal(row.node_id, ESTATE);
  } finally {
    await harness.admin.query(
      `UPDATE access.group_membership SET effective_from = '2024-01-01T00:00:00Z'
        WHERE group_id = 'grp_of_one_stf_wfg_manager'`,
    );
  }
});

// ─────────────────────── D1 property 4 — not deletable or amendable by the actor
test('D1.4 — the ACTOR cannot amend or delete its own audit row: a permission, not a courtesy', async () => {
  await publish(MANAGER);
  assert.equal((await auditRows()).length, 1);

  // The runtime role is what the API actually connects as. A trigger would be
  // defeatable by whoever installs it; this is a privilege the role does not hold.
  await assert.rejects(
    harness.modules.homeSafetyDb.query(`UPDATE access.audit_event SET action = 'tampered'`),
    /permission denied/,
  );
  await assert.rejects(
    harness.modules.homeSafetyDb.query(`DELETE FROM access.audit_event`),
    /permission denied/,
  );
  await assert.rejects(
    harness.modules.accessDb.query(`UPDATE audit_event SET action = 'tampered'`),
    /permission denied/,
  );
  assert.equal((await auditRows()).length, 1, 'the audit row changed');

  // AND IT CANNOT GRANT ITSELF THE PRIVILEGE IT LACKS — which is what separates a
  // permission from a convention, and is the reason D1's fourth property rejected
  // a trigger: a guard the actor can drop is not a guard.
  //
  // Note the shape of this assertion. `GRANT` does NOT raise here — PostgreSQL
  // answers a grant the grantor cannot make with a WARNING and a silent no-op, so
  // asserting a rejection would fail for the wrong reason and asserting the
  // statement "succeeded" would prove nothing at all. What must be true is that
  // the privilege is still not held afterwards, so that is what is checked.
  const accessLogin = loadConfig().moduleDatabases.access.user;
  await harness.modules.accessDb.query(`GRANT UPDATE ON audit_event TO ${accessLogin}`);
  await assert.rejects(
    harness.modules.accessDb.query(`UPDATE audit_event SET action = 'tampered'`),
    /permission denied/,
    'the access module login granted itself UPDATE on the audit table',
  );
  const legacyHeld = await harness.admin.query<{ privilege_type: string }>(
    `SELECT privilege_type FROM information_schema.role_table_grants
      WHERE grantee = 'pemo_app' AND table_schema = 'access' AND table_name = 'audit_event'
      ORDER BY 1`,
  );
  assert.deepEqual(legacyHeld.map((r) => r.privilege_type), [],
    'the legacy shared login must hold no audit_event grants');
  const caps = await harness.admin.query<{ sel: boolean; ins: boolean; upd: boolean; del: boolean }>(
    `SELECT has_table_privilege($1, 'access.audit_event', 'SELECT') AS sel,
            has_table_privilege($1, 'access.audit_event', 'INSERT') AS ins,
            has_table_privilege($1, 'access.audit_event', 'UPDATE') AS upd,
            has_table_privilege($1, 'access.audit_event', 'DELETE') AS del`,
    [accessLogin],
  );
  assert.deepEqual(caps[0], { sel: true, ins: false, upd: false, del: false },
    'the access module login may SELECT audit_event but must not INSERT, UPDATE or DELETE');
});
