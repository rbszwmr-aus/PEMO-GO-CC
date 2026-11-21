/**
 * Relative time from the RESPONSE's clock, by Intl (UI-051 D3, design system §16).
 *
 * The reference instant is a parameter, so the same fixture renders the same
 * words on every run; the expected strings come from Intl itself rather than
 * being typed here, so the assertion is about unit selection and sign, not
 * about one ICU build's spelling.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { relativeTime } from '../../src/format/datetime.ts';

const NOW = '2026-08-12T09:56:00+08:00'; // lifecycle.json meta.generatedAt

test('the age is measured from the reference instant, not the wall clock', () => {
  const en = new Intl.RelativeTimeFormat('en-HK', { numeric: 'auto' });
  assert.equal(relativeTime('2026-08-12T09:00:00+08:00', NOW, 'en'), en.format(-56, 'minute'));
  assert.equal(relativeTime('2026-08-01T09:00:00+08:00', NOW, 'en'), en.format(-2, 'week'));
  assert.equal(relativeTime('2026-09-10T09:00:00+08:00', NOW, 'en'), en.format(4, 'week'));
  assert.equal(relativeTime('2026-08-12T09:56:00+08:00', NOW, 'en'), en.format(0, 'second'));
});

test('Traditional Chinese comes from Intl, never assembled from fragments', () => {
  const zh = new Intl.RelativeTimeFormat('zh-Hant-HK', { numeric: 'auto' });
  const out = relativeTime('2026-08-12T09:00:00+08:00', NOW, 'zh-Hant');
  assert.equal(out, zh.format(-56, 'minute'));
  assert.match(out, /[一-鿿]/, 'the Chinese rendering carries no CJK glyph');
});

test('changing the reference changes the words — the clock is the response’s', () => {
  const a = relativeTime('2026-08-12T09:00:00+08:00', '2026-08-12T09:56:00+08:00', 'en');
  const b = relativeTime('2026-08-12T09:00:00+08:00', '2026-09-03T09:00:00+08:00', 'en');
  assert.notEqual(a, b);
});
