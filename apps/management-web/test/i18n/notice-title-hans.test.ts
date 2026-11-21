/** A notice’s title in the notices list and on the acknowledgements page follows the reader’s script. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { noticeTitleFor } from '../../src/data/notice-title.ts';
import { WFG_NOTICE_ROWS } from '../../src/data/notices-wfg-corpus.ts';

test('a notice title is English for en, Traditional for 繁 and Simplified for 简', () => {
  const n = WFG_NOTICE_ROWS.find((x) => /業主大會/.test(x.titleZhHant));
  assert.ok(n, 'the fixture has the owners’ meeting notice');
  assert.equal(noticeTitleFor(n.noticeId, 'en'), n.titleEn);
  assert.equal(noticeTitleFor(n.noticeId, 'zh-Hant'), n.titleZhHant);
  assert.match(noticeTitleFor(n.noticeId, 'zh-Hans') ?? '', /业主大会/);
  assert.doesNotMatch(noticeTitleFor(n.noticeId, 'zh-Hans') ?? '', /業|會/);
});
