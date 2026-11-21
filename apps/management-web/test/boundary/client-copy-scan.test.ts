/**
 * THE BOUNDARY SCAN OVER CLIENT-AUTHORED COPY.
 *
 * UI-007-ST found this the hard way: its boundary scan covered response fields
 * and not the strings the client itself writes. The contract's own scan proves
 * the corpus is clean; nothing proved that about the copy this app adds on top.
 *
 * THE LIST MATTERS, AND IT IS NOT THE RESIDENT ONE.
 *
 * The management boundary INVERTS the resident boundary rather than relaxing it.
 * Estate staff MUST see device and location references — dispatching somebody to
 * a fault requires naming the faulty thing — so `sourceDeviceRef` is permitted
 * here and forbidden there. What is forbidden here is the tier below: how the
 * message travelled. Loading the wrong list would change strictness in BOTH
 * directions and nothing else would notice, so it is asserted.
 *
 * WHAT IS AND IS NOT IN SCOPE.
 *
 * In scope: every string literal this app authors. Comments are stripped first —
 * a comment cannot reach a screen, and these files discuss the forbidden terms
 * by name in order to explain the rule.
 *
 * Out of scope: strings the SERVER sends. `problems/restricted-projection.json`
 * says "Raw payloads and correlation traces are available to integration support
 * only" — that is the contract's own copy, covered by the contract's own scan,
 * and it is not this app's to reword.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT, MGMT_CONTRACT_DIR, REPO_ROOT } from '../../tool/corpus-source.ts';

const MGMT = JSON.parse(readFileSync(join(MGMT_CONTRACT_DIR, 'forbidden-terms.json'), 'utf8'));

/* ------------------------------------------------- the guard on the guard */

test('the scan loaded the MANAGEMENT list, not the resident one', () => {
  assert.equal(MGMT.surface, 'management', 'this is not the management denylist');
  assert.match(MGMT.$id, /management-web/);

  // Asserted in both directions, because the lists differ by inversion rather
  // than by strictness and either mistake is silent.
  const permittedHere = MGMT.allowedExceptions.map((e: { term: string }) => e.term);
  assert.ok(permittedHere.includes('sourcedeviceref'),
    'the management list does not permit sourceDeviceRef — this looks like the resident list');

  const resident = JSON.parse(
    readFileSync(join(REPO_ROOT, 'packages/api-contracts/resident-mobile/forbidden-terms.json'), 'utf8'),
  );
  const residentTerms = JSON.stringify(resident).toLowerCase();
  assert.ok(residentTerms.includes('deviceid') || residentTerms.includes('sourcedeviceref'),
    'the resident list no longer forbids device references; the inversion this scan assumes has changed');
});

test('the denylist is non-empty and recognisable — an empty oracle agrees with everything', () => {
  const groups = Object.values(MGMT.forbiddenPropertyNames) as Array<{ terms: string[] }>;
  const all = groups.flatMap((g) => g.terms);
  assert.ok(all.length >= 60, `only ${all.length} terms loaded; the denylist did not parse`);
  assert.ok(all.includes('rawpayload'));
  assert.ok(all.includes('receivedat'));
  assert.ok(all.includes('idempotencykey'));
});

/* ------------------------------------------------------ gathering the copy */

const SCANNED = ['src'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.g\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

/** Remove comments so documentation of the rule is not mistaken for a breach. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/** Every string literal the app authors, with its file and line. */
function clientStrings(): Array<{ file: string; line: number; text: string }> {
  const out: Array<{ file: string; line: number; text: string }> = [];
  for (const dir of SCANNED) {
    for (const file of walk(join(APP_ROOT, dir))) {
      const rel = relative(APP_ROOT, file);
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`/g)) {
        const text = m[1] ?? m[2] ?? m[3] ?? '';
        if (text.trim().length === 0) continue;
        out.push({ file: rel, line: src.slice(0, m.index).split('\n').length, text });
      }
    }
  }
  return out;
}

/**
 * A term matcher that does not produce nonsense.
 *
 * Normalising prose to letters and matching substrings is how a scan invents
 * findings: "you omit" normalises to "youomit", which contains "uom". So each
 * term is matched on word boundaries, allowing the separators a compound term
 * would really appear with — `rawPayload`, `raw payload`, `raw_payload`.
 */
function matcherFor(term: string): RegExp {
  const compounds: Record<string, string> = {
    rawpayload: 'raw', sourcepayload: 'source', originalpayload: 'original',
    payloadraw: 'payload', rawmessage: 'raw', rawbody: 'raw', framepayload: 'frame',
    idempotencykey: 'idempotency', messageid: 'message', sourcemessageid: 'source message',
    receivedat: 'received', duplicatecount: 'duplicate', duplicatedeliveries: 'duplicate',
    deliveryattempt: 'delivery', attemptnumber: 'attempt', correlationtrace: 'correlation',
    causationid: 'causation', deadletter: 'dead', quarantinepayload: 'quarantine',
    transportdelta: 'transport', transportlatency: 'transport', ingestlatency: 'ingest',
    sensorreading: 'sensor', sensorvalue: 'sensor', measuredvalue: 'measured',
    rawvalue: 'raw', unitofmeasure: 'unit of measure', engineeringunits: 'engineering',
    firmwareversion: 'firmware', devicemodel: 'device', pointname: 'point',
    registeraddress: 'register', supersededby: 'superseded', supersessionchain: 'supersession',
    replaywindow: 'replay', replayon: 'replay',
  };
  if (term in compounds) {
    const parts = term.split(/(?<=^.{0,40})/); // placeholder, replaced below
    void parts;
  }
  // Build from the known split when we have one, else treat as a single word.
  const known = compounds[term];
  if (known) {
    const head = known.replace(/\s+/g, '[\\s_-]*');
    const tail = term.slice(known.replace(/\s+/g, '').length);
    return new RegExp(`\\b${head}[\\s_-]*${tail}\\b`, 'i');
  }
  return new RegExp(`\\b${term}\\b`, 'i');
}

/**
 * CONTRACT VOCABULARY IS NOT COPY.
 *
 * The first run of this scan flagged three strings for containing "credential":
 * the problem-type URI `https://pemo.local/problems/invalid-credential`, the
 * corpus path `problems/invalid-credential.json`, and the state id
 * `invalid-credential`. None is a secret and none is shown to anybody — they are
 * the contract's own names for one of its seven problem types, which this client
 * must be able to refer to in order to render it.
 *
 * Worth stating plainly: the CONTRACT'S OWN REGISTRY would trip its own denylist
 * under a substring rule. That is a property of the scanner, not a breach.
 *
 * The exemption is DERIVED FROM THE CONTRACT AND THE CORPUS — the problem-type
 * enum, the manifest's file paths, and the state ids declared beside them. It is
 * not a hand-kept list, so it cannot be widened to hide real copy: a string is
 * exempt only if the contract itself already contains it.
 */
function contractVocabulary(): Set<string> {
  const vocab = new Set<string>();

  const openapi = readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8');
  for (const m of openapi.matchAll(/https:\/\/pemo\.local\/problems\/[a-z-]+/g)) {
    vocab.add(m[0]);
    vocab.add(m[0].split('/').pop() as string);
  }
  // The contract's PARAMETER names — a header the contract requires the client
  // to send is the contract's own name for it, exactly as a problem type is.
  // Widened at UI-051, when the write surface had to send `Idempotency-Key`:
  // still derived (only what `components.parameters` declares), never hand-kept.
  for (const m of openapi.matchAll(/^ {6}name: ([A-Za-z][A-Za-z-]+)$/gm)) {
    vocab.add(m[1] as string);
  }

  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, 'tests/fixtures/management-web/index.json'), 'utf8'),
  ) as { fixtures: Array<{ file: string | null; state: string }> };
  for (const f of manifest.fixtures) {
    if (f.file) vocab.add(f.file);
    vocab.add(f.state);
  }
  return vocab;
}

/* ---------------------------------------------------------------- the scan */

test('no client-authored string carries a forbidden term', () => {
  const strings = clientStrings();
  assert.ok(strings.length > 200, `only ${strings.length} strings gathered; the scan is not reaching the copy`);

  const groups = Object.entries(MGMT.forbiddenPropertyNames) as Array<[string, { terms: string[] }]>;
  const permitted = new Set<string>(MGMT.allowedExceptions.map((e: { term: string }) => e.term));

  const vocab = contractVocabulary();
  assert.ok(vocab.size > 25, `contract vocabulary did not load (${vocab.size} entries)`);

  const breaches: string[] = [];
  for (const [group, { terms }] of groups) {
    for (const term of terms) {
      if (permitted.has(term)) continue;
      const re = matcherFor(term);
      for (const s of strings) {
        if (vocab.has(s.text)) continue;   // the contract's own name for a thing
        if (re.test(s.text)) breaches.push(`${s.file}:${s.line} [${group}/${term}] "${s.text.slice(0, 70)}"`);
      }
    }
  }
  assert.deepEqual(breaches, [], `client-authored copy carries forbidden terms:\n  ${breaches.join('\n  ')}`);
});

test('no client-authored string matches a forbidden VALUE pattern', () => {
  const strings = clientStrings();
  const breaches: string[] = [];
  for (const p of MGMT.forbiddenValuePatterns as Array<{ name: string; pattern: string }>) {
    const re = new RegExp(p.pattern);
    for (const s of strings) {
      if (re.test(s.text)) breaches.push(`${s.file}:${s.line} [${p.name}] "${s.text.slice(0, 70)}"`);
    }
  }
  assert.deepEqual(breaches, [], `client copy matches forbidden value patterns:\n  ${breaches.join('\n  ')}`);
});

test('the scan would catch a breach — it is not passing by matching nothing', () => {
  // The check on the check. A scan that cannot fire is indistinguishable from
  // clean copy, which is the defect this whole suite is built around.
  // Both matcher paths are exercised. The first version of this test used only
  // compound terms, so the single-word branch of matcherFor was never covered —
  // found by a mutation that disabled that branch and changed nothing.
  const samples = [
    // compound-term path
    'The idempotency key for this event',
    'Raw payload from the source',
    'Received at 09:42',
    'Sensor reading was 12 ppm',
    // single-word path
    'Telemetry is unavailable',
    'Spoken over modbus',
    'The session cookie',
    'Replay this message',
  ];
  const groups = Object.values(MGMT.forbiddenPropertyNames) as Array<{ terms: string[] }>;
  const terms = groups.flatMap((g) => g.terms);
  for (const sample of samples) {
    const hit = terms.some((t) => matcherFor(t).test(sample));
    assert.ok(hit, `the scan would NOT catch: "${sample}"`);
  }
});

test('the scan does not invent findings from ordinary prose', () => {
  // The counterpart. Normalised substring matching would flag "you omit" for
  // containing "uom"; word-boundary matching must not.
  const innocent = [
    'you omit the second language',
    'Please sign in again to continue',
    'Records kept for 24 months',
    'Source reference',
    'Mapped to unit',
  ];
  const groups = Object.values(MGMT.forbiddenPropertyNames) as Array<{ terms: string[] }>;
  const terms = groups.flatMap((g) => g.terms);
  for (const sample of innocent) {
    const hits = terms.filter((t) => matcherFor(t).test(sample));
    assert.deepEqual(hits, [], `the scan invented a finding in "${sample}": ${hits.join(', ')}`);
  }
});

test('device and location references ARE permitted here — the inversion holds', () => {
  // The management surface must be able to name the faulty thing. If this ever
  // fails, somebody has applied the resident boundary to a staff screen.
  const strings = clientStrings();
  const mentionsSourceRef = strings.some((s) => /source reference/i.test(s.text));
  assert.ok(mentionsSourceRef, 'the copy no longer labels a source reference; the staff surface has lost it');
});

test('the contract-vocabulary exemption is narrow and derived, not a loophole', () => {
  const vocab = contractVocabulary();

  // It contains what it should: the seven problem types by URI and by short name.
  assert.ok(vocab.has('https://pemo.local/problems/invalid-credential'));
  assert.ok(vocab.has('invalid-credential'));
  assert.ok(vocab.has('problems/invalid-credential.json'));

  // And NOT arbitrary prose. If a sentence could be exempted, the exemption
  // would be a hole rather than a rule.
  assert.ok(!vocab.has('The idempotency key for this event'));
  assert.ok(!vocab.has('credential'));
  assert.ok(!vocab.has('Raw payload from the source'));

  // Every entry really is present in the contract or the corpus manifest.
  const openapi = readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8');
  const manifest = readFileSync(join(REPO_ROOT, 'tests/fixtures/management-web/index.json'), 'utf8');
  for (const entry of vocab) {
    assert.ok(
      openapi.includes(entry) || manifest.includes(entry),
      `"${entry}" is exempted but appears in neither the contract nor the corpus manifest`,
    );
  }
});
