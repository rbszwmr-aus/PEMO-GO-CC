/**
 * Base45 (RFC 9285). Alphabet is QR alphanumeric-mode safe.
 * Encode: each 2 bytes [a, b] -> n = a*256 + b -> c d e with n = c + d*45 + e*45^2;
 * a trailing single byte -> c d. Decode rejects any char outside the alphabet,
 * a dangling single char, and chunk values that overflow (> 65535 / > 255).
 */

export const BASE45_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const DECODE: ReadonlyMap<string, number> = new Map(
  [...BASE45_ALPHABET].map((ch, i) => [ch, i] as const),
);

export class Base45Error extends Error {
  override readonly name = 'Base45Error';
}

export const base45Encode = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 2) {
    if (i + 1 < bytes.length) {
      const n = bytes[i]! * 256 + bytes[i + 1]!;
      const e = Math.floor(n / 2025);
      const rest = n % 2025;
      out += BASE45_ALPHABET[rest % 45]! + BASE45_ALPHABET[Math.floor(rest / 45)]! + BASE45_ALPHABET[e]!;
    } else {
      const n = bytes[i]!;
      out += BASE45_ALPHABET[n % 45]! + BASE45_ALPHABET[Math.floor(n / 45)]!;
    }
  }
  return out;
};

export const base45Decode = (text: string): Uint8Array => {
  if (text.length % 3 === 1) throw new Base45Error('invalid base45 length');
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 3) {
    const chunk = text.slice(i, i + 3);
    const digits = [...chunk].map((ch) => {
      const v = DECODE.get(ch);
      if (v === undefined) throw new Base45Error(`invalid base45 character ${JSON.stringify(ch)}`);
      return v;
    });
    if (digits.length === 3) {
      const n = digits[0]! + digits[1]! * 45 + digits[2]! * 2025;
      if (n > 0xffff) throw new Base45Error('base45 triplet out of range');
      out.push(n >> 8, n & 0xff);
    } else {
      const n = digits[0]! + digits[1]! * 45;
      if (n > 0xff) throw new Base45Error('base45 pair out of range');
      out.push(n);
    }
  }
  return Uint8Array.from(out);
};
