/**
 * COSE_Sign1 (RFC 9052) with EdDSA / Ed25519 (COSE alg -8), node:crypto only.
 *
 *   COSE_Sign1 = #6.18([ protected: bstr .cbor {1: -8, 4: kid-bstr}, unprotected: {}, payload: bstr, signature: bstr ])
 *   Sig_structure = ["Signature1", protected, external_aad = h'', payload]
 */

import { sign as cryptoSign, verify as cryptoVerify, type KeyObject } from 'node:crypto';
import { CborError, CborTag, cborDecode, cborEncode, type CborKey, type CborValue } from './cbor.js';

export const COSE_SIGN1_TAG = 18;
export const COSE_ALG_EDDSA = -8;
const HDR_ALG = 1;
const HDR_KID = 4;

const utf8 = new TextEncoder();
const utf8d = new TextDecoder('utf-8', { fatal: true });

const sigStructure = (protectedBytes: Uint8Array, payload: Uint8Array): Uint8Array =>
  cborEncode(['Signature1', protectedBytes, new Uint8Array(), payload]);

export const coseSign1 = (payload: Uint8Array, kid: string, privateKey: KeyObject): Uint8Array => {
  const protectedBytes = cborEncode(new Map<CborKey, CborValue>([
    [HDR_ALG, COSE_ALG_EDDSA],
    [HDR_KID, utf8.encode(kid)],
  ]));
  const signature = new Uint8Array(cryptoSign(null, sigStructure(protectedBytes, payload), privateKey));
  return cborEncode(new CborTag(COSE_SIGN1_TAG, [protectedBytes, new Map(), payload, signature]));
};

export interface ParsedSign1 {
  readonly protectedBytes: Uint8Array;
  readonly alg: number;
  readonly kid: string;
  readonly payload: Uint8Array;
  readonly signature: Uint8Array;
}

/** Structural parse only (no signature check). Throws CborError on anything malformed. */
export const parseCoseSign1 = (bytes: Uint8Array): ParsedSign1 => {
  let top = cborDecode(bytes);
  if (top instanceof CborTag) {
    if (top.tag !== COSE_SIGN1_TAG) throw new CborError(`unexpected tag ${top.tag}`);
    top = top.value;
  }
  if (!Array.isArray(top) || top.length !== 4) throw new CborError('COSE_Sign1 must be a 4-element array');
  const [protectedBytes, unprotected, payload, signature] = top;
  if (!(protectedBytes instanceof Uint8Array) || !(payload instanceof Uint8Array)
    || !(signature instanceof Uint8Array) || !(unprotected instanceof Map)) {
    throw new CborError('COSE_Sign1 element types are wrong');
  }
  const hdr = protectedBytes.length === 0 ? new Map() : cborDecode(protectedBytes);
  if (!(hdr instanceof Map)) throw new CborError('protected header must be a map');
  const alg = hdr.get(HDR_ALG);
  const kidRaw = hdr.get(HDR_KID);
  if (typeof alg !== 'number') throw new CborError('protected header has no alg');
  let kid: string;
  if (kidRaw instanceof Uint8Array) kid = utf8d.decode(kidRaw);
  else if (typeof kidRaw === 'string') kid = kidRaw;
  else throw new CborError('protected header has no kid');
  return { protectedBytes, alg, kid, payload, signature };
};

export const verifyCoseSign1 = (parsed: ParsedSign1, publicKey: KeyObject): boolean => {
  if (parsed.alg !== COSE_ALG_EDDSA || parsed.signature.length !== 64) return false;
  try {
    return cryptoVerify(null, sigStructure(parsed.protectedBytes, parsed.payload), publicKey, parsed.signature);
  } catch {
    return false;
  }
};
