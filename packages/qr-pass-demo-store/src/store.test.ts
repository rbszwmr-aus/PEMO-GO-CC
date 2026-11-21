import assert from 'node:assert/strict';
import { createPublicKey } from 'node:crypto';
import { describe, it } from 'node:test';
import { base45Decode, base45Encode } from './base45.js';
import { CborTag, cborDecode, cborEncode } from './cbor.js';
import { COSE_ALG_EDDSA, parseCoseSign1, verifyCoseSign1 } from './cose.js';
import { createQrPassStore, type QrPassStore } from './store.js';
import { QR_PREFIX, SKEW_SECONDS } from './types.js';

const T0 = Date.parse('2026-09-26T00:00:00Z');
const clock = () => {
  let ms = T0;
  return { now: () => new Date(ms), set: (iso: string) => { ms = Date.parse(iso); }, add: (s: number) => { ms += s * 1000; } };
};

const issueVisitor = (store: QrPassStore, over: Record<string, unknown> = {}) => {
  const res = store.issue({
    purpose: 'VISITOR_ACCESS',
    subject_ref: 'vsr_TEST0001',
    not_before: '2026-09-26T00:00:00Z',
    expires_at: '2026-09-27T00:00:00Z',
    module_ref: 'vis_seed_courier',
    ...over,
  });
  assert.ok(res.ok, JSON.stringify(!res.ok && res.problem));
  return res.value.response;
};

const scan = (store: QrPassStore, payload: string) => {
  const r = store.scan({ payload });
  assert.ok(r.ok);
  return r.value;
};

describe('qr-pass-demo-store: format + sign/verify', () => {
  it('issues a QP1: base45 COSE_Sign1 CWT with the contract claims, verifiable with the JWKS key', () => {
    const c = clock();
    const store = createQrPassStore({ now: c.now, kid: 'k1' });
    const pass = issueVisitor(store);
    assert.match(pass.pass_id, /^qp_[0-9A-HJKMNP-TV-Z]{8}$/);
    assert.equal(pass.use_limit, 2); // D6 default
    assert.equal(pass.kid, 'k1');
    assert.equal(pass.qr.mode, 'alphanumeric');
    assert.ok(pass.qr.payload.startsWith(QR_PREFIX));
    assert.match(pass.qr.payload, /^QP1:[0-9A-Z $%*+\-./:]+$/);

    const bytes = base45Decode(pass.qr.payload.slice(4));
    const top = cborDecode(bytes);
    assert.ok(top instanceof CborTag && top.tag === 18);
    const parsed = parseCoseSign1(bytes);
    assert.equal(parsed.alg, COSE_ALG_EDDSA);
    assert.equal(parsed.kid, 'k1');
    const jwk = store.jwks().keys[0]!;
    assert.deepEqual({ kty: jwk.kty, crv: jwk.crv, kid: jwk.kid, use: jwk.use }, { kty: 'OKP', crv: 'Ed25519', kid: 'k1', use: 'sig' });
    const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' });
    assert.equal(verifyCoseSign1(parsed, pub), true);

    const claims = cborDecode(parsed.payload) as Map<string | number, unknown>;
    assert.equal(claims.get('v'), 1);
    assert.equal(claims.get('p'), 'VA');
    assert.equal(claims.get('m'), 'pemo');
    assert.equal(claims.get(2), 'vsr_TEST0001');
    assert.equal(claims.get('i'), pass.pass_id);
    assert.equal(new TextDecoder().decode(claims.get(7) as Uint8Array), pass.jti);
    assert.equal(claims.get(5), T0 / 1000);
    assert.equal(claims.get(4), T0 / 1000 + 86400);
    assert.equal(claims.get('u'), 2);
    assert.equal(claims.get('r'), 'vis_seed_courier');
  });

  it('first scan is ACCEPTED and returns the verified claims', () => {
    const c = clock();
    const store = createQrPassStore({ now: c.now });
    const pass = issueVisitor(store);
    c.add(3600);
    const out = scan(store, pass.qr.payload);
    assert.equal(out.scan.result, 'ACCEPTED');
    assert.equal(out.claims?.i, pass.pass_id);
    assert.equal(out.pass?.uses_remaining, 1);
    assert.equal(out.scan.purpose, 'VISITOR_ACCESS');
  });

  it('a key from another store (restart / forged kid) gives UNKNOWN_KEY', () => {
    const a = createQrPassStore({ kid: 'kA' });
    const b = createQrPassStore({ kid: 'kB' });
    const pass = issueVisitor(a, { not_before: undefined, expires_at: new Date(Date.now() + 3600_000).toISOString() });
    assert.equal(scan(b, pass.qr.payload).scan.result, 'UNKNOWN_KEY');
  });

  it('same kid but a different key (tampered signature) gives REJECTED_SIGNATURE', () => {
    const a = createQrPassStore({ kid: 'k1' });
    const b = createQrPassStore({ kid: 'k1' });
    const pass = issueVisitor(a, { not_before: undefined, expires_at: new Date(Date.now() + 3600_000).toISOString() });
    assert.equal(scan(b, pass.qr.payload).scan.result, 'REJECTED_SIGNATURE');
  });
});

describe('qr-pass-demo-store: tamper', () => {
  it('flipping a claim byte / a signature byte / garbage gives REJECTED_SIGNATURE', () => {
    const c = clock();
    const store = createQrPassStore({ now: c.now });
    const pass = issueVisitor(store);
    const bytes = base45Decode(pass.qr.payload.slice(4));
    const parsed = parseCoseSign1(bytes);

    // change u = 2 -> u = 9 inside the signed payload, keep the old signature
    const claims = cborDecode(parsed.payload) as Map<string | number, never>;
    claims.set('u', 9 as never);
    const forged = cborEncode(new CborTag(18, [parsed.protectedBytes, new Map(), cborEncode(claims), parsed.signature]));
    const r1 = scan(store, QR_PREFIX + base45Encode(forged));
    assert.equal(r1.scan.result, 'REJECTED_SIGNATURE');
    assert.equal(r1.claims, null);
    assert.equal(r1.scan.pass_id, null);

    const sigFlip = Uint8Array.from(bytes);
    sigFlip[sigFlip.length - 1] = sigFlip[sigFlip.length - 1]! ^ 0x01;
    assert.equal(scan(store, QR_PREFIX + base45Encode(sigFlip)).scan.result, 'REJECTED_SIGNATURE');

    for (const bad of ['', 'QP1:', 'QP1:A', 'hello', 'QP2:' + pass.qr.payload.slice(4), pass.qr.payload.slice(0, -3)]) {
      assert.equal(scan(store, bad).scan.result, 'REJECTED_SIGNATURE', bad);
    }
    // no use was consumed by any of these
    const got = store.get(pass.pass_id);
    assert.ok(got.ok && got.value.uses_seen === 0);
  });
});

describe('qr-pass-demo-store: window + skew (D7 ±120 s)', () => {
  it('not-yet-valid before nbf - skew, accepted from nbf - skew', () => {
    const c = clock();
    const store = createQrPassStore({ now: c.now });
    const pass = issueVisitor(store, { not_before: '2026-09-26T10:00:00Z', expires_at: '2026-09-26T12:00:00Z' });
    c.set('2026-09-26T09:57:59Z');
    assert.equal(scan(store, pass.qr.payload).scan.result, 'REJECTED_NOT_YET_VALID');
    c.set('2026-09-26T09:58:00Z');
    assert.equal(scan(store, pass.qr.payload).scan.result, 'ACCEPTED');
  });

  it('accepted until exp + skew, expired after', () => {
    const c = clock();
    const store = createQrPassStore({ now: c.now });
    const pass = issueVisitor(store, { not_before: '2026-09-26T10:00:00Z', expires_at: '2026-09-26T12:00:00Z', use_limit: 0 });
    c.set('2026-09-26T12:02:00Z');
    assert.equal(scan(store, pass.qr.payload).scan.result, 'ACCEPTED');
    c.add(1);
    assert.equal(scan(store, pass.qr.payload).scan.result, 'REJECTED_EXPIRED');
    const got = store.get(pass.pass_id);
    assert.ok(got.ok && got.value.status === 'expired');
    assert.equal(SKEW_SECONDS, 120);
  });

  it('rejects lifetime > 7 days over HTTP semantics, caps it for in-process clamp', () => {
    const c = clock();
    const store = createQrPassStore({ now: c.now });
    const input = { purpose: 'VISITOR_ACCESS', subject_ref: 'vsr_X', not_before: '2026-09-26T00:00:00Z', expires_at: '2026-10-10T00:00:00Z' };
    const r = store.issue(input);
    assert.ok(!r.ok && r.problem.suffix === 'invalid-request' && r.problem.status === 400);
    const clamped = store.issue(input, { clampLifetime: true });
    assert.ok(clamped.ok);
    assert.equal(clamped.value.response.expires_at, '2026-10-03T00:00:00Z');
    const bad = store.issue({ ...input, expires_at: '2026-09-25T00:00:00Z' });
    assert.ok(!bad.ok && bad.problem.suffix === 'invalid-request');
  });
});

describe('qr-pass-demo-store: use limit (D6 u = 2), replay, revoke', () => {
  it('u = 2: ACCEPTED, ACCEPTED, then REJECTED_USE_LIMIT', () => {
    const c = clock();
    const store = createQrPassStore({ now: c.now });
    const pass = issueVisitor(store);
    assert.equal(scan(store, pass.qr.payload).scan.result, 'ACCEPTED');
    assert.equal(scan(store, pass.qr.payload).scan.result, 'ACCEPTED');
    const third = scan(store, pass.qr.payload);
    assert.equal(third.scan.result, 'REJECTED_USE_LIMIT');
    assert.equal(third.pass?.uses_seen, 2);
    assert.equal(third.pass?.uses_remaining, 0);
  });

  it('u = 1: second scan is REJECTED_REPLAY', () => {
    const store = createQrPassStore({ now: clock().now });
    const pass = issueVisitor(store, { use_limit: 1 });
    assert.equal(scan(store, pass.qr.payload).scan.result, 'ACCEPTED');
    assert.equal(scan(store, pass.qr.payload).scan.result, 'REJECTED_REPLAY');
  });

  it('online consume by pass id (no payload) counts the same uses', () => {
    const store = createQrPassStore({ now: clock().now });
    const pass = issueVisitor(store);
    const r = store.scan({ passId: pass.pass_id });
    assert.ok(r.ok && r.value.scan.result === 'ACCEPTED');
    assert.equal(scan(store, pass.qr.payload).scan.result, 'ACCEPTED');
    const r3 = store.scan({ passId: pass.pass_id });
    assert.ok(r3.ok && r3.value.scan.result === 'REJECTED_USE_LIMIT');
    const other = issueVisitor(store);
    const mismatch = store.scan({ passId: other.pass_id, payload: pass.qr.payload });
    assert.ok(!mismatch.ok && mismatch.problem.status === 400);
    const missing = store.scan({ passId: 'qp_NOPE0000' });
    assert.ok(!missing.ok && missing.problem.suffix === 'pass-not-found');
  });

  it('revoke is idempotent, gives REJECTED_REVOKED, and lands on the revocation list', () => {
    const c = clock();
    const store = createQrPassStore({ now: c.now });
    const pass = issueVisitor(store);
    assert.equal(scan(store, pass.qr.payload).scan.result, 'ACCEPTED');
    const r1 = store.revoke(pass.pass_id, 'booking_cancelled');
    assert.ok(r1.ok && r1.value.revocation_list_version === 1);
    c.add(30);
    const r2 = store.revoke(pass.pass_id, 'other_reason');
    assert.ok(r2.ok);
    assert.deepEqual(r2.value, r1.value);
    assert.equal(scan(store, pass.qr.payload).scan.result, 'REJECTED_REVOKED');
    const got = store.get(pass.pass_id);
    assert.ok(got.ok && got.value.status === 'revoked' && got.value.revocation_reason === 'booking_cancelled');

    const full = store.revocations();
    assert.ok(full.ok);
    assert.equal(full.value.list.full, true);
    assert.deepEqual(full.value.list.revoked.map((x) => x.pass_id), [pass.pass_id]);
    assert.equal(full.value.jws.split('.').length, 3);
    const delta = store.revocations('rl_1');
    assert.ok(delta.ok && delta.value.list.revoked.length === 0 && delta.value.list.full === false);
    const gone = store.revocations('rl_99');
    assert.ok(!gone.ok && gone.problem.status === 410);
    assert.ok(store.revoke(pass.pass_id, 'Free text with spaces').ok); // already revoked -> 200 original
    assert.ok(!store.revoke('qp_NOPE0000', 'x').ok);
  });

  it('revocation-list JWS verifies with the JWKS key', async () => {
    const { verify } = await import('node:crypto');
    const store = createQrPassStore({ now: clock().now });
    const r = store.revocations();
    assert.ok(r.ok);
    const [h, p, s] = r.value.jws.split('.') as [string, string, string];
    const jwk = store.jwks().keys[0]!;
    const pub = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' });
    assert.equal(verify(null, Buffer.from(`${h}.${p}`), pub, Buffer.from(s, 'base64url')), true);
    assert.equal(JSON.parse(Buffer.from(h, 'base64url').toString()).alg, 'EdDSA');
  });
});

describe('qr-pass-demo-store: issue validation, idempotency, outbox', () => {
  it('purpose + subject validation and Idempotency-Key semantics', () => {
    const store = createQrPassStore({ now: clock().now });
    const base = { purpose: 'VISITOR_ACCESS', subject_ref: 'vsr_A', expires_at: '2026-09-26T08:00:00Z' };
    const pay = store.issue({ ...base, purpose: 'PAYMENT' });
    assert.ok(!pay.ok && pay.problem.suffix === 'purpose-unknown');
    const foo = store.issue({ ...base, purpose: 'FOO' });
    assert.ok(!foo.ok && foo.problem.suffix === 'purpose-unknown');
    const pii = store.issue({ ...base, subject_ref: 'Chan Tai Man' });
    assert.ok(!pii.ok && pii.problem.suffix === 'invalid-request');
    const a = store.issue(base, { idempotencyKey: 'k-1' });
    const b = store.issue(base, { idempotencyKey: 'k-1' });
    assert.ok(a.ok && b.ok && b.value.replayed && a.value.response.pass_id === b.value.response.pass_id);
    const conflict = store.issue({ ...base, use_limit: 5 }, { idempotencyKey: 'k-1' });
    assert.ok(!conflict.ok && conflict.problem.suffix === 'idempotency-conflict' && conflict.problem.status === 409);
    const otherModule = store.get(a.value.response.pass_id, 'parkcore');
    assert.ok(!otherModule.ok && otherModule.problem.status === 403);
  });

  it('records pass.issued / pass.scanned / pass.revoked with the §5.5 envelope and data', () => {
    const store = createQrPassStore({ now: clock().now });
    const pass = issueVisitor(store);
    scan(store, pass.qr.payload);
    store.revoke(pass.pass_id, 'booking_cancelled');
    const ev = store.outbox({ pass_id: pass.pass_id });
    assert.deepEqual(ev.map((e) => e.type), ['pass.issued', 'pass.scanned', 'pass.revoked']);
    for (const e of ev) {
      assert.match(e.id, /^evt_/);
      assert.equal(e.module, 'pemo');
      assert.match(e.occurred_at, /Z$/);
    }
    assert.deepEqual(Object.keys(ev[0]!.data).sort(),
      ['expires_at', 'jti', 'kid', 'not_before', 'pass_id', 'purpose', 'subject_ref', 'use_limit']);
    assert.deepEqual(Object.keys(ev[1]!.data).sort(), [
      'device_id', 'jti', 'kid', 'location_ref', 'module_decision_ref', 'offline', 'pass_id', 'purpose', 'received_at',
      'result', 'revocation_list_version', 'revocation_stale', 'scan_id', 'scanned_at']);
    assert.deepEqual(Object.keys(ev[2]!.data).sort(), ['pass_id', 'reason', 'revocation_list_version', 'revoked_at']);
    assert.equal(store.scans({ module: 'pemo', pass_id: pass.pass_id }).records.length, 1);
  });
});
