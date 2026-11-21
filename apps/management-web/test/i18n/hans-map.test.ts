/**
 * Traditional → Simplified for the Backend’s strings (hans.ts): the words a 简 reader sees when the API sent
 * English and Traditional only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HANS_MAP_SIZE, toHans } from '../../src/i18n/hans.ts';
import { t } from '../../src/i18n/locale.ts';

const here = import.meta.dirname;
const TRAD_ONLY = new Set([...(JSON.parse(readFileSync(join(here, 'traditional-only-chars.json'), 'utf8')).chars as string)]);

test('names, blocks, floors and notice words come out in Simplified; English, digits and symbols are left alone', () => {
  assert.equal(toHans('A座12樓A1室'), 'A座12楼A1室');
  assert.equal(toHans('Chan Mei-ling 陳美玲'), 'Chan Mei-ling 陈美玲');
  assert.equal(toHans('每月管理費'), '每月管理费');
  assert.equal(toHans('車位牌照費'), '车位牌照费');
  assert.equal(toHans('特別徵費 — 外牆維修'), '特别征费 — 外墙维修');
  assert.equal(toHans('2026年9月30日 HK$3,280'), '2026年9月30日 HK$3,280');
  assert.equal(toHans('Block A'), 'Block A');
  assert.equal(toHans(''), '');
});

test('converting twice changes nothing, and the table is large enough to be the common-use set', () => {
  for (const s of ['榮富花園', '我們的系統出現問題，請稍後再試。', '屋苑不在您獲授權的範圍內']) assert.equal(toHans(toHans(s)), toHans(s));
  assert.ok(HANS_MAP_SIZE >= 2800, `table has ${HANS_MAP_SIZE} characters`);
});

test('t() gives a 简 reader the Backend’s zh-Hans when there is one, and the converted 繁 when there is not; never English', () => {
  assert.equal(t({ en: 'Lifts', 'zh-Hant': '升降機', 'zh-Hans': '电梯' }, 'zh-Hans'), '电梯');
  assert.equal(t({ en: 'Lifts', 'zh-Hant': '升降機' }, 'zh-Hans'), '升降机');
  assert.equal(t({ en: 'Lifts', 'zh-Hant': '升降機' }, 'zh-Hant'), '升降機');
  assert.equal(t({ en: 'Lifts', 'zh-Hant': '升降機' }, 'en'), 'Lifts');
});

test('the Traditional words the corpus carries leave no Traditional-only character behind once converted', () => {
  const corpus = readFileSync(join(here, '../../src/data/corpus.g.ts'), 'utf8');
  const han = [...new Set(corpus.match(/[\u4e00-\u9fff]/g) ?? [])].join('');
  const left = [...toHans(han)].filter((c) => TRAD_ONLY.has(c));
  assert.deepEqual(left, [], `Traditional-only characters the table does not convert: ${left.join('')}`);
});

test('management-web and resident-portal carry the same table', () => {
  const a = readFileSync(join(here, '../../src/i18n/hans.ts'), 'utf8');
  const b = readFileSync(join(here, '../../../resident-portal/src/i18n/hans.ts'), 'utf8');
  assert.equal(a, b);
});
