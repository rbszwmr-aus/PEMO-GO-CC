#!/usr/bin/env node
/**
 * Management scenario generator — and the BINDING MANIFEST.
 *
 * PROVENANCE, stated plainly because it changes what fixture parity proves.
 *
 * Like the resident generator, this transcribes the management corpus into
 * NORMALISED DATABASE ROWS which the API then has to reassemble by itself. So
 * parity proves routing, staff authorization, SCOPE FILTERING IN THE QUERY,
 * projection assembly, ordering, window computation and bilingual completeness.
 * It does not prove anybody authored the Traditional Chinese correctly.
 *
 * ── THE BINDING MANIFEST ──────────────────────────────────────────────────────
 *
 * API-020-ST established that NO FIXTURE STATES WHICH SEEDED WORLD IT BELONGS TO.
 * 46 resident fixtures match a scenario file by FILENAME CONVENTION ONLY, 25 have
 * none, and every management fixture has none because no management scenario file
 * existed. Nothing asserted the binding; it was a naming coincidence that held.
 *
 * Scenario files are this track's. `tests/fixtures/**\/index.json` is API-020-ST's.
 * Neither party can author both halves of the binding, which is the point: a
 * binding one party asserts alone is testimony, not a check.
 *
 * So this emits `BINDINGS.json` beside the scenario files — fixture, scenario
 * file, and THE INSTANT THE WORLD REPRESENTS — as structured data for API-020-ST
 * to encode into the manifest. The instant is the field neither a filename nor a
 * fixture currently carries, and it is the one that matters: the two corpora
 * describe DIFFERENT MOMENTS (resident 2026-08-13T10:00+08:00, management
 * 2026-08-12T09:56+08:00) and nothing anywhere says so.
 *
 * ── WHAT IS INVENTED ──────────────────────────────────────────────────────────
 *
 * `home_safety.safety_event` carries resident-facing columns the MANAGEMENT
 * corpus never shows and cannot constrain: instruction, disclaimer, reported_by.
 * They are NOT NULL, so a value must exist. Those values are INVENTIONS, marked
 * as such in the emitted SQL, and no management fixture depends on them. They are
 * the same class as the vacancy figures: constrained by nothing, recorded as
 * arbitrary-but-fixed rather than passed off as facts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FIXTURES = path.join(ROOT, 'tests/fixtures/management-web');
const OUT = path.join(ROOT, 'database/seeds/scenarios');

const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'index.json'), 'utf8'));
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const ORG = 'org_wingfu_holdings';
const ESTATE = 'est_wing_fu_garden';

/** Invented, because the management corpus does not show these fields at all. */
const INVENTED = {
  instruction_en: 'Follow the estate emergency procedure.',
  instruction_zh_hant: '請依屋苑緊急程序處理。',
  disclaimer_en: 'Information from building sensors. Always trust your own senses.',
  disclaimer_zh_hant: '資料來自大廈感應器。請以你的親身感覺為準。',
  reported_by_en: 'Building sensor',
  reported_by_zh_hant: '大廈感應器',
};

/** ADR-003 location classes, from the scope node kind the fixture states. */
const locationClassFor = (node) => (node.kind === 'unit' ? 'unit' : node.kind === 'location' ? 'common_area' : 'common_area');

const eventSql = (e) => {
  const node = e.scope.node;
  const isUnit = node.kind === 'unit';
  return [
    `DELETE FROM home_safety.safety_event WHERE event_id = ${q(e.eventId)};`,
    `INSERT INTO home_safety.safety_event (
  event_id, organization_id, estate_id, severity,
  title_en, title_zh_hant, instruction_en, instruction_zh_hant,
  location_label_en, location_label_zh_hant, location_class,
  audience_source, source_unit_id, source_location_id,
  occurred_at, received_at,
  reported_by_en, reported_by_zh_hant, disclaimer_en, disclaimer_zh_hant
) VALUES (
  ${q(e.eventId)}, ${q(ORG)}, ${q(ESTATE)}, ${q(e.severity)},
  ${q(e.title.en)}, ${q(e.title['zh-Hant'])},
  ${q(INVENTED.instruction_en)}, ${q(INVENTED.instruction_zh_hant)},   -- INVENTED
  ${q(node.label?.en ?? node.id)}, ${q(node.label?.['zh-Hant'] ?? node.id)}, ${q(locationClassFor(node))},
  ${q(isUnit ? 'unit' : 'serving_scope')},
  ${q(isUnit ? node.id : null)}, ${q(node.kind === 'location' ? node.id : null)},
  ${q(e.occurredAt)}, ${q(e.occurredAt)},
  ${q(INVENTED.reported_by_en)}, ${q(INVENTED.reported_by_zh_hant)},   -- INVENTED
  ${q(INVENTED.disclaimer_en)}, ${q(INVENTED.disclaimer_zh_hant)}      -- INVENTED
);`,
  ];
};

const bindings = [];
let written = 0;

for (const entry of manifest.fixtures) {
  if (entry.file === null || entry.operationId !== 'listSafetyEvents') continue;
  const body = JSON.parse(fs.readFileSync(path.join(FIXTURES, entry.file), 'utf8'));
  const events = body.events ?? [];

  const statements = [
    `-- Clear the management event population, so scenarios REPLACE rather than layer.`,
    `DELETE FROM home_safety.safety_event WHERE event_id LIKE 'evt\\_hs\\_%' ESCAPE '\\';`,
    ...events.flatMap(eventSql),
  ];

  /**
   * SURFACE-PREFIXED, because the flat namespace is already contested.
   *
   * `tests/integration/scenario-inventory.test.ts` caught it on its first run:
   * BOTH manifests carry `problems/invalid-credential.json`, so both would claim
   * `problems__invalid-credential.sql` — two surfaces, two different worlds, one
   * filename, and the last generator to run wins silently.
   *
   * That is the directory wipe one level up: not "who may write here" but "who
   * owns this name". A prefix makes the collision unrepresentable rather than
   * merely avoided, and management operations do not exist yet, so nothing
   * depends on the unprefixed form.
   */
  const file = `management__${entry.screen}__${entry.state}.sql`;
  fs.writeFileSync(
    path.join(OUT, file),
    `-- GENERATED by database/seeds/tools/generate-management-scenarios.mjs\n` +
      `-- from ${entry.file} at management contract version ${manifest.contractVersion}.\n` +
      `-- Do not edit by hand: regenerate. Values marked INVENTED are not constrained\n` +
      `-- by the management corpus, which never shows those fields.\n` +
      `-- WORLD INSTANT: ${body.meta.generatedAt}\n\n` +
      `${statements.join('\n')}\n`,
  );
  written += 1;

  bindings.push({
    surface: 'management',
    fixture: entry.file,
    screen: entry.screen,
    state: entry.state,
    // Emitted in API-025-ST's own format — `scenarios/<file>.sql`, relative to
    // database/seeds/ — so the value can be copied into index.json's `scenario`
    // field verbatim rather than translated. Every management entry there
    // currently reads "pending"; these are what it is pending on.
    scenario: `scenarios/${file}`,
    scenarioFile: `database/seeds/scenarios/${file}`,
    worldInstant: body.meta.generatedAt,
    eventIds: events.map((e) => e.eventId),
    generatedBy: 'GEN-018-ST',
  });
}

fs.writeFileSync(
  path.join(OUT, 'BINDINGS.json'),
  `${JSON.stringify(
    {
      $comment:
        'Fixture-to-scenario bindings AUTHORED BY THE SEED SIDE (GEN-018-ST). API-020-ST encodes these into tests/fixtures/**/index.json. Neither party authors both halves. worldInstant is the field no filename and no fixture currently carries, and the two corpora describe different moments.',
      generatedBy: 'database/seeds/tools/generate-management-scenarios.mjs',
      bindings,
    },
    null,
    2,
  )}\n`,
);

console.log(`wrote ${written} management scenario files and BINDINGS.json (${bindings.length} bindings)`);
