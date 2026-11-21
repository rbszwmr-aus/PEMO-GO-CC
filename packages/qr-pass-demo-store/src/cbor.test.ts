import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CborError, CborTag, cborDecode, cborEncode, type CborValue } from './cbor.js';

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');

describe('minimal CBOR', () => {
  it('encodes RFC 8949 Appendix A vectors', () => {
    const cases: [CborValue, string][] = [
      [0, '00'], [23, '17'], [24, '1818'], [100, '1864'], [1000, '1903e8'],
      [1000000, '1a000f4240'], [1000000000000, '1b000000e8d4a51000'],
      [-1, '20'], [-8, '27'], [-1000, '3903e7'],
      ['', '60'], ['IETF', '6449455446'], [Uint8Array.of(1, 2, 3, 4), '4401020304'],
      [[1, [2, 3]], '8201820203'], [new Map<string | number, CborValue>([[1, 2], [3, 4]]), 'a201020304'],
      [new CborTag(18, []), 'd280'], [null, 'f6'], [true, 'f5'],
    ];
    for (const [value, expected] of cases) {
      assert.equal(hex(cborEncode(value)), expected);
      assert.deepEqual(cborDecode(Buffer.from(expected, 'hex')), value);
    }
  });

  it('rejects indefinite lengths, floats, trailing bytes, duplicate keys', () => {
    assert.throws(() => cborDecode(Buffer.from('9f01ff', 'hex')), CborError);
    assert.throws(() => cborDecode(Buffer.from('f93c00', 'hex')), CborError);
    assert.throws(() => cborDecode(Buffer.from('0000', 'hex')), CborError);
    assert.throws(() => cborDecode(Buffer.from('a201020103', 'hex')), CborError);
    assert.throws(() => cborDecode(Buffer.from('44010203', 'hex')), CborError);
  });
});
