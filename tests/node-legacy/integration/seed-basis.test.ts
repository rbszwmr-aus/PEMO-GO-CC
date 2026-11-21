/**
 * THE SEED, HELD TO ITS OWN BASIS.
 *
 * A generated world that silently generates the wrong thing is worse than a
 * transcribed one, because it looks authoritative. 812 hand-written INSERTs are
 * checkable by reading them; a generator is checkable only by this file.
 *
 * So every number the seed claims is recomputed here from the world, and the
 * basis is written out independently rather than imported from the seed — if the
 * test read the same constants the seed used, the two would agree by
 * construction and prove nothing. This is a second statement of the same claim,
 * which is the only kind that can disagree.
 *
 * WHAT IS A FACT AND WHAT IS AN INVENTION is asserted here too, because that
 * distinction is the thing a future reader most needs and the thing least likely
 * to survive in comments alone.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

/**
 * The ADMIN handle, deliberately.
 *
 * This file checks the SEED, which spans property.* and resident.* — two module
 * schemas. A module handle could not read both, and it should not: the module
 * boundary exists so no module can. The seed is not a module, and asserting that
 * a world was built correctly is exactly the job the admin handle is for.
 */
let harness: Harness;
let db: Harness['admin'];

test.before(async () => {
  harness = await startHarness();
  db = harness.admin;
});
test.after(async () => {
  await harness.close();
});

/** The basis, restated — deliberately NOT imported from the seed. */
const BASIS = [
  { code: 'a', building: 'blk_wfg_a', perFloor: 8, topFloor: 40, floors: 35, units: 280, households: 268, vacant: 12, parking: 118, storage: 17 },
  { code: 'b', building: 'blk_wfg_b', perFloor: 7, topFloor: 26, floors: 22, units: 154, households: 138, vacant: 16, parking: 52, storage: 11 },
  { code: 'c', building: 'blk_wfg_c', perFloor: 9, topFloor: 48, floors: 42, units: 378, households: 359, vacant: 19, parking: 66, storage: 13 },
] as const;

const ESTATE_UNITS = 812;

const counts = async (): Promise<Map<string, { units: number; households: number; parking: number; storage: number; floors: number; maxOrdinal: number }>> => {
  const rows = await db.query<{
    code: string; units: string; households: string; parking: string; storage: string; floors: string; max_ordinal: string;
  }>(`
    SELECT substring(f.floor_id from 'fl_wfg_(.)_') AS code,
           count(*) FILTER (WHERE u.unit_class = 'residential')                        AS units,
           count(h.household_id)                                                       AS households,
           count(*) FILTER (WHERE u.unit_class = 'parking')                            AS parking,
           count(*) FILTER (WHERE u.unit_class = 'storage')                            AS storage,
           count(DISTINCT f.floor_id) FILTER (WHERE f.ordinal > 0)                     AS floors,
           coalesce(max(f.ordinal), 0)                                                 AS max_ordinal
    FROM property.floor f
    LEFT JOIN property.unit u ON u.floor_id = f.floor_id
    LEFT JOIN resident.household h ON h.unit_id = u.unit_id AND u.unit_class = 'residential'
    WHERE f.building_id LIKE 'blk\\_wfg\\_%' ESCAPE '\\'
    GROUP BY 1`);
  return new Map(rows.map((r) => [r.code, {
    units: Number(r.units), households: Number(r.households), parking: Number(r.parking),
    storage: Number(r.storage), floors: Number(r.floors), maxOrdinal: Number(r.max_ordinal),
  }]));
};

test('the total is the PRODUCT of the basis, not a number anybody typed', async () => {
  const world = await counts();
  let total = 0;

  for (const b of BASIS) {
    const actual = world.get(b.code);
    assert.ok(actual, `block ${b.code} is absent from the world`);

    // The product, recomputed. This is the assertion that makes 812 a
    // consequence rather than a target: if a block's floor count or its units
    // per floor drifts, the total moves and cannot be nudged back by editing one
    // number.
    assert.equal(actual.floors, b.floors, `block ${b.code}: floor count`);
    assert.equal(
      actual.units,
      b.perFloor * b.floors,
      `block ${b.code}: ${b.perFloor} × ${b.floors} should be ${b.perFloor * b.floors}, world has ${actual.units}`,
    );
    total += actual.units;
  }

  assert.equal(total, ESTATE_UNITS, 'the estate total must be what the blocks come to');
});

test('floor ORDINAL differs from floor COUNT, and the omission rule holds', async () => {
  /**
   * Hong Kong floor numbering as a TEST PROPERTY rather than as decoration. A
   * contiguously numbered block cannot expose code that conflates "the 20th
   * floor" with "20 floors up", because in such a block the two are equal.
   */
  const world = await counts();
  for (const b of BASIS) {
    const actual = world.get(b.code)!;
    assert.equal(actual.maxOrdinal, b.topFloor, `block ${b.code}: top floor`);
    assert.notEqual(
      actual.maxOrdinal,
      actual.floors,
      `block ${b.code}: ordinal ${actual.maxOrdinal} equals count ${actual.floors} — the conflation would be undetectable`,
    );
  }

  const bad = await db.query<{ floor_id: string; ordinal: number }>(
    `SELECT floor_id, ordinal FROM property.floor
     WHERE building_id LIKE 'blk\\_wfg\\_%' ESCAPE '\\' AND (ordinal % 10 = 4 OR ordinal IN (13, 14))`,
  );
  assert.deepEqual(bad, [], 'no floor may end in 4, or be 13 or 14');
});

test('households are NOT units — vacancy is non-zero at every block', async () => {
  const world = await counts();
  for (const b of BASIS) {
    const actual = world.get(b.code)!;
    assert.equal(actual.households, b.households, `block ${b.code}: households`);
    const vacant = actual.units - actual.households;
    assert.equal(vacant, b.vacant, `block ${b.code}: vacancy`);
    assert.ok(
      vacant > 0,
      `block ${b.code} has zero vacancy — a test confusing households with units would pass here`,
    );
  }
});

test('the corpus-stated fact is a FACT, and the rest are inventions', async () => {
  // 268 is the only household figure the corpus states. Recorded as such so a
  // future reader knows which number is load-bearing and which is arbitrary.
  const world = await counts();
  assert.equal(world.get('a')!.households, 268, 'Block A households is stated by the corpus, twice');
  assert.equal(world.get('a')!.units, 280, 'and 268 is a FLOOR on Block A units, not its value');
  assert.ok(world.get('a')!.units > 268);
});

test('per-class counts are separate quantities, and parking is not a unit count', async () => {
  const world = await counts();
  let parking = 0;
  let storage = 0;
  for (const b of BASIS) {
    const actual = world.get(b.code)!;
    assert.equal(actual.parking, b.parking, `block ${b.code}: parking`);
    assert.equal(actual.storage, b.storage, `block ${b.code}: storage`);
    parking += actual.parking;
    storage += actual.storage;
  }
  assert.equal(parking, 236);
  assert.equal(storage, 41);

  // 812 is the RESIDENTIAL count. An aggregate that forgot the class filter would
  // report 1089, and that number is deliberately distinct from every figure in
  // the corpus so the mistake cannot look like a right answer.
  const [{ all }] = await db.query<{ all: string }>(
    `SELECT count(*) AS all FROM property.unit u JOIN property.floor f ON f.floor_id = u.floor_id
     WHERE f.building_id LIKE 'blk\\_wfg\\_%' ESCAPE '\\'`,
  );
  assert.equal(Number(all), 1089);
  assert.notEqual(Number(all), ESTATE_UNITS);
});

test('no two blocks are alike at ANY level of the basis', async () => {
  /**
   * Ruling 3 generalised. If two blocks held the same number, a query returning
   * the WRONG BLOCK would still return the RIGHT NUMBER — the same family as an
   * axis that stopped growing when the world grew.
   *
   * Extended past the totals into the basis itself, because a per-floor figure
   * shared by two blocks makes a wrong-block per-floor aggregate invisible too.
   */
  const world = await counts();
  for (const field of ['units', 'households', 'parking', 'storage', 'floors', 'maxOrdinal'] as const) {
    const values = BASIS.map((b) => world.get(b.code)![field]);
    assert.equal(new Set(values).size, BASIS.length, `blocks share a ${field} value: ${values.join(', ')}`);
  }
  assert.equal(new Set(BASIS.map((b) => b.perFloor)).size, 3, 'units per floor must differ across blocks');
});

test('no seeded magnitude collides with an UNRELATED corpus figure', async () => {
  /**
   * A coincidence between unrelated quantities hides a wrong JOIN exactly as
   * sameness hides a wrong block: if the parking count equalled the case count, a
   * query against the wrong table would still return the expected number.
   */
  const world = await counts();
  const seeded = new Set<number>([ESTATE_UNITS, 1089, 236, 41, 765, 47]);
  for (const b of BASIS) {
    const a = world.get(b.code)!;
    for (const v of [a.units, a.households, a.parking, a.storage, a.floors, a.units - a.households]) seeded.add(v);
  }

  // Figures the corpus states about things that are NOT unit counts.
  const unrelated = [212, 31, 14, 6, 3, 2, 24];
  const collisions = unrelated.filter((v) => seeded.has(v));
  assert.deepEqual(collisions, [], `seeded magnitudes collide with unrelated corpus figures: ${collisions.join(', ')}`);
});

test('the fixture-named units survived generation with their identifiers intact', async () => {
  // The generator could have produced a twin at the same address and left the
  // named unit orphaned, or replaced it. Both would be silent.
  const pinned = ['unit_wfg_a_12_a1', 'unit_wfg_b_03_b2', 'unit_wfg_c_08_c3', 'unit_wfg_cp_p101', 'unit_wfg_st_s021'];
  for (const unitId of pinned) {
    const [row] = await db.query<{ unit_id: string; label: string }>(
      'SELECT unit_id, label FROM property.unit WHERE unit_id = $1',
      [unitId],
    );
    assert.ok(row, `${unitId} did not survive generation`);
  }

  // And no address holds two units — the twin case, asserted directly.
  const dupes = await db.query<{ floor_id: string; label: string }>(
    `SELECT floor_id, label FROM property.unit GROUP BY 1, 2 HAVING count(*) > 1`,
  );
  assert.deepEqual(dupes, [], 'an address holds more than one unit');
});

test('RED — the basis test detects a world that drifted from its basis', async () => {
  /**
   * The mutation is the failure this file exists to catch: one extra unit,
   * exactly as a generator that miscounted by one would produce. Nothing about
   * the seed text changes, so only a recomputation from the world can see it.
   */
  const [floor] = await db.query<{ floor_id: string }>(
    `SELECT floor_id FROM property.floor WHERE building_id = 'blk_wfg_b' AND ordinal = 3`,
  );
  assert.ok(floor);

  // Control BEFORE the mutation.
  assert.equal((await counts()).get('b')!.units, 154);

  await db.query(
    `INSERT INTO property.unit (unit_id, floor_id, unit_class, label) VALUES ('unit_wfg_mutant', $1, 'residential', 'ZZ')`,
    [floor.floor_id],
  );

  const mutated = (await counts()).get('b')!;
  assert.equal(mutated.units, 155, 'the mutation must actually change the world');
  assert.notEqual(mutated.units, 7 * 22, 'and the product assertion must therefore fail');

  await db.query(`DELETE FROM property.unit WHERE unit_id = 'unit_wfg_mutant'`);

  // Control AFTER the mutation, so contamination is located rather than merely
  // detected somewhere later in the run.
  assert.equal((await counts()).get('b')!.units, 154);
  assert.equal((await counts()).get('b')!.households, 138);
});
