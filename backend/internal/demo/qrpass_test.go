package demo

import (
	"bytes"
	"strings"
	"testing"
	"time"
)

func TestBase45RoundTrip(t *testing.T) {
	for _, in := range [][]byte{{}, {0}, {255}, []byte("AB"), []byte("Hello!!"), bytes.Repeat([]byte{0xff, 0x00, 0x7f}, 33)} {
		got, err := Base45Decode(Base45Encode(in))
		if err != nil || !bytes.Equal(got, in) {
			t.Fatalf("round trip %v: %v %v", in, got, err)
		}
	}
	// RFC 9285 test vectors
	if Base45Encode([]byte("AB")) != "BB8" || Base45Encode([]byte("Hello!!")) != "%69 VD92EX0" {
		t.Fatal("RFC 9285 vectors")
	}
	if _, err := Base45Decode("GGW"); err == nil {
		t.Fatal("out-of-range triplet accepted")
	}
}

func TestCborRoundTripAndStrictness(t *testing.T) {
	m := &CMap{}
	m.Set("v", int64(1))
	m.Set(int64(2), "sub")
	m.Set(int64(7), []byte("jti"))
	m.Set("neg", int64(-500))
	m.Set("list", []any{true, false, nil, int64(1 << 40)})
	enc, err := CborEncode(CTag{18, []any{m}})
	if err != nil {
		t.Fatal(err)
	}
	dec, err := CborDecode(enc)
	if err != nil {
		t.Fatal(err)
	}
	re, _ := CborEncode(dec)
	if !bytes.Equal(re, enc) {
		t.Fatal("re-encoding differs")
	}
	if _, err := CborDecode(append(enc, 0)); err == nil {
		t.Fatal("trailing bytes accepted")
	}
	if _, err := CborDecode([]byte{0xa2, 0x01, 0x01, 0x01, 0x02}); err == nil {
		t.Fatal("duplicate key accepted")
	}
	if _, err := CborDecode([]byte{0x9f}); err == nil {
		t.Fatal("indefinite length accepted")
	}
}

func issue(t *testing.T, s *QRPassStore, uses any) *IssueResponse {
	t.Helper()
	r, _, p := s.Issue(IssueInput{"purpose": "VISITOR_ACCESS", "subject_ref": "vsr_ABC", "expires_at": time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339), "use_limit": uses}, DemoModule, "", false)
	if p != nil {
		t.Fatalf("issue: %+v", p)
	}
	return r
}

func TestQRPassLifecycle(t *testing.T) {
	s := NewQRPassStore(nil)
	r := issue(t, s, 2)
	if !strings.HasPrefix(r.QR.Payload, QRPrefix) || r.UseLimit != 2 {
		t.Fatalf("bad issue: %+v", r)
	}
	want := []string{"ACCEPTED", "ACCEPTED", "REJECTED_USE_LIMIT"}
	for i, w := range want {
		out, p := s.Scan(ScanInput{Payload: r.QR.Payload})
		if p != nil || out.Scan.Result != w {
			t.Fatalf("scan %d: %v %+v", i, p, out)
		}
	}
	one := issue(t, s, 1)
	s.Scan(ScanInput{Payload: one.QR.Payload})
	if out, _ := s.Scan(ScanInput{Payload: one.QR.Payload}); out.Scan.Result != "REJECTED_REPLAY" {
		t.Fatalf("replay: %s", out.Scan.Result)
	}
	// tamper: flip a character in the base45 body
	tampered := []byte(r.QR.Payload)
	tampered[len(tampered)-3] ^= 1
	if out, _ := s.Scan(ScanInput{Payload: string(tampered)}); out.Scan.Result != "REJECTED_SIGNATURE" || out.Claims != nil {
		t.Fatalf("tamper: %+v", out.Scan)
	}
	// revoke
	fresh := issue(t, s, 0)
	rv, p := s.Revoke(fresh.PassID, "visit_cancelled", DemoModule)
	if p != nil || rv.RevocationListVersion != 1 {
		t.Fatalf("revoke: %+v %+v", rv, p)
	}
	if out, _ := s.Scan(ScanInput{Payload: fresh.QR.Payload}); out.Scan.Result != "REJECTED_REVOKED" {
		t.Fatalf("revoked scan: %s", out.Scan.Result)
	}
	if _, p := s.Revoke(fresh.PassID, "Free text, with PII", DemoModule); p != nil {
		t.Fatal("second revoke must replay, not validate the new reason")
	}
	jws, list, p := s.Revocations("")
	if p != nil || len(list.Revoked) != 1 || strings.Count(jws, ".") != 2 {
		t.Fatalf("revocations: %v %+v", p, list)
	}
	if _, _, p := s.Revocations("rl_99"); p == nil || p.Status != 410 {
		t.Fatal("unknown cursor must be 410")
	}
}

func TestQRPassIssueValidationAndIdempotency(t *testing.T) {
	s := NewQRPassStore(nil)
	exp := time.Now().Add(time.Hour).UTC().Format(time.RFC3339)
	cases := []IssueInput{
		{"subject_ref": "x", "expires_at": exp},
		{"purpose": "PAYMENT", "subject_ref": "x", "expires_at": exp},
		{"purpose": "VISITOR_ACCESS", "subject_ref": "has space", "expires_at": exp},
		{"purpose": "VISITOR_ACCESS", "subject_ref": "x"},
		{"purpose": "VISITOR_ACCESS", "subject_ref": "x", "expires_at": "tomorrow"},
		{"purpose": "VISITOR_ACCESS", "subject_ref": "x", "expires_at": time.Now().Add(8 * 24 * time.Hour).UTC().Format(time.RFC3339)},
		{"purpose": "VISITOR_ACCESS", "subject_ref": "x", "expires_at": exp, "use_limit": 1001},
	}
	for i, c := range cases {
		if _, _, p := s.Issue(c, DemoModule, "", false); p == nil {
			t.Fatalf("case %d accepted", i)
		}
	}
	in := IssueInput{"purpose": "VISITOR_ACCESS", "subject_ref": "x", "expires_at": exp}
	a, _, _ := s.Issue(in, DemoModule, "key-1", false)
	b, replayed, _ := s.Issue(in, DemoModule, "key-1", false)
	if !replayed || a.PassID != b.PassID {
		t.Fatal("same key, same body must replay")
	}
	in2 := IssueInput{"purpose": "VISITOR_ACCESS", "subject_ref": "y", "expires_at": exp}
	if _, _, p := s.Issue(in2, DemoModule, "key-1", false); p == nil || p.Status != 409 {
		t.Fatal("same key, different body must conflict")
	}
}
