/** The refusal to delete a type that records use counts them in the reader's own grammar: “1 record”, not “1 records”. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { MESSAGES } from '../../src/i18n/messages.ts';
import { t } from '../../src/i18n/locale.ts';

test('the delete refusal says “1 record” for one and “n records” for more, in en, 繁 and 简', () => {
  const M = MESSAGES.lookups;
  assert.match(t(M.deleteInUseOne, 'en'), /used by 1 record,/);
  assert.doesNotMatch(t(M.deleteInUseOne, 'en'), /records/);
  assert.match(t(M.deleteInUse, 'en'), /used by \{n\} records,/);
  assert.match(t(M.deleteInUseOne, 'zh-Hant'), /有 1 筆紀錄/);
  assert.match(t(M.deleteInUseOne, 'zh-Hans'), /有 1 条记录/);
});
