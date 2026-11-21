/**
 * Managed lookup lists against Backend's contract (lookup-lists-v0-PROPOSED_v0.1.md): records store the code,
 * raw spellings fold to codes, a deactivated type stays on old records, the fallback type is protected, and
 * delete is offered only for a type nothing uses.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VISITOR_PURPOSE, VISITOR_PURPOSE_SEED, activeItems, canDeactivate, canDelete, foldLabel, isLegacyCode, normalizePurpose,
  purposeFilterOptions, resolvePurpose, type LookupItem,
} from '../../src/lookups/lookup-lists.ts';
import { LookupError, createFixtureLookupsClient, lookupsClient, movedCodes, setLookupsClient } from '../../src/lookups/lookups-client.ts';
import { memoryStorage } from '../../src/lookups/lookup-storage.ts';
import { deskPurpose, fixturePurpose, purposeItems, purposeUsage } from '../../src/lookups/purpose-view.ts';
import { VISITOR_LIST_FIXTURE } from '../../src/data/visitor-fixtures.ts';
import { createFixtureClient } from '../../src/data/front-counter-client.ts';

const seed = (): LookupItem[] => JSON.parse(JSON.stringify(VISITOR_PURPOSE_SEED)) as LookupItem[];
const GROUPS = { inactive: 'Inactive', other: 'Other values' };
const NOW = new Date('2026-09-23T06:00:00Z');

test('raw spellings fold to one code, as Backend does: caregiver in any case, family / Family / Family visit', () => {
  const items = seed();
  for (const raw of ['caregiver', 'Caregiver', ' CAREGIVER ', 'Care-giver', '照顧者', '照顾者']) assert.equal(normalizePurpose(raw, items), 'caregiver', raw);
  for (const raw of ['family', 'Family', 'Family visit', 'family visit', 'family_visit', 'family-visit', '探訪家人', '探访家人']) assert.equal(normalizePurpose(raw, items), 'family_visit', raw);
  for (const [raw, code] of [['Delivery', 'delivery'], ['送貨', 'delivery'], ['Contractor', 'contractor'], ['承办商', 'contractor'], ['visit', 'visit'], ['other', 'other']] as const) {
    assert.equal(normalizePurpose(raw, items), code, raw);
  }
  assert.equal(foldLabel('Family visit'), foldLabel('family-visit'));
});

test('a value no type claims stays a legacy value under its own words, never a broken filter', () => {
  const items = seed();
  assert.equal(normalizePurpose('Piano tuning', items), null);
  const r = resolvePurpose({ words: ['Piano tuning'] }, items, 'en');
  assert.ok(isLegacyCode(r.code));
  assert.equal(r.label, 'Piano tuning');
  const legacy = purposeFilterOptions(items, [r], 'en', GROUPS).find((o) => o.value === r.code);
  assert.deepEqual({ label: legacy?.label, group: legacy?.group }, { label: 'Piano tuning', group: 'Other values' });
});

test('rows match on the purpose code; labels come from the list in the current language, other + text reads as the text', () => {
  const items = seed();
  assert.deepEqual(resolvePurpose({ code: 'family_visit', text: null }, items, 'zh-Hant'), { code: 'family_visit', label: '探訪家人' });
  assert.deepEqual(resolvePurpose({ code: 'caregiver' }, items, 'zh-Hans'), { code: 'caregiver', label: '照顾者' });
  assert.deepEqual(resolvePurpose({ code: 'other', text: 'Parcel delivery' }, items, 'en'), { code: 'other', label: 'Parcel delivery' });
  assert.deepEqual(resolvePurpose({ code: 'other', text: null }, items, 'en'), { code: 'other', label: 'Other' });
  // A code the list does not carry (an estate type) uses the labels the row came with.
  assert.deepEqual(resolvePurpose({ code: 'pest_control', labels: { en: 'Pest control', 'zh-Hant': '滅蟲' } }, items, 'zh-Hant'), { code: 'pest_control', label: '滅蟲' });
  // An older API said other + text for a named type: it still folds to the type.
  assert.equal(resolvePurpose({ code: 'other', text: 'Family visit' }, items, 'en').code, 'family_visit');
});

test('the Purpose filter has one option per type in list order, labelled in the current language, with no duplicates', () => {
  const items = seed();
  const rows = ['caregiver', 'family_visit', 'visit', 'delivery'].map((c) => resolvePurpose({ code: c }, items, 'en'));
  const en = purposeFilterOptions(items, rows, 'en', GROUPS);
  assert.deepEqual(en.map((o) => o.label), ['Delivery', 'Contractor', 'Visit', 'Caregiver', 'Family visit', 'Other']);
  assert.equal(new Set(en.map((o) => o.value)).size, en.length);
  const hant = purposeFilterOptions(items, rows, 'zh-Hant', { inactive: '已停用', other: '其他數值' });
  assert.deepEqual(hant.map((o) => o.label), ['送貨', '承辦商', '探訪', '照顧者', '探訪家人', '其他']);
  assert.equal(purposeFilterOptions(items, rows, 'zh-Hans', GROUPS)[4]?.label, '探访家人');
});

test('the demo data resolves to managed types with no legacy values left over, and the counter seed carries codes', async () => {
  setLookupsClient(createFixtureLookupsClient(memoryStorage()));
  try {
    const items = purposeItems();
    for (const v of VISITOR_LIST_FIXTURE.visitors) assert.ok(!isLegacyCode(fixturePurpose(v, 'en', items).code), v.purpose.en);
    const visits = await createFixtureClient(() => NOW).listToday();
    assert.ok(visits.every((v) => items.some((i) => i.code === v.purpose)), 'every seeded visit stores a list code');
    const wong = visits.find((v) => v.name.startsWith('Wong'));
    assert.deepEqual({ p: wong?.purpose, t: wong?.purpose_text, l: wong?.purpose_label }, { p: 'family_visit', t: null, l: 'Family visit' });
    assert.deepEqual(wong?.purpose_labels, { en: 'Family visit', 'zh-Hant': '探訪家人', 'zh-Hans': '探访家人' });
    const usage = purposeUsage(visits, items);
    assert.ok((usage['visit'] ?? 0) > 0);
    assert.ok(!Object.keys(usage).some(isLegacyCode));
  } finally { setLookupsClient(null); }
});

test('a walk-in stores the code Backend would: a code or label maps to its type, other text becomes other + purpose_text', async () => {
  setLookupsClient(createFixtureLookupsClient(memoryStorage()));
  try {
    const c = createFixtureClient(() => NOW);
    const host = 'unit_wfg_a_12_a1';
    const mk = async (purpose: string, purpose_text?: string) => c.createWalkIn({ name: 'X', purpose, host_unit_id: host, ...(purpose_text ? { purpose_text } : {}) });
    for (const [input, code] of [['family_visit', 'family_visit'], ['Family', 'family_visit'], ['caregiver', 'caregiver'], ['送貨', 'delivery'], ['other', 'other']] as const) {
      const v = await mk(input);
      assert.deepEqual({ p: v.purpose, t: v.purpose_text }, { p: code, t: null }, input);
    }
    const free = await mk('Kitchen U-bend repair');
    assert.deepEqual({ p: free.purpose, t: free.purpose_text }, { p: 'other', t: 'Kitchen U-bend repair' });
    const kept = await mk('other', 'Parcel delivery');
    assert.deepEqual({ p: kept.purpose, t: kept.purpose_text }, { p: 'other', t: 'Parcel delivery' });
    // The text is dropped when the purpose resolves to a type.
    assert.equal((await mk('visit', 'ignored')).purpose_text, null);
    // A deactivated type is not matched for new input: it becomes other + the words.
    await lookupsClient().update(VISITOR_PURPOSE, 'caregiver', { active: false });
    const off = await mk('caregiver');
    assert.deepEqual({ p: off.purpose, t: off.purpose_text }, { p: 'other', t: 'caregiver' });
  } finally { setLookupsClient(null); }
});

test('a deactivated type drops out of new forms and filters but stays on old records with its label', async () => {
  const client = createFixtureLookupsClient(memoryStorage());
  await client.update(VISITOR_PURPOSE, 'caregiver', { active: false });
  const items = client.items(VISITOR_PURPOSE);
  assert.ok(!activeItems(items).some((i) => i.code === 'caregiver'), 'not offered in a new form');
  const old = resolvePurpose({ code: 'caregiver' }, items, 'zh-Hant');
  assert.deepEqual(old, { code: 'caregiver', label: '照顧者' });
  const withOld = purposeFilterOptions(items, [old], 'en', GROUPS);
  assert.deepEqual(withOld.filter((o) => o.value === 'caregiver').map((o) => o.group), ['Inactive']);
  assert.ok(!purposeFilterOptions(items, [], 'en', GROUPS).some((o) => o.value === 'caregiver'), 'no records, so no Inactive entry');
  await client.update(VISITOR_PURPOSE, 'caregiver', { active: true });
  assert.ok(activeItems(client.items(VISITOR_PURPOSE)).some((i) => i.code === 'caregiver'));
});

test('a rename relabels existing records because they match on the code', async () => {
  const client = createFixtureClient(() => NOW);
  setLookupsClient(createFixtureLookupsClient(memoryStorage()));
  try {
    const lc = lookupsClient();
    await lc.update(VISITOR_PURPOSE, 'family_visit', { labels: { en: 'Relatives', 'zh-Hant': '親友到訪', 'zh-Hans': '亲友到访' } });
    const wong = (await client.listToday()).find((v) => v.name.startsWith('Wong'))!;
    assert.equal(wong.purpose, 'family_visit');
    assert.equal(deskPurpose(wong, 'en').label, 'Relatives');
    assert.equal(deskPurpose(wong, 'zh-Hant').label, '親友到訪');
  } finally { setLookupsClient(null); }
});

test('the fallback type cannot be deactivated or deleted, only renamed; its actions are not offered', async () => {
  const client = createFixtureLookupsClient(memoryStorage());
  const other = client.items(VISITOR_PURPOSE).find((i) => i.code === 'other')!;
  assert.equal(other.isSystem, true);
  assert.equal(canDeactivate(other), false);
  assert.equal(canDelete(other, 0), false);
  await assert.rejects(() => client.update(VISITOR_PURPOSE, 'other', { active: false }), (e) => e instanceof LookupError && e.status === 409 && e.kind === 'lookup-code-protected');
  await assert.rejects(() => client.remove(VISITOR_PURPOSE, 'other', 0), (e) => e instanceof LookupError && e.kind === 'lookup-code-protected');
  await client.update(VISITOR_PURPOSE, 'other', { labels: { en: 'Something else', 'zh-Hant': '其他事項', 'zh-Hans': '其他事项' } });
  assert.equal(client.items(VISITOR_PURPOSE).find((i) => i.code === 'other')?.labels.en, 'Something else');
});

test('delete is offered only for a type nothing uses; the client refuses with 409 lookup-code-in-use and the count', async () => {
  const client = createFixtureLookupsClient(memoryStorage());
  const visit = client.items(VISITOR_PURPOSE).find((i) => i.code === 'visit')!;
  assert.equal(canDelete(visit, 3), false, 'visit is on records');
  await assert.rejects(() => client.remove(VISITOR_PURPOSE, 'visit', 3), (e) => e instanceof LookupError && e.status === 409 && e.kind === 'lookup-code-in-use' && e.inUseCount === 3);
  const made = await client.create(VISITOR_PURPOSE, { en: 'Inspection', 'zh-Hant': '巡查', 'zh-Hans': '巡查' });
  assert.equal(made.code, 'inspection');
  assert.equal(canDelete(made, 0), true);
  await client.remove(VISITOR_PURPOSE, 'inspection', 0);
  assert.ok(!client.items(VISITOR_PURPOSE).some((i) => i.code === 'inspection'));
});

test('no two types may share a label in any language (lookup-label-exists); a new type needs all three languages', async () => {
  const c = createFixtureLookupsClient(memoryStorage());
  await assert.rejects(() => c.create(VISITOR_PURPOSE, { en: 'FAMILY VISIT', 'zh-Hant': '新', 'zh-Hans': '新' }), (e) => e instanceof LookupError && e.status === 409 && e.kind === 'lookup-label-exists');
  await assert.rejects(() => c.create(VISITOR_PURPOSE, { en: 'Inspection', 'zh-Hant': '送貨', 'zh-Hans': '巡查' }), (e) => e instanceof LookupError && e.kind === 'lookup-label-exists');
  await assert.rejects(() => c.create(VISITOR_PURPOSE, { en: 'Inspection', 'zh-Hant': '', 'zh-Hans': '巡查' }), (e) => e instanceof LookupError && e.status === 400);
});

test('edits persist in storage and a second client sees them; a move renumbers 10, 20, … and keeps other last', async () => {
  const store = memoryStorage();
  const a = createFixtureLookupsClient(store);
  await a.create(VISITOR_PURPOSE, { en: 'Inspection', 'zh-Hant': '巡查', 'zh-Hans': '巡查' });
  await a.move(VISITOR_PURPOSE, 'inspection', -1);
  await a.update(VISITOR_PURPOSE, 'visit', { active: false });
  const b = createFixtureLookupsClient(store);
  assert.deepEqual(b.items(VISITOR_PURPOSE).map((i) => i.code), ['delivery', 'contractor', 'visit', 'caregiver', 'inspection', 'family_visit', 'other']);
  assert.deepEqual(b.items(VISITOR_PURPOSE).map((i) => i.sortOrder), [10, 20, 30, 40, 50, 60, 900]);
  assert.equal(b.items(VISITOR_PURPOSE).find((i) => i.code === 'visit')?.active, false);
  // other never moves, and nothing moves past it.
  assert.equal(movedCodes(b.items(VISITOR_PURPOSE), 'other', -1), null);
  assert.equal(movedCodes(b.items(VISITOR_PURPOSE), 'family_visit', 1), null);
  b.reset();
  assert.equal(createFixtureLookupsClient(store).items(VISITOR_PURPOSE).length, 6);
});
