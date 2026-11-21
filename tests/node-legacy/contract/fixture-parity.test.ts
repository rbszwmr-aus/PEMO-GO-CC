/**
 * FIXTURE PARITY.
 *
 * This is the acceptance test that makes the parallel Flutter session safe. If it
 * fails, UI-007-ST is building against a lie.
 *
 * Every fixture in the pinned corpus is requested from the RUNNING API against
 * seeded data and compared EXACTLY. Nothing is normalised away:
 *
 *   * the correlation identifier is supplied as a request header and echoed, so
 *     the contract's correlation rule is exercised rather than excused;
 *   * the clock is pinned through the development seam, so `generatedAt` and
 *     every `freshness.ageSeconds` are deterministic.
 *
 * A test that normalised those two fields would silently stop checking data age,
 * which is the one thing a safety screen must not get wrong.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readManifest, readFixture, startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { loadContractValidator } from '../../apps/api/dist/testing/contract-validator.js';

const RESIDENT = 'res_wfg_000412';
const UNIT = 'unit_wfg_a_12_a1';

const ROUTES: Record<string, { path: (body: any) => string; needsUnit: boolean; operationId: string }> = {
  'mob-02-home': { path: () => '/api/resident-mobile/v0/home', needsUnit: true, operationId: 'getHome' },
  'mob-03-services': { path: () => '/api/resident-mobile/v0/services', needsUnit: true, operationId: 'getServices' },
  'mob-08-safety-overview': {
    path: () => '/api/resident-mobile/v0/safety/overview',
    needsUnit: true,
    operationId: 'getSafetyOverview',
  },
  'mob-09-safety-event-detail': {
    path: (body) =>
      `/api/resident-mobile/v0/safety/events/${body?.event?.eventId ?? body?.eventId ?? 'evt_20260813_smoke01'}`,
    needsUnit: false,
    operationId: 'getSafetyEvent',
  },
  'mob-11-account': { path: () => '/api/resident-mobile/v0/account', needsUnit: false, operationId: 'getAccount' },
};

/** States driven by the development fault seam rather than by seeded data. */
const FAULTS: Record<string, string> = {
  'integration-unavailable': 'integration-unavailable',
  error: 'internal-error',
  partial: 'partial',
};

let harness: Harness;

test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.close();
});

const manifest = await readManifest();
const validator = await loadContractValidator();

test('the contract, the fixture manifest and the API agree on one version', async () => {
  // Asserted as an AGREEMENT rather than against a literal. A version-only bump
  // must not need a code change, and this is what proves the three stay in step.
  const { CONTRACT_VERSION } = await import('../../apps/api/dist/contract/contract-version.js');
  assert.equal(manifest.contractVersion, validator.contractVersion);
  assert.equal(CONTRACT_VERSION, validator.contractVersion);
});

for (const entry of manifest.fixtures) {
  if (entry.file === null) continue;

  const route = ROUTES[entry.screen];
  if (route === undefined) continue;

  test(`fixture parity — ${entry.file}`, async () => {
    const expected = (await readFixture(entry.file!)) as any;
    const status = entry.httpStatus ?? 200;

    // The status a fixture claims must be one the operation actually declares.
    // Its absence in v0.1.0 is exactly how six fixtures shipped unservable.
    const operationId = ['acknowledgement-recorded', 'acknowledgement-replayed', 'duplicate-submission'].includes(
      entry.state,
    )
      ? 'acknowledgeSafetyEvent'
      : route.operationId;

    assert.ok(
      validator.declaresStatus(operationId, status),
      `${operationId} does not declare status ${status} in the pinned contract`,
    );

    await harness.reseed();
    await harness.applyScenario(entry.screen, entry.state);

    const correlationId =
      expected?.meta?.correlationId ?? expected?.correlationId ?? '1a2b3c4d-0000-4000-8000-00000000ffff';
    const generatedAt = expected?.meta?.generatedAt ?? '2026-08-13T10:00:00+08:00';

    const headers: Record<string, string> = {
      'x-correlation-id': correlationId,
      'x-pemo-dev-now': generatedAt,
      'x-pemo-dev-scenario': entry.state,
    };

    /**
     * PROVOCATION — recorded here, in the test, not only in a report.
     *
     * A fixture records a RESPONSE. It does not record the condition that
     * produced it, so a fixture is green when the bytes match whether or not the
     * situation it claims to describe is the situation that produced them. That
     * gap is real and is raised as G7 for the contract track; this comment is its
     * local mitigation.
     *
     *   session-expired  ← a GENUINELY EXPIRED token: correctly signed, real
     *                      resident, issued outside the TTL window.
     *
     *                      It was previously provoked by sending NO token, which
     *                      produced the same bytes for the wrong reason — the
     *                      fixture passed while the state it describes could not
     *                      occur at all. Since B5, an absent token is
     *                      invalid-credential, and only a real expiry produces
     *                      this body.
     *
     *   no-permission    ← a resident with no active residential relationship.
     *   caregiver-…      ← a caregiver whose scope ended, asking the day after.
     *   error / 503      ← the development fault seam; no seeded data can produce
     *                      a transport or framework failure.
     *   everything else  ← seeded data alone.
     */
    let residentId = RESIDENT;
    let unitId = UNIT;
    // A caregiver whose scope ended yesterday, asking today. Only on the safety
    // screen: the account fixture of the same name is the OTHER side of that
    // story — the resident whose caregiver's access lapsed, seeing it listed.
    if (entry.state === 'caregiver-permission-expired' && entry.screen === 'mob-08-safety-overview') {
      residentId = 'res_wfg_000733';
    }
    // A resident with no active residential relationship. Real authorization, not
    // an injected fault.
    if (entry.state === 'no-permission') residentId = 'res_wfg_000001';
    // A unit the resident genuinely holds but which has no safety projection: the
    // quarantine path, answered with 409 UnitNotMapped rather than a normal-looking
    // 200 (declared since contract v0.1.1).
    if (entry.state === 'unknown-unit' && entry.screen === 'mob-08-safety-overview') {
      unitId = 'unit_wfg_c_08_c3';
    }
    headers['authorization'] =
      entry.state === 'session-expired' ? harness.expiredToken(residentId) : harness.token(residentId);

    const fault = FAULTS[entry.state];
    if (fault !== undefined) headers['x-pemo-dev-fault'] = fault;

    // Two event states are built rather than transcribed, because their fixtures
    // are Problem bodies with no event to read back.
    const eventOverrides: Record<string, string> = {
      'retracted-event': 'evt_20260813_retract',
      'resident-not-authorized': 'evt_20260813_other01',
    };
    const overrideEventId = eventOverrides[entry.state];

    const query = route.needsUnit ? `?unitId=${unitId}` : '';

    // The acknowledgement fixtures describe the contract's single write path.
    // `recorded` and `replayed` differ only in whether the SAME key has been seen
    // before, so the replay case is produced by sending the identical request
    // twice — which is exactly the retry-after-timeout the rule exists for.
    const ackStates = new Set(['acknowledgement-recorded', 'acknowledgement-replayed', 'duplicate-submission']);
    let response;
    if (ackStates.has(entry.state)) {
      const eventId = (expected?.eventId as string | undefined) ?? 'evt_20260813_smoke01';
      const url = `/api/resident-mobile/v0/safety/events/${eventId}/acknowledgement`;
      const key = '4f1c9a55-0000-4000-8000-000000000001';
      const actedAt = (expected?.acknowledgement?.acknowledgedAt as string | undefined) ?? generatedAt;
      const payload = { acknowledgementKey: key, action: 'i_am_safe', occurredAt: actedAt };

      const first = await harness.app.inject({ method: 'PUT', url, headers, payload });
      if (entry.state === 'acknowledgement-recorded') {
        response = first;
      } else if (entry.state === 'acknowledgement-replayed') {
        response = await harness.app.inject({ method: 'PUT', url, headers, payload });
      } else {
        // A DIFFERENT key for the same resident and event: a duplicate submission,
        // refused with 409 rather than silently recorded a second time.
        response = await harness.app.inject({
          method: 'PUT',
          url,
          headers,
          payload: { ...payload, acknowledgementKey: '4f1c9a55-0000-4000-8000-000000000002' },
        });
      }
    } else {
      const url =
        overrideEventId !== undefined && entry.screen === 'mob-09-safety-event-detail'
          ? `/api/resident-mobile/v0/safety/events/${overrideEventId}`
          : `${route.path(expected)}${query}`;
      response = await harness.app.inject({ method: 'GET', url, headers });
    }

    assert.equal(response.statusCode, status, `status for ${entry.file}: ${response.body.slice(0, 400)}`);

    const actual = response.json();
    const schemaErrors = validator.validate(entry.schema ?? 'Problem', actual);
    assert.deepEqual(schemaErrors, [], `schema errors for ${entry.file}`);

    assert.deepEqual(actual, expected, `body mismatch for ${entry.file}`);
  });
}
