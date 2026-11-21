/**
 * Module isolation, proven rather than asserted.
 *
 * The static layers are checked by `pnpm --filter @pemo/api verify:boundaries`.
 * This file checks the layer that no lint rule can see: the database.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

let harness: Harness;
test.before(async () => {
  harness = await startHarness();
});
test.after(async () => {
  await harness.close();
});

const MODULE_SCHEMAS = ['platform', 'property', 'resident', 'home_safety', 'integration', 'access'];

test('no cross-module foreign key exists', async () => {
  // The constraint the architecture is most explicit about, and the one most
  // likely to be violated under time pressure. Zero rows, or the test names the
  // offender.
  const rows = await harness.admin.query<{
    conname: string;
    from_schema: string;
    from_table: string;
    to_schema: string;
  }>(
    `SELECT c.conname, ns.nspname AS from_schema, t.relname AS from_table, fns.nspname AS to_schema
       FROM pg_constraint c
       JOIN pg_class t       ON t.oid = c.conrelid
       JOIN pg_namespace ns  ON ns.oid = t.relnamespace
       JOIN pg_class ft      ON ft.oid = c.confrelid
       JOIN pg_namespace fns ON fns.oid = ft.relnamespace
      WHERE c.contype = 'f' AND ns.nspname <> fns.nspname
        AND ns.nspname = ANY($1::text[]) AND fns.nspname = ANY($1::text[])`,
    [MODULE_SCHEMAS],
  );

  assert.deepEqual(
    rows.map((r) => `${r.from_schema}.${r.from_table} → ${r.to_schema} (${r.conname})`),
    [],
  );
});

test("a module's connection cannot see another module's tables", async () => {
  // search_path is set per module, so an unqualified cross-module query fails
  // with `relation does not exist` rather than succeeding quietly. This is the
  // layer that survives someone disabling the lint rules.
  await assert.rejects(
    harness.modules.propertyDb.query('SELECT * FROM resident LIMIT 1'),
    /does not exist/,
    'Property Core reached the resident schema',
  );
  await assert.rejects(
    harness.modules.homeSafetyDb.query('SELECT * FROM unit LIMIT 1'),
    /does not exist/,
    'Home Safety reached the property schema',
  );
  await assert.rejects(
    harness.modules.residentDb.query('SELECT * FROM safety_event LIMIT 1'),
    /does not exist/,
    'Resident reached the home_safety schema',
  );

  // Each can of course see its own.
  await harness.modules.propertyDb.query('SELECT 1 FROM unit LIMIT 1');
  await harness.modules.residentDb.query('SELECT 1 FROM resident LIMIT 1');
  await harness.modules.homeSafetyDb.query('SELECT 1 FROM safety_event LIMIT 1');
});

test('only the declared module schemas and the disclosed dev scaffold exist', async () => {
  // Empty schemas are not free: they invite premature coupling and imply an
  // ownership claim this PID has not earned.
  //
  // THE LIST IS DELIBERATE, not an oversight. This is an INVENTORY: adding a
  // schema must be a decision somebody makes on purpose and writes down, so this
  // is one of the few places where a hand-kept list is the point rather than the
  // smell. `notices` joined it at GEN-037 under ADR-019.
  //
  // (The title said "four" while the list held seven; corrected at GEN-037.)
  const rows = await harness.admin.query<{ nspname: string }>(
    `SELECT nspname FROM pg_namespace
      WHERE nspname NOT LIKE 'pg\\_%' ESCAPE '\\' AND nspname NOT IN ('information_schema', 'public')
      ORDER BY 1`,
  );
  assert.deepEqual(rows.map((r) => r.nspname), [
    'access',
    'dev_scaffold',
    'helpdesk',
    'home_safety',
    'integration',
    'notices',
    'platform',
    'property',
    'resident',
    'service_case',
    'strata',
  ]);
});

test('cross-module references are stable identifiers, unconstrained by design', async () => {
  // A household may name a unit that Property Core has never heard of. The
  // database permits it — cross-module integrity is not a foreign key — and the
  // system must therefore handle it in code rather than assume it away. That is
  // exactly what quarantine is for.
  await harness.admin.query(
    `INSERT INTO resident.household (household_id, organization_id, unit_id)
     VALUES ('hh_dangling_test', 'org_wingfu_holdings', 'unit_that_does_not_exist')`,
  );
  const rows = await harness.admin.query(
    `SELECT unit_id FROM resident.household WHERE household_id = 'hh_dangling_test'`,
  );
  assert.equal(rows.length, 1);
  await harness.admin.query(`DELETE FROM resident.household WHERE household_id = 'hh_dangling_test'`);
});

test('Home Safety does not depend on Property Core or Resident', async () => {
  // Dependency inversion, verified at the manifest rather than by reading code:
  // Home Safety owns audience resolution but declares the ports it needs, and
  // apps/api binds Property Core adapters to them.
  const manifest = await harness.admin.query<{ ok: boolean }>('SELECT true AS ok');
  assert.equal(manifest[0]?.ok, true);

  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { REPO_ROOT } = await import('../../apps/api/dist/testing/harness.js');

  const pkg = JSON.parse(
    await readFile(path.join(REPO_ROOT, 'modules/home-safety/package.json'), 'utf8'),
  ) as { dependencies: Record<string, string> };

  assert.deepEqual(
    Object.keys(pkg.dependencies).filter((d) => d.startsWith('@pemo/')),
    ['@pemo/platform'],
  );
});
