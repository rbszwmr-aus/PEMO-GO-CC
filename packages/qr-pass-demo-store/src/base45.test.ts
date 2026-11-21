import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import { Base45Error, base45Decode, base45Encode } from './base45.js';

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
const text = (b: Uint8Array): string => new TextDecoder().decode(b);

describe('base45 (RFC 9285)', () => {
  it('matches the RFC 9285 examples', () => {
    assert.equal(base45Encode(utf8('AB')), 'BB8');
    assert.equal(base45Encode(utf8('Hello!!')), '%69 VD92EX0');
    assert.equal(base45Encode(utf8('base-45')), 'UJCLQE7W581');
    assert.equal(text(base45Decode('QED8WEX0')), 'ietf!');
    assert.equal(text(base45Decode('%69 VD92EX0')), 'Hello!!');
  });

  it('handles empty input and edge bytes', () => {
    assert.equal(base45Encode(new Uint8Array()), '');
    assert.deepEqual(base45Decode(''), new Uint8Array());
    assert.equal(base45Encode(Uint8Array.of(0xff, 0xff)), 'FGW');
    assert.deepEqual(base45Decode('FGW'), Uint8Array.of(0xff, 0xff));
    assert.deepEqual(base45Decode('U5'), Uint8Array.of(0xff));
  });

  it('round-trips random bytes of every small length', () => {
    for (let len = 0; len < 300; len++) {
      const b = new Uint8Array(randomBytes(len));
      const enc = base45Encode(b);
      assert.match(enc, /^[0-9A-Z $%*+\-./:]*$/);
      assert.deepEqual(base45Decode(enc), b);
    }
  });

  it('rejects invalid input', () => {
    assert.throws(() => base45Decode('A'), Base45Error); // dangling char
    assert.throws(() => base45Decode('GGW'), Base45Error); // 65536 overflow
    assert.throws(() => base45Decode(':;'), Base45Error); // bad char
    assert.throws(() => base45Decode('aB8'), Base45Error); // lowercase
    assert.throws(() => base45Decode('::'), Base45Error); // pair > 255
  });
});
