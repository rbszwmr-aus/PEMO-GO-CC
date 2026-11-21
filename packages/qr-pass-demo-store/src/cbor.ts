/**
 * Minimal, strict CBOR (RFC 8949) for COSE_Sign1 / CWT — only what the pass
 * format needs: unsigned/negative ints (safe-integer range), byte strings,
 * text strings, arrays, maps (int or text keys), tags, false/true/null.
 *
 * Encoding is deterministic (shortest-form heads, definite lengths, map order
 * as given). Decoding is strict: definite lengths only, no floats, no
 * duplicate map keys, no trailing bytes, bounded nesting depth.
 */

export type CborKey = number | string;
export type CborValue =
  | number
  | string
  | boolean
  | null
  | Uint8Array
  | CborValue[]
  | Map<CborKey, CborValue>
  | CborTag;

export class CborTag {
  constructor(
    readonly tag: number,
    readonly value: CborValue,
  ) {}
}

export class CborError extends Error {
  override readonly name = 'CborError';
}

const MAX_DEPTH = 16;

const head = (major: number, n: number, out: number[]): void => {
  if (!Number.isSafeInteger(n) || n < 0) throw new CborError(`cannot encode length/int ${n}`);
  const m = major << 5;
  if (n < 24) out.push(m | n);
  else if (n < 0x100) out.push(m | 24, n);
  else if (n < 0x10000) out.push(m | 25, n >> 8, n & 0xff);
  else if (n < 0x100000000) out.push(m | 26, (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  else {
    const hi = Math.floor(n / 0x100000000);
    const lo = n >>> 0;
    out.push(m | 27, (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
      (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);
  }
};

const encodeInto = (value: CborValue, out: number[], depth: number): void => {
  if (depth > MAX_DEPTH) throw new CborError('nesting too deep');
  if (value === false) out.push(0xf4);
  else if (value === true) out.push(0xf5);
  else if (value === null) out.push(0xf6);
  else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new CborError(`only safe integers are supported: ${value}`);
    if (value >= 0) head(0, value, out);
    else head(1, -1 - value, out);
  } else if (typeof value === 'string') {
    const bytes = new TextEncoder().encode(value);
    head(3, bytes.length, out);
    for (const b of bytes) out.push(b);
  } else if (value instanceof Uint8Array) {
    head(2, value.length, out);
    for (const b of value) out.push(b);
  } else if (Array.isArray(value)) {
    head(4, value.length, out);
    for (const item of value) encodeInto(item, out, depth + 1);
  } else if (value instanceof Map) {
    head(5, value.size, out);
    for (const [k, v] of value) {
      encodeInto(k, out, depth + 1);
      encodeInto(v, out, depth + 1);
    }
  } else if (value instanceof CborTag) {
    head(6, value.tag, out);
    encodeInto(value.value, out, depth + 1);
  } else {
    throw new CborError('unsupported value');
  }
};

export const cborEncode = (value: CborValue): Uint8Array => {
  const out: number[] = [];
  encodeInto(value, out, 0);
  return Uint8Array.from(out);
};

export const cborDecode = (bytes: Uint8Array): CborValue => {
  let pos = 0;
  const need = (n: number): void => {
    if (pos + n > bytes.length) throw new CborError('unexpected end of input');
  };
  const readArg = (info: number): number => {
    if (info < 24) return info;
    if (info === 24) { need(1); return bytes[pos++]!; }
    if (info === 25) { need(2); const v = (bytes[pos]! << 8) | bytes[pos + 1]!; pos += 2; return v; }
    if (info === 26) {
      need(4);
      const v = ((bytes[pos]! << 24) >>> 0) + (bytes[pos + 1]! << 16) + (bytes[pos + 2]! << 8) + bytes[pos + 3]!;
      pos += 4;
      return v;
    }
    if (info === 27) {
      need(8);
      let v = 0;
      for (let i = 0; i < 8; i++) v = v * 256 + bytes[pos + i]!;
      pos += 8;
      if (!Number.isSafeInteger(v)) throw new CborError('integer outside safe range');
      return v;
    }
    throw new CborError(`unsupported additional info ${info} (indefinite lengths are rejected)`);
  };
  const item = (depth: number): CborValue => {
    if (depth > MAX_DEPTH) throw new CborError('nesting too deep');
    need(1);
    const initial = bytes[pos++]!;
    const major = initial >> 5;
    const info = initial & 0x1f;
    switch (major) {
      case 0: return readArg(info);
      case 1: return -1 - readArg(info);
      case 2: {
        const n = readArg(info); need(n);
        const b = new Uint8Array(bytes.subarray(pos, pos + n)); pos += n; return b;
      }
      case 3: {
        const n = readArg(info); need(n);
        const s = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(pos, pos + n));
        pos += n; return s;
      }
      case 4: {
        const n = readArg(info);
        if (n > bytes.length) throw new CborError('array length exceeds input');
        const arr: CborValue[] = [];
        for (let i = 0; i < n; i++) arr.push(item(depth + 1));
        return arr;
      }
      case 5: {
        const n = readArg(info);
        if (n > bytes.length) throw new CborError('map length exceeds input');
        const map = new Map<CborKey, CborValue>();
        for (let i = 0; i < n; i++) {
          const k = item(depth + 1);
          if (typeof k !== 'number' && typeof k !== 'string') throw new CborError('map keys must be int or text');
          if (map.has(k)) throw new CborError(`duplicate map key ${String(k)}`);
          map.set(k, item(depth + 1));
        }
        return map;
      }
      case 6: {
        const tag = readArg(info);
        return new CborTag(tag, item(depth + 1));
      }
      default: {
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        throw new CborError('floats / other simple values are not supported');
      }
    }
  };
  const value = item(0);
  if (pos !== bytes.length) throw new CborError('trailing bytes after CBOR item');
  return value;
};
