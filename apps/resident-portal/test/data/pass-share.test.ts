/**
 * Visitor pass sharing: which image action applies, the download file name, the
 * clipboard image call (and its failures), the HKT stamp, and the host-unit label.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { canCopyImage, qrImageAction, visitorPassFileName } from '../../src/data/pass-share.ts';
import { formatHktStamp } from '../../src/format/datetime.ts';
import { parseUnitId, unitLocationLabel } from '../../src/data/locations.ts';
import { copyImagePng } from '../../src/data/clipboard.ts';

const SECURE = { secure: true, hasClipboardWrite: true, hasClipboardItem: true };

test('Copy QR image only where the async clipboard can take an image; otherwise Download', () => {
  assert.equal(qrImageAction(SECURE), 'copy-image');
  // Plain http over the LAN is not a secure context: the common case here.
  assert.equal(qrImageAction({ ...SECURE, secure: false }), 'download');
  assert.equal(qrImageAction({ ...SECURE, hasClipboardWrite: false }), 'download');
  assert.equal(qrImageAction({ ...SECURE, hasClipboardItem: false }), 'download');
  // A refused write flips the action for the rest of the page.
  assert.equal(qrImageAction(SECURE, true), 'download');
  assert.equal(canCopyImage({ ...SECURE, secure: false }), false);
});

test('the download file is named for the HKT day it is saved', () => {
  assert.equal(visitorPassFileName(new Date('2026-09-23T06:00:00Z')), 'visitor-pass-2026-09-23.png');
  // 17:00Z is already the next day in Hong Kong.
  assert.equal(visitorPassFileName(new Date('2026-09-23T17:00:00Z')), 'visitor-pass-2026-09-24.png');
});

test('copyImagePng writes ONE ClipboardItem keyed image/png and reports failure honestly', async () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = { ClipboardItem: g.ClipboardItem, navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator') };
  const seen: Array<Record<string, Blob>> = [];
  class FakeItem { constructor(data: Record<string, Blob>) { seen.push(data); } }
  g.ClipboardItem = FakeItem;
  const blob = new Blob(['x'], { type: 'image/png' });
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { write: async (items: unknown[]) => { assert.equal(items.length, 1); } } } });
    assert.equal(await copyImagePng(blob), true);
    assert.deepEqual(Object.keys(seen[0]!), ['image/png']);
    assert.equal(seen[0]!['image/png'], blob);

    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { write: async () => { throw new Error('NotAllowedError'); } } } });
    assert.equal(await copyImagePng(blob), false, 'a blocked write is false, not a throw');

    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
    assert.equal(await copyImagePng(blob), false, 'no clipboard API is false');
  } finally {
    g.ClipboardItem = saved.ClipboardItem;
    if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator);
  }
});

test('expected from/to read "23 Sep 2026, 14:00 HKT" and the zh-Hant equivalent', () => {
  assert.equal(formatHktStamp('2026-09-23T06:00:00Z', 'en'), '23 Sep 2026, 14:00 HKT');
  assert.equal(formatHktStamp('2026-09-23T14:00:00+08:00', 'en'), '23 Sep 2026, 14:00 HKT');
  assert.equal(formatHktStamp('2026-09-03T00:05:00+08:00', 'en'), '3 Sep 2026, 00:05 HKT', 'midnight is 00, not 24');
  assert.equal(formatHktStamp('2026-09-23T06:00:00Z', 'zh-Hant'), '2026年9月23日 14:00（香港時間）');
  assert.equal(formatHktStamp('not a date', 'en'), 'not a date');
  assert.equal(formatHktStamp('', 'en'), '');
});

test('a host unit id becomes the tree wording and never shows raw', () => {
  assert.equal(unitLocationLabel('unt_demo_a_12f_a1', 'en'), 'Block A · 12/F · Flat A1');
  assert.equal(unitLocationLabel('unit_wfg_a_12_a1', 'en'), 'Block A · 12/F · Flat A1');
  assert.equal(unitLocationLabel('unt_demo_a_12f_a1', 'zh-Hant'), 'A座 · 12樓 · A1室');
  assert.deepEqual(parseUnitId('unit_wfg_b_3_b7'), { block: 'B', floor: 3, unit: 'B7' });
  assert.equal(unitLocationLabel('something_else', 'en'), null, 'unreadable ids give null, so the screen shows a dash');
  assert.equal(unitLocationLabel(null, 'en'), null);
});
