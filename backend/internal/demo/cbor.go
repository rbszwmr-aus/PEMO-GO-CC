package demo

import (
	"crypto/ed25519"
	"errors"
	"fmt"
	"unicode/utf8"
)

// ---- minimal deterministic CBOR (ints, text, bytes, arrays, maps, tags,
// bool, null; no floats, no indefinite lengths) ----

var errCbor = errors.New("cbor")

func cborErr(format string, a ...any) error {
	return fmt.Errorf("%w: %s", errCbor, fmt.Sprintf(format, a...))
}

// CMap is an ordered CBOR map with int64 or string keys.
type CMap struct {
	Keys []any
	Vals []any
}

func (m *CMap) Set(k, v any) {
	for i, x := range m.Keys {
		if x == k {
			m.Vals[i] = v
			return
		}
	}
	m.Keys, m.Vals = append(m.Keys, k), append(m.Vals, v)
}

func (m *CMap) Get(k any) (any, bool) {
	for i, x := range m.Keys {
		if x == k {
			return m.Vals[i], true
		}
	}
	return nil, false
}

// CTag is a tagged item.
type CTag struct {
	Tag   uint64
	Value any
}

const maxDepth = 16

func head(major byte, n uint64, out []byte) []byte {
	m := major << 5
	switch {
	case n < 24:
		return append(out, m|byte(n))
	case n < 0x100:
		return append(out, m|24, byte(n))
	case n < 0x10000:
		return append(out, m|25, byte(n>>8), byte(n))
	case n < 0x100000000:
		return append(out, m|26, byte(n>>24), byte(n>>16), byte(n>>8), byte(n))
	}
	return append(out, m|27, byte(n>>56), byte(n>>48), byte(n>>40), byte(n>>32), byte(n>>24), byte(n>>16), byte(n>>8), byte(n))
}

func cborEncodeInto(v any, out []byte, depth int) ([]byte, error) {
	if depth > maxDepth {
		return nil, cborErr("nesting too deep")
	}
	switch x := v.(type) {
	case bool:
		if x {
			return append(out, 0xf5), nil
		}
		return append(out, 0xf4), nil
	case nil:
		return append(out, 0xf6), nil
	case int:
		return cborEncodeInto(int64(x), out, depth)
	case int64:
		if x >= 0 {
			return head(0, uint64(x), out), nil
		}
		return head(1, uint64(-1-x), out), nil
	case string:
		out = head(3, uint64(len(x)), out)
		return append(out, x...), nil
	case []byte:
		out = head(2, uint64(len(x)), out)
		return append(out, x...), nil
	case []any:
		out = head(4, uint64(len(x)), out)
		var err error
		for _, it := range x {
			if out, err = cborEncodeInto(it, out, depth+1); err != nil {
				return nil, err
			}
		}
		return out, nil
	case *CMap:
		out = head(5, uint64(len(x.Keys)), out)
		var err error
		for i := range x.Keys {
			if out, err = cborEncodeInto(x.Keys[i], out, depth+1); err != nil {
				return nil, err
			}
			if out, err = cborEncodeInto(x.Vals[i], out, depth+1); err != nil {
				return nil, err
			}
		}
		return out, nil
	case CTag:
		out = head(6, x.Tag, out)
		return cborEncodeInto(x.Value, out, depth+1)
	}
	return nil, cborErr("unsupported value %T", v)
}

func CborEncode(v any) ([]byte, error) { return cborEncodeInto(v, nil, 0) }

const maxSafe = 1<<53 - 1

func CborDecode(b []byte) (any, error) {
	pos := 0
	need := func(n uint64) error {
		if uint64(pos)+n > uint64(len(b)) {
			return cborErr("unexpected end of input")
		}
		return nil
	}
	readArg := func(info byte) (uint64, error) {
		if info < 24 {
			return uint64(info), nil
		}
		size := map[byte]int{24: 1, 25: 2, 26: 4, 27: 8}[info]
		if size == 0 {
			return 0, cborErr("unsupported additional info %d (indefinite lengths are rejected)", info)
		}
		if err := need(uint64(size)); err != nil {
			return 0, err
		}
		var v uint64
		for i := 0; i < size; i++ {
			v = v<<8 | uint64(b[pos+i])
		}
		pos += size
		if size == 8 && v > maxSafe {
			return 0, cborErr("integer outside safe range")
		}
		return v, nil
	}
	var item func(depth int) (any, error)
	item = func(depth int) (any, error) {
		if depth > maxDepth {
			return nil, cborErr("nesting too deep")
		}
		if err := need(1); err != nil {
			return nil, err
		}
		initial := b[pos]
		pos++
		major, info := initial>>5, initial&0x1f
		switch major {
		case 0, 1:
			n, err := readArg(info)
			if err != nil {
				return nil, err
			}
			if major == 0 {
				return int64(n), nil
			}
			return -1 - int64(n), nil
		case 2, 3:
			n, err := readArg(info)
			if err != nil {
				return nil, err
			}
			if err := need(n); err != nil {
				return nil, err
			}
			raw := append([]byte(nil), b[pos:pos+int(n)]...)
			pos += int(n)
			if major == 2 {
				return raw, nil
			}
			if !utf8.Valid(raw) {
				return nil, cborErr("invalid utf-8")
			}
			return string(raw), nil
		case 4:
			n, err := readArg(info)
			if err != nil {
				return nil, err
			}
			if n > uint64(len(b)) {
				return nil, cborErr("array length exceeds input")
			}
			arr := make([]any, 0, n)
			for i := uint64(0); i < n; i++ {
				v, err := item(depth + 1)
				if err != nil {
					return nil, err
				}
				arr = append(arr, v)
			}
			return arr, nil
		case 5:
			n, err := readArg(info)
			if err != nil {
				return nil, err
			}
			if n > uint64(len(b)) {
				return nil, cborErr("map length exceeds input")
			}
			m := &CMap{}
			for i := uint64(0); i < n; i++ {
				k, err := item(depth + 1)
				if err != nil {
					return nil, err
				}
				switch k.(type) {
				case int64, string:
				default:
					return nil, cborErr("map keys must be int or text")
				}
				if _, dup := m.Get(k); dup {
					return nil, cborErr("duplicate map key %v", k)
				}
				v, err := item(depth + 1)
				if err != nil {
					return nil, err
				}
				m.Set(k, v)
			}
			return m, nil
		case 6:
			t, err := readArg(info)
			if err != nil {
				return nil, err
			}
			v, err := item(depth + 1)
			if err != nil {
				return nil, err
			}
			return CTag{t, v}, nil
		}
		switch info {
		case 20:
			return false, nil
		case 21:
			return true, nil
		case 22:
			return nil, nil
		}
		return nil, cborErr("floats / other simple values are not supported")
	}
	v, err := item(0)
	if err != nil {
		return nil, err
	}
	if pos != len(b) {
		return nil, cborErr("trailing bytes after CBOR item")
	}
	return v, nil
}

// ---- COSE_Sign1 (EdDSA) ----

const (
	coseSign1Tag = 18
	coseAlgEdDSA = -8
	hdrAlg       = 1
	hdrKid       = 4
)

func sigStructure(protected, payload []byte) []byte {
	b, _ := CborEncode([]any{"Signature1", protected, []byte{}, payload})
	return b
}

func CoseSign1(payload []byte, kid string, key ed25519.PrivateKey) []byte {
	ph := &CMap{}
	ph.Set(int64(hdrAlg), int64(coseAlgEdDSA))
	ph.Set(int64(hdrKid), []byte(kid))
	protected, _ := CborEncode(ph)
	sig := ed25519.Sign(key, sigStructure(protected, payload))
	out, _ := CborEncode(CTag{coseSign1Tag, []any{protected, &CMap{}, payload, sig}})
	return out
}

type ParsedSign1 struct {
	Protected []byte
	Alg       int64
	Kid       string
	Payload   []byte
	Signature []byte
}

func ParseCoseSign1(b []byte) (*ParsedSign1, error) {
	top, err := CborDecode(b)
	if err != nil {
		return nil, err
	}
	if t, ok := top.(CTag); ok {
		if t.Tag != coseSign1Tag {
			return nil, cborErr("unexpected tag %d", t.Tag)
		}
		top = t.Value
	}
	arr, ok := top.([]any)
	if !ok || len(arr) != 4 {
		return nil, cborErr("COSE_Sign1 must be a 4-element array")
	}
	protected, ok1 := arr[0].([]byte)
	_, ok2 := arr[1].(*CMap)
	payload, ok3 := arr[2].([]byte)
	sig, ok4 := arr[3].([]byte)
	if !ok1 || !ok2 || !ok3 || !ok4 {
		return nil, cborErr("COSE_Sign1 element types are wrong")
	}
	hdr := &CMap{}
	if len(protected) > 0 {
		h, err := CborDecode(protected)
		if err != nil {
			return nil, err
		}
		if hdr, ok = h.(*CMap); !ok {
			return nil, cborErr("protected header must be a map")
		}
	}
	algV, _ := hdr.Get(int64(hdrAlg))
	alg, ok := algV.(int64)
	if !ok {
		return nil, cborErr("protected header has no alg")
	}
	kidV, _ := hdr.Get(int64(hdrKid))
	var kid string
	switch k := kidV.(type) {
	case []byte:
		if !utf8.Valid(k) {
			return nil, cborErr("kid is not utf-8")
		}
		kid = string(k)
	case string:
		kid = k
	default:
		return nil, cborErr("protected header has no kid")
	}
	return &ParsedSign1{protected, alg, kid, payload, sig}, nil
}

func VerifyCoseSign1(p *ParsedSign1, pub ed25519.PublicKey) bool {
	if p.Alg != coseAlgEdDSA || len(p.Signature) != 64 {
		return false
	}
	return ed25519.Verify(pub, sigStructure(p.Protected, p.Payload), p.Signature)
}

// ---- base45 (RFC 9285) ----

const base45Alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"

var errBase45 = errors.New("base45")

func Base45Encode(b []byte) string {
	out := make([]byte, 0, len(b)*3/2+2)
	for i := 0; i < len(b); i += 2 {
		if i+1 < len(b) {
			n := int(b[i])*256 + int(b[i+1])
			e, rest := n/2025, n%2025
			out = append(out, base45Alphabet[rest%45], base45Alphabet[rest/45], base45Alphabet[e])
		} else {
			n := int(b[i])
			out = append(out, base45Alphabet[n%45], base45Alphabet[n/45])
		}
	}
	return string(out)
}

func Base45Decode(s string) ([]byte, error) {
	if len(s)%3 == 1 {
		return nil, fmt.Errorf("%w: invalid base45 length", errBase45)
	}
	val := func(c byte) (int, error) {
		for i := 0; i < len(base45Alphabet); i++ {
			if base45Alphabet[i] == c {
				return i, nil
			}
		}
		return 0, fmt.Errorf("%w: invalid base45 character %q", errBase45, c)
	}
	out := []byte{}
	for i := 0; i < len(s); i += 3 {
		end := i + 3
		if end > len(s) {
			end = len(s)
		}
		d := []int{}
		for j := i; j < end; j++ {
			v, err := val(s[j])
			if err != nil {
				return nil, err
			}
			d = append(d, v)
		}
		if len(d) == 3 {
			n := d[0] + d[1]*45 + d[2]*2025
			if n > 0xffff {
				return nil, fmt.Errorf("%w: base45 triplet out of range", errBase45)
			}
			out = append(out, byte(n>>8), byte(n))
		} else {
			n := d[0] + d[1]*45
			if n > 0xff {
				return nil, fmt.Errorf("%w: base45 pair out of range", errBase45)
			}
			out = append(out, byte(n))
		}
	}
	return out, nil
}
