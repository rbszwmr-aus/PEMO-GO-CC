/**
 * Wing Fu Garden notices overlay + Documents library must resolve
 * list → detail and keep the three CD stories (fee reminder, maintenance, AGM).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DOCUMENT_ROWS,
  findDocument,
} from '../../src/data/documents-corpus.ts';
import {
  findWfgNoticeDetail,
  findWfgOutstanding,
  noticeScopeFor,
  relatedDocumentId,
  WFG_NOTICE_ROWS,
  WFG_STORY_IDS,
} from '../../src/data/notices-wfg-corpus.ts';

test('Wing Fu Garden notices include fee reminder, maintenance and AGM with both languages', () => {
  assert.ok(WFG_NOTICE_ROWS.length >= 6, 'WFG notice list is hollow');
  for (const id of Object.values(WFG_STORY_IDS)) {
    const row = WFG_NOTICE_ROWS.find((n) => n.noticeId === id);
    assert.ok(row, `missing story ${id}`);
    assert.ok(row!.titleZhHant.length > 0 && row!.titleZhHant !== '（未翻譯）', `${id} missing zh-Hant title`);
    const detail = findWfgNoticeDetail(id);
    assert.ok(detail, `no detail for ${id}`);
    assert.ok(detail!.notice.bodyZhHant.length > 0, `${id} missing zh-Hant body`);
    assert.ok(noticeScopeFor(id), `${id} has no scope path`);
  }
  assert.equal(WFG_NOTICE_ROWS.find((n) => n.noticeId === WFG_STORY_IDS.feeReminder)?.story, 'fee_reminder');
  assert.equal(WFG_NOTICE_ROWS.find((n) => n.noticeId === WFG_STORY_IDS.maintenance)?.story, 'maintenance');
  assert.equal(WFG_NOTICE_ROWS.find((n) => n.noticeId === WFG_STORY_IDS.agm)?.story, 'agm');
});

test('every WFG notice list row has a matching detail fixture', () => {
  for (const row of WFG_NOTICE_ROWS) {
    assert.ok(findWfgNoticeDetail(row.noticeId), `no detail for ${row.noticeId}`);
  }
  assert.equal(findWfgNoticeDetail('ntc_does_not_exist'), undefined);
});

test('fee reminder outstanding is non-empty and unacknowledged come first', () => {
  const ack = findWfgOutstanding(WFG_STORY_IDS.feeReminder);
  assert.ok(ack, 'fee reminder has no outstanding fixture');
  assert.ok(ack!.recipients.length >= 2, 'fee reminder outstanding is hollow');
  const firstUnack = ack!.recipients.findIndex((r) => !r.acknowledged);
  const firstAck = ack!.recipients.findIndex((r) => r.acknowledged);
  assert.ok(firstUnack === 0, 'unacknowledged recipients must lead');
  assert.ok(firstAck > firstUnack, 'acknowledged recipients must follow');
});

test('fee reminder and AGM pair with Documents stubs', () => {
  assert.equal(relatedDocumentId(WFG_STORY_IDS.feeReminder), 'doc_wfg_fee_schedule');
  assert.equal(relatedDocumentId(WFG_STORY_IDS.agm), 'doc_wfg_agm_circular');
  assert.ok(findDocument('doc_wfg_fee_schedule')?.relatedNoticeId === WFG_STORY_IDS.feeReminder);
  assert.ok(findDocument('doc_wfg_agm_circular')?.relatedNoticeId === WFG_STORY_IDS.agm);
});

test('every document list row has a matching detail and a PDF stub', () => {
  assert.ok(DOCUMENT_ROWS.length >= 4, 'documents library is hollow');
  for (const row of DOCUMENT_ROWS) {
    const found = findDocument(row.documentId);
    assert.ok(found, `no document ${row.documentId}`);
    assert.equal(found!.stub.mime, 'application/pdf');
    assert.ok(found!.stub.pages >= 1, `${row.documentId} has no page count`);
    assert.ok(found!.title['zh-Hant'].length > 0, `${row.documentId} missing zh-Hant title`);
    assert.ok(found!.scope.node.id, `${row.documentId} has no scope node`);
  }
  assert.equal(findDocument('doc_does_not_exist'), undefined);
});
