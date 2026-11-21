/**
 * QR visitor pass: parsing, the display-only `used` derivation, HKT formatting,
 * the copy-only deep link, and the QR matrix constraints (alphanumeric, ECC M,
 * version >= min_version).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  asVisitorPass,
  fillTemplate,
  passDisplayStatus,
  visitorDetailLink,
} from '../../src/data/visitor-pass.ts';
import { formatDateTimeHkt } from '../../src/format/datetime.ts';
import { qrMatrix, qrPath } from '../../src/data/qr-matrix.ts';

const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const longCode = 'QP1:' + Array.from({ length: 266 }, (_, i) => ALNUM[(i * 7) % 45]).join('');

const raw = {
  pass_id: 'qp_demo1',
  jti: 'j1',
  kid: 'k1',
  purpose: 'VISITOR_ACCESS',
  not_before: '2026-09-25T06:30:00Z',
  expires_at: '2026-09-26T06:30:00Z',
  use_limit: 2,
  qr: { payload: longCode, mode: 'alphanumeric', ecc: 'M', min_version: 10 },
  module: 'pemo',
  subject_ref: 'vsr_1',
  module_ref: 'vis_1',
  status: 'active',
  issued_at: '2026-09-25T06:30:00Z',
  uses_seen: 0,
  uses_remaining: 2,
  revoked_at: null,
  revocation_reason: null,
};

test('asVisitorPass keeps the snake_case shape and rejects a missing pass', () => {
  const p = asVisitorPass(raw);
  assert.ok(p);
  assert.equal(p.pass_id, 'qp_demo1');
  assert.equal(p.qr.payload, longCode);
  assert.equal(p.qr.min_version, 10);
  assert.equal(p.uses_remaining, 2);
  assert.equal(p.revoked_at, null);
  assert.equal(asVisitorPass(null), null);
  assert.equal(asVisitorPass(undefined), null);
  assert.equal(asVisitorPass({ ...raw, qr: null }), null);
  assert.equal(asVisitorPass({ ...raw, status: 'weird' })?.status, 'expired');
  assert.equal(asVisitorPass({ ...raw, uses_remaining: null })?.uses_remaining, null);
});

test('Used is display-only: uses_seen >= use_limit and not revoked', () => {
  const s = (status: 'active' | 'revoked' | 'expired', uses_seen: number, use_limit = 2) =>
    passDisplayStatus({ status, uses_seen, use_limit });
  assert.equal(s('active', 0), 'active');
  assert.equal(s('active', 1), 'active');
  assert.equal(s('active', 2), 'used');
  assert.equal(s('active', 3), 'used');
  assert.equal(s('expired', 1), 'expired');
  assert.equal(s('expired', 2), 'used');
  assert.equal(s('revoked', 0), 'revoked');
  assert.equal(s('revoked', 2), 'revoked');
  assert.equal(s('active', 5, 0), 'active', 'use_limit 0 is unlimited, never used');
});

test('HKT formatting is Asia/Hong_Kong, 24-hour, both locales', () => {
  const en = formatDateTimeHkt('2026-09-25T06:30:00Z', 'en');
  assert.match(en, /25/);
  assert.match(en, /Sep/);
  assert.match(en, /2026/);
  assert.match(en, /14:30/);
  const zh = formatDateTimeHkt('2026-09-25T06:30:00Z', 'zh-Hant');
  assert.match(zh, /2026/);
  assert.match(zh, /9月/);
  assert.match(zh, /14:30/);
  const rollover = formatDateTimeHkt('2026-09-25T17:05:00Z', 'en');
  assert.match(rollover, /26/);
  assert.match(rollover, /01:05/);
  assert.equal(formatDateTimeHkt('not-a-date', 'en'), 'not-a-date');
});

test('the share link is the visitor detail deep link', () => {
  const url = new URL(visitorDetailLink('http://192.168.0.134:5176/', 'vis_abc', 'zh-Hant'));
  assert.equal(url.searchParams.get('service'), 'visitor');
  assert.equal(url.searchParams.get('tab'), 'detail');
  assert.equal(url.searchParams.get('visitor'), 'vis_abc');
  assert.equal(url.searchParams.get('lang'), 'zh-Hant');
  assert.equal(fillTemplate('{a} of {b} {c}', { a: '1', b: '2' }), '1 of 2 {c}');
});

test('QR matrix: alphanumeric, version >= min_version, quiet-zone path', () => {
  const m = qrMatrix(longCode, 10);
  assert.ok(m);
  assert.ok(m.version >= 10, `version ${m.version}`);
  assert.equal(m.size, 17 + 4 * m.version);
  const forced = qrMatrix('QP1:AB', 12);
  assert.ok(forced);
  assert.equal(forced.version, 12, 'a short code is lifted to min_version');
  assert.equal(qrMatrix('qp1:lowercase', 1), null, 'lowercase is not alphanumeric mode');
  const darkCount = m.dark.flat().filter(Boolean).length;
  assert.equal(qrPath(m).split('M').length - 1, darkCount);
  assert.match(qrPath(m), /^M4 4h1v1h-1z/, 'finder corner starts at the quiet-zone offset');
});