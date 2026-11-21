#!/usr/bin/env node
/**
 * Scenario seed generator.
 *
 * PROVENANCE, stated plainly because it changes what fixture parity proves.
 *
 * The API-005-ST fixture corpus is the specification of what each screen must
 * return. This script transcribes that corpus into NORMALISED DATABASE ROWS —
 * property, resident and home_safety tables — which the API then has to
 * reassemble by itself.
 *
 * So fixture parity proves: routing, authorization, tenancy scoping, projection
 * assembly, field selection and omission, ordering, timestamp formatting and
 * offset, freshness computation, the staleness downgrade, the coverage/severity
 * pairing and bilingual completeness.
 *
 * It does NOT prove that anyone hand-authored the Traditional Chinese correctly.
 * That is a contract-authoring property, it belongs to API-005-ST, and claiming
 * otherwise would be overclaiming.
 *
 * Sections with no owning module in this slice — notices, the open case, the
 * service catalogue — are stored as JSON in the dev-only scaffold schema and are
 * echoed rather than reassembled. That is disclosed here and in migration 0090,
 * and it is the reason the scaffold is deleted rather than migrated.
 *
 *   node database/seeds/tools/generate-scenarios.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const FIXTURES = path.join(ROOT, 'tests/fixtures/resident-mobile');
const OUT = path.resolve(HERE, '..', 'scenarios');

const q = (value) => (value === null || value === undefined ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`);
const json = (value) => (value === undefined ? 'NULL' : `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`);
const bool = (value) => (value ? 'true' : 'false');
const num = (value) => (value === null || value === undefined ? 'NULL' : String(value));

const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'index.json'), 'utf8'));
const read = (file) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));

/** Fixtures that are Problem bodies come from real behaviour, not from seeded rows. */
const isProblemFixture = (entry) => entry.schema === 'Problem';

/**
 * The stored severity behind a projection.
 *
 * The API applies the staleness rule on read: a stale projection that would
 * otherwise say `normal` is served as `unknown`. So when a fixture is stale AND
 * says `unknown`, the stored value must be `normal` — that is the only
 * combination that exercises the downgrade. A stale `offline` is stored as
 * `offline`, because downgrading it would lose the more useful statement.
 */
const storedSeverity = (safety) =>
  safety.freshness?.status === 'stale' && safety.severity === 'unknown' ? 'normal' : safety.severity;

const storedServiceSeverity = (service, safety) =>
  safety.freshness?.status === 'stale' && service.severity === 'unknown' ? 'normal' : service.severity;

const ORG = 'org_wingfu_holdings';
const ESTATE = 'est_wing_fu_garden';

const safetyStateSql = (unitId, safety) => [
  `DELETE FROM home_safety.unit_safety_state WHERE unit_id = ${q(unitId)};`,
  `INSERT INTO home_safety.unit_safety_state (
     unit_id, organization_id, severity, monitoring_coverage,
     headline_en, headline_zh_hant, detail_en, detail_zh_hant,
     observed_at, received_at, freshness_window_seconds, disclaimer_en, disclaimer_zh_hant)
   VALUES (${q(unitId)}, ${q(ORG)}, ${q(storedSeverity(safety))}, ${q(safety.monitoringCoverage)},
     ${q(safety.headline.en)}, ${q(safety.headline['zh-Hant'])},
     ${q(safety.detail?.en ?? null)}, ${q(safety.detail?.['zh-Hant'] ?? null)},
     ${q(safety.observedAt)}, ${q(safety.receivedAt)}, ${num(safety.freshness.windowSeconds)},
     ${q(safety.disclaimer.en)}, ${q(safety.disclaimer['zh-Hant'])});`,
];

const installedServicesSql = (unitId, services, note, safety) => {
  const out = [`DELETE FROM home_safety.installed_service WHERE unit_id = ${q(unitId)};`];
  services.forEach((service, index) => {
    out.push(
      `INSERT INTO home_safety.installed_service (
         installed_service_id, unit_id, service_key, name_en, name_zh_hant,
         location_en, location_zh_hant, state_en, state_zh_hant, severity, observed_at, sort_order)
       VALUES (${q(`${unitId}_${service.serviceKey}`)}, ${q(unitId)}, ${q(service.serviceKey)},
         ${q(service.name.en)}, ${q(service.name['zh-Hant'])},
         ${q(service.location.en)}, ${q(service.location['zh-Hant'])},
         ${q(service.state.en)}, ${q(service.state['zh-Hant'])},
         ${q(storedServiceSeverity(service, safety))}, ${q(service.observedAt)}, ${index});`,
    );
  });
  out.push(`DELETE FROM home_safety.installed_services_note WHERE unit_id = ${q(unitId)};`);
  if (note) {
    out.push(
      `INSERT INTO home_safety.installed_services_note (unit_id, note_en, note_zh_hant)
       VALUES (${q(unitId)}, ${q(note.en)}, ${q(note['zh-Hant'])});`,
    );
  }
  return out;
};

/** Events are stored whole; the audience row is what makes them readable. */
const eventSql = (event, audienceUnitIds, extra = {}) => {
  const out = [
    // Corrections and retractions link events to each other, so a re-seed must
    // break those links before deleting. Clearing them here rather than cascading
    // in the schema is deliberate: a correction losing its link to the original
    // silently would be worse than a failed seed.
    `UPDATE home_safety.safety_event SET supersedes_event_id = NULL
       WHERE supersedes_event_id = ${q(event.eventId)};`,
    `UPDATE home_safety.safety_event SET superseded_by_event_id = NULL
       WHERE superseded_by_event_id = ${q(event.eventId)};`,
    `DELETE FROM home_safety.safety_event_audience WHERE event_id = ${q(event.eventId)};`,
    `DELETE FROM home_safety.event_action WHERE event_id = ${q(event.eventId)};`,
    `DELETE FROM home_safety.management_update WHERE event_id = ${q(event.eventId)};`,
    `DELETE FROM home_safety.safety_event WHERE event_id = ${q(event.eventId)};`,
    `INSERT INTO home_safety.safety_event (
       event_id, organization_id, estate_id, severity, title_en, title_zh_hant,
       instruction_en, instruction_zh_hant, location_label_en, location_label_zh_hant,
       location_class, audience_source, serving_scope_label_en, serving_scope_label_zh_hant,
       source_unit_id, source_location_id, occurred_at, received_at,
       reported_by_en, reported_by_zh_hant, status_note_en, status_note_zh_hant,
       acknowledgement_required, management_update_pending,
       disclaimer_en, disclaimer_zh_hant, revision_number, is_correction,
       supersedes_event_id, correction_note_en, correction_note_zh_hant,
       retracted, superseded_by_event_id)
     VALUES (${q(event.eventId)}, ${q(ORG)}, ${q(ESTATE)}, ${q(event.severity)},
       ${q(event.title.en)}, ${q(event.title['zh-Hant'])},
       ${q(event.instruction.en)}, ${q(event.instruction['zh-Hant'])},
       ${q(event.location.label.en)}, ${q(event.location.label['zh-Hant'])},
       ${q(event.location.locationClass)}, ${q(event.location.audienceSource)},
       ${q(event.location.servingScopeLabel?.en ?? null)}, ${q(event.location.servingScopeLabel?.['zh-Hant'] ?? null)},
       ${q(extra.sourceUnitId ?? null)}, ${q(extra.sourceLocationId ?? null)},
       ${q(event.occurredAt)}, ${q(event.receivedAt)},
       ${q(event.reportedBy.en)}, ${q(event.reportedBy['zh-Hant'])},
       ${q(event.statusNote?.en ?? null)}, ${q(event.statusNote?.['zh-Hant'] ?? null)},
       ${bool(event.acknowledgement?.required ?? false)}, ${bool(event.managementUpdatePending ?? false)},
       ${q(event.disclaimer.en)}, ${q(event.disclaimer['zh-Hant'])},
       ${num(event.revision?.revisionNumber ?? 1)}, ${bool(event.revision?.isCorrection ?? false)},
       ${q(event.revision?.supersedes ?? null)},
       ${q(event.revision?.correctionNote?.en ?? null)}, ${q(event.revision?.correctionNote?.['zh-Hant'] ?? null)},
       ${bool(extra.retracted ?? false)}, ${q(extra.supersededBy ?? null)});`,
  ];

  (event.actions ?? []).forEach((action, index) => {
    out.push(
      `INSERT INTO home_safety.event_action (event_id, action_key, label_en, label_zh_hant, kind, telephone, sort_order)
       VALUES (${q(event.eventId)}, ${q(action.actionKey)}, ${q(action.label.en)}, ${q(action.label['zh-Hant'])},
         ${q(action.kind)}, ${q(action.telephone ?? null)}, ${index});`,
    );
  });

  (event.managementUpdates ?? []).forEach((update) => {
    out.push(
      `INSERT INTO home_safety.management_update (update_id, event_id, published_at, body_en, body_zh_hant, is_all_clear)
       VALUES (${q(update.updateId)}, ${q(event.eventId)}, ${q(update.publishedAt)},
         ${q(update.body.en)}, ${q(update.body['zh-Hant'])}, ${bool(update.isAllClear ?? false)});`,
    );
  });

  for (const unitId of audienceUnitIds) {
    out.push(
      `INSERT INTO home_safety.safety_event_audience (event_id, unit_id) VALUES (${q(event.eventId)}, ${q(unitId)});`,
    );
  }
  return out;
};

const scaffoldSql = (screen, section, scenario, payload) => [
  `DELETE FROM dev_scaffold.screen_content WHERE screen = ${q(screen)} AND section = ${q(section)} AND scenario = ${q(scenario)};`,
  `INSERT INTO dev_scaffold.screen_content (screen, section, scenario, payload)
   VALUES (${q(screen)}, ${q(section)}, ${q(scenario)}, ${json(payload)});`,
];

/**
 * Help-desk opening hours, derived from the fixture rather than stored as a
 * boolean. `openNow` in a response is computed from these bounds and the request
 * instant, so a stored boolean would be a second source of truth that could go
 * stale.
 */
const helpDeskSql = (helpDesk) => {
  // Opening bounds are seeded ONLY when the scenario says the office is open at
  // the fixture's instant. The stale scenario is the reason: its copy says the
  // opening hours "were last confirmed yesterday", so PEMO does not actually know
  // whether the office is open — and the API's rule is that unknown bounds never
  // assert `openNow: true`. Same discipline as the safety staleness rule: an
  // interface must not assert something it does not know.
  const range = helpDesk.openNow
    ? /(\d{2}):(\d{2})\s*[–-]\s*(\d{2}):(\d{2})/.exec(helpDesk.hours?.en ?? '')
    : null;
  const opensAt = range ? `${range[1]}:${range[2]}` : null;
  const closesAt = range ? `${range[3]}:${range[4]}` : null;
  return [
    `UPDATE property.estate_contact SET
       hours_en = ${q(helpDesk.hours?.en ?? null)},
       hours_zh_hant = ${q(helpDesk.hours?.['zh-Hant'] ?? null)},
       instructions_en = ${q(helpDesk.availability?.en ?? null)},
       instructions_zh_hant = ${q(helpDesk.availability?.['zh-Hant'] ?? null)},
       telephone = ${helpDesk.telephoneAvailable ? q('3123 4567') : 'NULL'},
       typical_reply_minutes = ${num(helpDesk.typicalReplyMinutes ?? null)},
       opens_at = ${opensAt === null ? 'NULL' : q(opensAt)}, closes_at = ${closesAt === null ? 'NULL' : q(closesAt)}
     WHERE estate_id = ${q(ESTATE)} AND contact_kind = 'management_office';`,
  ];
};

const preferencesSql = (residentId, preferences) => {
  const out = [`DELETE FROM resident.notification_preference WHERE resident_id = ${q(residentId)};`];
  preferences.forEach((preference, index) => {
    out.push(
      `INSERT INTO resident.notification_preference (
         resident_id, preference_key, label_en, label_zh_hant, description_en, description_zh_hant,
         enabled, locked, lock_reason_en, lock_reason_zh_hant, channels, sort_order)
       VALUES (${q(residentId)}, ${q(preference.preferenceKey)}, ${q(preference.label.en)}, ${q(preference.label['zh-Hant'])},
         ${q(preference.description?.en ?? null)}, ${q(preference.description?.['zh-Hant'] ?? null)},
         ${bool(preference.enabled)}, ${bool(preference.locked)},
         ${q(preference.lockReason?.en ?? null)}, ${q(preference.lockReason?.['zh-Hant'] ?? null)},
         ARRAY[${(preference.channels ?? ['in_app']).map(q).join(',')}]::text[], ${index});`,
    );
  });
  return out;
};

/**
 * Occupancy rows behind an account screen's membership list.
 *
 * `unit_class` is `residential` for every one of them: parking and storage
 * occupancy exists in the seed base and must never appear as a membership, which
 * is a separate test.
 */
const occupancySql = (residentId, memberships) => {
  const out = [
    `DELETE FROM resident.occupancy WHERE resident_id = ${q(residentId)} AND unit_class = 'residential';`,
  ];
  memberships.forEach((membership, index) => {
    const from = new Date(Date.UTC(2020, 0, 1 + index)).toISOString();
    out.push(
      `INSERT INTO resident.occupancy
         (occupancy_id, resident_id, household_id, unit_id, unit_class, role, status, source, effective_from, effective_to)
       VALUES (${q(`occ_${residentId}_${index}`)}, ${q(residentId)}, NULL, ${q(membership.unitId)},
         'residential', ${q(membership.role)}, 'active', 'scenario', ${q(from)},
         ${q(membership.effectiveTo ?? null)});`,
    );
  });
  return out;
};

const passSql = (residentId, pass) => [
  `DELETE FROM resident.resident_pass WHERE resident_id = ${q(residentId)};`,
  `INSERT INTO resident.resident_pass (resident_id, pass_reference, carries_access, note_en, note_zh_hant)
   VALUES (${q(residentId)}, ${q(pass.passReference)}, false, ${q(pass.note.en)}, ${q(pass.note['zh-Hant'])});`,
];

let written = 0;
fs.mkdirSync(OUT, { recursive: true });

/**
 * CLEAR ONLY WHAT THIS GENERATOR OWNS.
 *
 * This was `fs.rmSync(OUT, { recursive: true, force: true })` — wiping the whole
 * scenarios directory — and it destroyed another track's files the first time a
 * second author wrote here: four management scenario files and BINDINGS.json,
 * silently, on a run whose only intended effect was a version-stamp refresh.
 *
 * It was silent for the reason such things always are: nothing asserted the other
 * files existed, so the suite stayed green over their absence. The guard is
 * `tests/integration/scenario-inventory.test.ts`, added with this fix.
 *
 * A directory is a shared mutable resource. Wiping one is only safe for a sole
 * author, and "sole author" is a property of today rather than of the code.
 */
const OWNED = new Set(
  manifest.fixtures.filter((e) => e.file && !isProblemFixture(e)).map((e) => `${e.screen}__${e.state}.sql`),
);
for (const existing of fs.readdirSync(OUT)) {
  if (OWNED.has(existing)) fs.rmSync(path.join(OUT, existing));
}

for (const entry of manifest.fixtures) {
  if (!entry.file || isProblemFixture(entry)) continue;
  const body = read(entry.file);
  const statements = [];
  const screen = entry.screen;
  const scenario = entry.state;

  if (body.meta?.degraded) {
    statements.push(...scaffoldSql(screen, 'degraded', scenario, body.meta.degraded));
  }

  if (screen === 'mob-02-home') {
    statements.push(...safetyStateSql(body.unit.unitId, body.safety));
    statements.push(...scaffoldSql(screen, 'notices', scenario, body.notices));
    statements.push(...scaffoldSql(screen, 'openCase', scenario, body.openCase));
    statements.push(...scaffoldSql(screen, 'quickServices', scenario, body.quickServices));
  }

  if (screen === 'mob-03-services') {
    statements.push(...helpDeskSql(body.helpDesk));
    statements.push(...scaffoldSql(screen, 'services', scenario, body.services));
    if (body.comingSoonNote !== undefined) {
      statements.push(...scaffoldSql(screen, 'comingSoonNote', scenario, body.comingSoonNote));
    }
  }

  if (screen === 'mob-08-safety-overview') {
    statements.push(...safetyStateSql(body.unit.unitId, body.safety));
    statements.push(
      ...installedServicesSql(body.unit.unitId, body.installedServices, body.installedServicesNote, body.safety),
    );
    // Recent events on the overview are summaries of events seeded whole, so the
    // audience row is what makes each of them readable by this unit.
    statements.push(`DELETE FROM home_safety.safety_event_audience WHERE unit_id = ${q(body.unit.unitId)};`);
    for (const summary of body.recentEvents ?? []) {
      statements.push(
        ...eventSql(
          {
            ...summary,
            instruction: summary.instruction ?? { en: 'Follow the estate instructions.', 'zh-Hant': '請依照屋苑指示。' },
            reportedBy: summary.reportedBy ?? { en: 'Installed sensor', 'zh-Hant': '已安裝感應器' },
            disclaimer: summary.disclaimer ?? {
              en: 'This alert supplements the building fire alarm and statutory emergency procedures. It does not replace them, and it may be delayed or unavailable.',
              'zh-Hant': '此警報為輔助性質，不能取代大廈火警系統及法定緊急程序，並可能延遲或無法提供。',
            },
          },
          [body.unit.unitId],
          { sourceUnitId: body.unit.unitId },
        ),
      );
    }
  }

  if (screen === 'mob-09-safety-event-detail') {
    if (body.event) {
      const isCommonArea = body.event.location.locationClass !== 'unit';
      statements.push(
        ...eventSql(body.event, ['unit_wfg_a_12_a1'], {
          sourceUnitId: isCommonArea ? null : 'unit_wfg_a_12_a1',
          sourceLocationId: isCommonArea ? 'loc_wfg_block_a_lobby' : null,
        }),
      );
    }
    // An event the resident has already acknowledged needs the acknowledgement row
    // to exist, otherwise the detail read would correctly report it unacknowledged.
    if (body.event?.acknowledgement?.acknowledged && body.event.acknowledgement.acknowledgedAt) {
      statements.push(
        `INSERT INTO home_safety.acknowledgement
           (acknowledgement_id, acknowledgement_key, event_id, resident_id, action, occurred_at, received_at, correlation_id)
         VALUES (${q(`ack_${body.event.eventId}`)}, '4f1c9a55-0000-4000-8000-0000000000aa',
           ${q(body.event.eventId)}, 'res_wfg_000412', 'i_am_safe',
           ${q(body.event.acknowledgement.acknowledgedAt)}, ${q(body.event.acknowledgement.acknowledgedAt)},
           '1a2b3c4d-0000-4000-8000-0000000000aa')
         ON CONFLICT (acknowledgement_key) DO NOTHING;`,
      );
    }
    if (body.acknowledgement && body.eventId) {
      // Acknowledgement fixtures: the recorded and replayed states differ only in
      // the `replayed` flag, which the API decides — so the row is the same and the
      // parity test drives the difference by sending the same key twice.
      statements.push(
        `DELETE FROM home_safety.acknowledgement WHERE event_id = ${q(body.eventId)};`,
      );
    }
  }

  if (screen === 'mob-11-account') {
    statements.push(...preferencesSql(body.resident.residentId, body.notificationPreferences));
    statements.push(...passSql(body.resident.residentId, body.pass));
    // Memberships are reassembled from resident.occupancy, so the scenario has to
    // set the occupancy rows rather than the rendered list. Ordering is by
    // effective_from ascending — longest-standing relationship first — so the
    // seeded dates follow the fixture's order.
    statements.push(...occupancySql(body.resident.residentId, body.memberships));
  }

  if (statements.length === 0) continue;

  const file = path.join(OUT, `${screen}__${scenario}.sql`);
  fs.writeFileSync(
    file,
    `-- GENERATED by database/seeds/tools/generate-scenarios.mjs from ${entry.file}\n` +
      `-- at contract version ${manifest.contractVersion}. Do not edit by hand: regenerate.\n` +
      `-- Provenance and what fixture parity does and does not prove: see the generator header.\n\n` +
      `${statements.join('\n')}\n`,
  );
  written += 1;
}

/**
 * Two scenarios whose fixtures are Problem bodies, so there is nothing to
 * transcribe — the STATE has to be built instead.
 *
 *   retracted-event          an event withdrawn by its source, with its
 *                            replacement named so the correction stays linked
 *   resident-not-authorized  a real event belonging to a household this resident
 *                            is not part of, which must answer 404 rather than
 *                            403: confirming existence would disclose a safety
 *                            event in someone else's home
 */
const behavioural = {
  'mob-09-safety-event-detail__retracted-event': [
    `UPDATE home_safety.safety_event SET superseded_by_event_id = NULL WHERE superseded_by_event_id = 'evt_20260813_retract';`,
    `DELETE FROM home_safety.safety_event_audience WHERE event_id = 'evt_20260813_retract';`,
    `DELETE FROM home_safety.safety_event WHERE event_id = 'evt_20260813_retract';`,
    `INSERT INTO home_safety.safety_event (
       event_id, organization_id, estate_id, severity, title_en, title_zh_hant,
       instruction_en, instruction_zh_hant, location_label_en, location_label_zh_hant,
       location_class, audience_source, source_unit_id, occurred_at, received_at,
       reported_by_en, reported_by_zh_hant, disclaimer_en, disclaimer_zh_hant,
       revision_number, retracted, superseded_by_event_id)
     VALUES ('evt_20260813_retract', 'org_wingfu_holdings', 'est_wing_fu_garden', 'critical',
       'Smoke detected in your unit', '您的單位偵測到煙霧',
       'Leave the flat and use the staircase.', '請離開單位並使用樓梯。',
       'Kitchen · 12/F Flat A1', '廚房 · 12樓 A1室', 'unit', 'unit', 'unit_wfg_a_12_a1',
       '2026-08-13T09:40:00+08:00', '2026-08-13T09:40:05+08:00',
       'Installed smoke detector', '已安裝煙霧探測器',
       'This alert supplements the building fire alarm and statutory emergency procedures. It does not replace them, and it may be delayed or unavailable.',
       '此警報為輔助性質，不能取代大廈火警系統及法定緊急程序，並可能延遲或無法提供。',
       1, true, 'evt_20260813_smoke02');`,
    `INSERT INTO home_safety.safety_event_audience (event_id, unit_id) VALUES ('evt_20260813_retract', 'unit_wfg_a_12_a1');`,
  ],
  'mob-09-safety-event-detail__resident-not-authorized': [
    `DELETE FROM home_safety.safety_event_audience WHERE event_id = 'evt_20260813_other01';`,
    `DELETE FROM home_safety.safety_event WHERE event_id = 'evt_20260813_other01';`,
    `INSERT INTO home_safety.safety_event (
       event_id, organization_id, estate_id, severity, title_en, title_zh_hant,
       instruction_en, instruction_zh_hant, location_label_en, location_label_zh_hant,
       location_class, audience_source, source_unit_id, occurred_at, received_at,
       reported_by_en, reported_by_zh_hant, disclaimer_en, disclaimer_zh_hant, revision_number)
     VALUES ('evt_20260813_other01', 'org_wingfu_holdings', 'est_wing_fu_garden', 'critical',
       'Smoke detected in a unit', '單位偵測到煙霧',
       'Leave the flat and use the staircase.', '請離開單位並使用樓梯。',
       'Kitchen · 20/F Flat A1', '廚房 · 20樓 A1室', 'unit', 'unit', 'unit_wfg_a_20_a1',
       '2026-08-13T09:30:00+08:00', '2026-08-13T09:30:05+08:00',
       'Installed smoke detector', '已安裝煙霧探測器',
       'This alert supplements the building fire alarm and statutory emergency procedures. It does not replace them, and it may be delayed or unavailable.',
       '此警報為輔助性質，不能取代大廈火警系統及法定緊急程序，並可能延遲或無法提供。', 1);`,
    // Audience is the OTHER household. res_wfg_000412 is not in it.
    `INSERT INTO home_safety.safety_event_audience (event_id, unit_id) VALUES ('evt_20260813_other01', 'unit_wfg_a_20_a1');`,
  ],
};

for (const [name, statements] of Object.entries(behavioural)) {
  fs.writeFileSync(
    path.join(OUT, `${name}.sql`),
    `-- GENERATED by database/seeds/tools/generate-scenarios.mjs\n` +
      `-- Behavioural scenario: the fixture is a Problem body, so there is nothing to\n` +
      `-- transcribe and the STATE is constructed instead. See the generator.\n\n` +
      `${statements.join('\n')}\n`,
  );
  written += 1;
}

console.log(`generated ${written} scenario seed files into database/seeds/scenarios/`);
