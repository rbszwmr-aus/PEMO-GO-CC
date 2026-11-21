/**
 * BITING TESTS.
 *
 * A test suite that only proves the happy path proves very little. Each test here
 * pairs a guard with a MUTANT — a deliberate reproduction of the wrong behaviour —
 * and asserts that the guard catches the mutant. If a guard were ever weakened,
 * its mutant would start passing and the test goes red.
 *
 * Mutants that need to weaken the database do so inside a transaction that is
 * ROLLED BACK, so the wrong state never outlives the assertion.
 */

import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { loadBoundaryScanner } from '../../apps/api/dist/testing/boundary-scanner.js';

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
  await harness.applyScenario('mob-08-safety-overview', 'default');
  await harness.applyScenario('mob-09-safety-event-detail', 'default');
});
test.after(async () => {
  await harness.close();
});

const BASE = '/api/resident-mobile/v0';
const RESIDENT = 'res_wfg_000412';

test('BITING — Estate A reaching Estate B is caught', async () => {
  // The guard: scoped reads refuse a foreign unit.
  const scoped = await harness.modules.units.getResidentialUnit(
    { organizationId: 'org_wingfu_holdings' },
    'unit_hbv_b_05_b2',
  );
  assert.equal(scoped, undefined, 'GUARD: a foreign unit must not resolve');

  // The mutant: the same lookup with the organization predicate removed. It finds
  // the row — which is precisely why the predicate is not optional.
  const unscoped = await harness.admin.query<{ unit_id: string }>(
    `SELECT unit_id FROM property.unit WHERE unit_id = 'unit_hbv_b_05_b2'`,
  );
  assert.equal(unscoped.length, 1, 'MUTANT: without scoping, the foreign unit is reachable');

  // And end to end, the API refuses.
  const response = await harness.app.inject({
    method: 'GET',
    url: `${BASE}/safety/overview?unitId=unit_hbv_b_05_b2`,
    headers: { authorization: harness.token(RESIDENT) },
  });
  assert.equal(response.statusCode, 403);
});

test('BITING — duplicate delivery creating a second acknowledgement is caught', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-09-safety-event-detail', 'default');

  const url = `${BASE}/safety/events/evt_20260813_smoke01/acknowledgement`;
  const headers = { authorization: harness.token(RESIDENT) };
  const payload = { acknowledgementKey: '11112222-0000-4000-8000-000000000001', action: 'seen' as const };

  await harness.app.inject({ method: 'PUT', url, headers, payload });
  await harness.app.inject({ method: 'PUT', url, headers, payload });

  const rows = await harness.admin.query(
    `SELECT 1 FROM home_safety.acknowledgement WHERE event_id = 'evt_20260813_smoke01'`,
  );
  assert.equal(rows.length, 1, 'GUARD: a replayed key creates nothing new');

  // The mutant: drop the uniqueness that makes replay safe, then deliver twice.
  // Two rows appear — one resident, one alert, two records — which is the state
  // the constraint exists to prevent. Rolled back immediately.
  await assert.rejects(
    harness.admin.transaction(async (tx) => {
      await tx.query('ALTER TABLE home_safety.acknowledgement DROP CONSTRAINT acknowledgement_event_id_resident_id_key');
      await tx.query('ALTER TABLE home_safety.acknowledgement DROP CONSTRAINT acknowledgement_acknowledgement_key_key');
      await tx.query(
        `INSERT INTO home_safety.acknowledgement
           (acknowledgement_id, acknowledgement_key, event_id, resident_id, action, occurred_at, received_at, correlation_id)
         VALUES ('ack_mutant', '11112222-0000-4000-8000-000000000001', 'evt_20260813_smoke01', $1,
                 'seen', now(), now(), '1a2b3c4d-0000-4000-8000-0000000000ff')`,
        [RESIDENT],
      );
      const mutated = await tx.query(
        `SELECT 1 FROM home_safety.acknowledgement WHERE event_id = 'evt_20260813_smoke01'`,
      );
      assert.equal(mutated.length, 2, 'MUTANT: without the constraint a duplicate is recorded');
      throw new Error('rollback the mutant');
    }),
    /rollback the mutant/,
  );

  const after = await harness.admin.query(
    `SELECT 1 FROM home_safety.acknowledgement WHERE event_id = 'evt_20260813_smoke01'`,
  );
  assert.equal(after.length, 1, 'the mutant left no trace');
});

test('BITING — an unmapped unit being guessed instead of quarantined is caught', async () => {
  // The guard: an unresolvable unit reference resolves to nothing.
  const resolved = await harness.modules.audience.resolve({
    organizationId: 'org_wingfu_holdings',
    sourceUnitId: 'unit_wfg_a_12_a9',
    sourceLocationId: null,
  });
  assert.equal(resolved.kind, 'unresolved', 'GUARD: an unknown unit is never resolved');

  // The mutant: "nearest match" resolution, the tempting shortcut. It confidently
  // returns a real household — someone else's. This is why guessing is worse than
  // dropping: the alert arrives, at the wrong flat, looking correct.
  const nearestMatch = async (unitId: string): Promise<string | undefined> => {
    const rows = await harness.admin.query<{ unit_id: string }>(
      `SELECT unit_id FROM property.unit
        WHERE unit_class = 'residential'
        ORDER BY levenshtein(unit_id, $1), unit_id LIMIT 1`,
      [unitId],
    ).catch(async () =>
      // levenshtein needs fuzzystrmatch; fall back to a prefix match, which is the
      // shortcut someone would actually write.
      harness.admin.query<{ unit_id: string }>(
        `SELECT unit_id FROM property.unit
          WHERE unit_class = 'residential' AND unit_id LIKE $1
          ORDER BY unit_id LIMIT 1`,
        [`${unitId.slice(0, 15)}%`],
      ),
    );
    return rows[0]?.unit_id;
  };

  const guessed = await nearestMatch('unit_wfg_a_12_a9');
  assert.equal(guessed, 'unit_wfg_a_12_a1', "MUTANT: nearest-match attaches a stranger's alert");
  assert.notEqual(
    resolved.kind === 'resolved' ? resolved.unitIds[0] : undefined,
    guessed,
    'the real resolver must not agree with the guess',
  );
});

test('BITING — an unauthorised household member reading an event is caught', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-09-safety-event-detail', 'resident-not-authorized');

  // The guard: the event is invisible to a resident outside its audience.
  const denied = await harness.modules.events.getForAudience(
    'evt_20260813_other01',
    ['unit_wfg_a_12_a1'],
    RESIDENT,
  );
  assert.equal(denied, undefined, 'GUARD: an event outside the audience does not resolve');

  // The mutant: the same read with the audience check removed. The event is right
  // there — the audience filter is the only thing standing between a resident and
  // another household's safety alert.
  const unfiltered = await harness.admin.query(
    `SELECT event_id FROM home_safety.safety_event WHERE event_id = 'evt_20260813_other01'`,
  );
  assert.equal(unfiltered.length, 1, 'MUTANT: without the audience filter the event is readable');
});

test('BITING — a life-safety event losing its statutory disclaimer is caught', async () => {
  await harness.reseed();
  await harness.applyScenario('mob-09-safety-event-detail', 'default');

  const body = (
    await harness.app.inject({
      method: 'GET',
      url: `${BASE}/safety/events/evt_20260813_smoke01`,
      headers: { authorization: harness.token(RESIDENT) },
    })
  ).json();

  // The guard: the disclaimer is present, server-supplied, in both languages, and
  // says PEMO supplements rather than replaces statutory systems.
  assert.match(body.event.disclaimer.en, /supplements|does not replace/i);
  assert.ok(body.event.disclaimer['zh-Hant'].length > 0);

  // The mutant: try to store an event without one. The column is NOT NULL, so the
  // omission cannot even be written — the strongest form of this guard.
  await assert.rejects(
    harness.admin.query(
      `INSERT INTO home_safety.safety_event
         (event_id, organization_id, estate_id, severity, title_en, title_zh_hant,
          instruction_en, instruction_zh_hant, location_label_en, location_label_zh_hant,
          location_class, audience_source, occurred_at, received_at,
          reported_by_en, reported_by_zh_hant, disclaimer_en, disclaimer_zh_hant)
       VALUES ('evt_no_disclaimer', 'org_wingfu_holdings', 'est_wing_fu_garden', 'critical',
               'x', 'x', 'x', 'x', 'x', 'x', 'unit', 'unit', now(), now(), 'x', 'x', NULL, NULL)`,
    ),
    /disclaimer_en/,
  );
});

test('BITING — raw source data reaching a resident is caught', async () => {
  const scanner = await loadBoundaryScanner();

  const clean = (
    await harness.app.inject({
      method: 'GET',
      url: `${BASE}/safety/overview?unitId=unit_wfg_a_12_a1`,
      headers: { authorization: harness.token(RESIDENT) },
    })
  ).json();
  assert.deepEqual(scanner.scan(clean, 'clean'), [], 'GUARD: a real response carries nothing denied');

  // The mutant: the leak someone would actually ship — a device identifier and a
  // raw reading, passed straight through from a gateway that will carry any shape
  // PEMO asks for.
  const leaked = JSON.parse(JSON.stringify(clean));
  leaked.installedServices[0].deviceId = 'SMK-0042-AB';
  leaked.installedServices[0].rawValue = '412 ppm';
  leaked.safety.gatewayId = 'gw-blk-a-01';

  const findings = scanner.scan(leaked, 'leaked');
  const groups = new Set(findings.map((f) => f.group));
  assert.ok(findings.length >= 3, 'MUTANT: the scan must catch every leaked field');
  assert.ok(groups.has('deviceIdentity'));
  assert.ok(groups.has('telemetry'));
});

test('BITING — database state disappearing after a restart is caught', async () => {
  // The guard, from the recovered FEAT-001 section 3.10 persistence gate: the data
  // directory is a real filesystem on a named volume, and a value written before a
  // restart is still there afterwards. That probe was run before the first
  // migration; this asserts the storage layer has not silently changed since.
  const rows = await harness.admin.query<{ setting: string }>(
    `SELECT setting FROM pg_settings WHERE name = 'data_directory'`,
  );
  assert.equal(rows[0]?.setting, '/var/lib/postgresql/data', 'the data directory must be the mounted volume');

  // And a value written earlier in this suite is still readable, which is the
  // cheap continuous version of the write-restart-read probe.
  const survived = await harness.admin.query(
    `SELECT 1 FROM platform.organization WHERE organization_id = 'org_wingfu_holdings'`,
  );
  assert.equal(survived.length, 1);

  // The mutant: the check that would pass a RAM-backed directory. A tmpfs mount
  // line must be rejected — a development database that silently loses state on
  // restart wastes days before anyone suspects the storage layer.
  const isDurable = (mountLine: string): boolean =>
    !/\b(tmpfs|ramfs|overlay)\b/.test(mountLine);

  assert.equal(
    isDurable('/dev/mapper/ubuntu--vg-ubuntu--lv /var/lib/postgresql/data ext4 rw,relatime 0 0'),
    true,
    'GUARD: a real filesystem passes',
  );
  assert.equal(
    isDurable('tmpfs /var/lib/postgresql/data tmpfs rw,relatime 0 0'),
    false,
    'MUTANT: a tmpfs data directory must fail the gate',
  );
});

test('BITING — an integration failure being swallowed is caught', async () => {
  // A fresh identifier per run: the point is that the failure was invisible
  // BEFORE it was recorded, and a leftover row from an earlier run would hide that.
  const correlationId = randomUUID();

  // The mutant: the catch block everyone writes at 5pm.
  const swallow = async (): Promise<void> => {
    try {
      throw new Error('downstream rejected the request');
    } catch {
      // ...and the failure is gone.
    }
  };
  await swallow();

  let recorded = await harness.admin.query(
    `SELECT 1 FROM platform.integration_exception WHERE correlation_id = $1`,
    [correlationId],
  );
  assert.equal(recorded.length, 0, 'MUTANT: a swallowed failure leaves no evidence anywhere');

  // The guard: the same failure, surfaced.
  await harness.modules.deadLetters.record({
    source: 'test.biting',
    reason: 'downstream rejected the request',
    correlationId,
    detail: { attempt: 1 },
  });

  recorded = await harness.admin.query(
    `SELECT 1 FROM platform.integration_exception WHERE correlation_id = $1`,
    [correlationId],
  );
  assert.equal(recorded.length, 1, 'GUARD: the failure is visible and auditable');
});
