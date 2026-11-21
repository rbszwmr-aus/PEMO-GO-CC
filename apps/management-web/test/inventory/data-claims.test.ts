/**
 * The screens claim the corpus LACKS certain things. Those claims are checked.
 *
 * WHY THIS EXISTS — a gap the re-pin exposed.
 *
 * The dependency inventory called client-authored copy `content-stable`:
 * "unaffected by the corpus". That was right about renames and WRONG about
 * additions. Copy that DESCRIBES the corpus is coupled to it even though no
 * assertion links the two — so when API-020-ST added a Portfolio node, the
 * scope-gap line went on saying the corpus "carries no Portfolio node at all"
 * and the whole suite stayed green while the product stated something untrue.
 *
 * A claim about absence is a claim, and it rots in exactly the direction nobody
 * watches: things are ADDED, and the sentence saying they are missing survives.
 *
 * So each declared absence names its values as DATA here, and the corpus is
 * asked. Prose and check cannot drift, because the check reads the values and a
 * second assertion requires the prose to mention each of them.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { CORPUS_DIR, loadCorpus } from '../../tool/corpus-source.ts';
import { SCOPE_GAP, SCREENS } from '../../src/data/states.ts';
import {
  ABSENCE_CLAIMS, STRING_CLAIMS, VALUE_MAPS, communicationStatesIn, feedStatesIn,
  noticeLifecycleStatesIn,
  noticeRowStatesIn, scopeKindsIn, severitiesIn,
} from './data-claims.data.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { APP_ROOT, MGMT_CONTRACT_DIR } from '../../tool/corpus-source.ts';

/**
 * Extractors and claims live in absence-claims.data.ts, shared with
 * tool/prove-absence-claims.ts so the proof cannot hard-code what it violates.
 */
const parsed = () => [...loadCorpus().files.values()] as any[];
const severitiesInCorpus = () => severitiesIn(parsed());
const feedStatesInCorpus = () => feedStatesIn(parsed());
const noticeLifecycleInCorpus = () => noticeLifecycleStatesIn(parsed());
const noticeRowStatesInCorpus = () => noticeRowStatesIn(parsed());
const scopeKindsInCorpus = () => scopeKindsIn(parsed());
const communicationStatesInCorpus = () => communicationStatesIn(parsed());

test('the extractors actually find things — an empty oracle agrees with everything', () => {
  assert.ok(severitiesInCorpus().size >= 3, 'no severities extracted');
  assert.ok(feedStatesInCorpus().size >= 2, 'no feed states extracted');
  assert.ok(noticeLifecycleInCorpus().size >= 2, 'no notice lifecycle states extracted');
  assert.ok(noticeRowStatesInCorpus().size >= 1, 'no NoticeRow states extracted');
  assert.ok(scopeKindsInCorpus().size >= 5, 'no scope kinds extracted');
  assert.ok(communicationStatesInCorpus().size >= 5, 'no communication states extracted');
});

test('the corpus really does lack what the no-fixture panels say it lacks', () => {
  const wrong: string[] = [];
  for (const claim of ABSENCE_CLAIMS) {
    const present = claim.present(parsed());
    for (const v of claim.values) {
      if (present.has(v)) {
        wrong.push(`${claim.screen}/${claim.state} claims no ${claim.label} "${v}", but the corpus now has one`);
      }
    }
  }
  assert.deepEqual(
    wrong,
    [],
    `a no-fixture panel is stating something untrue:\n  ${wrong.join('\n  ')}\n` +
      `The corpus gained something and the copy saying it was missing survived.`,
  );
});

test('the prose names every value the claim is checked against', () => {
  // Stops the data and the sentence drifting apart: if a value is added to the
  // check but not to the copy, the panel under-reports; if it is removed from
  // the check but left in the copy, the panel over-reports and nothing notices.
  const missing: string[] = [];
  for (const claim of ABSENCE_CLAIMS) {
    const entry = SCREENS[claim.screen].states.find((s) => s.id === claim.state);
    assert.ok(entry, `${claim.screen}/${claim.state} is not in the registry`);
    const prose = `${entry.missing?.en ?? ''}`.toLowerCase();
    for (const v of claim.values) {
      if (!prose.includes(v)) missing.push(`${claim.screen}/${claim.state} checks "${v}" but never mentions it`);
    }
  }
  assert.deepEqual(missing, [], `check and copy have drifted:\n  ${missing.join('\n  ')}`);
});

test('the scope-gap line is true of the corpus as it stands', () => {
  // The specific claim that went stale. Phase is the only kind with no node;
  // Portfolio arrived with API-020-ST and the sentence had to change with it.
  const kinds = scopeKindsInCorpus();

  assert.ok(kinds.has('portfolio'), 'the corpus lost its Portfolio node; the scope-gap copy must change back');
  assert.ok(!kinds.has('phase'), 'the corpus gained a Phase node; the scope-gap copy is now wrong');
  assert.match(SCOPE_GAP.en, /Only Phase has no node/i, 'the scope-gap copy no longer matches what the corpus shows');
  assert.ok(!/no Portfolio node at all/i.test(SCOPE_GAP.en), 'the stale Portfolio claim is back');
  assert.match(SCOPE_GAP.en, /Portfolio-level grant/i, 'the copy does not mention the grant, which is the form that has teeth');
});

test('the corpus path under test is the real one', () => {
  assert.match(CORPUS_DIR, /tests\/fixtures\/management-web$/);
  assert.ok(readFileSync(join(CORPUS_DIR, 'index.json'), 'utf8').includes('"surface": "management"'));
});

test('the three gaps API-020-ST closed are really closed — dropped panels, not hidden ones', () => {
  // Removing a no-fixture panel is only correct if the corpus actually covers
  // the thing. Asserted, so a panel cannot be deleted on the strength of a
  // manifest note that turned out to be optimistic.
  const sev = severitiesInCorpus();
  for (const v of ['normal', 'information', 'offline']) {
    assert.ok(sev.has(v), `the severity-coverage panel was removed but "${v}" still has no fixture`);
  }
  const feeds = feedStatesInCorpus();
  for (const v of ['unavailable', 'unknown']) {
    assert.ok(feeds.has(v), `the feed-unavailable panel was removed but "${v}" still has no fixture`);
  }
  // Read from lifecycleState, the field the notices list actually carries after
  // the GEN-043 reshape. Anchored to that field on purpose: these three values
  // also exist in the retained NoticeRow vocabulary, so an extractor that merged
  // both would let an S2 overview row close a gap declared about the S5 list.
  const notices = noticeLifecycleInCorpus();
  for (const v of ['draft', 'scheduled', 'withdrawn']) {
    assert.ok(notices.has(v), `the other-notice-states panel was removed but "${v}" still has no fixture`);
  }

  const gone = ['severity-coverage', 'feed-unavailable', 'other-notice-states'];
  const stillDeclared = Object.values(SCREENS)
    .flatMap((sc: { states: Array<{ id: string }> }) => sc.states)
    .filter((st) => gone.includes(st.id))
    .map((st) => st.id);
  assert.deepEqual(stillDeclared, [], `these panels claim a gap the corpus has closed: ${stillDeclared.join(', ')}`);
});


/* ==================================================== UI-022-ST — the sweep */

/** Every client-authored string, by dotted key. Labels included: the point is
 *  that nothing escapes classification by being short. */
function allClientStrings(): Array<{ key: string; en: string }> {
  const out: Array<{ key: string; en: string }> = [];
  const walk = (o: any, path: string[]): void => {
    for (const [k, v] of Object.entries<any>(o)) {
      if (v && typeof v === 'object' && 'en' in v) out.push({ key: path.concat(k).join('.'), en: String(v.en) });
      else if (v && typeof v === 'object') walk(v, path.concat(k));
    }
  };
  walk(MESSAGES, []);
  for (const [sid, sc] of Object.entries<any>(SCREENS))
    for (const st of sc.states) {
      if (st.missing) out.push({ key: `states.${sid}.${st.id}.missing`, en: st.missing.en });
      // UI-051: a client-form state carries a `reason`, classified like a gap's `missing`.
      if (st.reason) out.push({ key: `states.${sid}.${st.id}.reason`, en: st.reason.en });
    }
  out.push({ key: 'states.SCOPE_GAP', en: SCOPE_GAP.en });
  return out;
}

const isUnderValueMap = (key: string) => VALUE_MAPS.some((m) => key.startsWith(`${m.path}.`));

test('the extractor reaches the copy — an empty oracle agrees with everything', () => {
  const all = allClientStrings();
  assert.ok(all.length > 150, `only ${all.length} strings extracted`);
  assert.ok(all.some((s) => s.key === 's1.unassignedNote'), 'the known claim is not being extracted');
});

test('every classified string still exists — the registry carries nothing gone', () => {
  const live = new Set(allClientStrings().map((s) => s.key));
  const orphaned = STRING_CLAIMS.filter((c) => !live.has(c.key)).map((c) => c.key);
  assert.deepEqual(orphaned, [], `the registry classifies copy that has been deleted: ${orphaned.join(', ')}`);
});

test('every gated claim names its gate AND where the gate is asserted', () => {
  // A conditional with no assertion beside it is the same unchecked claim
  // pointing the other way.
  const bad = STRING_CLAIMS.filter((c) => c.disposition === 'gated' && (!c.gate || !c.assertedIn || !c.direction))
    .map((c) => c.key);
  assert.deepEqual(bad, [], `gated claims missing direction, gate or assertion: ${bad.join(', ')}`);

  const unexplained = STRING_CLAIMS
    .filter((c) => (c.disposition === 'policy' || c.disposition === 'retained') && !c.why)
    .map((c) => c.key);
  assert.deepEqual(unexplained, [], `policy/retained with no reason recorded: ${unexplained.join(', ')}`);
});

test('a retained non-rendering string must be NAMED in the divergence register', () => {
  // The condition that decided the nine deletions. Nothing names a severity
  // legend, so the legend copy went; B10 names the tabs, so the tab copy stayed.
  // Asserted so the retained set cannot grow silently.
  const register = readFileSync(join(APP_ROOT, 'DIVERGENCES.md'), 'utf8');
  assert.ok(register.length > 2000, 'the divergence register did not load');
  const unnamed: string[] = [];
  for (const c of STRING_CLAIMS.filter((x) => x.disposition === 'retained')) {
    const text = c.key.split('.').pop() as string;
    const label = text.replace(/^tab/, '');
    if (!new RegExp(label, 'i').test(register)) unnamed.push(c.key);
  }
  assert.deepEqual(unnamed, [], `retained copy no surface is named for: ${unnamed.join(', ')}`);
});

test('VALUE-MAP TOTALITY — every contract enum value has copy, derived from the contract', () => {
  // The frozen-axis shape in a lookup table: a new enum value renders undefined.
  // Checked against the CONTRACT, never against a list kept here, so widening an
  // enum fails until the copy follows.
  const doc = parseYaml(readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8')) as any;
  const schemas = doc?.components?.schemas;
  assert.ok(schemas, 'the contract did not parse');

  /** Resolve a dotted path through `properties` and `items` to its enum. */
  const enumAt = (path: string): string[] => {
    const [head, ...rest] = path.split('.');
    let node: any = schemas[head as string];
    assert.ok(node, `no schema named ${head}`);
    for (const seg of rest) {
      if (node?.items) node = node.items;
      node = node?.properties?.[seg] ?? node?.[seg];
      assert.ok(node, `${path}: could not resolve "${seg}"`);
    }
    if (node.items) node = node.items;
    assert.ok(Array.isArray(node.enum), `${path} resolves to no enum`);
    return node.enum as string[];
  };

  const missing: string[] = [];
  let covered = 0;
  for (const map of VALUE_MAPS) {
    if (!map.schema) continue;
    const node = map.path.split('.').reduce<any>((o, k) => o?.[k], MESSAGES as any);
    assert.ok(node, `${map.path} is not a message map`);
    const keys = new Set(Object.keys(node));

    const paths = Array.isArray(map.schema) ? map.schema : [map.schema];
    const values = new Set<string>();
    for (const sp of paths) for (const v of enumAt(sp)) values.add(v);
    covered++;

    for (const v of values) if (!keys.has(v)) missing.push(`${map.path} has no copy for contract value "${v}" (${paths.join(', ')})`);
    for (const k of keys) if (!values.has(k)) missing.push(`${map.path} has copy for "${k}", which the contract does not declare`);
  }
  assert.ok(covered >= 10, `only ${covered} of ${VALUE_MAPS.length} value maps matched a contract enum`);
  assert.deepEqual(missing, [], `value maps are not total against the contract:\n  ${missing.join('\n  ')}`);
});

test('EVERY client-authored string is classified — silence is how the fourth instance arrives', () => {
  // The load-bearing check. A string is either under a value map, or in the
  // registry, or it is a label — and "label" has to be a decision, so the
  // registry must name every string that is not one.
  const all = allClientStrings();
  const classified = new Set(STRING_CLAIMS.map((c) => c.key));
  // No label-shaped regex. A pattern wide enough to absorb every unclassified
  // string would absorb the next claim too, which is how this class hid in the
  // first place. Every string is either under a value map or named in the
  // registry — including as a label, which is a decision somebody made.
  const unclassified = all
    .filter((s) => !classified.has(s.key) && !isUnderValueMap(s.key))
    .map((s) => `${s.key} — "${s.en.slice(0, 60)}"`);
  assert.deepEqual(
    unclassified,
    [],
    `client copy nothing has classified:\n  ${unclassified.join('\n  ')}\n` +
      `Give each a disposition in STRING_CLAIMS. If it claims nothing about the data, say so as ` +
      `'policy' with a reason.`,
  );
});

test('PRESENCE — every source projection carries BOTH attributions, as s1.bothAttributions states', () => {
  const { files } = loadCorpus();
  let checked = 0;
  for (const [name, body] of files) {
    const c = (body as any).classification;
    if (!c) continue;
    checked++;
    assert.ok(c.source?.code && c.source?.level, `${name}: no source classification`);
    assert.ok(c.pemo?.severity && c.pemo?.policyVersion, `${name}: no PEMO classification`);
  }
  assert.ok(checked >= 2, `only ${checked} source projections checked`);
});

test('declared absences hold — the four the corpus is asked about directly', () => {
  const { files } = loadCorpus();
  const parsedAll = [...files.values()] as any[];
  // zero-recipients
  const emptyRecipients = parsedAll.filter((f) => Array.isArray(f.recipients) && f.recipients.length === 0);
  assert.equal(emptyRecipients.length, 0, 's1/zero-recipients claims no such fixture, but one exists');
  // empty attention queue
  const emptyAttention = parsedAll.filter((f) => Array.isArray(f.attention) && f.attention.length === 0);
  assert.equal(emptyAttention.length, 0, 's2/empty-attention claims no such fixture, but one exists');
  // unmapped or household-less unit
  const oddUnit = parsedAll.filter((f) => f.unit && (f.unit.facts?.mapping?.state === 'unmapped' || f.unit.household?.length === 0));
  assert.equal(oddUnit.length, 0, 's3/unmapped-unit claims no such fixture, but one exists');
  // case-detail operation
  const openapi = readFileSync(join(MGMT_CONTRACT_DIR, 'openapi.yaml'), 'utf8');
  assert.ok(!/operationId: getCase\b/.test(openapi), 's4/case-detail claims no such operation, but the contract has one');
  // UI-051: the write-flow absence that survives. The incomplete-translation
  // absence was RETIRED at GEN-052 when its fixture landed.
  const emptyAck = parsedAll.filter((f) => f.noticeId && Array.isArray(f.recipients) && f.recipients.length === 0);
  assert.equal(emptyAck.length, 0, 's5ack/empty claims no such fixture, but one exists');
});


/* ================================================== UI-024-ST — the fallback */

/**
 * `label` was a resting place, and that is why the gap survived.
 *
 * UI-022-ST refused a catch-all regex, on the grounds that one wide enough to
 * absorb every unclassified string would absorb the next claim too. Then the 116
 * label dispositions were GENERATED — everything not otherwise classified became
 * a label — and the completeness guard passed, because `label` is a
 * classification.
 *
 * Refusing a catch-all as a RULE does not prevent one arriving as a DEFAULT. A
 * classifier whose fallback is a real category will always pass its own
 * completeness check.
 *
 * So `label` is now CHECKED rather than assumed, on the two properties that
 * distinguish it mechanically: a label is not reachable through an indexed
 * lookup, and a label does not assert anything.
 */

/** Every message object indexed as a lookup somewhere in src. */
function indexedMapNames(): Set<string> {
  const out = new Set<string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) { walk(full); continue; }
      if (!/\.(ts|tsx)$/.test(entry)) continue;
      const src = readFileSync(full, 'utf8');
      for (const m of src.matchAll(/(?:M|MESSAGES)\.([A-Za-z0-9_.]+)\[/g)) {
        const path = m[1] as string;
        out.add(path.split('.').pop() as string);
      }
    }
  };
  walk(join(APP_ROOT, 'src'));
  return out;
}

test('the index scan finds lookups — an empty oracle agrees with everything', () => {
  const idx = indexedMapNames();
  assert.ok(idx.size >= 10, `only ${idx.size} indexed lookups found; the scan is not reaching src`);
  assert.ok(idx.has('scopeKind'), 'the scan missed a known lookup');
});

test('every VALUE_MAP is actually indexed somewhere — a map nothing uses is dead copy', () => {
  // The other direction. `s1.source` was declared a value map, indexed nowhere
  // and rendered nowhere; its three strings were deleted by UI-024-ST.
  const idx = indexedMapNames();
  const unused = VALUE_MAPS
    .map((m) => m.path)
    .filter((p) => !idx.has(p.split('.').pop() as string));
  assert.deepEqual(unused, [], `declared value maps that nothing indexes: ${unused.join(', ')}`);
});

test('every INDEXED lookup is declared a VALUE_MAP — the gap this PID exists for', () => {
  // s3.systemName was indexed over a contract enum and classified `label`, so
  // totality could not see it. This is the check that would have caught it.
  const declared = new Set(VALUE_MAPS.map((m) => m.path.split('.').pop() as string));
  const missing = [...indexedMapNames()].filter((n) => !declared.has(n)).sort();
  assert.deepEqual(
    missing,
    [],
    `indexed lookups with no VALUE_MAPS entry, so excluded from totality: ${missing.join(', ')}`,
  );
});

test('every `label` really is one — not reachable by a lookup, and asserting nothing', () => {
  const idx = indexedMapNames();
  const viaIndex: string[] = [];
  const sentences: string[] = [];

  for (const c of STRING_CLAIMS.filter((x) => x.disposition === 'label')) {
    const parts = c.key.split('.');
    const parent = parts[parts.length - 2];
    if (parent && idx.has(parent)) viaIndex.push(c.key);

    const node = c.key.split('.').reduce<any>((o, k) => o?.[k], MESSAGES as any);
    const en = String(node?.en ?? '');
    if (/[.!]/.test(en) && en.split(' ').length >= 6) sentences.push(`${c.key} — "${en.slice(0, 50)}"`);
  }

  assert.deepEqual(viaIndex, [],
    `classified 'label' but reachable through an indexed lookup, so excluded from totality:\n  ${viaIndex.join('\n  ')}`);
  assert.deepEqual(sentences, [],
    `classified 'label' but asserts something:\n  ${sentences.join('\n  ')}`);
});

test('a value map keyed by client data declares what enforces its totality', () => {
  // `nav` is indexed by a value typed `keyof typeof MESSAGES.nav`, so the
  // compiler enforces totality and a runtime check would only restate the type.
  // What can drift is the ANNOTATION, so that is what is asserted.
  for (const map of VALUE_MAPS) {
    assert.ok(map.schema || map.totalityBy, `${map.path} declares neither a contract enum nor another oracle`);
    if (!map.totalityBy) continue;
    const src = readFileSync(join(APP_ROOT, map.totalityBy.file), 'utf8');
    assert.ok(
      src.includes(map.totalityBy.annotation),
      `${map.path} relies on the annotation \`${map.totalityBy.annotation}\` in ${map.totalityBy.file}, and it is gone — ` +
        `totality is now enforced by nothing`,
    );
  }
});
