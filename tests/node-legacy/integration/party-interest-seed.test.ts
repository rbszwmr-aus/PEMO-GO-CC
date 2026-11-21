/**
 * The demonstration seed — the acceptance test for ADR-011 D7.
 *
 * Interest and occupancy are separate facts, and this is where that holds or is
 * quietly false. The seed adds the four ownership shapes the product could never
 * represent, plus joint ownership and the vacant-unit discriminator. Every claim
 * is asserted against the seeded world, and the magnitudes it must NOT move are
 * asserted unchanged — a seed that silently perturbed 765 or 47 would be D7
 * violated by the seed itself.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
let db: Harness['admin'];
test.before(async () => {
  harness = await startHarness();
  db = harness.admin;
});
test.after(async () => {
  await harness.close();
});

const count = async (sql: string, params: unknown[] = []): Promise<number> => {
  const [row] = await db.query<{ n: string }>(sql, params);
  return Number(row?.n ?? 0);
};

test('the seeded magnitudes are UNCHANGED — interests are additive, no household added', async () => {
  assert.equal(
    await count(`SELECT count(*) AS n FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
                 JOIN property.building b ON b.building_id=f.building_id
                 WHERE b.estate_id='est_wing_fu_garden' AND u.unit_class='residential'`),
    812, 'residential units');
  assert.equal(await count(`SELECT count(*) AS n FROM resident.household WHERE organization_id='org_wingfu_holdings'`), 765, 'households — NOT moved by the seed');
  assert.equal(
    await count(`SELECT count(*) AS n FROM property.unit u JOIN property.floor f ON f.floor_id=u.floor_id
                 JOIN property.building b ON b.building_id=f.building_id
                 LEFT JOIN resident.household h ON h.unit_id=u.unit_id
                 WHERE b.estate_id='est_wing_fu_garden' AND u.unit_class='residential' AND h.household_id IS NULL`),
    47, 'vacant units — still 47');
});

test('the declared basis holds: 8 parties, 12 interests, 6 ownership + 6 tenancy', async () => {
  assert.equal(await count(`SELECT count(*) AS n FROM resident.party WHERE party_id LIKE 'pty\\_demo\\_%' ESCAPE '\\'`), 8);
  assert.equal(await count(`SELECT count(*) AS n FROM resident.interest WHERE interest_id LIKE 'int\\_demo\\_%' ESCAPE '\\'`), 12);
  assert.equal(await count(`SELECT count(*) AS n FROM resident.interest WHERE interest_id LIKE 'int\\_demo\\_%' ESCAPE '\\' AND kind='ownership'`), 6);
  assert.equal(await count(`SELECT count(*) AS n FROM resident.interest WHERE interest_id LIKE 'int\\_demo\\_%' ESCAPE '\\' AND kind='tenancy'`), 6);
});

test('D7 — the DISCRIMINATOR: interest without occupancy (an owner of a vacant unit)', async () => {
  // The cleanest proof interest does not depend on occupancy. The vacant unit has
  // an ownership interest and NO household — the empty-page-non-zero-total shape.
  const unit = 'unit_wfg_a_39_a5';
  assert.equal(await count(`SELECT count(*) AS n FROM resident.household WHERE unit_id=$1`, [unit]), 0, 'the unit is genuinely vacant');
  assert.equal(await count(`SELECT count(*) AS n FROM resident.interest WHERE unit_id=$1 AND kind='ownership'`, [unit]), 1, 'and it still has an owner');
});

test('D7 — the Novatek case: five occupied units, the company holds the tenancy, occupants hold NO interest', async () => {
  const novatekUnits = (
    await db.query<{ unit_id: string }>(
      `SELECT unit_id FROM resident.interest WHERE party_id='pty_demo_novatek' AND kind='tenancy' ORDER BY unit_id`,
    )
  ).map((r) => r.unit_id);
  assert.equal(novatekUnits.length, 5, 'five tenancy interests, one legal person');

  // The tenant is a legal_person (the company), not a natural person.
  const [{ kind }] = await db.query<{ kind: string }>(`SELECT kind FROM resident.party WHERE party_id='pty_demo_novatek'`);
  assert.equal(kind, 'legal_person', 'the tenant is the company');

  for (const unit of novatekUnits) {
    // Each unit is OCCUPIED (a household exists on it).
    assert.equal(await count(`SELECT count(*) AS n FROM resident.household WHERE unit_id=$1`, [unit]), 1, `${unit} is occupied`);
    // The occupancy holds NO interest: the only interest on the unit is Novatek's
    // tenancy, held by the company — never by the household or its members.
    const holders = await db.query<{ party_id: string }>(`SELECT party_id FROM resident.interest WHERE unit_id=$1`, [unit]);
    assert.deepEqual(holders.map((h) => h.party_id), ['pty_demo_novatek'], `${unit}: only the company holds an interest`);
  }
});

test('D7 — occupancy WITHOUT interest and interest WITHOUT occupancy both exist, which is the whole point', async () => {
  // interest without occupancy: the vacant-unit owner.
  const interestNoOccupancy = await count(
    `SELECT count(*) AS n FROM resident.interest i
      LEFT JOIN resident.household h ON h.unit_id = i.unit_id
      WHERE i.interest_id LIKE 'int\\_demo\\_%' ESCAPE '\\' AND h.household_id IS NULL`);
  assert.ok(interestNoOccupancy >= 1, 'at least one interest sits on a unit with no household');

  // occupancy without the occupant holding interest: Novatek's five units have a
  // household and an interest held by a party (the company), and the household is
  // not that party — occupancy and interest are carried by different things.
  const novatekOccupiedUnits = await count(
    `SELECT count(*) AS n FROM resident.interest i
      JOIN resident.household h ON h.unit_id = i.unit_id
      WHERE i.party_id = 'pty_demo_novatek'`);
  assert.equal(novatekOccupiedUnits, 5, 'five occupied units whose interest is held by the company, not the occupants');
});

test('the exclusion key held in the seed — joint ownership present, no duplicate', async () => {
  // Two parties own one unit at once (joint), which the wrong key would forbid.
  const jointOwners = await db.query<{ party_id: string }>(
    `SELECT party_id FROM resident.interest WHERE unit_id='unit_wfg_b_03_b2' AND kind='ownership' ORDER BY party_id`,
  );
  assert.deepEqual(jointOwners.map((r) => r.party_id), ['pty_demo_joint_a', 'pty_demo_joint_b'], 'joint ownership is seeded and representable');

  // And the landlord/tenant unit carries both kinds.
  const kinds = await db.query<{ kind: string }>(
    `SELECT DISTINCT kind FROM resident.interest WHERE unit_id='unit_wfg_a_01_a2' ORDER BY kind`);
  assert.deepEqual(kinds.map((k) => k.kind), ['ownership', 'tenancy']);
});

test('every seeded row carries provenance under the no-placeholder gate (F2)', async () => {
  // All demonstration rows are bulk_import — a bootstrap with no acting principal
  // — so recorded_by is honestly NULL and no placeholder was written.
  assert.equal(await count(`SELECT count(*) AS n FROM resident.party WHERE party_id LIKE 'pty\\_demo\\_%' ESCAPE '\\' AND source='bulk_import' AND recorded_by IS NULL`), 8);
  assert.equal(await count(`SELECT count(*) AS n FROM resident.interest WHERE interest_id LIKE 'int\\_demo\\_%' ESCAPE '\\' AND source='bulk_import' AND recorded_by IS NULL`), 12);
  // Not one row smuggled a fiction into recorded_by.
  assert.equal(await count(`SELECT count(*) AS n FROM resident.party WHERE party_id LIKE 'pty\\_demo\\_%' ESCAPE '\\' AND recorded_by IS NOT NULL`), 0, 'no placeholder principal, ever');
});

test('resident.interest answers what occupancy.role cannot: a non-occupying owner', async () => {
  // The gap DOC-030-ST reports as PRP-03 `partial`: occupancy.role has no value
  // for an owner who does not occupy. resident.interest does, and this asserts it
  // — the landlord holds ownership and appears in NO occupancy row.
  const [{ n }] = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM resident.interest WHERE party_id='pty_demo_landlord' AND kind='ownership'`);
  assert.equal(Number(n), 1, 'the landlord is representable as an owner');
  // occupancy.role cannot carry this fact — there is no occupancy row for the
  // landlord party, and even if there were, no role value means "owns, absent".
  const landlordOccupancy = await count(
    `SELECT count(*) AS n FROM resident.occupancy WHERE resident_id = 'pty_demo_landlord'`);
  assert.equal(landlordOccupancy, 0, 'the owning party is a party, not an occupancy — the two are not the same table');
});


test('F1 as a tested STATE — the contradiction is CONSTRUCTED in a test, never seeded', async () => {
  /**
   * A demonstration seed describes a world; a test constructs a situation
   * (GEN-029-ST ruling). The occupancy.role='tenant'-vs-interest contradiction is
   * REAL — it is what a migration from a legacy system produces — so it must be
   * HANDLED. But it is not a state this fixture world should assert as its own,
   * and seeding one `tenant` row would convert `tenant`'s free retirement (zero
   * rows) into a one-row migration. So it is built here and torn down, leaving
   * `tenant` at zero rows — asserted at the end.
   *
   * The situation: a Novatek unit whose tenancy interest is held by the COMPANY,
   * with a legacy-style occupancy row marking an employee as 'tenant'. F1 says the
   * interest is the answer and the role is not.
   */
  const UNIT = 'unit_wfg_a_01_a3'; // a Novatek tenancy-interest unit
  try {
    await db.query(
      `INSERT INTO resident.resident (resident_id, organization_id, display_name)
       VALUES ('res_f1_probe', 'org_wingfu_holdings', 'Employee (legacy tenant row)')`,
    );
    await db.query(
      `INSERT INTO resident.occupancy
         (occupancy_id, resident_id, unit_id, unit_class, role, status, source, effective_from)
       VALUES ('occ_f1_probe', 'res_f1_probe', $1, 'residential', 'tenant', 'active', 'legacy_migration', '2024-01-01T00:00:00+08:00')`,
      [UNIT],
    );

    // The occupancy row now CLAIMS a tenant on this unit.
    const occTenant = await db.query<{ resident_id: string }>(
      `SELECT resident_id FROM resident.occupancy WHERE unit_id=$1 AND role='tenant'`, [UNIT]);
    assert.equal(occTenant.length, 1, 'the legacy occupancy row exists and says tenant');

    // F1: the AUTHORITATIVE answer to "who is the tenant" is the interest — the
    // company — NOT the occupancy role.
    const interestHolder = await db.query<{ party_id: string; kind: string }>(
      `SELECT i.party_id, p.kind FROM resident.interest i JOIN resident.party p ON p.party_id=i.party_id
        WHERE i.unit_id=$1 AND i.kind='tenancy'`, [UNIT]);
    assert.equal(interestHolder.length, 1, 'exactly one tenancy interest — the company\'s');
    assert.equal(interestHolder[0]!.party_id, 'pty_demo_novatek', 'THE INTEREST IS THE ANSWER: the company holds the tenancy');
    assert.equal(interestHolder[0]!.kind, 'legal_person', 'and it is a company, not the employee the role names');

    // The role and the interest DISAGREE about who the tenant is, and F1 rules
    // the interest authoritative. Asserted as a disagreement, not assumed.
    assert.notEqual(occTenant[0]!.resident_id, interestHolder[0]!.party_id,
      'the role names the employee; the interest names the company; they disagree and the interest wins');
  } finally {
    await db.query(`DELETE FROM resident.occupancy WHERE occupancy_id='occ_f1_probe'`);
    await db.query(`DELETE FROM resident.resident WHERE resident_id='res_f1_probe'`);
  }

  // The free-retirement invariant is preserved: no tenant row persists.
  const [{ n }] = await db.query<{ n: string }>(
    `SELECT count(*) AS n FROM resident.occupancy WHERE role='tenant'`);
  assert.equal(Number(n), 0, 'tenant stays at zero rows — the contradiction was constructed, not seeded');
});
