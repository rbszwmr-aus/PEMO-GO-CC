/**
 * W3 batch 3b-i -- the identity boundary (ADR-016).
 *
 * PEMO AUTHORIZES, IT DOES NOT AUTHENTICATE. These prove the schema says so,
 * not just the comments: an external identity carries its id, anything else
 * carries none, the same identity cannot be recorded twice in one organization,
 * one person may work for two, and there is nowhere to put a credential.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';
import { createPrincipalCommands } from '../../modules/access/dist/index.js';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

const ORG_A = 'org_w3i_a';
const ORG_B = 'org_w3i_b';

let harness: Harness;
let owner: ReturnType<typeof createModuleDb>;
let app: ReturnType<typeof createModuleDb>;

test.before(async () => {
  harness = await startHarness();
  owner = createModuleDb({ schema: 'access', database: loadConfig().databaseOwner });
  app = createModuleDb({ schema: 'access', database: loadConfig().moduleDatabases.access });
  await owner.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ($1, 'W3IA', 'A', 'A'), ($2, 'W3IB', 'B', 'B')
     ON CONFLICT (organization_id) DO NOTHING`, [ORG_A, ORG_B]);
});

test.after(async () => {
  // Escaped: `_` is a LIKE wildcard, so a bare prefix reaches further than it looks.
  await owner.query(`DELETE FROM staff_principal WHERE principal_id LIKE $1 ESCAPE '\\'`, ['stf\\_w3i%']);
  await owner.query(`DELETE FROM platform.organization WHERE organization_id LIKE $1 ESCAPE '\\'`, ['org\\_w3i\\_%']);
  await owner.close();
  await app.close();
  await harness.close();
});

const commands = () => createPrincipalCommands(app);

const rawInsert = (cols: Record<string, unknown>) => {
  const names = Object.keys(cols);
  return owner.query(
    `INSERT INTO staff_principal (${names.join(', ')})
     VALUES (${names.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(cols),
  );
};

// ------------------------------------------------- the biconditional, both ways

test('an EXTERNAL principal WITHOUT an external_id is refused', async () => {
  await assert.rejects(
    rawInsert({
      principal_id: 'stf_w3i_bad_a', organization_id: ORG_A,
      display_name: 'No id', identity_source: 'external',
    }),
    /staff_principal_external_id_only_when_external/,
    'recording an external identity without the id is the one thing it must not do',
  );
});

test('a NON-EXTERNAL principal WITH an external_id is refused', async () => {
  await assert.rejects(
    rawInsert({
      principal_id: 'stf_w3i_bad_b', organization_id: ORG_A, display_name: 'Fixture',
      identity_source: 'recorded_seed', external_id: 'idp|someone',
    }),
    /staff_principal_external_id_only_when_external/,
    'a fixture carrying an external id is the fiction the null exists to avoid',
  );
});

test('and BOTH honest shapes are accepted', async () => {
  // The negatives above are worthless if everything is refused.
  await rawInsert({
    principal_id: 'stf_w3i_seed', organization_id: ORG_A,
    display_name: 'Fixture', identity_source: 'recorded_seed',
  });
  await rawInsert({
    principal_id: 'stf_w3i_ext', organization_id: ORG_A, display_name: 'Real',
    identity_source: 'external', external_id: 'idp|honest',
  });
  const [row] = await app.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM staff_principal WHERE principal_id LIKE $1 ESCAPE '\\'`,
    ['stf\\_w3i\\_%']);
  assert.equal(row?.n, '2');
});

// ------------------------------------------------------------- uniqueness

test('the SAME external identity twice in ONE organization is refused', async () => {
  await assert.rejects(
    rawInsert({
      principal_id: 'stf_w3i_dupe', organization_id: ORG_A, display_name: 'Twice',
      identity_source: 'external', external_id: 'idp|honest',
    }),
    /staff_principal_external_identity/,
  );
});

test('the SAME external identity in a DIFFERENT organization is ALLOWED', async () => {
  /**
   * A person may work for two Organizations: under ADR-007 those are two
   * separate worlds and two principal rows. A GLOBAL unique would forbid it —
   * and would leak, because a refusal would tell the caller that this person
   * exists in a tenancy they cannot see.
   */
  await rawInsert({
    principal_id: 'stf_w3i_ext_b', organization_id: ORG_B, display_name: 'Real, elsewhere',
    identity_source: 'external', external_id: 'idp|honest',
  });
  const rows = await app.query<{ organization_id: string }>(
    `SELECT organization_id FROM staff_principal WHERE external_id = 'idp|honest' ORDER BY organization_id`);
  assert.deepEqual(rows.map((r) => r.organization_id), [ORG_A, ORG_B]);
});

test('MANY principals with NO external identity coexist in one organization', async () => {
  // The opposite call from 0120's index, and the reason: NULL here means "no
  // external identity", not "the one act with no principal". NULLS NOT DISTINCT
  // would allow exactly one such principal per Organization.
  await rawInsert({
    principal_id: 'stf_w3i_seed2', organization_id: ORG_A,
    display_name: 'Another fixture', identity_source: 'recorded_seed',
  });
  const [row] = await app.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM staff_principal
      WHERE organization_id = $1 AND external_id IS NULL`, [ORG_A]);
  assert.equal(row?.n, '2');
});

// ------------------------------------------------------------ no credential

test('THERE IS NOWHERE TO PUT A CREDENTIAL -- asserted on the shape, not the comments', async () => {
  /**
   * ADR-016 D3, as a check rather than a promise. A column added later to hold a
   * password, hash, token or secret would move the authentication boundary into
   * PEMO — the one thing ADR-016 decides against — and this is what would notice.
   */
  const rows = await app.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'access' AND table_name = 'staff_principal'`);
  const names = rows.map((r) => r.column_name).sort();
  assert.deepEqual(names, [
    'created_at', 'display_name', 'external_id', 'identity_source',
    'organization_id', 'principal_id',
  ], 'the shape is closed: any new column here needs a decision, and a secret-shaped one needs ADR-016 reopened');
  const suspicious = names.filter((n) => /pass|secret|token|hash|credential|key/i.test(n));
  assert.deepEqual(suspicious, [], 'nothing secret-shaped');
});

// ------------------------------------------------------ registerPrincipal

test('registerPrincipal RECORDS an external identity', async () => {
  const res = await app.transaction((tx) => commands().register(tx, {
    principalId: 'stf_w3i_reg', organizationId: ORG_A,
    externalId: 'idp|registered', displayName: 'Registered',
  }));
  assert.equal(res.kind, 'registered');

  const found = await commands().findPrincipalByExternalId(ORG_A, 'idp|registered');
  assert.equal(found?.identitySource, 'external');
  assert.equal(found?.externalId, 'idp|registered');
  assert.equal(found?.displayName, 'Registered');
});

test('registering the SAME identity again REFUSES rather than throwing', async () => {
  // An onboarding step run twice, or an IdP re-notifying on a second sign-in, is
  // an ordinary thing for a caller to attempt. It is a no-op the caller must be
  // able to SEE, not an exception.
  const again = await app.transaction((tx) => commands().register(tx, {
    principalId: 'stf_w3i_reg2', organizationId: ORG_A,
    externalId: 'idp|registered', displayName: 'Registered again',
  }));
  assert.equal(again.kind, 'already-recorded');

  const [n] = await app.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM staff_principal WHERE external_id = 'idp|registered'`);
  assert.equal(n?.n, '1', 'and nothing was written');
});

test('EXISTING SEED PRINCIPALS SURVIVED the migration, with the biconditional holding', async () => {
  const [row] = await app.query<{ total: string; seeded: string; violating: string }>(
    `SELECT count(*)::text AS total,
            count(*) FILTER (WHERE identity_source = 'recorded_seed')::text AS seeded,
            count(*) FILTER (WHERE (identity_source = 'external') <> (external_id IS NOT NULL))::text AS violating
       FROM staff_principal WHERE principal_id LIKE 'stf\\_wfg%' ESCAPE '\\'
          OR principal_id LIKE 'stf\\_hbv%' ESCAPE '\\'`);
  assert.ok(Number(row?.total) >= 6, `the seeded principals are still here (${row?.total})`);
  assert.equal(row?.seeded, row?.total, 'all of them recorded_seed');
  assert.equal(row?.violating, '0', 'and none violates the biconditional');
});
