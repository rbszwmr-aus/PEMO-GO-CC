/**
 * EVERY ASSERTION TABLE'S SUPERSESSION KEY, PROVEN — AND THE LIST IS DERIVED.
 *
 * ─── WHY THIS FILE EXISTS (GEN-038's ruling, GEN-039 G2) ────────────────────
 *
 * ADR-013 D2 makes `UNIQUE (instance_id, version)` the mechanism that stops two
 * writers appending a different version-N to one instance. A test claiming to
 * prove it must actually exercise IT, and at GEN-038 one did not: both competing
 * INSERTs reused a single `assertion_id`, so the PRIMARY KEY rejected the second.
 * The test passed, its message named the right constraint, and it PASSED WITH THE
 * SUPERSESSION CONSTRAINT DROPPED. A bite that reds for a neighbouring
 * constraint's reason is not a bite (`mutate-to-the-plausible-wrong-rule`).
 *
 * The sweep for that vacuity found something worse than vacuity, and it is the
 * reason this file is a sweep rather than four edits: `access.group_membership`
 * and `resident.occupancy` — two AUTHORITY tables — had NO duplicate-version test
 * at all. Nothing was wrong; nothing was proven either.
 *
 * ─── THE MEMBERSHIP IS DERIVED, NOT LISTED ──────────────────────────────────
 *
 * The tables come from `pg_constraint`: every UNIQUE constraint whose definition
 * mentions `version`. A hand-kept list is what let two tables go uncovered, and
 * writing a fifth one here would repeat the mistake this PID exists to retire
 * (`correlated-lists-certify-nothing`).
 *
 * The INSERTS cannot be derived — and the reason is stronger than "NOT NULL
 * columns". A prober must write a SEMANTICALLY valid v1: a `disposition` that is a
 * member of that table's CHECK-IN vocabulary, an `organization_id`/`recorded_by`
 * that satisfy the foreign keys, values that pass cross-column constraints. The
 * catalogue gives the columns and their NOT NULL-ness, but not a valid ENUM member
 * or a live FK target, and parsing `CHECK (x IN (…))` for one is brittle. So the
 * INSERTs are a DECLARED, HAND-KEPT list, named as such with this reason — not left
 * looking derived. (This is the honest half of `correlated-lists-certify-nothing`:
 * keep the hand-kept side, and cross-check it against ground truth.)
 *
 * The two halves are cross-checked: a new assertion table appears in the DERIVED
 * set, has no declared prober, and THIS FILE REDS until somebody writes one. What
 * that cross-check does NOT catch is a prober whose INSERT went STALE when a schema
 * changed its columns or vocabulary — the INSERT simply fails, loudly, when the
 * suite runs. GEN-055 hit exactly that (0139 added `status NOT NULL` and retired the
 * old `disposition` values; 0140 added `disposition NOT NULL`), and CI caught it
 * while the local pre-push gate — which does not run this suite — did not. That
 * local-visibility gap is the gate-coverage finding's, not this file's: the drift
 * IS caught, by whatever gate actually runs the suite. Half-derived, half-declared
 * is subtle precisely because the derived half grows past the written half silently;
 * fourth instance of the class, and the remedy here is to keep the written half
 * HONEST (named, reasoned) rather than to pretend it is derived.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createModuleDb, loadConfig } from '../../modules/platform/dist/index.js';

/** Declared before every use: the probers interpolate it at module-evaluation time. */
const ORG = 'org_sweep';

let db: ReturnType<typeof createModuleDb>;

test.before(async () => {
  db = createModuleDb({ schema: 'platform', database: loadConfig().databaseOwner });
  await db.query(
    `INSERT INTO platform.organization (organization_id, code, name_en, name_zh_hant)
     VALUES ($1, 'SWP', 'Sweep', 'Sweep') ON CONFLICT (organization_id) DO NOTHING`, [ORG]);
});
test.after(async () => {
  await db.query(`DELETE FROM platform.organization WHERE organization_id = $1`, [ORG]);
  await db.close();
});

/** Every supersession key in the database, from the catalogue. */
const supersessionConstraints = async () => db.query<{
  qualified: string; conname: string; definition: string;
}>(
  `SELECT n.nspname || '.' || t.relname AS qualified, c.conname,
          pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype = 'u' AND pg_get_constraintdef(c.oid) LIKE '%version%'
    ORDER BY 1`);

/**
 * One prober per assertion table: write version 1, then write a SECOND version 1
 * under a DIFFERENT assertion id. Only the supersession key can refuse that.
 *
 * `notice_audience` is deliberately absent from this map and excluded below: its
 * UNIQUE is `(notice_id, publishing_version, resident_id)`, which is a
 * one-row-per-recipient-per-publication rule, not an ADR-013 supersession key. It
 * mentions `version` and is not one, which is exactly the kind of near-miss a
 * derived list must be told about explicitly rather than silently skipped.
 *
 * `helpdesk.ticket_satisfaction` is the same shape (GEN-055): its UNIQUE is
 * `(ticket_id, closure_version)` — one satisfaction fact per CLOSURE of a ticket —
 * and `closure_version` is a REFERENCE to the closing assertion's version, not the
 * row's own supersession key. The broad `%version%` match catches it, and the rule
 * holds: a near-miss is classified here, explicitly and with its reason, never
 * silently skipped. (This is why the derivation stays broad rather than anchoring on
 * a column named exactly `version`: forcing every near-miss to be named is the point.)
 */
const NOT_A_SUPERSESSION_KEY = new Set([
  'notices.notice_audience',
  'helpdesk.ticket_satisfaction',
]);

/**
 * A prober is now DERIVED, not written out (GEN-055, fifth instance of
 * `correlated-lists-certify-nothing`). The row is built from the catalogue the
 * derivation ALREADY reads: `information_schema.columns` gives every column, its
 * type, its NOT NULL and its default. `buildInsert` fills every NOT-NULL column
 * that has no default — `version` = 1, the instance column and the distinct
 * `assertion_id` handled specially, the rest by a per-type valid value — and
 * leaves every defaulted column alone. A NOT NULL column added by a future
 * migration is then satisfied automatically, and this test stops being a tax on
 * every schema change.
 *
 * What CANNOT be derived is kept in a SHRUNKEN, NAMED per-table map with the
 * reason: a CHECK-enum member the catalogue does not constrain to a value, and a
 * foreign key that must resolve to a parent row this file creates. Those columns
 * — and only those — are listed in `semantic`, honestly labelled as hand-kept.
 * A shrunken honest list beats a full list that pretends to be derived. (GEN-055's
 * own break was exactly here: 0139/0140 added `status`/`disposition` — CHECK-enums —
 * NOT NULL; those stay in `semantic`, but the free-text and defaulted columns no
 * longer do.)
 */
const DISTINCT_ID = 'assertion_id'; // ADR-013: the row identity, distinct per assertion.

interface ProbeSpec {
  /** Parent rows the WITHIN-module foreign keys require (created before, removed after). */
  setup?: string[];
  teardown?: string[];
  /** The non-`version` half of the supersession key — same in both inserts. */
  instance: { column: string; value: string };
  /** Only the columns the catalogue cannot value: CHECK-enum members and FK targets. */
  semantic?: Record<string, string>;
}

const SPECS: Record<string, ProbeSpec> = {
  'access.scope_grant': {
    setup: [`INSERT INTO access.user_group (group_id, organization_id, display_name) VALUES ('grp_sw', '${ORG}', 'sweep') ON CONFLICT (group_id) DO NOTHING`],
    teardown: [`DELETE FROM access.user_group WHERE group_id = 'grp_sw'`],
    instance: { column: 'grant_id', value: `'gr_sw'` },
    semantic: { group_id: `'grp_sw'`, role: `'estate_staff'`, node_kind: `'estate'` },
  },
  'access.group_membership': {
    setup: [`INSERT INTO access.user_group (group_id, organization_id, display_name) VALUES ('grp_sw', '${ORG}', 'sweep') ON CONFLICT (group_id) DO NOTHING`,
             `INSERT INTO access.staff_principal (principal_id, organization_id, display_name, identity_source, external_id) VALUES ('stf_sw', '${ORG}', 'sweep', 'external', 'idp|sweep') ON CONFLICT (principal_id) DO NOTHING`],
    teardown: [`DELETE FROM access.staff_principal WHERE principal_id = 'stf_sw'`,
                `DELETE FROM access.user_group WHERE group_id = 'grp_sw'`],
    instance: { column: 'membership_id', value: `'mem_sw'` },
    semantic: { group_id: `'grp_sw'`, principal_id: `'stf_sw'` },
  },
  'resident.occupancy': {
    setup: [`INSERT INTO resident.resident (resident_id, organization_id, display_name) VALUES ('res_sw', '${ORG}', 'sweep') ON CONFLICT (resident_id) DO NOTHING`],
    teardown: [`DELETE FROM resident.resident WHERE resident_id = 'res_sw'`],
    instance: { column: 'occupancy_id', value: `'occ_sw'` },
    semantic: { resident_id: `'res_sw'`, unit_class: `'residential'`, role: `'tenant'`, status: `'active'`, source: `'seed'` },
  },
  'notices.notice': {
    instance: { column: 'notice_id', value: `'ntc_sw'` },
    semantic: { disposition: `'draft_saved'`, notice_type: `'general'` },
  },
  'helpdesk.ticket': {
    instance: { column: 'ticket_id', value: `'tkt_sw'` },
    semantic: { disposition: `'report_opened'`, status: `'open'`, channel: `'phone'` },
  },
  'service_case.service_case': {
    instance: { column: 'case_id', value: `'cse_sw'` },
    semantic: { state: `'open'`, disposition: `'case_opened'` },
  },
};

/** A type-valid value for a column the catalogue does not otherwise constrain. */
const typeLiteral = (dataType: string): string => {
  if (/bool/.test(dataType)) return 'false';
  if (/int|numeric|real|double|decimal/.test(dataType)) return '1';
  if (/timestamp/.test(dataType)) return 'now()';
  if (/^date$/.test(dataType)) return 'now()::date';
  if (/json/.test(dataType)) return `'{}'`;
  return `'x'`;
};

/** Build one INSERT for `qualified`, DERIVED from the catalogue, with `assertion_id` = `idValue`. */
const buildInsert = async (qualified: string, spec: ProbeSpec, idValue: string): Promise<string> => {
  const [schema, table] = qualified.split('.');
  const cols = await db.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND is_nullable = 'NO' AND column_default IS NULL
      ORDER BY ordinal_position`, [schema, table]);
  const names: string[] = [];
  const values: string[] = [];
  for (const c of cols) {
    names.push(c.column_name);
    if (c.column_name === DISTINCT_ID) values.push(`'${idValue}'`);
    else if (c.column_name === 'version') values.push('1');
    else if (c.column_name === spec.instance.column) values.push(spec.instance.value);
    else if (spec.semantic?.[c.column_name] !== undefined) values.push(spec.semantic[c.column_name]!);
    else values.push(typeLiteral(c.data_type));
  }
  return `INSERT INTO ${qualified} (${names.join(', ')}) VALUES (${values.join(', ')})`;
};

test('the derived set of supersession keys is fully covered by probers', async () => {
  const found = (await supersessionConstraints())
    .map((c) => c.qualified)
    .filter((q) => !NOT_A_SUPERSESSION_KEY.has(q));
  const covered = Object.keys(SPECS).sort();
  assert.deepEqual([...new Set(found)].sort(), covered,
    'an assertion table with no prober is a supersession guarantee nobody has tested — ' +
    'which is exactly how access.group_membership and resident.occupancy went uncovered');
});

for (const [table, spec] of Object.entries(SPECS)) {
  test(`${table} — a SECOND version-1 assertion under a DISTINCT id is refused`, async () => {
    const idBase = table.replace(/[^a-z]/gi, '').slice(0, 8);
    const cleanup = `DELETE FROM ${table} WHERE ${spec.instance.column} = ${spec.instance.value}`;
    const first = await buildInsert(table, spec, `${idBase}_a`);
    const second = await buildInsert(table, spec, `${idBase}_b`);
    await db.query(cleanup);
    for (const sql of spec.setup ?? []) await db.query(sql);
    try {
      await db.query(first);
      // The distinct assertion_id is the whole point: with a reused id the PRIMARY
      // KEY would refuse this and the supersession key would never be exercised.
      await assert.rejects(() => db.query(second), (e: Error) => {
        assert.match(e.message, /version_unique/,
          `${table} must be refused BY THE SUPERSESSION KEY, not by another constraint`);
        return true;
      });
    } finally {
      await db.query(cleanup);
      for (const sql of spec.teardown ?? []) await db.query(sql);
    }
  });
}

test('[probe-must-bite] a newly-added required column is auto-filled by the derived prober (the tax is gone)', async () => {
  // The bite for the derivation: add a NOT NULL, no-default column to an assertion
  // table and the derived prober must pick it up and fill it — where a hand-written
  // INSERT list would silently omit it and red on the next schema change (which is
  // exactly what GEN-055's 0139/0140 did to the old written probers). Rolled back in
  // `finally`, so it leaves no trace.
  const T = 'service_case.service_case';
  const spec = SPECS[T]!;
  const cleanup = `DELETE FROM ${T} WHERE ${spec.instance.column} = ${spec.instance.value}`;
  // ADD with a DEFAULT (so existing seeded rows satisfy NOT NULL), then DROP the
  // DEFAULT: the column is now NOT NULL with NO default — exactly the shape the
  // derived prober must fill and a hand-written list would miss.
  await db.query(`ALTER TABLE ${T} ADD COLUMN sw_probe_note text NOT NULL DEFAULT 'x'`);
  await db.query(`ALTER TABLE ${T} ALTER COLUMN sw_probe_note DROP DEFAULT`);
  try {
    const insert = await buildInsert(T, spec, 'probe_a');
    assert.match(insert, /sw_probe_note/,
      'the derived prober must INCLUDE a newly-added required column — a hand-written list would omit it');
    await db.query(cleanup);
    await db.query(insert); // and the type-valid fill actually satisfies the NOT NULL
    await db.query(cleanup);
  } finally {
    await db.query(`ALTER TABLE ${T} DROP COLUMN sw_probe_note`);
  }
});
