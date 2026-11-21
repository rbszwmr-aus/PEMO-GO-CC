/**
 * 0113 — resident-facing text is required IF AND ONLY IF the event has an audience.
 *
 * The migration is PERMISSIVE, so the interesting assertions are not about the
 * schema. Three things need proving:
 *
 *   1. the permission is real — an event with no resident-facing text can now be
 *      stored, which is what makes NULL the honest state for a management-only
 *      event instead of a padded invention nothing could ever check;
 *   2. the requirement did not evaporate with the constraint — an event that IS
 *      resident-visible and lacks text fails LOUDLY rather than serving a null
 *      into a field the resident schema marks `required`;
 *   3. the guard discriminates — a normal event still serves.
 *
 * (3) is not padding. A check that fires on everything is indistinguishable from
 * a broken projection, and this project has already shipped a needle that
 * measured "a function of that name exists" rather than the property it named.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;

test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.reseed();
  await harness.close();
});

const RESIDENT = 'res_wfg_000412';
const UNIT = 'unit_wfg_a_12_a1';

test('0113 — an event with NO resident-facing text can be stored', async () => {
  /**
   * Before 0113 this INSERT was impossible, and a management-only event had to
   * carry six invented values no contract surfaces and no test could check.
   *
   * `audience_source = 'unit'` deliberately. An earlier draft used
   * 'serving_scope' and was refused by `serving_scope_audience_is_explained` — a
   * constraint from 0032 requiring that a serving-scope audience explain itself.
   * The test data was wrong, not the migration, and the constraint caught it
   * first try. Worth leaving in the record: the schema already refuses an
   * unexplained audience, which is the same shape as the pairing 0113 moves.
   */
  await harness.admin.query(
    // disclaimer stays NOT NULL: statutory boilerplate is not invention,
    // and the biting test proved relaxing it downgrades a life-safety
    // guarantee from unrepresentable to caught-at-read.
    `INSERT INTO home_safety.safety_event
       (event_id, organization_id, estate_id, severity, title_en, title_zh_hant,
        location_label_en, location_label_zh_hant, location_class, audience_source,
        source_unit_id, occurred_at, received_at, disclaimer_en, disclaimer_zh_hant)
     VALUES ('evt_no_resident_text', 'org_wingfu_holdings', 'est_wing_fu_garden', 'warning',
             'Management only', '僅管理層', 'Flat A1', 'A1室', 'unit', 'unit',
             $1, now(), now(),
             'PEMO notifications supplement the building fire alarm and statutory emergency procedures. They do not replace them.',
             '此通知為輔助性質，不能取代大廈火警系統及法定緊急程序。')`,
    [UNIT],
  );

  const [row] = await harness.admin.query<{ instruction_en: string | null }>(
    `SELECT instruction_en FROM home_safety.safety_event WHERE event_id = 'evt_no_resident_text'`,
  );
  assert.equal(row?.instruction_en, null, 'NULL is now representable, and it means "no resident presentation"');
});

test('an event that IS resident-visible and lacks text fails loudly', async () => {
  // Give the textless event an audience. That is the ONLY way an event becomes
  // resident-visible, so this is exactly the state the pairing forbids.
  await harness.admin.query(
    `INSERT INTO home_safety.safety_event_audience (event_id, unit_id)
     VALUES ('evt_no_resident_text', $1) ON CONFLICT DO NOTHING`,
    [UNIT],
  );

  await assert.rejects(
    () => harness.modules.events.getForAudience('evt_no_resident_text', [UNIT], RESIDENT),
    (error: unknown) =>
      error instanceof Error &&
      /resident-visible but has no resident-facing text/.test(error.message) &&
      /instruction_en/.test(error.message),
    'a missing safety instruction must never be rendered as a blank',
  );

  // The failure names every missing field, not just the first — whoever fixes it
  // should not have to discover them one run at a time.
  await harness.modules.events
    .getForAudience('evt_no_resident_text', [UNIT], RESIDENT)
    .then(() => assert.fail('should have thrown'))
    .catch((error: Error) => {
      for (const field of ['instruction_en', 'reported_by_en']) {
        assert.ok(error.message.includes(field), `${field} must be named in the failure`);
      }
    });
});

test('the guard DISCRIMINATES — a normal event still serves', async () => {
  // Control. Without this the test above passes for a projection that throws on
  // everything, which is a different defect wearing the same result.
  const detail = await harness.modules.events.getForAudience('evt_20260813_smoke01', [UNIT], RESIDENT);
  assert.ok(detail, 'a seeded, resident-visible event must still be served');
  assert.ok(detail.instruction.en.length > 0);
  assert.ok(detail.reportedBy.en.length > 0);
  assert.ok(detail.disclaimer.en.length > 0);
});

test('disclaimer was NOT relaxed — the statutory guard stays structural', async () => {
  // 0113 relaxed four columns, not six. The biting test in biting-tests.ts is the
  // one that caught the original six-column form; this asserts the narrowing held
  // from the other side, so the two cannot drift apart.
  const [row] = await harness.admin.query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'home_safety' AND table_name = 'safety_event' AND column_name = 'disclaimer_en'`,
  );
  assert.equal(row?.is_nullable, 'NO', 'a statutory life-safety statement must remain impossible to omit');
});

test('an event WITHOUT an audience is invisible, so its missing text is not a fault', async () => {
  // The other half of the biconditional, and the reason the constraint moved
  // rather than being dropped: no audience means no resident path reaches it, so
  // NULL text is correct rather than merely tolerated.
  await harness.admin.query(
    `DELETE FROM home_safety.safety_event_audience WHERE event_id = 'evt_no_resident_text'`,
  );

  const detail = await harness.modules.events.getForAudience('evt_no_resident_text', [UNIT], RESIDENT);
  assert.equal(detail, undefined, 'no audience row means the event does not exist for this resident');

  const listed = await harness.modules.events.listRecentForUnit(UNIT);
  assert.ok(
    !listed.some((e) => e.eventId === 'evt_no_resident_text'),
    'and it appears in no list either',
  );

  // Control after the mutation, so contamination is located rather than detected
  // somewhere later in the run.
  const still = await harness.modules.events.getForAudience('evt_20260813_smoke01', [UNIT], RESIDENT);
  assert.ok(still, 'the legitimate event is unaffected');

  await harness.admin.query(`DELETE FROM home_safety.safety_event WHERE event_id = 'evt_no_resident_text'`);
});

test('the ROLLBACK EXPIRY is a claim about the data, and it is checkable', async () => {
  /**
   * 0113's down path re-adds NOT NULL. It executes cleanly today and stops
   * working the moment the permission is exercised — so reversibility here is a
   * property of the DATA, not of the schema.
   *
   * The query the migration tells an operator to run before rolling back is
   * asserted here, so the instruction cannot rot away from the thing it checks.
   */
  const [{ blocking }] = await harness.admin.query<{ blocking: string }>(
    `SELECT count(*) AS blocking FROM home_safety.safety_event
      WHERE instruction_en IS NULL OR instruction_zh_hant IS NULL
         OR reported_by_en IS NULL OR reported_by_zh_hant IS NULL`,
  );

  assert.equal(Number(blocking), 0, 'no seeded row exercises the permission, so the rollback is available today');
});
