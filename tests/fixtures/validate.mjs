#!/usr/bin/env node
/**
 * PEMO resident-mobile contract validator.
 *
 * Owned by API-005-ST and committed so that GEN-006-ST and UI-007-ST can both
 * re-run it. This is the check that makes concurrent work safe: it proves the
 * contract, the canonical severity set, the resident-boundary denylist and the
 * fixture corpus all agree with each other.
 *
 * It proves nothing else. A passing run does not mean a backend serves these
 * responses or that a client renders them. No endpoint or app exists.
 *
 *   node tests/fixtures/validate.mjs
 *
 * Exit 0 = all checks pass. Exit 1 = at least one failure, itemised on stdout.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validate as validateOpenapi, dereference } from '@readme/openapi-parser';
import { surfaceHash, corpusHash, authoredVersion, hashedFiles, SURFACES, unclassifiedRegistryFields, PT_SURFACE_FIELDS, PT_CORPUS_FIELDS, PT_FILTER_FIELDS } from '../../packages/api-contracts/contract-hash.mjs';
import { VALIDATOR_CODE_SET } from './validator-codes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const CONTRACT_DIR = path.join(ROOT, 'packages/api-contracts/resident-mobile');
const OPENAPI = path.join(CONTRACT_DIR, 'openapi.yaml');
const SEVERITY = path.join(CONTRACT_DIR, 'severity.json');
const FORBIDDEN = path.join(CONTRACT_DIR, 'forbidden-terms.json');
const REGISTRY = path.join(ROOT, 'packages/api-contracts/problem-types.json');
const MGMT_DIR = path.join(ROOT, 'packages/api-contracts/management-web');
const MGMT_OPENAPI = path.join(MGMT_DIR, 'openapi.yaml');
const MGMT_FIXTURES = path.join(ROOT, 'tests/fixtures/management-web');
const MGMT_FORBIDDEN = path.join(MGMT_DIR, 'forbidden-terms.json');
const PORTAL_DIR = path.join(ROOT, 'packages/api-contracts/resident-portal');
const PORTAL_OPENAPI = path.join(PORTAL_DIR, 'openapi.yaml');
const PORTAL_FIXTURES = path.join(ROOT, 'tests/fixtures/resident-portal');
const PORTAL_FORBIDDEN = path.join(PORTAL_DIR, 'forbidden-terms.json');
const LOCK = path.join(CONTRACT_DIR, 'contract-lock.json');
const FIXTURES = path.join(HERE, 'resident-mobile');

/** Latin tokens that are legitimate inside Traditional Chinese copy. */
const ALLOWED_LATIN_IN_ZH = new Set(['PEMO']);

/** Fields whose value is prose by contract and must therefore be a complete sentence. */
const PROSE_FIELDS = new Set([
  'detail', 'instruction', 'summary', 'body', 'note', 'residentMessage',
  'confirmation', 'availability', 'comingSoonNote', 'installedServicesNote',
  'servicesNote', 'lockReason', 'correctionNote',
]);

const failures = [];
const notes = [];
/**
 * Record a failure under a DECLARED code.
 *
 * The code must appear in `validator-codes.mjs`. That file is what
 * `adrs-present.sh` reads to know this namespace exists, so an undeclared code
 * would be invisible there and would read as a dangling principle id — the
 * `GEN-034` gap 2 defect. Refusing here is what keeps the declaration honest;
 * a list nothing enforces is a list that drifts.
 */
const fail = (check, where, detail) => {
  if (!VALIDATOR_CODE_SET.has(check)) {
    throw new Error(
      `validate.mjs: fail() called with undeclared code '${check}'. ` +
      'Add it to tests/fixtures/validator-codes.mjs — adrs-present.sh reads that ' +
      'file to tell a validator code from a dangling principle id.',
    );
  }
  return failures.push({ check, where, detail });
};
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Required state coverage, from design system section 18. */
const REQUIRED_BASE_STATES = [
  'loading', 'empty', 'error', 'partial', 'offline', 'stale',
  'no-permission', 'session-expired', 'integration-unavailable',
  'duplicate-submission', 'long-content-en', 'long-content-zh',
];

/** Home Safety additional states, section 18, allocated to the screen that owns each. */
const REQUIRED_SAFETY_STATES = {
  'mob-08-safety-overview': [
    'unknown-unit', 'no-installed-sensors', 'sensor-offline',
    'caregiver-permission-expired', 'all-clear',
  ],
  'mob-09-safety-event-detail': [
    'unknown-unit', 'event-update', 'duplicate-event', 'late-event',
    'corrected-event', 'retracted-event', 'resident-not-authorized',
    'management-update-pending', 'all-clear',
    'common-area-event', // required by ADR-003
  ],
};

const SCREENS = [
  'mob-02-home', 'mob-03-services', 'mob-08-safety-overview',
  'mob-09-safety-event-detail', 'mob-11-account',
];

// --------------------------------------------------------------- 1. OpenAPI
console.log('PEMO resident-mobile contract validation\n');

const validation = await validateOpenapi(OPENAPI);
if (!validation.valid) {
  fail('openapi-3.1', 'openapi.yaml', JSON.stringify(validation.errors ?? validation).slice(0, 2000));
  console.log('OpenAPI 3.1 .................. FAIL');
} else {
  console.log('OpenAPI 3.1 .................. ok');
}

const doc = await dereference(OPENAPI);

const mgmtValidation = await validateOpenapi(MGMT_OPENAPI);
if (!mgmtValidation.valid) {
  fail('openapi-3.1', 'management-web/openapi.yaml', JSON.stringify(mgmtValidation.errors ?? mgmtValidation).slice(0, 2000));
  console.log('OpenAPI 3.1 (management) ..... FAIL');
} else {
  console.log('OpenAPI 3.1 (management) ..... ok');
}
const mgmtDoc = await dereference(MGMT_OPENAPI);
const mgmtSchemas = mgmtDoc?.components?.schemas ?? {};

const portalValidation = await validateOpenapi(PORTAL_OPENAPI);
if (!portalValidation.valid) {
  fail('openapi-3.1', 'resident-portal/openapi.yaml', JSON.stringify(portalValidation.errors ?? portalValidation).slice(0, 2000));
  console.log('OpenAPI 3.1 (portal) ......... FAIL');
} else {
  console.log('OpenAPI 3.1 (portal) ......... ok');
}
const portalDoc = await dereference(PORTAL_OPENAPI);
const portalSchemas = portalDoc?.components?.schemas ?? {};
const schemas = doc?.components?.schemas ?? {};
const contractVersion = doc?.info?.version;

/**
 * Statuses actually declared per operation.
 *
 * Added in v0.1.1. Its absence is why six fixtures shipped in v0.1.0 declaring statuses
 * the contract did not: the validator checked each fixture *against* its declared response
 * schema, but nothing asserted that the status the fixture claims is declared anywhere on
 * the operation it belongs to. Found by GEN-006-ST Step 1, not by this script.
 */
const declaredStatuses = new Map();
for (const [route, item] of Object.entries(doc?.paths ?? {})) {
  for (const [method, op] of Object.entries(item)) {
    if (!op?.operationId) continue;
    declaredStatuses.set(op.operationId, {
      route, method, statuses: new Set(Object.keys(op.responses ?? {})),
    });
  }
}

// --------------------------------------------------- 2. severity enum agrees
const severity = readJson(SEVERITY);
const canonical = severity.levelOrder;
const contractEnum = schemas?.Severity?.enum ?? [];

if (JSON.stringify(canonical) !== JSON.stringify(contractEnum)) {
  fail('severity-enum-agreement', 'openapi.yaml #/components/schemas/Severity',
    `severity.json levelOrder [${canonical}] != OpenAPI enum [${contractEnum}]`);
}
for (const level of canonical) {
  if (!severity.levels[level]) fail('severity-definition', `severity.json ${level}`, 'listed in levelOrder but not defined');
  const def = severity.levels[level];
  if (def && (!def.label?.en || !def.label?.['zh-Hant'])) {
    fail('severity-bilingual-label', `severity.json ${level}`, 'missing an English or Traditional Chinese label');
  }
}
if (canonical.length !== 7) {
  fail('severity-count', 'severity.json', `expected 7 canonical levels, found ${canonical.length}`);
}
console.log(`Severity set ................. ${canonical.length} levels, enum agrees: ${JSON.stringify(canonical) === JSON.stringify(contractEnum)}`);

// ------------------------------------------------------------- 3. Ajv set-up
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true });
addFormats(ajv);
const compiled = new Map();
const validatorFor = (name) => {
  if (!compiled.has(name)) {
    const schema = schemas[name];
    if (!schema) return null;
    compiled.set(name, ajv.compile({ ...schema, $schema: 'https://json-schema.org/draft/2020-12/schema' }));
  }
  return compiled.get(name);
};

// -------------------------------------------------------- 4. denylist set-up
const forbidden = readJson(FORBIDDEN);
const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const denyNames = new Map();
for (const [group, cfg] of Object.entries(forbidden.forbiddenPropertyNames)) {
  for (const term of cfg.terms) denyNames.set(normalise(term), group);
}
const denyPatterns = forbidden.forbiddenValuePatterns.map((p) => ({ ...p, re: new RegExp(p.pattern) }));

function scanForbidden(node, where, at = '$') {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => scanForbidden(v, where, `${at}[${i}]`));
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const group = denyNames.get(normalise(k));
      if (group) {
        fail('forbidden-term', where, `property "${k}" at ${at} is denied (${group}): ${forbidden.forbiddenPropertyNames[group].reason}`);
      }
      scanForbidden(v, where, `${at}.${k}`);
    }
    return;
  }
  if (typeof node === 'string') {
    for (const p of denyPatterns) {
      if (p.re.test(node)) {
        fail('forbidden-value', where, `value at ${at} matches "${p.name}": ${p.reason}`);
      }
    }
  }
}

// ------------------------------------------------- 5. severity + bilingual scan
function scanValues(node, where, at = '$') {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => scanValues(v, where, `${at}[${i}]`));
    return;
  }
  if (typeof node !== 'object') return;

  for (const [k, v] of Object.entries(node)) {
    if (k === 'severity' && typeof v === 'string' && !canonical.includes(v)) {
      fail('severity-value', where, `"${v}" at ${at}.${k} is not in the canonical enumeration`);
    }
    scanValues(v, where, `${at}.${k}`);
  }

  // Bilingual completeness: anything shaped like LocalizedText must carry both.
  const keys = Object.keys(node);
  if (keys.includes('en') || keys.includes('zh-Hant')) {
    const en = node.en, zh = node['zh-Hant'];
    if (typeof en !== 'string' || en.length === 0) fail('bilingual', where, `missing or empty English text at ${at}`);
    if (typeof zh !== 'string' || zh.length === 0) fail('bilingual', where, `missing or empty Traditional Chinese text at ${at}`);
    if (typeof zh === 'string' && !/[㐀-鿿]/.test(zh)) {
      fail('bilingual', where, `zh-Hant at ${at} contains no Han characters — likely an untranslated placeholder`);
    }
    // Mixed-language copy. An English word left inside Traditional Chinese would be served
    // to a resident verbatim. PEMO is the product name and is legitimate in Chinese copy;
    // anything else is a defect. Added in v0.1.1 after `請於颱風season前…` shipped in v0.1.0.
    if (typeof zh === 'string') {
      const latin = (zh.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !ALLOWED_LATIN_IN_ZH.has(w));
      if (latin.length) {
        fail('mixed-language', where, `zh-Hant at ${at} contains untranslated Latin word(s): ${latin.join(', ')}`);
      }
    }
    // Truncated prose. Added in v0.1.1 after sliced long-content strings shipped in v0.1.0
    // cut mid-word in both languages.
    //
    // Scoped deliberately to fields that are prose by contract. Titles, labels, states and
    // coming-soon reasons are short-form by design — "Existing visitor system integration
    // pending" is the copy the design specifies, not a fragment — so requiring terminal
    // punctuation everywhere produces false positives, which is worse than a narrower check.
    //
    // Limitation, stated rather than hidden: this catches truncated *prose*. It would not
    // catch a truncated title. The generator no longer slices any string, so the source of
    // that defect is removed; this assertion is the backstop for the prose case only.
    const field = at.slice(at.lastIndexOf('.') + 1);
    if (PROSE_FIELDS.has(field)) {
      for (const [lang, text] of [['en', en], ['zh-Hant', zh]]) {
        if (typeof text !== 'string' || text.length < 40) continue;
        if (!/[.。!！?？]$/.test(text.trim())) {
          fail('truncated-copy', where,
            `${lang} at ${at} is prose but does not end in terminal punctuation — likely truncated: "…${text.slice(-28)}"`);
        }
      }
    }
  }
}

// ---------------------------------------------------------- 6. fixture sweep
const manifest = readJson(path.join(FIXTURES, 'index.json'));

// Every artifact in the contract package must claim the same contract version. Added in
// v0.1.1: the patch bumped openapi.yaml, severity.json, forbidden-terms.json and index.json
// together, and a partial bump is exactly the drift this package cannot afford.
for (const [label, declared] of [
  ['index.json', manifest.contractVersion],
  ['severity.json', severity.contractVersion],
  ['forbidden-terms.json', forbidden.contractVersion],
]) {
  if (declared !== contractVersion) {
    fail('contract-version', label, `declares ${declared}, OpenAPI declares ${contractVersion}`);
  }
}

// Fixtures carry the version in their envelope; it must match too.
for (const entry of manifest.fixtures.filter((f) => f.file)) {
  const body = readJson(path.join(FIXTURES, entry.file));
  const v = body?.meta?.contractVersion;
  if (v !== undefined && v !== contractVersion) {
    fail('contract-version', entry.file, `meta.contractVersion is ${v}, OpenAPI declares ${contractVersion}`);
  }
}

let validated = 0;
for (const entry of manifest.fixtures) {
  if (!entry.file) {
    if (!entry.reason) fail('client-only-reason', `${entry.screen}/${entry.state}`, 'client-only state declared without a reason');
    continue;
  }
  const abs = path.join(FIXTURES, entry.file);
  const where = entry.file;
  if (!fs.existsSync(abs)) { fail('fixture-missing', where, 'listed in index.json but not on disk'); continue; }

  let body;
  try { body = readJson(abs); } catch (e) { fail('fixture-json', where, e.message); continue; }

  const validator = validatorFor(entry.schema);
  if (!validator) {
    fail('schema-missing', where, `declared schema "${entry.schema}" is not in the OpenAPI document`);
  } else if (!validator(body)) {
    fail('schema-validation', where,
      validator.errors.map((e) => `${e.instancePath || '$'} ${e.message}`).slice(0, 6).join('; '));
  }

  // Every status a fixture claims must be declared on its operation. Without this,
  // contract conformance and fixture parity can disagree and both still pass.
  if (!entry.operationId) {
    fail('operation-missing', where, 'fixture does not declare which operationId it belongs to');
  } else if (!declaredStatuses.has(entry.operationId)) {
    fail('operation-unknown', where, `operationId "${entry.operationId}" is not in the OpenAPI document`);
  } else {
    const op = declaredStatuses.get(entry.operationId);
    if (!op.statuses.has(String(entry.httpStatus))) {
      fail('status-undeclared', where,
        `declares HTTP ${entry.httpStatus}, which ${entry.operationId} (${op.method.toUpperCase()} ${op.route}) does not declare — ` +
        `declared: ${[...op.statuses].join(', ')}`);
    }
  }

  scanForbidden(body, where);
  scanValues(body, where);
  validated += 1;
}
console.log(`Fixtures ..................... ${validated} validated against their declared schema`);

// Every fixture on disk must be in the manifest; nothing silently unchecked.
const declared = new Set(manifest.fixtures.filter((f) => f.file).map((f) => f.file));
for (const screen of fs.readdirSync(FIXTURES, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  for (const f of fs.readdirSync(path.join(FIXTURES, screen.name))) {
    const rel = `${screen.name}/${f}`;
    if (f.endsWith('.json') && !declared.has(rel)) {
      fail('fixture-undeclared', rel, 'present on disk but absent from index.json, so nothing validates it');
    }
  }
}

// -------------------------------------------------------- 7. state coverage
const byScreen = new Map(SCREENS.map((s) => [s, new Set()]));
for (const entry of manifest.fixtures) {
  if (byScreen.has(entry.screen)) byScreen.get(entry.screen).add(entry.state);
}
for (const screen of SCREENS) {
  const have = byScreen.get(screen);
  for (const state of REQUIRED_BASE_STATES) {
    if (!have.has(state)) fail('state-coverage', screen, `required state "${state}" is neither a fixture nor a declared client-only state`);
  }
  for (const state of (REQUIRED_SAFETY_STATES[screen] ?? [])) {
    if (!have.has(state)) fail('state-coverage', screen, `required Home Safety state "${state}" is missing`);
  }
}
console.log(`State coverage ............... ${SCREENS.length} screens checked against design system section 18`);

// ------------------------------------- 8. contract-level boundary assertions
// The contract itself must not name a forbidden property.
scanForbidden(
  Object.fromEntries(Object.entries(schemas).map(([n, s]) => [n, s.properties ?? {}])),
  'openapi.yaml #/components/schemas',
);

// monitoringCoverage=none must pair with severity=information, per severity.md.
for (const entry of manifest.fixtures.filter((f) => f.file)) {
  const body = readJson(path.join(FIXTURES, entry.file));
  const s = body?.safety;
  if (s && s.monitoringCoverage === 'none' && s.severity !== 'information') {
    fail('coverage-severity-pairing', entry.file,
      `monitoringCoverage "none" must pair with severity "information", found "${s.severity}"`);
  }
  if (s && s.observedAt && s.receivedAt && new Date(s.receivedAt) < new Date(s.observedAt)) {
    fail('timestamp-order', entry.file, 'receivedAt is earlier than observedAt');
  }
  // Derived freshness must agree with the timestamps it is derived from. Added in v0.2.1
  // after mob-08/sensor-offline.json shipped ageSeconds 103000 against timestamps saying
  // 103560. No correct server reproduces that, and one that did would misreport how old a
  // safety observation is — which is the number the resident is asked to judge staleness by.
  if (s?.freshness && s.observedAt && body?.meta?.generatedAt) {
    const actual = Math.round((new Date(body.meta.generatedAt) - new Date(s.observedAt)) / 1000);
    if (s.freshness.ageSeconds !== actual) {
      fail('freshness-age', entry.file,
        `freshness.ageSeconds is ${s.freshness.ageSeconds}, but meta.generatedAt minus safety.observedAt is ${actual}`);
    }
    const expected = actual > s.freshness.windowSeconds ? 'stale' : 'current';
    if (s.freshness.status !== expected) {
      fail('freshness-status', entry.file,
        `freshness.status is "${s.freshness.status}" but an age of ${actual}s against a ${s.freshness.windowSeconds}s window is "${expected}"`);
    }
  }

  // Monitoring coverage must agree with the installed-service list it describes.
  if (s?.monitoringCoverage !== undefined && Array.isArray(body?.installedServices)) {
    const n = body.installedServices.length;
    if (s.monitoringCoverage === 'none' && n > 0) {
      fail('coverage-consistency', entry.file, `monitoringCoverage "none" but ${n} installed service(s) listed`);
    }
    if (s.monitoringCoverage !== 'none' && n === 0) {
      fail('coverage-consistency', entry.file, `monitoringCoverage "${s.monitoringCoverage}" but no installed services listed`);
    }
  }

  const e = body?.event;
  if (e && new Date(e.receivedAt) < new Date(e.occurredAt)) {
    fail('timestamp-order', entry.file, 'event receivedAt is earlier than occurredAt');
  }

  // An acknowledgement time must agree with whether it was acknowledged.
  const ack = e?.acknowledgement ?? body?.acknowledgement;
  if (ack) {
    if (ack.acknowledged === true && !ack.acknowledgedAt) {
      fail('acknowledgement-consistency', entry.file, 'acknowledged is true but acknowledgedAt is null');
    }
    if (ack.acknowledged === false && ack.acknowledgedAt) {
      fail('acknowledgement-consistency', entry.file, 'acknowledged is false but acknowledgedAt is set');
    }
  }

  // managementUpdatePending means management has not yet published. Added in v0.2.1 after
  // mob-09/duplicate-event.json shipped pending true alongside an already-published update.
  if (e && e.managementUpdatePending === true && (e.managementUpdates?.length ?? 0) > 0) {
    fail('update-pending-consistency', entry.file,
      `managementUpdatePending is true but ${e.managementUpdates.length} update(s) are already published`);
  }

  // A correction must name what it corrects, so it stays linked to the original event.
  if (e?.revision?.isCorrection === true && !e.revision.supersedes) {
    fail('revision-consistency', entry.file, 'revision.isCorrection is true but supersedes is null');
  }
  if (e && e.location && e.location.locationClass !== 'unit' && e.location.audienceSource !== 'serving_scope') {
    fail('serving-scope', entry.file,
      `locationClass "${e.location.locationClass}" is not a unit, so audienceSource must be "serving_scope" (ADR-003)`);
  }
}
console.log('Boundary assertions .......... coverage/severity pairing, timestamp order, serving scope\n');

const usedBySurface = new Map([['resident', new Set()], ['management', new Set()], ['resident-portal', new Set()]]);
const operationSurface = new Map();
for (const [surface, doc2] of [['resident', doc], ['management', mgmtDoc], ['resident-portal', portalDoc]]) {
  for (const item of Object.values(doc2?.paths ?? {})) {
    for (const op of Object.values(item)) {
      if (op?.operationId) operationSurface.set(op.operationId, surface);
    }
  }
}

const registry = readJson(REGISTRY);
const declaredUris = new Map(Object.entries(registry.types).map(([k, v]) => [v.uri, { key: k, ...v }]));

// ------------------------------------------ 8b. management-web surface (ADR-007 D2/D3)
//
// A SECOND scan with its own term list, unconditional within this surface. Never a
// conditional one: D2 chose separate packages precisely so neither scan has to decide,
// per response and per field, which rule applies.
const mgmtForbidden = readJson(MGMT_FORBIDDEN);
const mgmtDeny = new Map();
for (const [group, cfg] of Object.entries(mgmtForbidden.forbiddenPropertyNames)) {
  for (const term of cfg.terms) mgmtDeny.set(normalise(term), group);
}
const mgmtPatterns = mgmtForbidden.forbiddenValuePatterns.map((p) => ({ ...p, re: new RegExp(p.pattern) }));

function scanManagement(node, where, at = '$') {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) return node.forEach((v, i) => scanManagement(v, where, `${at}[${i}]`));
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const group = mgmtDeny.get(normalise(k));
      if (group) {
        fail('mgmt-forbidden-term', where,
          `property "${k}" at ${at} is denied on the management surface (${group}): ${mgmtForbidden.forbiddenPropertyNames[group].reason}`);
      }
      scanManagement(v, where, `${at}.${k}`);
    }
    return;
  }
  if (typeof node === 'string') {
    for (const p of mgmtPatterns) {
      if (p.re.test(node)) fail('mgmt-forbidden-value', where, `value at ${at} matches "${p.name}": ${p.reason}`);
    }
  }
}

const mgmtManifest = readJson(path.join(MGMT_FIXTURES, 'index.json'));
const mgmtAuthored = mgmtDoc?.info?.version;
if (mgmtManifest.contractVersion !== mgmtAuthored) {
  fail('contract-version', 'management-web/index.json',
    `manifest declares ${mgmtManifest.contractVersion}, management openapi declares ${mgmtAuthored}`);
}

let mgmtValidated = 0;
for (const entry of mgmtManifest.fixtures) {
  if (!entry.file) {
    if (!entry.reason) fail('client-only-reason', `${entry.screen}/${entry.state}`, 'client-only state declared without a reason');
    continue;
  }
  const abs = path.join(MGMT_FIXTURES, entry.file);
  const where = `management-web/${entry.file}`;
  if (!fs.existsSync(abs)) { fail('fixture-missing', where, 'listed in index.json but not on disk'); continue; }
  let body;
  try { body = readJson(abs); } catch (e) { fail('fixture-json', where, e.message); continue; }

  const schema = mgmtSchemas[entry.schema];
  if (!schema) {
    fail('schema-missing', where, `declared schema "${entry.schema}" is not in the management document`);
  } else {
    const key = `mgmt:${entry.schema}`;
    if (!compiled.has(key)) compiled.set(key, ajv.compile({ ...schema, $schema: 'https://json-schema.org/draft/2020-12/schema' }));
    const v = compiled.get(key);
    if (!v(body)) {
      fail('schema-validation', where, v.errors.map((e) => `${e.instancePath || '$'} ${e.message}`).slice(0, 6).join('; '));
    }
  }

  // status must be declared by the operation, same rule as the resident surface
  const op = entry.operationId;
  if (!op || operationSurface.get(op) !== 'management') {
    fail('operation-unknown', where, `operationId "${op}" is not a management operation`);
  } else {
    let declared = null;
    for (const item of Object.values(mgmtDoc.paths)) {
      for (const o of Object.values(item)) if (o.operationId === op) declared = Object.keys(o.responses ?? {});
    }
    if (declared && !declared.includes(String(entry.httpStatus))) {
      fail('status-undeclared', where, `declares HTTP ${entry.httpStatus}, which ${op} does not declare — declared: ${declared.join(', ')}`);
    }
  }

  // type URIs on this surface
  const uri = body?.type;
  if (typeof uri === 'string') {
    usedBySurface.get('management').add(uri);
    const decl = declaredUris.get(uri);
    if (!decl) fail('problem-type-undeclared', where, `Problem.type "${uri}" is not in problem-types.json`);
    else if (!decl.surfaces.includes('management')) {
      fail('problem-type-surface', where, `type "${uri}" declares surfaces [${decl.surfaces}] and does not include "management"`);
    }
  }

  scanManagement(body, where);
  scanValues(body, where);
  mgmtValidated += 1;
}

// every management fixture on disk must be declared
const mgmtDeclared = new Set(mgmtManifest.fixtures.filter((f) => f.file).map((f) => f.file));
for (const d of fs.readdirSync(MGMT_FIXTURES, { withFileTypes: true }).filter((x) => x.isDirectory())) {
  for (const f of fs.readdirSync(path.join(MGMT_FIXTURES, d.name))) {
    const rel = `${d.name}/${f}`;
    if (f.endsWith('.json') && !mgmtDeclared.has(rel)) {
      fail('fixture-undeclared', `management-web/${rel}`, 'present on disk but absent from index.json');
    }
  }
}

// management enum generated from the registry's management projection
const mgmtRegistryUris = Object.values(readJson(REGISTRY).types)
  .filter((v) => v.status === 'active' && v.surfaces.includes('management')).map((v) => v.uri).sort();
const mgmtEnum = [...(mgmtSchemas?.Problem?.properties?.type?.enum ?? [])].sort();
if (JSON.stringify(mgmtRegistryUris) !== JSON.stringify(mgmtEnum)) {
  fail('problem-type-enum-agreement', 'management-web/openapi.yaml',
    `registry declares ${mgmtRegistryUris.length} management type(s); the generated enum has ${mgmtEnum.length}.`);
}

console.log(`Management surface .......... ${mgmtValidated} fixtures, own boundary scan (${mgmtDeny.size} terms), enum agrees`);

// ---------------------------------- 8b. resident-portal surface (API-027-ST)
//
// The third contract line: Amenities & Booking read surfaces. Own boundary (a booking
// denylist derived by diffing the two existing lists), own state vocabulary, and the
// eligibility INVERSION — an ineligible facility is present with a reason, not absent.
// All world bindings are `pending` (overlay-on-WFG), verified when Backend seeds the overlay.
const portalManifest = readJson(path.join(PORTAL_FIXTURES, 'index.json'));
const portalAuthored = portalDoc?.info?.version;
if (portalManifest.contractVersion !== portalAuthored) {
  fail('contract-version', 'resident-portal/index.json',
    `manifest declares ${portalManifest.contractVersion}, portal openapi declares ${portalAuthored}`);
}

const portalForbidden = readJson(PORTAL_FORBIDDEN);
const portalDeny = new Map();
for (const [group, cfg] of Object.entries(portalForbidden.forbiddenPropertyNames)) {
  for (const term of cfg.terms) portalDeny.set(normalise(term), group);
}
function scanPortal(node, where, at = '$') {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) return node.forEach((v, i) => scanPortal(v, where, `${at}[${i}]`));
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      const group = portalDeny.get(normalise(k));
      if (group) {
        fail('portal-forbidden-term', where,
          `property "${k}" at ${at} is denied on the resident-portal surface (${group}): ${portalForbidden.forbiddenPropertyNames[group].reason}`);
      }
      scanPortal(v, where, `${at}.${k}`);
    }
  }
}

let portalValidated = 0;
for (const entry of portalManifest.fixtures) {
  if (!entry.file) { if (!entry.reason) fail('client-only-reason', `${entry.screen}/${entry.state}`, 'client-only state without a reason'); continue; }
  const abs = path.join(PORTAL_FIXTURES, entry.file);
  const where = `resident-portal/${entry.file}`;
  if (!fs.existsSync(abs)) { fail('fixture-missing', where, 'listed in index.json but not on disk'); continue; }
  let body;
  try { body = readJson(abs); } catch (e) { fail('fixture-json', where, e.message); continue; }
  const schema = portalSchemas[entry.schema];
  if (!schema) {
    fail('schema-missing', where, `declared schema "${entry.schema}" is not in the portal document`);
  } else {
    const key = `portal:${entry.schema}`;
    if (!compiled.has(key)) compiled.set(key, ajv.compile({ ...schema, $schema: 'https://json-schema.org/draft/2020-12/schema' }));
    const v = compiled.get(key);
    if (!v(body)) fail('schema-validation', where, v.errors.map((e) => `${e.instancePath || '$'} ${e.message}`).slice(0, 6).join('; '));
  }
  scanPortal(body, where);
  scanValues(body, where);       // bilingual + mixed-language (severity checks are no-ops here)
  // Problem.type forward: every URI a fixture carries is declared and applies to this surface.
  const uri = body?.type;
  if (typeof uri === 'string') {
    usedBySurface.get('resident-portal').add(uri);
    const decl = declaredUris.get(uri);
    if (!decl) fail('problem-type-undeclared', where, `Problem.type "${uri}" is not in problem-types.json`);
    else {
      if (!decl.surfaces.includes('resident-portal')) fail('problem-type-surface', where, `type "${uri}" does not include surface "resident-portal"`);
      if (Array.isArray(decl.httpStatus) && !decl.httpStatus.includes(entry.httpStatus)) {
        fail('problem-type-status', where, `type "${uri}" is declared for HTTP ${decl.httpStatus.join(', ')}, fixture declares ${entry.httpStatus}`);
      }
    }
  }
  portalValidated += 1;
}
// every fixture on disk must be declared
const portalDeclared = new Set(portalManifest.fixtures.filter((f) => f.file).map((f) => f.file));
for (const d of fs.readdirSync(PORTAL_FIXTURES, { withFileTypes: true }).filter((x) => x.isDirectory())) {
  for (const f of fs.readdirSync(path.join(PORTAL_FIXTURES, d.name))) {
    const rel = `${d.name}/${f}`;
    if (f.endsWith('.json') && !portalDeclared.has(rel)) fail('fixture-undeclared', `resident-portal/${rel}`, 'present on disk but absent from index.json');
  }
}
// enum agreement: registry resident-portal projection == the openapi Problem enum
const portalRegistryUris = Object.values(readJson(REGISTRY).types)
  .filter((v) => v.status === 'active' && v.surfaces.includes('resident-portal')).map((v) => v.uri).sort();
const portalEnum = [...(portalSchemas?.Problem?.properties?.type?.enum ?? [])].sort();
if (JSON.stringify(portalRegistryUris) !== JSON.stringify(portalEnum)) {
  fail('problem-type-enum-agreement', 'resident-portal/openapi.yaml',
    `registry declares ${portalRegistryUris.length} resident-portal type(s); the generated enum has ${portalEnum.length}.`);
}

// ---- The FOUR tests (each proven red by mutation in the Step 2 report) ----
const portalRead = (f) => readJson(path.join(PORTAL_FIXTURES, f));
{
  // TEST 1 — eligibility inversion: an ineligible facility is PRESENT with a reason, never absent.
  const explore = portalRead('explore/default.json');
  const inelig = explore.results.filter((c) => c.eligibility && c.eligibility.eligible === false);
  if (inelig.length === 0) {
    fail('portal-eligibility-inversion', 'resident-portal/explore/default.json',
      'no facility is present with eligibility.eligible=false. The inversion (present-with-reason, not absent-when-out-of-scope) is unexercised — scope-filtering would remove it, and that is the defect this guards (trap 8).');
  }
  for (const c of inelig) {
    if (c.eligibility.reason == null) fail('portal-eligibility-inversion', 'resident-portal/explore/default.json',
      `${c.facilityId} is ineligible but carries no reason — an ineligible facility must say why, in the caller's own terms.`);
  }

  // TEST 2 — absence and zero are distinguishable (R7).
  const fn = portalRead('facility/function-room.json'), party = portalRead('facility/party-room.json');
  const q1 = fn.rules.perPersonQuotaPerMonth, q2 = party.rules.perPersonQuotaPerMonth;
  if (!(q1 === null && q2 === 0)) {
    fail('portal-absence-vs-zero', 'resident-portal/facility',
      `the corpus must carry BOTH an ABSENT policy (null = property does not operate it) and a ZERO policy (0 = operates it, currently zero) and keep them distinct. perPersonQuotaPerMonth is ${JSON.stringify(q1)} (function-room) and ${JSON.stringify(q2)} (party-room). A default/zero-fallback coercing one into the other is the defect this guards.`);
  }
  const f1 = fn.rules.adminFee, f2 = party.rules.adminFee;
  if (!(f1 === null && f2 && f2.amount === 0)) {
    fail('portal-absence-vs-zero', 'resident-portal/facility',
      `adminFee must be absent (null) on one fixture and a set zero ({amount:0}) on the other, kept distinct. Got ${JSON.stringify(f1)} and ${JSON.stringify(f2)}.`);
  }

  // TEST 3a — counts computed, not transcribed; and the derived scope is WORLD.
  // default.json is the unfiltered full-world query, so world == results and the facets are
  // recomputable from the returned set. facets.scope must declare `world` (the derivation).
  if (explore.facets.scope !== 'world') {
    fail('portal-facet-scope', 'resident-portal/explore/default.json',
      `facets.scope is "${explore.facets.scope}"; this contract computes facets over the world (derived Step 2). See empty.json for why page-scope cannot hold.`);
  }
  const catCounts = {};
  for (const c of explore.results) catCounts[c.category] = (catCounts[c.category] || 0) + 1;
  for (const fc of explore.facets.categories) {
    const computed = catCounts[fc.key] || 0;
    if (fc.count !== computed) fail('portal-counts-computed', 'resident-portal/explore/default.json',
      `facet category "${fc.key}" declares ${fc.count} but the returned set computes ${computed}. Counts are computed from the bound world, never transcribed (trap 4).`);
  }
  const parent = { clubhouse: 0, podium: 0 };
  for (const c of explore.results) {
    if (c.location.parentLocationId === 'loc_wfg_clubhouse') parent.clubhouse += 1;
    else if (c.location.parentLocationId === 'loc_wfg_podium') parent.podium += 1;
  }
  const bookable = explore.results.filter((c) => c.eligibility.eligible).length;
  for (const ff of explore.facets.filters) {
    let computed;
    if (ff.key.startsWith('parent:')) computed = parent[ff.key.slice(7)];
    else if (ff.key === 'bookable') computed = bookable;
    else if (ff.key === 'ineligible') computed = explore.results.length - bookable;
    if (computed !== undefined && ff.count !== computed) {
      fail('portal-counts-computed', 'resident-portal/explore/default.json',
        `facet filter "${ff.key}" declares ${ff.count} but the returned set computes ${computed}.`);
    }
  }

  // TEST 3b — facets are WORLD-scoped, not page-scoped. The discriminating fixture
  // (empty.json) returns an empty page with non-zero category counts and total 0 — exactly
  // mob-s4-cases/empty.json's shape (cases:[] with counts.all:212). A page-scoped
  // implementation computes facets from the returned page and cannot produce this: its
  // facets would all be zero. The counts describe what selecting each facet WOULD yield.
  const empty = portalRead('explore/empty.json');
  if (empty.results.length !== 0 || empty.page.total !== 0) {
    fail('portal-facet-scope', 'resident-portal/explore/empty.json',
      'the world-scope discriminator must return an empty page (results:[] and page.total 0).');
  }
  if (empty.facets.scope !== 'world') {
    fail('portal-facet-scope', 'resident-portal/explore/empty.json', `facets.scope is "${empty.facets.scope}", expected world.`);
  }
  const anyNonZero = empty.facets.categories.some((fc) => fc.count > 0);
  if (!anyNonZero) {
    fail('portal-facet-scope', 'resident-portal/explore/empty.json',
      'an empty page carries all-zero category counts — that is page-scoped, and a page-scoped facet cannot establish what selecting a category would yield. World-scoped facets stay non-zero when the page is empty.');
  }
  // Same caller, same world: the empty query and the default query describe one world, so
  // their world-scoped facets are identical. Page-scope would make them differ (13 vs 0).
  if (JSON.stringify(empty.facets.categories) !== JSON.stringify(explore.facets.categories)) {
    fail('portal-facet-scope', 'resident-portal/explore/empty.json',
      'the empty query and the default query are one caller over one world, so their world-scoped category facets must be identical. They differ — which is what a page-scoped implementation produces.');
  }

  // TEST 4 — no catalogue facility may resolve to a Location of class public_area (Ruling D).
  // A public_area has no resident audience (ADR-003 Q1); the failure is silent — the row looks
  // normal but can never reach a resident. Named invariant; the ComposedLocation enum is the
  // structural half, this scan is the assertion the ruling requires.
  const scanClass = (node, where) => {
    if (Array.isArray(node)) return node.forEach((v) => scanClass(v, where));
    if (node && typeof node === 'object') {
      if (node.locationClass === 'public_area') {
        fail('portal-public-area', where, 'a catalogue facility resolves to a Location of class public_area, which has no resident audience (ADR-003 Q1). A garden or free-space facility meant for residents must be public_facility.');
      }
      for (const v of Object.values(node)) scanClass(v, where);
    }
  };
  for (const entry of portalManifest.fixtures.filter((f) => f.file)) {
    scanClass(portalRead(entry.file), `resident-portal/${entry.file}`);
  }
}
console.log(`Resident-portal surface ..... ${portalValidated} fixtures, own boundary scan (${portalDeny.size} terms), 4 invariants, enum agrees`);

// ------------------------------------------- 9. Problem.type registry (ADR-009)
//
// Before 0.3.0 `type` was an unconstrained uri-reference, so `session-expried` passed
// every check and silently broke every client branching on the field. A discriminator
// that is not validated is not a discriminator; it is a string.
const registryEntries = Object.entries(registry.types);

// Enum is GENERATED from the registry: the two must agree, or the schema is stale.
const residentUris = registryEntries
  .filter(([, v]) => v.status === 'active' && v.surfaces.includes('resident'))
  .map(([, v]) => v.uri)
  .sort();
const schemaEnum = [...(schemas?.Problem?.properties?.type?.enum ?? [])].sort();
if (JSON.stringify(residentUris) !== JSON.stringify(schemaEnum)) {
  fail('problem-type-enum-agreement', 'openapi.yaml #/components/schemas/Problem',
    `registry declares ${residentUris.length} resident type(s); the generated enum has ${schemaEnum.length}. Regenerate rather than hand-editing.`);
}

// FORWARD — every type a fixture carries is declared. This catches the typo.
const usedUris = new Set();
for (const entry of manifest.fixtures.filter((f) => f.file)) {
  const body = readJson(path.join(FIXTURES, entry.file));
  const uri = body?.type;
  if (typeof uri !== 'string') continue;
  usedUris.add(uri);
  usedBySurface.get('resident').add(uri);
  const declared = declaredUris.get(uri);
  if (!declared) {
    fail('problem-type-undeclared', entry.file,
      `Problem.type "${uri}" is not in problem-types.json. A typo here is invisible to every other check.`);
    continue;
  }
  // SURFACE CONTAINMENT — a resident fixture may only carry a resident-applicable type.
  if (!declared.surfaces.includes('resident')) {
    fail('problem-type-surface', entry.file,
      `type "${uri}" declares surfaces [${declared.surfaces}] and does not include "resident".`);
  }
  if (Array.isArray(declared.httpStatus) && !declared.httpStatus.includes(entry.httpStatus)) {
    fail('problem-type-status', entry.file,
      `type "${uri}" is declared for HTTP ${declared.httpStatus.join(', ')}, fixture declares ${entry.httpStatus}.`);
  }
}

// REVERSE — every active entry is reachable, PER SURFACE.
//
// Surface-aware since API-017-ST. A type may legitimately be fixtured on one surface and
// emitted-only on another: `invalid-credential` has a management fixture and, on the
// resident surface, only an emitter. A surface-blind check would call that a contradiction
// and would have forced a wrong fix — either an invented resident fixture or a lost
// emitted-only declaration.
for (const [key, v] of registryEntries) {
  if (v.status === 'reserved') continue;
  if (v.status !== 'active') {
    fail('problem-type-status-value', `problem-types.json ${key}`, `unknown status "${v.status}"`);
    continue;
  }
  for (const surface of v.surfaces) {
    const fixtured = (usedBySurface.get(surface) ?? new Set()).has(v.uri);
    const emitters = (v.emittedOnlyBy ?? []).filter((op) => operationSurface.get(op) === surface);
    if (!fixtured && emitters.length === 0) {
      fail('problem-type-unused', `problem-types.json ${key}`,
        `declared active for surface "${surface}" but no ${surface} fixture carries it and it names no ${surface} operation in emittedOnlyBy. A declared type nobody emits is a client branch that can never be taken.`);
    }
    // No "both" complaint. With two surfaces it is legitimate: `invalid-credential` is
    // fixtured on management and emitted-only on resident, and one flat emittedOnlyBy list
    // serves both. The check that matters is REACHABILITY per surface, which the branch
    // above enforces. Complaining about a stale-looking list would fire on a correct entry,
    // and a check that fires on correct input is the kind that gets bypassed.
  }
}
{
  const active = registryEntries.filter(([, v]) => v.status === 'active');
  const reserved = registryEntries.filter(([, v]) => v.status === 'reserved');
  const emittedOnly = active.filter(([, v]) => Array.isArray(v.emittedOnlyBy) && v.emittedOnlyBy.length > 0);
  console.log(
    `Problem.type registry ....... ${registryEntries.length} declared: ` +
    `${usedUris.size} fixtured, ${emittedOnly.length} emitted-only, ${reserved.length} reserved`,
  );
}

// ------------------------------------------------ 10. contract-lock (ADR-008 + Amendment A4)
//
// TWO hashes per surface with asymmetric roles (A4 D1/D2). surfaceHash is paired with the
// version: if it moved, the contract surface changed and the version must bump — it is the
// objective form of ADR-008's test, now sufficient as well as necessary. corpusHash is
// integrity only and version-independent: a corpus change moves it and does NOT bump. Before
// A4 there was one hash over both, so every corpus byte forced a bump no client could observe.
//
// THE CLASSIFIER IS LOAD-BEARING (A4 D7). With one hash, a misfiled field was still caught by
// the hash as a backstop; with the version paired to surfaceHash only, a field misfiled as
// corpus moves no surfaceHash and slips silently. So the classifier carries its OWN coverage:
// the exhaustiveness assertion below, and the D6/D7 battery run in this PID. A redundant check
// is also a witness; removing the backstop promotes the classifier, and that is the moment it
// needs coverage of its own.
//
// classifier exhaustiveness — a registry field in neither surface nor corpus nor filter is a
// hard failure, not a default. unknown->surface reintroduces churn (A4 D3); unknown->corpus
// ships a real surface change silently (the A4 stop condition). There is no safe default, so
// the suite stops until a human classifies it.
for (const u of unclassifiedRegistryFields()) {
  fail('classifier-unknown-field', `problem-types.json ${u.type}.${u.field}`,
    `field "${u.field}" is classified neither surface [${PT_SURFACE_FIELDS}] nor corpus [${PT_CORPUS_FIELDS}] nor filter [${PT_FILTER_FIELDS}]. It would enter neither hash silently. Classify it in contract-hash.mjs — surface if it alters what a conforming implementation may emit or must accept, corpus otherwise — in the same commit that introduced it.`);
}

// Both surfaces, by iterating SURFACES rather than repeating the block: a third surface is
// covered the moment it is registered. Until API-020-ST this section defaulted to `resident`
// and never asserted the management lock at all — a lock nothing executes is a file that
// happens to contain a hash.
for (const surface of Object.keys(SURFACES)) {
  const surfaceLock = readJson(SURFACES[surface].lock);
  const recomputedSurface = surfaceHash(surface);
  const recomputedCorpus = corpusHash(surface);
  if (surfaceLock.surfaceHash !== recomputedSurface) {
    fail('contract-lock-surface-hash', `${surface}/contract-lock.json`,
      `surfaceHash is ${recomputedSurface} but the lock records ${surfaceLock.surfaceHash}. The contract SURFACE changed — what a conforming implementation may emit or must accept — so the version must move with it. Regenerate the lock in the same commit as the bump.`);
  }
  if (surfaceLock.corpusHash !== recomputedCorpus) {
    fail('contract-lock-corpus-hash', `${surface}/contract-lock.json`,
      `corpusHash is ${recomputedCorpus} but the lock records ${surfaceLock.corpusHash}. Corpus content changed without the lock being updated. This does NOT require a version bump; regenerate the lock alone.`);
  }
  if (surfaceLock.contractVersion !== authoredVersion(surface)) {
    fail('contract-lock-version', `${surface}/contract-lock.json`,
      `lock records ${surfaceLock.contractVersion}, openapi.yaml declares ${authoredVersion(surface)}.`);
  }
  console.log(`contract-lock ............... ${surface}: v${surfaceLock.contractVersion}  surface ${surfaceLock.surfaceHash.slice(7, 21)}  corpus ${surfaceLock.corpusHash.slice(7, 21)}`);
}

// ------------------------------------- 11. corpus cross-checks (API-020-ST)
//
// GEN-018-ST's diagnosis, and the reason these three belong together: a corpus records
// ANSWERS without recording the RELATIONSHIPS between them. Each defect these catch was
// two assertions with nothing comparing them. Relationships are what a validator can check
// for free, and none of these needs a server.

// --- 2.1 Shared entities carry identical identifiers across corpora.
//
// The seeded world is the source of truth for "shared": an identifier is shared if the seed
// defines it. That makes the check derivable rather than a hand-maintained list. The seed is
// READ ONLY here and stays so.
const SEED_DIR = path.join(ROOT, 'database/seeds');
const seedIds = new Set();
if (fs.existsSync(SEED_DIR)) {
  const walkSeed = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkSeed(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of walkSeed(SEED_DIR).filter((f) => f.endsWith('.sql'))) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/'([a-z]+_[a-z0-9_]+)'/g)) seedIds.add(m[1]);
  }
}

/** Every {kind,id} node any fixture carries, per corpus. */
const collectScopeRefs = (dir) => {
  const found = [];
  const walk = (n, where) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach((v) => walk(v, where));
    if (typeof n.kind === 'string' && typeof n.id === 'string') found.push({ ...n, where });
    Object.values(n).forEach((v) => walk(v, where));
  };
  if (!fs.existsSync(dir)) return found;
  for (const d of fs.readdirSync(dir, { withFileTypes: true }).filter((x) => x.isDirectory())) {
    for (const f of fs.readdirSync(path.join(dir, d.name)).filter((f) => f.endsWith('.json'))) {
      walk(readJson(path.join(dir, d.name, f)), `${path.basename(dir)}/${d.name}/${f}`);
    }
  }
  return found;
};

const HIERARCHY = new Set(['organization', 'portfolio', 'estate', 'phase', 'building', 'floor', 'unit', 'location']);
const SYNTHETIC = new Set(['loc_unmapped']); // ADR-006 C4: belongs to no node BY DESIGN

if (seedIds.size > 0) {
  for (const ref of collectScopeRefs(MGMT_FIXTURES)) {
    if (!HIERARCHY.has(ref.kind) || SYNTHETIC.has(ref.id)) continue;
    if (!seedIds.has(ref.id)) {
      fail('shared-identifier', ref.where,
        `${ref.kind} "${ref.id}" is not defined in database/seeds. A corpus describing the same physical world must use the same identifiers, or a query written against one finds nothing in the other.`);
    }
  }
  // resident unitIds are hierarchy identifiers too
  for (const entry of manifest.fixtures.filter((f) => f.file)) {
    const body = readJson(path.join(FIXTURES, entry.file));
    for (const id of JSON.stringify(body).matchAll(/"unitId":\s*"([^"]+)"/g)) {
      if (!seedIds.has(id[1])) {
        fail('shared-identifier', entry.file, `unitId "${id[1]}" is not defined in database/seeds.`);
      }
    }
  }
  console.log(`Shared identifiers .......... checked against ${seedIds.size} seeded identifiers`);
} else {
  console.log('Shared identifiers .......... SKIPPED — database/seeds not present');
}

// --- 2.2 A value carried beside its stated derivation must follow from it.
//
// A response carrying both a value AND the rule that produced it makes two assertions. If
// nothing compares them, one is decoration.
//
// THE THIRD ARM ASSERTS ITS OWN PRECONDITION. Until API-020-ST Step 5 this section noted,
// as a comment, that getOverview carries no per-unit array and therefore could not replay
// the basis — and then PASSED. A check that passes when it cannot evaluate is
// indistinguishable from a check that evaluated and agreed, so the gap was invisible while
// looking maintained. It now goes RED, naming the inputs it lacks.
//
// This is deliberately a failing check, not a skipped one. units-unknown-state is
// estate-wide and the per-unit states it derives from are ABSENT FROM THE CONTRACT, not
// merely absent from a fixture: an empty input set is a degenerate case, an absent one is
// not a case at all. The honest state is a visible open gap until the contract carries the
// inputs (`deduplicatedByUnit` states THAT dedup happens and never how it RESOLVES).
//
// It self-heals: the moment a fixture carries the input set, the branch below replays the
// derivation for real instead of failing.
const derivedQuantities = new Map();
for (const entry of mgmtManifest.fixtures.filter((f) => f.file)) {
  const body = readJson(path.join(MGMT_FIXTURES, entry.file));
  const where = `management-web/${entry.file}`;

  for (const c of body.counters ?? []) {
    if (c.key === 'units-unknown-state') {
      if (!c.basis) {
        fail('derivation-missing', where, 'units-unknown-state carries a value with no declared basis. The figure asserts a derivation nobody can check.');
      } else {
        for (const sev of c.basis.includesSeverities ?? []) {
          if (!canonical.includes(sev)) {
            fail('derivation-basis', where, `basis names severity "${sev}", which is not in the canonical enumeration`);
          }
        }
        if (typeof c.basis.deduplicatedByUnit !== 'boolean') {
          fail('derivation-basis', where, 'basis omits deduplicatedByUnit, so the double-counting question the figure raises is unanswered');
        }

        // The inputs the basis names, if the response ever carries them: a per-unit state
        // set over which includesSeverities can actually be counted.
        const unitStates = body.unitStates ?? body.units ?? null;
        if (!Array.isArray(unitStates)) {
          fail('derivation-unevaluable', where,
            `units-unknown-state declares ${c.value} over includesSeverities ` +
            `[${(c.basis.includesSeverities ?? []).join(', ')}] with deduplicatedByUnit=${c.basis.deduplicatedByUnit}, ` +
            'but NO per-unit state set is present to count over. The value cannot be checked against its own ' +
            'stated derivation — by any fixture, for any value. Missing: a per-unit state array (unitStates) ' +
            'carrying, for every unit in scope, the severity that governs it. Until the contract carries one, ' +
            'this figure is an assertion nothing can evaluate. Tracked for Version B: it needs the dedup rule\'s ' +
            'RESOLUTION parameter too, which the contract does not state.');
        } else {
          const governing = new Map();
          for (const u of unitStates) governing.set(u.unitId, u.severity);
          const expected = [...governing.values()].filter((sv) => (c.basis.includesSeverities ?? []).includes(sv)).length;
          if (expected !== c.value) {
            fail('derivation-disagreement', where,
              `units-unknown-state declares ${c.value} but replaying its own basis over the per-unit states gives ${expected}.`);
          }
        }
      }
    }
    if (c.key === 'safety-events-window' && typeof c.windowHours === 'number') {
      const k = `safety-events:${c.windowHours}h`;
      if (!derivedQuantities.has(k)) derivedQuantities.set(k, []);
      derivedQuantities.get(k).push({ where, value: c.value });
    }
  }
  if (body.window && typeof body.window.hours === 'number' && entry.state === 'default') {
    const k = `safety-events:${body.window.hours}h`;
    if (!derivedQuantities.has(k)) derivedQuantities.set(k, []);
    derivedQuantities.get(k).push({ where, value: body.window.total });
  }
}
for (const [k, rows] of derivedQuantities) {
  const distinct = [...new Set(rows.map((r) => r.value))];
  if (distinct.length > 1) {
    fail('derivation-disagreement', k,
      `the same derived quantity is stated as ${distinct.join(' and ')} by ${rows.map((r) => r.where).join(' and ')}. Two fixtures describing one world disagree.`);
  }
}

// --- 2.3 A collection's declared counts must agree with the collection.
for (const entry of mgmtManifest.fixtures.filter((f) => f.file)) {
  const body = readJson(path.join(MGMT_FIXTURES, entry.file));
  const where = `management-web/${entry.file}`;
  if (body.window && Array.isArray(body.events)) {
    if (body.window.returned !== body.events.length) {
      fail('declared-count', where,
        `window.returned is ${body.window.returned} but events carries ${body.events.length}. A collection and its own count contradict each other.`);
    }
    if (body.window.returned > body.window.total) {
      fail('declared-count', where, `window.returned ${body.window.returned} exceeds window.total ${body.window.total}`);
    }
  }
  if (body.cases && body.counts && typeof body.counts.all === 'number') {
    if (body.cases.length > body.counts.all) {
      fail('declared-count', where, `cases carries ${body.cases.length} rows but counts.all is ${body.counts.all}`);
    }
  }
}
// --- 2.4 A unit's severities within one window must be coherent under the dedup rule.
//
// Added by API-020-ST Step 5 after I authored BOTH of these defects while fixing F1, and
// the suite went green on both: one unit carrying `warning` and `normal` at once, another
// carrying `critical` and `offline` under deduplicatedByUnit. Neither was visible to any
// check. The class is the same as 2.1-2.3 — an assertion inside the corpus that nothing
// compares — and I had just demonstrated it is authorable by someone paying attention.
//
// WHAT THIS DELIBERATELY DOES NOT ASSERT: a precedence rule. The contract declares
// `deduplicatedByUnit` as a boolean — it says dedup HAPPENS and never how it RESOLVES.
// Asserting latest-wins here would invent that rule and freeze it in a test, which is
// backwards: the rule belongs in the contract as a parameter first. So this checks only
// what is decidable without it.
//
// THE HONEST CONSEQUENCE, measured rather than assumed: of the two defects that motivated
// this check, 2.4 catches the FIRST (normal beside a live condition) and DOES NOT catch
// the SECOND (`critical` and `offline` on one unit at different instants). Verified by
// mutation — it produces no finding. Deciding whether that unit is critical or offline
// REQUIRES the resolution rule, so the second defect stays authorable until the contract
// states one. That is Version B, and it is a product decision, not a test to write.
// Recorded here so this check is not mistaken for covering the class it half covers.
for (const entry of mgmtManifest.fixtures.filter((f) => f.file)) {
  const body = readJson(path.join(MGMT_FIXTURES, entry.file));
  const where = `management-web/${entry.file}`;
  if (!Array.isArray(body.events)) continue;

  const byUnit = new Map();
  for (const e of body.events) {
    if (e.scope?.node?.kind !== 'unit') continue;
    const id = e.scope.node.id;
    if (!byUnit.has(id)) byUnit.set(id, []);
    byUnit.get(id).push(e);
  }

  for (const [unitId, events] of byUnit) {
    if (events.length < 2) continue;

    // (ii) Dedup must be decidable. Two events for one unit at the SAME instant leave no
    // ordering at all, so no resolution rule of any kind — including one the contract has
    // not yet stated — could pick between them.
    const stamps = events.map((e) => e.occurredAt);
    if (new Set(stamps).size !== stamps.length) {
      fail('dedup-undecidable', where,
        `unit ${unitId} carries two events at the same occurredAt. Deduplication by unit has nothing to order them by, so which severity governs the unit is undecidable by any rule.`);
    }

    // (i) An all-clear is a claim about the whole unit. `normal` beside any other severity
    // asserts the unit is clear while the window itself shows it is not — unless the event
    // is an explicit all-clear that comes AFTER what it clears. A clearance predating the
    // condition is not a resolution; that is causality, not a precedence rule.
    const normals = events.filter((e) => e.severity === 'normal');
    const others = events.filter((e) => e.severity !== 'normal');
    for (const n of normals) {
      if (!others.length) continue;
      if (n.communication !== 'all-clear-sent') {
        fail('severity-incoherent', where,
          `unit ${unitId} is reported \`normal\` in the same window as ${others.map((o) => o.severity).join(', ')}, and the normal event is not an all-clear (communication is "${n.communication}"). The window asserts the unit is clear and not clear at once.`);
        continue;
      }
      const stale = others.filter((o) => o.occurredAt >= n.occurredAt);
      if (stale.length) {
        fail('severity-incoherent', where,
          `unit ${unitId} carries an all-clear at ${n.occurredAt} but ${stale.length} event(s) at or after it (${stale.map((o) => o.severity).join(', ')}). An all-clear cannot clear a condition that is not older than it.`);
      }
    }
  }
}

console.log('Corpus cross-checks ......... shared identifiers, declared derivations, declared counts, unit severity coherence');

// ------------------------------------------- 12. scenario binding (Family 2)
//
// A fixture records an ANSWER. Until this field it did not record WHICH SEEDED WORLD the
// answer came from -- so nothing could tell whether two fixtures describe one world or two.
// That is why a cross-corpus agreement check could not be written: demanding two fixtures
// agree on an event population would be WRONG, not merely unevaluable, when they were
// seeded to describe different worlds.
//
// The binding existed only as a FILENAME CONVENTION plus a prose comment in each generated
// scenario. Both held. Neither was executable, and a convention that has held is not a
// checked fact -- it is a coincidence that has not yet failed. This is G7's shape and takes
// G7's remedy: structured data a test can execute.
//
// THREE values, because two would force a lie:
//   a path   -- bound to that scenario
//   null     -- genuinely needs no seeded world, with the reason stated
//   'pending'-- no scenario EXISTS yet. Not a claim of world-independence; the absence of
//               something to bind to. Kept distinct so a gap cannot pass as an answer.
// An ABSENT field always fails. Same idiom as declared-open-gaps.json: declaring a gap is a
// decision, never a way to quiet a check.
const SCENARIO_DIR = path.join(ROOT, 'database/seeds');
const readIfExists = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
/** The authored base: the six hand-written files, NOT the 46 generated scenarios. */
const authoredBaseSql = fs.existsSync(SCENARIO_DIR)
  ? fs.readdirSync(SCENARIO_DIR).filter((f) => f.endsWith('.sql'))
      .map((f) => fs.readFileSync(path.join(SCENARIO_DIR, f), 'utf8')).join('\n')
  : '';
const scenarioSource = (rel) => {
  const abs = path.join(SCENARIO_DIR, rel);
  if (!fs.existsSync(abs)) return { missing: true };
  const head = fs.readFileSync(abs, 'utf8').slice(0, 400);
  const m = head.match(/from ([A-Za-z0-9\-_/]+\.json)/);
  return { declares: m ? m[1] : null };
};

let boundCount = 0; let noWorldCount = 0; let pendingCount = 0;
for (const [surface, mf, dir] of [['resident', manifest, FIXTURES], ['management', mgmtManifest, MGMT_FIXTURES], ['resident-portal', portalManifest, PORTAL_FIXTURES]]) {
  for (const entry of mf.fixtures.filter((f) => f.file)) {
    const where = `${surface}/${entry.file}`;
    if (!('scenario' in entry)) {
      fail('scenario-binding-absent', where,
        'index.json declares no `scenario`. Every fixture must say which seeded world it describes, or say explicitly that it needs none. An absent binding is not "no world"; it is an unanswered question, and it is what let a filename convention stand in for a checked fact.');
      continue;
    }
    const v = entry.scenario;
    if (v === null) {
      noWorldCount += 1;
      if (!entry.noScenarioReason) {
        fail('scenario-binding-unreasoned', where,
          'scenario is null but no noScenarioReason is given. Declaring a fixture world-independent is a claim, and a claim with no stated reason cannot be reviewed.');
      }
      continue;
    }
    if (v === 'pending') {
      pendingCount += 1;
      if (!entry.scenarioPending) {
        fail('scenario-binding-unreasoned', where, 'scenario is "pending" but no scenarioPending note is given.');
      }
      continue;
    }
    boundCount += 1;
    const src = scenarioSource(v);
    if (src.missing) {
      fail('scenario-binding-missing', where, `binds to ${v}, which does not exist under database/seeds.`);
      continue;
    }
    // THE ROUND TRIP: the scenario must name THIS fixture as its source. This is what turns
    // the convention into a checked fact -- it compares CONTENT, not names. Behavioural
    // scenarios declare no source by design (the fixture is a Problem body and the state is
    // constructed), and are exempted only when index.json says so explicitly.
    if (src.declares === null) {
      if (entry.scenarioKind !== 'behavioural') {
        fail('scenario-binding-unverified', where,
          `${v} names no source fixture in its header, so the binding rests on the filename alone. If the state is constructed rather than transcribed, declare scenarioKind: "behavioural" and the exemption becomes visible instead of assumed.`);
      }
    } else if (src.declares !== entry.file) {
      fail('scenario-binding-mismatch', where,
        `index.json binds this fixture to ${v}, but that scenario declares it was generated from ${src.declares}. Two artifacts disagree about which world this fixture describes. This is a finding, not a rename.`);
    }

    // CONTENT, not provenance: every entity the fixture names must exist in the world its
    // binding selects. A scenario is a DELTA on the authored base, never a whole world --
    // checking it alone flags 12 fixtures whose units and residents are seeded in
    // 30-residents-households.sql, which is a defect in the check, not the corpus.
    // Both surfaces. This was resident-only when written, for the honest reason that no
    // management scenario existed -- which is exactly the shape that left the management
    // contract-lock unasserted for two PIDs: a mechanism written when one case existed,
    // silently excluding the one that arrived later. Extended the moment the second case
    // landed rather than when someone noticed.
    {
      const world = authoredBaseSql + readIfExists(path.join(SCENARIO_DIR, v));
      const named = new Set([...JSON.stringify(readJson(path.join(dir, entry.file)))
        .matchAll(/"(?:eventId|unitId|residentId|householdId)":\s*"([^"]+)"/g)].map((m) => m[1]));
      const absent = [...named].filter((id) => !world.includes(id));
      if (absent.length) {
        fail('scenario-binding-unbacked', where,
          `names ${absent.join(', ')}, which the authored base seeds and ${v} together do not define. The fixture describes an entity its own declared world does not contain.`);
      }
    }
  }
}

// --- shared worlds. A shared world and an accidental duplicate are INDISTINGUISHABLE
// without a declaration, which is why this is a second field rather than a judgement.
// API-025-ST found six groups of fixtures resolving to byte-identical seeded worlds; three
// are correct (language is a REQUEST parameter, not world state) and three claim distinct
// states while a test asserting one would receive the other.
//
// Grouped by the scenario BODY with comments stripped, not by filename: the six pairs are
// six DIFFERENT files whose SQL is identical, so nothing about their names reveals it.
const worldGroups = new Map();
for (const entry of manifest.fixtures.filter((f) => f.file)) {
  const v = entry.scenario;
  if (!v || v === 'pending') continue;
  const abs = path.join(SCENARIO_DIR, v);
  if (!fs.existsSync(abs)) continue;
  const body = fs.readFileSync(abs, 'utf8').split('\n').filter((l) => !l.startsWith('--')).join('\n').trim();
  const k = crypto.createHash('sha256').update(body).digest('hex');
  if (!worldGroups.has(k)) worldGroups.set(k, []);
  worldGroups.get(k).push(entry);
}
let unadjudicated = 0;
for (const group of worldGroups.values()) {
  if (group.length < 2) continue;
  const names = group.map((e) => e.file).sort();
  for (const entry of group) {
    const where = `resident/${entry.file}`;
    const expected = names.filter((n) => n !== entry.file);
    if (!Array.isArray(entry.sharesWorldWith)) {
      fail('shared-world-undeclared', where,
        `resolves to a seeded world byte-identical to ${expected.join(', ')}, and does not declare it. A shared world and an accidental duplicate look the same from here; if the sameness is intended it must be stated, and if it is not, a test asserting this fixture's state receives another's.`);
      continue;
    }
    if (JSON.stringify([...entry.sharesWorldWith].sort()) !== JSON.stringify(expected)) {
      fail('shared-world-mismatch', where,
        `declares it shares a world with ${entry.sharesWorldWith.join(', ')}, but the scenario bodies say ${expected.join(', ')}. The declaration and the SQL disagree.`);
    }
    if (!['intended', 'unadjudicated'].includes(entry.sharedWorldStatus)) {
      fail('shared-world-unstatused', where, 'sharedWorldStatus must be "intended" or "unadjudicated". A third state is not a default; it is an unanswered question.');
    }
    if (!entry.sharedWorldReason) {
      fail('shared-world-unreasoned', where, 'a shared world is a claim and needs a stated reason.');
    }
    if (entry.sharedWorldStatus === 'unadjudicated') unadjudicated += 1;
  }
}
// THE CONVERSE, and it was silent until API-025-ST tested for it: the loop above validates
// only WITHIN a group, so when a group DISSOLVES -- the scenarios stop being identical --
// both fixtures keep asserting a shared world that no longer exists and nothing fires.
// Proven silent on an `intended` pair, where no count moves to betray it. That is the timing
// trap: the declarations were true when written and nothing re-examines them.
const grouped = new Set();
for (const g of worldGroups.values()) if (g.length > 1) for (const e of g) grouped.add(e.file);
for (const entry of manifest.fixtures.filter((f) => f.file)) {
  if (entry.sharesWorldWith && !grouped.has(entry.file)) {
    fail('shared-world-stale', `resident/${entry.file}`,
      `declares it shares a seeded world with ${entry.sharesWorldWith.join(', ')}, but no other fixture resolves to the same scenario body any more. The declaration was true when written and is not now; a claim nothing re-examines is not a claim.`);
  }
}

// Same discipline as EXPECTED_PENDING: the open question is COUNTED, so it cannot grow while
// nobody is looking, and closing one forces the expectation down in the same commit.
const EXPECTED_UNADJUDICATED = 4;
if (unadjudicated !== EXPECTED_UNADJUDICATED) {
  fail('shared-world-unadjudicated-count', 'resident-mobile/index.json',
    `${unadjudicated} fixtures declare sharedWorldStatus "unadjudicated"; ${EXPECTED_UNADJUDICATED} were open when this was written. GEN-018-ST authored the generator and is the only party that can settle them.`);
}
console.log(`Shared worlds ............... ${[...worldGroups.values()].filter((g) => g.length > 1).length} groups, ${unadjudicated} fixtures awaiting adjudication`);

// No silent growth: the pending set is the SIZE OF THE PROBLEM, so it is asserted rather
// than merely printed. A 27th unbound management fixture must not slip in unnoticed.
const EXPECTED_PENDING = 34;  // 22 management + 12 resident-portal (overlay-on-WFG, API-027-ST)
if (pendingCount !== EXPECTED_PENDING) {
  fail('scenario-binding-pending-count', 'management-web/index.json',
    `${pendingCount} fixtures declare scenario "pending"; ${EXPECTED_PENDING} were declared when this was written. If it grew, a fixture was added with no seeded world. If it shrank, update the expectation in the same commit that binds them.`);
}
console.log(`Scenario binding ............ ${boundCount} bound, ${noWorldCount} world-independent, ${pendingCount} pending`);

// ------------------------------------------- 13. orphan events (seed-first rule)
//
// The world is PERMITTED to be larger than the corpus: scenario-binding-unbacked asserts
// fixture-ids SUBSET-OF world and deliberately not the converse. That asymmetry is what
// makes the seed-first coordination rule work -- extra events land green, then the fixture
// half names them. It is not a concession invented for that rule: the corpus ALREADY
// depends on it, because two behavioural scenarios construct events their Problem-body
// fixtures cannot name.
//
// But green-because-permitted is indistinguishable from green-because-abandoned. So the
// orphan set is declared EXACTLY. Undeclared orphan -> fail. DECLARED orphan that does not
// exist -> fail just as hard, which is the arm that stops an expectation being nudged to
// match reality after the fact.
const orphanDecl = readJson(path.join(ROOT, 'tests/fixtures/declared-orphan-events.json'));
const seededEvents = new Set();
const walkSeeds = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walkSeeds(path.join(d, e.name)) : [path.join(d, e.name)]);
if (fs.existsSync(SCENARIO_DIR)) {
  for (const f of walkSeeds(SCENARIO_DIR).filter((f) => f.endsWith('.sql'))) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/'(evt_[a-z0-9_]+)'/g)) seededEvents.add(m[1]);
  }
}
const namedEvents = new Set();
for (const [mf, dir] of [[manifest, FIXTURES], [mgmtManifest, MGMT_FIXTURES]]) {
  for (const entry of mf.fixtures.filter((f) => f.file)) {
    for (const m of JSON.stringify(readJson(path.join(dir, entry.file))).matchAll(/"(evt_[a-z0-9_]+)"/g)) {
      namedEvents.add(m[1]);
    }
  }
}
const observedOrphans = [...seededEvents].filter((e) => !namedEvents.has(e)).sort();
// PERMANENT entries are EXACT in both directions: undeclared orphan fails, and a declared
// one that is not an orphan fails just as hard. That is the arm that stops an expectation
// being nudged to match reality after the fact.
const permanentIds = orphanDecl.permanent.map((o) => o.eventId);
for (const e of observedOrphans) {
  const inTransition = orphanDecl.transitions.some((t) => (t.eventIds ?? []).includes(e));
  if (!permanentIds.includes(e) && !inTransition) {
    fail('orphan-event-undeclared', 'declared-orphan-events.json',
      `${e} is seeded and named by no fixture, and is declared neither permanent nor in transition. Either a seed half landed without being declared IN ADVANCE, or a fixture stopped naming an event nobody noticed.`);
  }
}
for (const e of permanentIds) {
  if (!observedOrphans.includes(e)) {
    fail('orphan-event-absent', 'declared-orphan-events.json',
      `${e} is declared a PERMANENT orphan but is not one: it is either absent from the seed or now named by a fixture. A declaration that has become false is how an expectation gets quietly nudged -- remove the entry in the same commit that makes it false.`);
  }
}

// TRANSITIONS are deliberately tolerated in BOTH pre-landing states, which is what keeps
// seed-first green at both ends: declared-but-not-yet-seeded, and seeded-but-not-yet-named.
// Exact equality here would make DECLARING IN ADVANCE red until the seed arrives, moving
// the red window earlier instead of removing it. Found by running the lifecycle end to end
// rather than by reasoning about it.
//
// The tolerance is one-sided and SELF-CLOSING: once a fixture names the id the transition
// is complete, and leaving the entry behind fails. So a transition cannot become permanent
// scaffolding, and every open one is printed on every run.
for (const t of orphanDecl.transitions) {
  for (const f of ['landing', 'seedBy', 'fixtureBy']) {
    if (!t[f]) {
      fail('orphan-transition-unreasoned', 'declared-orphan-events.json',
        `a transition declares eventIds ${(t.eventIds ?? []).join(', ')} without "${f}". A transition tolerated in two states must say what it is and who lands each half, or it is a permanent exemption wearing a temporary name.`);
    }
  }
  for (const e of t.eventIds ?? []) {
    if (namedEvents.has(e)) {
      fail('orphan-transition-complete', 'declared-orphan-events.json',
        `${e} is now named by a fixture, so the transition "${t.landing}" is COMPLETE. Remove the entry in the same commit that lands the fixture half; a closed transition left declared is scaffolding nobody will take down.`);
    }
  }
}
const inFlight = orphanDecl.transitions.filter((t) => (t.eventIds ?? []).some((e) => seededEvents.has(e)));
const awaiting = orphanDecl.transitions.length - inFlight.length;
console.log(`Orphan events ............... ${observedOrphans.length} seeded and unnamed: ${orphanDecl.permanent.length} permanent, ${inFlight.length} in flight, ${awaiting} awaiting seed`);

// ------------------------------------------------------------------- report
//
// A run passes IF AND ONLY IF the observed failure set equals the DECLARED set, exactly.
// Standing ruling, API-020-ST: not "at least these", not "some failures". A MISSING
// expected failure is as much a finding as an unexpected one — it means a gap closed
// silently or a check stopped running.
//
// This exists because a suite expected to be red is one where a third failure hides among
// two, and where every downstream session learns to glance at red and move on. Remembered
// discipline decays; this does not. It is the converse of the rule that a correctly-silent
// mutation must be reported, because silence reads as a miss.
const declaredGaps = readJson(path.join(ROOT, 'tests/fixtures/declared-open-gaps.json'));
const key = (c, w) => `${c} @ ${w}`;
const declaredSet = new Map(declaredGaps.gaps.map((g) => [key(g.check, g.where), g]));
const observedSet = new Map(failures.map((f) => [key(f.check, f.where), f]));

const unexpected = [...observedSet.entries()].filter(([k]) => !declaredSet.has(k));
const missing = [...declaredSet.entries()].filter(([k]) => !observedSet.has(k));

if (unexpected.length === 0 && missing.length === 0) {
  if (declaredSet.size === 0) {
    console.log('PASS — contract, severity set, denylist and fixtures agree.');
  } else {
    console.log(`PASS — failure set equals the declared set exactly (${declaredSet.size} declared open gap(s)):`);
    for (const g of declaredGaps.gaps) console.log(`  [${g.check}] ${g.where}\n      OPEN BY DECLARATION — ${g.closedBy}`);
  }
  console.log('This proves internal consistency only. It is not proof of a working backend or a working app.');
  process.exit(0);
}

console.log('FAIL — the failure set does not equal the declared set.\n');
if (unexpected.length) {
  console.log(`UNEXPECTED (${unexpected.length}) — not declared as open:`);
  for (const [, f] of unexpected) console.log(`  [${f.check}] ${f.where}\n      ${f.detail}`);
}
if (missing.length) {
  console.log(`\nMISSING (${missing.length}) — declared open but DID NOT FIRE.`);
  console.log('  A gap closed silently, or the check that reports it stopped running. Either way the');
  console.log('  declaration is now false and must be removed or investigated — not left standing.');
  for (const [, g] of missing) console.log(`  [${g.check}] ${g.where}\n      declared because: ${g.why}`);
}
process.exit(1);
