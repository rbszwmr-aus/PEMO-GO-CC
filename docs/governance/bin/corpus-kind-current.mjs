#!/usr/bin/env node
// The generated corpus KIND map must equal the derivation, not a hand-edit (GEN-056).
//
// generate-fixtures.mjs derives each corpus group's KIND from its fixture SHAPE — a
// group is a `screen` iff it has a GET operation returning 200 (a data-fetch that
// gives it a state matrix), else `operation-fixture`. This check re-derives the same
// map from the SOURCE corpus and compares it to the `screenKind` map EMITTED in
// fixture_corpus.g.dart. They disagree only if the generated file was hand-edited to
// mislabel a group — which is exactly what the section-18 render-by-key tests trust:
// `renderableScreens` iterates `kind == 'screen'`, so a mislabelled operation-fixture
// would be pumped as a screen (and a real screen dropped from coverage). A wrong label
// reds here, naming the group, off a Flutter host.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const CORPUS = resolve(REPO, 'tests/fixtures/resident-mobile/index.json');
const GDART = resolve(REPO, 'apps/resident-mobile/lib/data/fixture_corpus.g.dart');

// DERIVE from the source shape — the same rule the generator applies.
const manifest = JSON.parse(readFileSync(CORPUS, 'utf8'));
const derived = new Map();
for (const e of manifest.fixtures) {
  const fetches = /^get/i.test(String(e.operationId ?? '')) && e.httpStatus === 200;
  derived.set(e.screen, (derived.get(e.screen) ?? false) || fetches);
}
const wantKind = (screen) => (derived.get(screen) ? 'screen' : 'operation-fixture');

// PARSE the emitted screenKind map out of the generated Dart.
const dart = readFileSync(GDART, 'utf8');
const block = /static const Map<String, String> screenKind = \{([\s\S]*?)\};/.exec(dart);
if (!block) {
  console.error(`FAIL: no screenKind map found in ${GDART} — regenerate with tool/generate-fixtures.mjs`);
  process.exit(1);
}
const emitted = new Map();
for (const m of block[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) emitted.set(m[1], m[2]);

const problems = [];
for (const screen of derived.keys()) {
  const want = wantKind(screen);
  const got = emitted.get(screen);
  if (got !== want) problems.push(`${screen}: g.dart says '${got ?? '(absent)'}', source shape derives '${want}'`);
}
for (const screen of emitted.keys()) {
  if (!derived.has(screen)) problems.push(`${screen}: in g.dart but not in the source corpus`);
}

if (problems.length) {
  console.error('FAIL: the generated corpus KIND map disagrees with the source-derived kind:');
  for (const p of problems) console.error(`  ${p}`);
  console.error('The render-by-key tests trust this label. Regenerate; do not hand-edit.');
  process.exit(1);
}
console.log(`ok: corpus screenKind agrees with the derivation for all ${derived.size} groups`);
