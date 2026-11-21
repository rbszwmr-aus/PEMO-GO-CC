/**
 * ADR-006: provenance, as-at resolution, and the boundaries that must survive it.
 *
 * Every assertion in this file has a RED CONDITION exercised alongside it. An
 * assertion that has never failed is not an assertion — it is a line that runs.
 *
 * As-at resolution is called through `@pemo/integration`'s query ports and is
 * never reimplemented here. A second implementation can agree with itself while
 * both are wrong, and the suite would then be testing the reimplementation.
 */

import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
// Reached by RELATIVE PATH into the built module, not by bare specifier.
//
// tests/** is outside the pnpm workspace globs, so a bare specifier would not
// resolve — the same constraint that shaped the existing harness. Importing the
// built dist directly also keeps apps/api free of a dependency on
// @pemo/integration, which must stay DELIBERATELY UNWIRED: a testing re-export
// inside apps/api would have made it a dependency in everything but name.
//
// The as-at ports are CALLED here and never reimplemented. A second
// implementation can agree with itself while both are wrong.
import { createAsAtQueries } from '../../modules/integration/dist/index.js';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { loadBoundaryScanner } from '../../apps/api/dist/testing/boundary-scanner.js';

const MODULE_SCHEMAS = ['platform', 'property', 'resident', 'home_safety', 'integration'];

/** A device reference chosen to be unmistakable if it ever appeared in a response. */
const DEVICE_REF = 'PANEL-ZX9-ZONE-0447-GEN012';

let harness: Harness;
/**
 * FIXTURE WRITES GO THROUGH THE OWNER HANDLE, never the app credential.
 *
 * `pemo_app` holds SELECT + INSERT and nothing else, so a fixture teardown run
 * through it is refused — and the test then cannot tell "the app is forbidden
 * this" from "my fixture could not run". Worse, a constraint probe issued as the
 * app fails on PERMISSION rather than on the constraint it exists to prove.
 *
 * Fixtures are owner work, exactly as the seeds' DELETEs are. The app handle
 * below stays for the module code under test, which is what actually runs as
 * the application.
 */
let integrationDb: ReturnType<typeof createModuleDb>;
let fixtureDb: ReturnType<typeof createModuleDb>;
let asAt: ReturnType<typeof createAsAtQueries>;

test.before(async () => {
  harness = await startHarness();
  // RT5-F6: integration has no runtime login; the module is owner-reached.
  integrationDb = createModuleDb({ schema: 'integration', database: loadConfig().databaseOwner });
  // Owner credential: fixtures are owner work (see the note above).
  fixtureDb = createModuleDb({ schema: 'integration', database: loadConfig().databaseOwner });
  asAt = createAsAtQueries(integrationDb);
});
test.after(async () => {
  await integrationDb.close();
  await fixtureDb.close();
  await harness.close();
});

const sweepCrossModuleForeignKeys = async (): Promise<number> => {
  const rows = await harness.admin.query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM pg_constraint c
       JOIN pg_class t       ON t.oid = c.conrelid
       JOIN pg_namespace ns  ON ns.oid = t.relnamespace
       JOIN pg_class ft      ON ft.oid = c.confrelid
       JOIN pg_namespace fns ON fns.oid = ft.relnamespace
      WHERE c.contype = 'f' AND ns.nspname <> fns.nspname
        AND ns.nspname = ANY($1::text[]) AND fns.nspname = ANY($1::text[])`,
    [MODULE_SCHEMAS],
  );
  return rows[0]?.n ?? -1;
};

// ─────────────────────────────────────────────────────── provenance (C5)

test('every pre-existing event is marked unknown, and none claims a provenance', async () => {
  // The backfill was applied to a table that ALREADY HELD ROWS. A backfill
  // verified on an empty table is the migration reporting success at having done
  // nothing — the same shape as a green test whose red condition is unknown.
  const rows = await harness.admin.query<{ provenance_state: string; n: number }>(
    `SELECT provenance_state, count(*)::int AS n
       FROM home_safety.safety_event GROUP BY provenance_state ORDER BY 1`,
  );

  assert.ok(rows.length > 0, 'there must be events to have backfilled');
  for (const row of rows) {
    assert.equal(row.provenance_state, 'unknown_pre_adr_006');
    assert.ok(row.n > 0);
  }

  // Unknown means all three fields absent — not an empty string that would later
  // read as "version zero", and not a default policy version.
  const claiming = await harness.admin.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM home_safety.safety_event
      WHERE provenance_state = 'unknown_pre_adr_006'
        AND (source_classification IS NOT NULL OR policy_version IS NOT NULL OR classified_at IS NOT NULL)`,
  );
  assert.equal(claiming[0]?.n, 0);
});

test('RED — a half-claimed provenance cannot be stored at all', async () => {
  // The PID said "do not fabricate provenance". This asserts the stronger
  // property: the fabricated shape is unrepresentable, so the rule cannot be
  // broken by someone who never read the instruction.
  await assert.rejects(
    harness.admin.query(
      `UPDATE home_safety.safety_event
          SET provenance_state = 'recorded'
        WHERE event_id = 'evt_20260813_smoke01'`,
    ),
    /provenance_is_complete_or_absent/,
    'claiming `recorded` without the three fields must be refused',
  );

  await assert.rejects(
    harness.admin.query(
      `UPDATE home_safety.safety_event
          SET policy_version = 'policy-v1'
        WHERE event_id = 'evt_20260813_smoke01'`,
    ),
    /provenance_is_complete_or_absent/,
    'attaching a policy version to an unknown-provenance row must be refused',
  );

  // And the honest complete shape IS storable — otherwise the constraint would be
  // refusing everything, which would pass the two assertions above for the wrong
  // reason.
  await harness.admin.query(
    `UPDATE home_safety.safety_event
        SET provenance_state = 'recorded',
            source_classification = 'FIRE_ALARM_CONFIRMED',
            policy_version = 'policy-2026-08-A',
            classified_at = now()
      WHERE event_id = 'evt_20260813_smoke01'`,
  );
  const back = await harness.admin.query<{ provenance_state: string }>(
    `SELECT provenance_state FROM home_safety.safety_event WHERE event_id = 'evt_20260813_smoke01'`,
  );
  assert.equal(back[0]?.provenance_state, 'recorded');

  // Restore, so the rest of the suite sees the seeded world.
  await harness.admin.query(
    `UPDATE home_safety.safety_event
        SET provenance_state = 'unknown_pre_adr_006',
            source_classification = NULL, policy_version = NULL, classified_at = NULL
      WHERE event_id = 'evt_20260813_smoke01'`,
  );
});

// ──────────────────────────────────────────── the boundary sweep (and its red)

test('the cross-module foreign key sweep returns zero — and can return non-zero', async () => {
  assert.equal(await sweepCrossModuleForeignKeys(), 0, 'baseline must be zero');

  // RED CONDITION. Add a real cross-module foreign key — integration → property,
  // exactly the one this design was careful not to create — and confirm the sweep
  // sees it. Rolled back, so the wrong state never outlives the assertion.
  await assert.rejects(
    harness.admin.transaction(async (tx) => {
      await tx.query(
        `ALTER TABLE integration.device_location_mapping
           ADD CONSTRAINT tmp_cross_module_fk
           FOREIGN KEY (organization_id) REFERENCES platform.organization (organization_id)`,
      );
      const rows = await tx.query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM pg_constraint c
           JOIN pg_class t       ON t.oid = c.conrelid
           JOIN pg_namespace ns  ON ns.oid = t.relnamespace
           JOIN pg_class ft      ON ft.oid = c.confrelid
           JOIN pg_namespace fns ON fns.oid = ft.relnamespace
          WHERE c.contype = 'f' AND ns.nspname <> fns.nspname
            AND ns.nspname = ANY($1::text[]) AND fns.nspname = ANY($1::text[])`,
        [MODULE_SCHEMAS],
      );
      assert.equal(rows[0]?.n, 1, 'MUTANT: the sweep must see a real cross-module FK');
      throw new Error('rollback the mutant');
    }),
    /rollback the mutant/,
  );

  assert.equal(await sweepCrossModuleForeignKeys(), 0, 'and the mutant left nothing behind');
});

// ──────────────────────────────────────────────────── effective dating (the point)

test('a historical event resolves as it did THEN, not as configuration says now', async () => {
  const system = { type: 'test-panel', version: 'fw-1.0' };
  const deviceRef = `DEV-EFFDATE-${randomUUID().slice(0, 8)}`;

  // A device mapped to Block A until 1 August, re-wired to Block C from then on.
  await fixtureDb.query(
    `INSERT INTO device_location_mapping
       (mapping_id, source_system_type, source_system_version, source_device_ref, source_zone_ref,
        organization_id, target_type, target_id, effective_from, effective_to)
     VALUES ($1, $2, $3, $4, '', 'org_wingfu_holdings', 'building', 'blk_wfg_a',
             '2026-01-01T00:00:00+08:00', '2026-08-01T00:00:00+08:00')`,
    [`map_old_${deviceRef}`, system.type, system.version, deviceRef],
  );
  await fixtureDb.query(
    `INSERT INTO device_location_mapping
       (mapping_id, source_system_type, source_system_version, source_device_ref, source_zone_ref,
        organization_id, target_type, target_id, effective_from, effective_to)
     VALUES ($1, $2, $3, $4, '', 'org_wingfu_holdings', 'building', 'blk_wfg_c',
             '2026-08-01T00:00:00+08:00', NULL)`,
    [`map_new_${deviceRef}`, system.type, system.version, deviceRef],
  );

  const historical = new Date('2026-07-01T09:00:00+08:00');
  const today = new Date('2026-08-13T09:00:00+08:00');

  const then = await asAt.resolveLocation({
    sourceSystemType: system.type,
    sourceSystemVersion: system.version,
    sourceDeviceRef: deviceRef,
    asAt: historical,
  });
  const now = await asAt.resolveLocation({
    sourceSystemType: system.type,
    sourceSystemVersion: system.version,
    sourceDeviceRef: deviceRef,
    asAt: today,
  });

  assert.equal(then.kind, 'resolved');
  assert.equal(then.kind === 'resolved' ? then.value.targetId : '', 'blk_wfg_a');

  assert.equal(now.kind, 'resolved');
  assert.equal(now.kind === 'resolved' ? now.value.targetId : '', 'blk_wfg_c');

  // RED CONDITION. Resolving the HISTORICAL event against CURRENT configuration
  // gives the wrong building — which is the whole failure effective dating exists
  // to prevent, and the reason a test that only ever resolves "now" proves
  // nothing.
  assert.notEqual(
    now.kind === 'resolved' ? now.value.targetId : '',
    then.kind === 'resolved' ? then.value.targetId : '',
    'if these agreed, the test could not tell as-at from now',
  );

  await fixtureDb.query('DELETE FROM device_location_mapping WHERE source_device_ref = $1', [
    deviceRef,
  ]);
});

test('the boundary instant belongs to exactly one period', async () => {
  // Half-open [from, to): a row ending at T and a row starting at T are one
  // continuous history. If the as-at predicate and the exclusion constraint
  // disagreed here, a change at an instant boundary would resolve twice or not at
  // all — and both failures are invisible except exactly on the boundary.
  const system = { type: 'test-panel', version: 'fw-boundary' };
  const deviceRef = `DEV-BOUND-${randomUUID().slice(0, 8)}`;
  const boundary = '2026-08-01T00:00:00+08:00';

  await fixtureDb.query(
    `INSERT INTO device_location_mapping
       (mapping_id, source_system_type, source_system_version, source_device_ref, source_zone_ref,
        organization_id, target_type, target_id, effective_from, effective_to)
     VALUES ($1, $2, $3, $4, '', 'org_wingfu_holdings', 'building', 'blk_wfg_a',
             '2026-01-01T00:00:00+08:00', $5),
            ($6, $2, $3, $4, '', 'org_wingfu_holdings', 'building', 'blk_wfg_c', $5, NULL)`,
    [`map_b1_${deviceRef}`, system.type, system.version, deviceRef, boundary, `map_b2_${deviceRef}`],
  );

  const atBoundary = await asAt.resolveLocation({
    sourceSystemType: system.type,
    sourceSystemVersion: system.version,
    sourceDeviceRef: deviceRef,
    asAt: new Date(boundary),
  });
  assert.equal(atBoundary.kind, 'resolved');
  assert.equal(
    atBoundary.kind === 'resolved' ? atBoundary.value.targetId : '',
    'blk_wfg_c',
    'the instant a period starts belongs to the NEW period, not both',
  );

  await fixtureDb.query('DELETE FROM device_location_mapping WHERE source_device_ref = $1', [
    deviceRef,
  ]);
});

test('overlapping periods are refused declaratively, on all three tables', async () => {
  // The exclusion constraint, not a trigger: a trigger is bypassable by a bulk
  // load, which is exactly how bad history arrives.
  const suffix = randomUUID().slice(0, 8);

  await fixtureDb.query(
    `INSERT INTO device_location_mapping
       (mapping_id, source_system_type, source_system_version, source_device_ref, source_zone_ref,
        organization_id, target_type, target_id, effective_from, effective_to)
     VALUES ($1, 'ov-panel', 'fw-1', $2, '', 'org_wingfu_holdings', 'building', 'blk_wfg_a',
             '2026-01-01T00:00:00+08:00', '2026-06-01T00:00:00+08:00')`,
    [`map_ov1_${suffix}`, `DEV-OV-${suffix}`],
  );
  await assert.rejects(
    fixtureDb.query(
      `INSERT INTO device_location_mapping
         (mapping_id, source_system_type, source_system_version, source_device_ref, source_zone_ref,
          organization_id, target_type, target_id, effective_from, effective_to)
       VALUES ($1, 'ov-panel', 'fw-1', $2, '', 'org_wingfu_holdings', 'building', 'blk_wfg_c',
               '2026-03-01T00:00:00+08:00', '2026-09-01T00:00:00+08:00')`,
      [`map_ov2_${suffix}`, `DEV-OV-${suffix}`],
    ),
    /mapping_no_overlapping_periods/,
    'two CLOSED periods that overlap must be refused — the partial unique index would not have caught this',
  );

  await fixtureDb.query(
    `INSERT INTO event_vocabulary
       (vocabulary_id, source_system_type, source_system_version, source_event_code,
        normalised_event_type, effective_from, effective_to)
     VALUES ($1, 'ov-panel', 'fw-1', $2, 'smoke_detected',
             '2026-01-01T00:00:00+08:00', '2026-06-01T00:00:00+08:00')`,
    [`voc_ov1_${suffix}`, `CODE-${suffix}`],
  );
  await assert.rejects(
    fixtureDb.query(
      `INSERT INTO event_vocabulary
         (vocabulary_id, source_system_type, source_system_version, source_event_code,
          normalised_event_type, effective_from, effective_to)
       VALUES ($1, 'ov-panel', 'fw-1', $2, 'gas_detected',
               '2026-03-01T00:00:00+08:00', NULL)`,
      [`voc_ov2_${suffix}`, `CODE-${suffix}`],
    ),
    /vocabulary_no_overlapping_periods/,
  );

  // The policy table stays empty in the committed state; this exercises its
  // constraint inside a transaction that is rolled back, so the table is still
  // empty afterwards. An empty approved-policy table is the correct state, and
  // this test must not be the thing that fills it.
  await assert.rejects(
    integrationDb.transaction(async (tx) => {
      const policyValues = (id: string, from: string, to: string | null) =>
        tx.query(
          `INSERT INTO severity_policy
             (policy_id, policy_version, normalised_event_type, location_class, pemo_severity,
              resident_copy_ref, approved_by, approved_on, approval_reference, effective_from, effective_to)
           VALUES ($1, 'test-only', $2, 'unit', 'warning', 'copy.ref', 'test', '2026-08-13', 'ref', $3, $4)`,
          [id, `ov_type_${suffix}`, from, to],
        );
      await policyValues(`pol_ov1_${suffix}`, '2026-01-01T00:00:00+08:00', '2026-06-01T00:00:00+08:00');
      await assert.rejects(
        policyValues(`pol_ov2_${suffix}`, '2026-03-01T00:00:00+08:00', null),
        /policy_no_overlapping_periods/,
      );
      throw new Error('rollback: the policy table ships empty');
    }),
    /rollback: the policy table ships empty/,
  );

  const remaining = await integrationDb.query<{ n: number }>(
    'SELECT count(*)::int AS n FROM severity_policy',
  );
  assert.equal(remaining[0]?.n, 0, 'the severity policy table must still be empty');

  await fixtureDb.query('DELETE FROM device_location_mapping WHERE source_device_ref = $1', [
    `DEV-OV-${suffix}`,
  ]);
  await fixtureDb.query('DELETE FROM event_vocabulary WHERE source_event_code = $1', [
    `CODE-${suffix}`,
  ]);
});

// ────────────────────────────────────── the resident boundary, now that devices exist

test('a mapping identifier cannot reach a resident payload', async () => {
  // ADR-006 requires this test by name. Storing a device reference does not
  // breach the resident boundary — forbidden-terms.json governs what crosses into
  // a RESPONSE, not what PEMO persists — but that distinction is only safe if
  // something checks it.
  // Idempotent: a previous run that failed before its cleanup must not make this
  // one fail for an unrelated reason.
  await fixtureDb.query(`DELETE FROM device_location_mapping WHERE mapping_id = 'map_leak_probe'`);
  await fixtureDb.query(
    `INSERT INTO device_location_mapping
       (mapping_id, source_system_type, source_system_version, source_device_ref, source_zone_ref,
        organization_id, target_type, target_id, effective_from)
     VALUES ('map_leak_probe', 'leak-probe', 'fw-1', $1, 'ZONE-0447',
             'org_wingfu_holdings', 'unit', 'unit_wfg_a_12_a1', '2020-01-01T00:00:00+08:00')`,
    [DEVICE_REF],
  );

  const headers = { authorization: harness.token('res_wfg_000412') };
  const base = '/api/resident-mobile/v0';
  const urls = [
    `${base}/home?unitId=unit_wfg_a_12_a1`,
    `${base}/services?unitId=unit_wfg_a_12_a1`,
    `${base}/safety/overview?unitId=unit_wfg_a_12_a1`,
    `${base}/safety/events/evt_20260813_smoke01`,
    `${base}/account`,
  ];

  const scanner = await loadBoundaryScanner();
  for (const url of urls) {
    const response = await harness.app.inject({ method: 'GET', url, headers });
    const body = response.body;

    assert.ok(!body.includes(DEVICE_REF), `${url} leaked the device reference`);
    assert.ok(!body.includes('ZONE-0447'), `${url} leaked the zone reference`);
    assert.ok(!body.includes('map_leak_probe'), `${url} leaked the mapping identifier`);
    assert.deepEqual(scanner.scan(response.json(), url), []);
  }

  // RED CONDITION. The check is only meaningful if it would catch the leak — so
  // put the identifier into a response body and confirm it is caught.
  //
  // Writing this is what found the denylist gap: the pinned forbidden-terms.json
  // enumerates identifier NAMES, and `sourceDeviceRef` — the name the mapping
  // table actually uses — is not among them, so the scan alone passed a leaked
  // device reference. Reported to API-005-ST; the local scan carries the extra
  // terms in the meantime, exactly as the car-park terms are carried.
  //
  // Note which assertion is load-bearing: string containment catches the leak
  // under ANY field name, including one nobody has thought of yet.
  const leaked = JSON.parse(JSON.stringify((await harness.app.inject({
    method: 'GET',
    url: urls[2]!,
    headers,
  })).json())) as Record<string, unknown>;
  (leaked as { safety: Record<string, unknown> }).safety['sourceDeviceRef'] = DEVICE_REF;

  assert.ok(
    JSON.stringify(leaked).includes(DEVICE_REF),
    'MUTANT: a leaked device reference must be detectable by the same means',
  );
  assert.ok(
    scanner.scan(leaked, 'mutant').length > 0,
    'MUTANT: the boundary scanner must flag a device reference in a response',
  );

  await fixtureDb.query(`DELETE FROM device_location_mapping WHERE mapping_id = 'map_leak_probe'`);
});

test('home_safety cannot read the integration schema', async () => {
  // The module boundary, at the layer no lint rule can see. Home Safety owns
  // resident presentation; it does not own device correspondence, and it cannot
  // reach it even if someone wrote the query.
  await assert.rejects(
    harness.modules.homeSafetyDb.query('SELECT * FROM device_location_mapping LIMIT 1'),
    /does not exist/,
  );
  await assert.rejects(
    harness.modules.homeSafetyDb.query('SELECT * FROM severity_policy LIMIT 1'),
    /does not exist/,
  );
});

// ─────────────────────────────────────────────── quarantine: stores, does not escalate

test('quarantine holds unrecognised input, unassigned, with no severity anywhere', async () => {
  const quarantineId = `qtn_${randomUUID()}`;
  await fixtureDb.query(
    `INSERT INTO classification_quarantine
       (quarantine_id, organization_id, source_system_type, source_system_version,
        source_event_code, source_classification, reason, received_at, correlation_id)
     VALUES ($1, 'org_wingfu_holdings', 'test-panel', 'fw-1', 'UNKNOWN_CODE_42', 'ALARM',
             'unknown_event_code', now(), $2)`,
    [quarantineId, randomUUID()],
  );

  const held = await integrationDb.query<{ status: string }>(
    'SELECT status FROM classification_quarantine WHERE quarantine_id = $1',
    [quarantineId],
  );
  assert.equal(held[0]?.status, 'held', 'unrecognised input is held, never dropped');

  // The two deliberate absences, asserted so that adding either becomes a visible
  // decision rather than a quiet one.
  const columns = await harness.admin.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'integration' AND table_name = 'classification_quarantine'`,
  );
  const names = columns.map((c) => c.column_name);

  assert.ok(!names.includes('severity'), 'quarantine must have nowhere to default a severity to');
  for (const escalation of ['assigned_to', 'escalated_at', 'notified_at', 'due_at']) {
    assert.ok(
      !names.includes(escalation),
      `quarantine must not carry "${escalation}": C4's named role and response time do not exist yet, and the column would imply escalation is built`,
    );
  }

  // Resolution is explicit — a status change without a human behind it is refused.
  await assert.rejects(
    fixtureDb.query(
      `UPDATE classification_quarantine SET status = 'resolved' WHERE quarantine_id = $1`,
      [quarantineId],
    ),
    /quarantine_resolution_is_explicit/,
  );

  await fixtureDb.query('DELETE FROM classification_quarantine WHERE quarantine_id = $1', [
    quarantineId,
  ]);
});

test('an empty policy table quarantines rather than guessing', async () => {
  // The policy table ships empty by design, so every severity resolution is
  // currently unresolved — and `unresolved` is a quarantine reason, never a
  // severity. This is the behaviour that makes an empty table safe rather than
  // broken.
  const outcome = await asAt.resolveSeverity({
    normalisedEventType: 'smoke_detected',
    locationClass: 'unit',
    asAt: new Date('2026-08-13T10:00:00+08:00'),
  });

  assert.equal(outcome.kind, 'unresolved');
  assert.equal(outcome.kind === 'unresolved' ? outcome.reason : '', 'no_policy_entry');
  assert.ok(!('severity' in outcome), 'an unresolved classification carries no severity at all');
});
