package api

import (
	"bytes"
	"encoding/json"
	"time"

	"pemo/internal/platform"
)

// O is a JSON object that keeps insertion order, so responses read in the
// same order the contract and the Node build wrote them.
type O []KV

// KV is one member.
type KV struct {
	K string
	V any
}

// obj builds an O from alternating keys and values.
func obj(kv ...any) O {
	o := make(O, 0, len(kv)/2)
	for i := 0; i+1 < len(kv); i += 2 {
		o = append(o, KV{kv[i].(string), kv[i+1]})
	}
	return o
}

// with appends members.
func (o O) with(kv ...any) O { return append(o, obj(kv...)...) }

// when appends members only if cond holds (the `...(cond ? {k: v} : {})` idiom).
func (o O) when(cond bool, kv ...any) O {
	if cond {
		return o.with(kv...)
	}
	return o
}

// get returns a member's value.
func (o O) get(k string) any {
	for _, m := range o {
		if m.K == k {
			return m.V
		}
	}
	return nil
}

// set replaces or appends a member.
func (o O) set(k string, v any) O {
	for i := range o {
		if o[i].K == k {
			o[i].V = v
			return o
		}
	}
	return append(o, KV{k, v})
}

// MarshalJSON writes the members in order. time.Time values are written as
// JavaScript Date.toJSON() would (UTC, milliseconds).
func (o O) MarshalJSON() ([]byte, error) {
	var b bytes.Buffer
	b.WriteByte('{')
	for i, m := range o {
		if i > 0 {
			b.WriteByte(',')
		}
		k, _ := marshalNoEscape(m.K)
		b.Write(k)
		b.WriteByte(':')
		v, err := marshalValue(m.V)
		if err != nil {
			return nil, err
		}
		b.Write(v)
	}
	b.WriteByte('}')
	return b.Bytes(), nil
}

func marshalValue(v any) ([]byte, error) {
	switch x := v.(type) {
	case time.Time:
		return json.Marshal(platform.ISO(x))
	case *time.Time:
		if x == nil {
			return []byte("null"), nil
		}
		return json.Marshal(platform.ISO(*x))
	}
	return marshalNoEscape(v)
}

// marshalNoEscape is json.Marshal without HTML escaping (<, >, & stay as
// written, as JSON.stringify writes them).
func marshalNoEscape(v any) ([]byte, error) {
	var b bytes.Buffer
	enc := json.NewEncoder(&b)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimRight(b.Bytes(), "\n"), nil
}

// jsTime is a time that marshals like a JavaScript Date.
type jsTime time.Time

func (t jsTime) MarshalJSON() ([]byte, error) { return json.Marshal(platform.ISO(time.Time(t))) }

// jt converts a nullable time to a JSON value (null or the ISO string).
func jt(t *time.Time) any {
	if t == nil {
		return nil
	}
	return platform.ISO(*t)
}

// nilStr turns a nullable string into a JSON value.
func nilStr(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}
