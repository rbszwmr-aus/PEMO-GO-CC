/**
 * The portal shows the Backend’s words to a 简 reader in Simplified (hans.ts, the same table as management-web).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toHans } from '../../src/i18n/hans.ts';
import { t } from '../../src/i18n/locale.ts';

test('invoice words and the unit label come out in Simplified', () => {
  assert.equal(toHans('每月管理費'), '每月管理费');
  assert.equal(toHans('車位牌照費'), '车位牌照费');
  assert.equal(toHans('特別徵費 — 外牆維修'), '特别征费 — 外墙维修');
  assert.equal(toHans('A座 12樓 A1室'), 'A座 12楼 A1室');
});

test('t() uses zh-Hans when the data has it, converts the 繁 when it has not, and never falls to English', () => {
  assert.equal(t({ en: 'Monthly fee', 'zh-Hant': '每月管理費', 'zh-Hans': '每月物业费' }, 'zh-Hans'), '每月物业费');
  assert.equal(t({ en: 'Monthly fee', 'zh-Hant': '每月管理費' }, 'zh-Hans'), '每月管理费');
  assert.equal(t({ en: 'Monthly fee', 'zh-Hant': '每月管理費' }, 'zh-Hant'), '每月管理費');
});
