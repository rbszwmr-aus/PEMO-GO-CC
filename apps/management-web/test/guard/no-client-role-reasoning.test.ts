/**
 * THE CLIENT MUST NOT REASON ABOUT A ROLE — asserted, not intended.
 *
 * UI-004's overview ruling: role-gating requires naming a role, and anything a
 * viewer may not see is ABSENT FROM THE PAYLOAD rather than hidden client-side.
 * ADR-010's role list is an open product decision, so a client that branched on a
 * role would be inventing the authority spine the project has not decided.
 *
 * The readout measured this surface at zero role reasoning and zero credential
 * storage. This test is what keeps it at zero: part 2 adds controls behind the
 * server's PERMITTED ACTIONS, and the difference between "the server said you may"
 * and "the client decided you are an approver" is the whole point.
 *
 * THE VOCABULARY IS DERIVED FROM THE CONTRACT, NEVER LISTED HERE. A hand-list
 * would go stale the moment ADR-010 is decided and the enum widens — and it would
 * go stale silently, which is the failure this project keeps finding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const APP = join(HERE, '..', '..');
const SRC = join(APP, 'src');
const CONTRACT = join(APP, '..', '..', 'packages', 'api-contracts', 'management-web', 'openapi.yaml');

/** The role enum, read out of the contract's ConferGrantRequest. */
function contractRoles(): string[] {
  const yaml = readFileSync(CONTRACT, 'utf8');
  const at = yaml.indexOf('ConferGrantRequest:');
  assert.ok(at > 0, 'ConferGrantRequest is not in the contract — this test cannot derive its vocabulary');
  const window = yaml.slice(at, at + 4000);
  const m = window.match(/enum:\s*\[([^\]]+)\]/);
  assert.ok(m, 'no role enum found under ConferGrantRequest');
  return (m[1] as string).split(',').map((s) => s.trim()).filter(Boolean);
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...sourceFiles(p));
    else if (/\.tsx?$/.test(e) && !/\.g\.ts$/.test(e)) out.push(p);
  }
  return out;
}

/** Source with comments stripped — a role NAMED in prose is documentation, not a branch. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('the role vocabulary is derived, and it is not empty', () => {
  const roles = contractRoles();
  assert.ok(roles.length >= 4, `only ${roles.length} roles derived — the extractor is measuring nothing`);
  assert.ok(roles.includes('approver'), 'the derived vocabulary does not contain approver');
});

/**
 * URL-KEY ALLOWLIST — the only way a role-spelled literal may appear in src.
 *
 * Each entry names ONE file and the EXACT source text that carries the literal.
 * That text is removed before the scan, so any other occurrence of the literal —
 * in the same file or elsewhere — still fails. A stale entry fails too: the
 * precision test below requires every entry's text to appear exactly once in its
 * file and its literal to still be a contract role (otherwise the entry is dead).
 *
 * Kept small on purpose, and asserted to stay so: this is a register of URL keys
 * that happen to spell a role, not a way to let role reasoning in.
 */
const URL_KEY_ALLOWLIST: ReadonlyArray<{ file: string; literal: string; text: string; reason: string }> = [
  {
    file: 'src/shell/resident-param.ts',
    literal: 'resident',
    text: "export const RESIDENT_ID_LEGACY_ALIAS = 'resident';",
    reason:
      'legacy READ-ONLY URL alias for residentId (links minted before 69b4fcc used ?resident=). ' +
      'readResidentId reads it only when residentId is absent; writeResidentId never emits it. ' +
      'A URL key, not a role: nothing compares against or branches on it.',
  },
];

function allowlistedCode(file: string): string {
  const rel = file.slice(APP.length + 1);
  let body = code(file);
  for (const entry of URL_KEY_ALLOWLIST) {
    if (entry.file === rel) body = body.split(entry.text).join('');
  }
  return body;
}

test('the URL-key allowlist is precise — file-scoped, exact, live, and small', () => {
  const roles = contractRoles();
  assert.ok(URL_KEY_ALLOWLIST.length <= 3, `the URL-key allowlist has grown to ${URL_KEY_ALLOWLIST.length}`);
  for (const entry of URL_KEY_ALLOWLIST) {
    assert.ok(roles.includes(entry.literal), `${entry.file}: "${entry.literal}" is no longer a contract role — drop the entry`);
    assert.ok(entry.text.includes(`'${entry.literal}'`), `${entry.file}: the allowlisted text does not carry '${entry.literal}'`);
    assert.ok(entry.reason.length >= 40, `${entry.file}: say why "${entry.literal}" is allowed`);
    const src = code(join(APP, entry.file));
    const hits = src.split(entry.text).length - 1;
    assert.equal(hits, 1, `${entry.file}: allowlisted text must appear exactly once (found ${hits}) — stale or widened entry`);
  }
});

test('NO client source compares against a role name', () => {
  const roles = contractRoles();
  const offences: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const body = allowlistedCode(file);
    for (const role of roles) {
      // A STRING LITERAL equal to the role, which is the only shape a comparison
      // or a lookup key can take. Anchored to the quotes on purpose: `resident`
      // occurs inside residentId and in prose, and an unanchored substring search
      // would report those and be ignored within a week.
      const re = new RegExp(`(['"\`])${role}\\1`);
      if (re.test(body)) offences.push(`${file.slice(APP.length + 1)} carries the role literal "${role}"`);
    }
  }
  assert.deepEqual(offences, [], `the client is reasoning about roles:\n  ${offences.join('\n  ')}`);
});

test('no client source reads a role off a payload', () => {
  const offences: string[] = [];
  for (const file of sourceFiles(SRC)) {
    const body = code(file);
    // `.role` as a property READ on anything. The corpus does carry a `role` on a
    // household member and a delivery recipient — those are RELATIONSHIPS
    // (owner-occupier, caregiver), rendered as LocalizedText, and they are read
    // through the typed field rather than branched on. Any comparison is caught by
    // the literal test above; this one catches an authorization-shaped read.
    for (const m of body.matchAll(/\.role\s*(===|!==|==|!=)/g)) {
      offences.push(`${file.slice(APP.length + 1)} compares a .role field (${m[0].trim()})`);
    }
  }
  assert.deepEqual(offences, [], `a role field is being compared:\n  ${offences.join('\n  ')}`);
});

test('no credential or identity is stored client-side', () => {
  const offences: string[] = [];
  // ONE documented exception: the lookup-list fixture keeps its edits in localStorage so a trial user sees
  // them after a reload. That file may use localStorage and nothing else, under one key, and may not mention
  // credentials. Every other file stays banned.
  const LOOKUP_STORE = join('src', 'lookups', 'lookup-storage.ts');
  for (const file of sourceFiles(SRC)) {
    const body = code(file);
    const rel = file.slice(APP.length + 1);
    const allowed = rel === LOOKUP_STORE;
    for (const api of ['localStorage', 'sessionStorage', 'document.cookie', 'indexedDB']) {
      if (body.includes(api) && !(allowed && api === 'localStorage')) offences.push(`${rel} uses ${api}`);
    }
    if (allowed) {
      if (/token|credential|password|secret|bearer|session/i.test(body)) offences.push(`${rel} mentions a credential word`);
      if (!/pemo\.lookups\.v\d+/.test(body)) offences.push(`${rel} lost its single namespaced key`);
    }
  }
  assert.deepEqual(offences, [], `client-side storage appeared:\n  ${offences.join('\n  ')}`);
});
