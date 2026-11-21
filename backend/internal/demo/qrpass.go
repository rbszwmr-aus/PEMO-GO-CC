package demo

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	QRPrefix                    = "QP1:"
	FormatVersion               = 1
	SkewSeconds                 = 120
	MaxStaleSeconds             = 600
	VisitorAccessDefaultUses    = 2
	VisitorAccessMaxLifetimeSec = 7 * 24 * 60 * 60
	DemoModule                  = "pemo"
)

var purposeWire = map[string]string{"VISITOR_ACCESS": "VA", "PAYMENT": "PAY"}

const (
	crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
	base62    = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
)

// claim keys (CWT ints where registered)
var (
	cV, cP, cM, cSub, cI, cCti, cNbf, cExp, cU, cR any = "v", "p", "m", int64(2), "i", int64(7), int64(5), int64(4), "u", "r"
)

func isoSeconds(sec int64) string { return time.Unix(sec, 0).UTC().Format("2006-01-02T15:04:05Z") }

var instantRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$`)

// parseInstant accepts an RFC 3339 string with an offset or a positive epoch-seconds integer.
func parseInstant(v any) (int64, bool) {
	if n, ok := intOf(v); ok {
		return n, n > 0
	}
	s, ok := v.(string)
	if !ok {
		return 0, false
	}
	s = strings.TrimSpace(s)
	if !instantRe.MatchString(s) {
		return 0, false
	}
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04Z07:00"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t.Unix(), true
		}
	}
	return 0, false
}

// intOf reads a JSON integer (json.Number, float64 or int).
func intOf(v any) (int64, bool) {
	switch x := v.(type) {
	case json.Number:
		if n, err := strconv.ParseInt(string(x), 10, 64); err == nil {
			return n, true
		}
		if f, err := x.Float64(); err == nil && f == math.Trunc(f) && math.Abs(f) <= maxSafe {
			return int64(f), true
		}
	case float64:
		if x == math.Trunc(x) && math.Abs(x) <= maxSafe {
			return int64(x), true
		}
	case int:
		return int64(x), true
	case int64:
		return x, true
	}
	return 0, false
}

var alnumM = []int{20, 38, 61, 90, 122, 154, 178, 221, 262, 311, 366, 419, 483, 528, 600, 656, 734, 816, 909, 970}

func minQRVersion(chars int) int {
	for i, c := range alnumM {
		if chars <= c {
			return i + 1
		}
	}
	return 40
}

var (
	opaqueRef = regexp.MustCompile(`^[A-Za-z0-9_.:\-]{1,64}$`)
	reasonRe  = regexp.MustCompile(`^[a-z0-9_.\-]{1,40}$`)
)

// Problem is a QR-pass problem (RFC 9457 under the qr-pass base).
type Problem struct {
	Suffix string
	Status int
	Title  string
	Detail string
}

func invalid(detail string) *Problem {
	return &Problem{"invalid-request", 400, "Invalid request", detail}
}

type QRHint struct {
	Payload    string `json:"payload"`
	Mode       string `json:"mode"`
	Ecc        string `json:"ecc"`
	MinVersion int    `json:"min_version"`
}

type IssueResponse struct {
	PassID    string `json:"pass_id"`
	Jti       string `json:"jti"`
	Kid       string `json:"kid"`
	Purpose   string `json:"purpose"`
	NotBefore string `json:"not_before"`
	ExpiresAt string `json:"expires_at"`
	UseLimit  int64  `json:"use_limit"`
	QR        QRHint `json:"qr"`
}

type PassView struct {
	IssueResponse
	Module           string  `json:"module"`
	SubjectRef       string  `json:"subject_ref"`
	ModuleRef        *string `json:"module_ref"`
	Status           string  `json:"status"`
	IssuedAt         string  `json:"issued_at"`
	UsesSeen         int64   `json:"uses_seen"`
	UsesRemaining    *int64  `json:"uses_remaining"`
	RevokedAt        *string `json:"revoked_at"`
	RevocationReason *string `json:"revocation_reason"`
}

type RevokeResponse struct {
	PassID                string `json:"pass_id"`
	RevokedAt             string `json:"revoked_at"`
	RevocationListVersion int64  `json:"revocation_list_version"`
}

type ScanRecord struct {
	ScanID                string  `json:"scan_id"`
	DeviceID              string  `json:"device_id"`
	LocationRef           *string `json:"location_ref"`
	PassID                *string `json:"pass_id"`
	Jti                   *string `json:"jti"`
	Kid                   *string `json:"kid"`
	Purpose               *string `json:"purpose"`
	Result                string  `json:"result"`
	ScannedAt             string  `json:"scanned_at"`
	ReceivedAt            string  `json:"received_at"`
	Offline               bool    `json:"offline"`
	RevocationListVersion int64   `json:"revocation_list_version"`
	RevocationStale       bool    `json:"revocation_stale"`
	ModuleDecisionRef     *string `json:"module_decision_ref"`
}

type PassClaims struct {
	V   int64   `json:"v"`
	P   string  `json:"p"`
	M   string  `json:"m"`
	S   string  `json:"s"`
	I   string  `json:"i"`
	J   string  `json:"j"`
	Nbf *int64  `json:"nbf"`
	Exp int64   `json:"exp"`
	U   int64   `json:"u"`
	R   *string `json:"r"`
}

type ScanPass struct {
	PassID        string  `json:"pass_id"`
	Status        string  `json:"status"`
	UseLimit      int64   `json:"use_limit"`
	UsesSeen      int64   `json:"uses_seen"`
	UsesRemaining *int64  `json:"uses_remaining"`
	SubjectRef    string  `json:"subject_ref"`
	ModuleRef     *string `json:"module_ref"`
}

type ScanOutcome struct {
	Scan   ScanRecord  `json:"scan"`
	Claims *PassClaims `json:"claims"`
	Pass   *ScanPass   `json:"pass"`
}

type RevokedEntry struct {
	PassID    string `json:"pass_id"`
	Exp       int64  `json:"exp"`
	RevokedAt string `json:"revoked_at"`
}

type RevocationList struct {
	ListVersion     int64          `json:"list_version"`
	Cursor          string         `json:"cursor"`
	Full            bool           `json:"full"`
	Since           *string        `json:"since"`
	IssuedAt        string         `json:"issued_at"`
	MaxStaleSeconds int            `json:"max_stale_seconds"`
	Revoked         []RevokedEntry `json:"revoked"`
	RevokedKids     []string       `json:"revoked_kids"`
	Pruned          []string       `json:"pruned"`
}

type Event struct {
	ID         string         `json:"id"`
	Type       string         `json:"type"`
	OccurredAt string         `json:"occurred_at"`
	Module     string         `json:"module"`
	Data       map[string]any `json:"data"`
}

type JWK struct {
	Kty string `json:"kty"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Kid string `json:"kid"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	Nbf int64  `json:"nbf"`
}

type passRecord struct {
	passID, jti, kid, purpose, module, subjectRef string
	moduleRef                                     *string
	nbf, exp, useLimit, issuedAt                  int64
	payload                                       string
	usesSeen                                      int64
	revokedAt                                     *int64
	revocationReason                              *string
	revocationListVersion                         *int64
}

// QRPassStore issues, verifies and revokes signed visitor passes in memory.
type QRPassStore struct {
	mu          sync.Mutex
	now         func() time.Time
	Kid         string
	priv        ed25519.PrivateKey
	pub         ed25519.PublicKey
	keyCreated  int64
	revokedKids []string
	passes      map[string]*passRecord
	order       []string
	idempotency map[string][2]string // key -> {hash, passId}
	scanLog     []ScanRecord
	events      []Event
	listVersion int64
}

func NewQRPassStore(now func() time.Time) *QRPassStore {
	if now == nil {
		now = time.Now
	}
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		panic(err)
	}
	return &QRPassStore{now: now, Kid: "k" + randomFrom(crockford, 5), priv: priv, pub: pub, keyCreated: now().Unix(),
		passes: map[string]*passRecord{}, idempotency: map[string][2]string{}}
}

func isoNowOf(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05Z") }

func (s *QRPassStore) emit(typ, module string, data map[string]any) {
	s.events = append(s.events, Event{"evt_" + randomFrom(crockford, 16), typ, isoNowOf(s.now()), module, data})
}

func (s *QRPassStore) issueResponse(r *passRecord) IssueResponse {
	return IssueResponse{r.passID, r.jti, r.kid, r.purpose, isoSeconds(r.nbf), isoSeconds(r.exp), r.useLimit,
		QRHint{r.payload, "alphanumeric", "M", minQRVersion(len(r.payload))}}
}

func (s *QRPassStore) view(r *passRecord) PassView {
	status := "active"
	if r.revokedAt != nil {
		status = "revoked"
	} else if s.now().Unix() > r.exp {
		status = "expired"
	}
	var remaining *int64
	if r.useLimit != 0 {
		n := r.useLimit - r.usesSeen
		if n < 0 {
			n = 0
		}
		remaining = &n
	}
	var revokedAt *string
	if r.revokedAt != nil {
		v := isoSeconds(*r.revokedAt)
		revokedAt = &v
	}
	return PassView{s.issueResponse(r), r.module, r.subjectRef, r.moduleRef, status, isoSeconds(r.issuedAt), r.usesSeen, remaining, revokedAt, r.revocationReason}
}

func (s *QRPassStore) signPass(r *passRecord) string {
	c := &CMap{}
	c.Set(cV, int64(FormatVersion))
	c.Set(cP, purposeWire[r.purpose])
	c.Set(cM, r.module)
	c.Set(cSub, r.subjectRef)
	c.Set(cI, r.passID)
	c.Set(cCti, []byte(r.jti))
	c.Set(cNbf, r.nbf)
	c.Set(cExp, r.exp)
	c.Set(cU, r.useLimit)
	if r.moduleRef != nil {
		c.Set(cR, *r.moduleRef)
	}
	payload, _ := CborEncode(c)
	return QRPrefix + Base45Encode(CoseSign1(payload, s.Kid, s.priv))
}

func decodeClaims(payload []byte) (*PassClaims, error) {
	v, err := CborDecode(payload)
	if err != nil {
		return nil, err
	}
	m, ok := v.(*CMap)
	if !ok {
		return nil, cborErr("claims must be a map")
	}
	str := func(k any, optional bool) (*string, error) {
		v, ok := m.Get(k)
		if !ok && optional {
			return nil, nil
		}
		s, ok := v.(string)
		if !ok {
			return nil, cborErr("claim %v must be text", k)
		}
		return &s, nil
	}
	num := func(k any, optional bool) (*int64, error) {
		v, ok := m.Get(k)
		if !ok && optional {
			return nil, nil
		}
		n, ok := v.(int64)
		if !ok {
			return nil, cborErr("claim %v must be int", k)
		}
		return &n, nil
	}
	var j string
	switch c, _ := m.Get(cCti); x := c.(type) {
	case []byte:
		j = string(x)
	case string:
		j = x
	default:
		return nil, cborErr("claim cti missing")
	}
	c := &PassClaims{J: j}
	var e error
	must := func(p *int64, err error) int64 {
		if err != nil && e == nil {
			e = err
		}
		if p == nil {
			return 0
		}
		return *p
	}
	mustS := func(p *string, err error) string {
		if err != nil && e == nil {
			e = err
		}
		if p == nil {
			return ""
		}
		return *p
	}
	c.V = must(num(cV, false))
	c.P = mustS(str(cP, false))
	c.M = mustS(str(cM, false))
	c.S = mustS(str(cSub, false))
	c.I = mustS(str(cI, false))
	nbf, err := num(cNbf, true)
	if err != nil && e == nil {
		e = err
	}
	c.Nbf = nbf
	c.Exp = must(num(cExp, false))
	c.U = must(num(cU, false))
	r, err := str(cR, true)
	if err != nil && e == nil {
		e = err
	}
	c.R = r
	if e != nil {
		return nil, e
	}
	if c.V != FormatVersion {
		return nil, cborErr("unsupported format version %d", c.V)
	}
	if c.U < 0 {
		return nil, cborErr("use limit must be >= 0")
	}
	return c, nil
}

func b64url(b []byte) string { return base64.RawURLEncoding.EncodeToString(b) }

func (s *QRPassStore) signJWS(payload any) string {
	h := []byte(`{"alg":"EdDSA","kid":` + strconv.Quote(s.Kid) + `}`)
	p, _ := json.Marshal(payload)
	signing := b64url(h) + "." + b64url(p)
	return signing + "." + b64url(ed25519.Sign(s.priv, []byte(signing)))
}

func (s *QRPassStore) owned(passID, module string) (*passRecord, *Problem) {
	r, ok := s.passes[passID]
	if !ok {
		return nil, &Problem{"pass-not-found", 404, "Pass not found", "pass " + passID + " does not exist"}
	}
	if r.module != module {
		return nil, &Problem{"forbidden-module", 403, "Forbidden", "pass " + passID + " belongs to another module"}
	}
	return r, nil
}

// IssueInput is the decoded request body (raw JSON values).
type IssueInput map[string]any

func present(m map[string]any, k string) bool { v, ok := m[k]; return ok && v != nil }

// Issue issues a VISITOR_ACCESS pass.
func (s *QRPassStore) Issue(in IssueInput, module, idempotencyKey string, clampLifetime bool) (*IssueResponse, bool, *Problem) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if module == "" {
		module = DemoModule
	}
	hb, _ := json.Marshal([]any{in["purpose"], in["subject_ref"], in["not_before"], in["expires_at"], in["use_limit"], in["module_ref"]})
	sum := sha256.Sum256(hb)
	hash := hex.EncodeToString(sum[:])
	idemKey := ""
	if idempotencyKey != "" {
		idemKey = module + "\x00" + idempotencyKey
		if seen, ok := s.idempotency[idemKey]; ok {
			if seen[0] != hash {
				return nil, false, &Problem{"idempotency-conflict", 409, "Idempotency conflict", "Idempotency-Key was already used with a different body"}
			}
			r := s.issueResponse(s.passes[seen[1]])
			return &r, true, nil
		}
	}
	purpose, _ := in["purpose"].(string)
	if purpose == "" {
		return nil, false, invalid("purpose is required")
	}
	if purpose != "VISITOR_ACCESS" {
		if _, registered := purposeWire[purpose]; registered {
			return nil, false, &Problem{"purpose-unknown", 400, "Unknown purpose", "purpose " + purpose + " is not allowed for this module (demo issues VISITOR_ACCESS only)"}
		}
		return nil, false, &Problem{"purpose-unknown", 400, "Unknown purpose", "purpose " + purpose + " is not registered"}
	}
	subject, _ := in["subject_ref"].(string)
	if !opaqueRef.MatchString(subject) {
		return nil, false, invalid("subject_ref is required: opaque ref, 1-64 chars [A-Za-z0-9_.:-], no PII")
	}
	nowS := s.now().Unix()
	nbf := nowS
	if present(in, "not_before") {
		var ok bool
		if nbf, ok = parseInstant(in["not_before"]); !ok {
			return nil, false, invalid("not_before must be an RFC 3339 timestamp with offset")
		}
	}
	if !present(in, "expires_at") {
		return nil, false, invalid("expires_at is required")
	}
	exp, ok := parseInstant(in["expires_at"])
	if !ok {
		return nil, false, invalid("expires_at must be an RFC 3339 timestamp with offset")
	}
	if exp <= nbf {
		return nil, false, invalid("expires_at must be after not_before")
	}
	if exp-nbf > VisitorAccessMaxLifetimeSec {
		if !clampLifetime {
			return nil, false, invalid("lifetime exceeds the VISITOR_ACCESS maximum of 7 days (D6)")
		}
		exp = nbf + VisitorAccessMaxLifetimeSec
	}
	useLimit := int64(VisitorAccessDefaultUses)
	if present(in, "use_limit") {
		n, ok := intOf(in["use_limit"])
		if !ok || n < 0 || n > 1000 {
			return nil, false, invalid("use_limit must be an integer 0..1000 (0 = unlimited)")
		}
		useLimit = n
	}
	var moduleRef *string
	if present(in, "module_ref") {
		m, ok := in["module_ref"].(string)
		if !ok || m == "" || len([]rune(m)) > 200 {
			return nil, false, invalid("module_ref must be a non-empty string (max 200) or null")
		}
		moduleRef = &m
	}
	passID := "qp_" + randomFrom(crockford, 8)
	for s.passes[passID] != nil {
		passID = "qp_" + randomFrom(crockford, 8)
	}
	r := &passRecord{passID: passID, jti: randomFrom(base62, 8), kid: s.Kid, purpose: "VISITOR_ACCESS", module: module, subjectRef: subject,
		moduleRef: moduleRef, nbf: nbf, exp: exp, useLimit: useLimit, issuedAt: nowS}
	r.payload = s.signPass(r)
	s.passes[passID] = r
	s.order = append(s.order, passID)
	if idemKey != "" {
		s.idempotency[idemKey] = [2]string{hash, passID}
	}
	s.emit("pass.issued", module, map[string]any{"pass_id": r.passID, "jti": r.jti, "kid": r.kid, "purpose": r.purpose, "subject_ref": r.subjectRef,
		"not_before": isoSeconds(r.nbf), "expires_at": isoSeconds(r.exp), "use_limit": r.useLimit})
	resp := s.issueResponse(r)
	return &resp, false, nil
}

func (s *QRPassStore) Get(passID, module string) (*PassView, *Problem) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, p := s.owned(passID, module)
	if p != nil {
		return nil, p
	}
	v := s.view(r)
	return &v, nil
}

func (s *QRPassStore) FindByModuleRef(ref, module string) *PassView {
	s.mu.Lock()
	defer s.mu.Unlock()
	var latest *passRecord
	for _, id := range s.order {
		r := s.passes[id]
		if r.moduleRef != nil && *r.moduleRef == ref && r.module == module {
			latest = r
		}
	}
	if latest == nil {
		return nil
	}
	v := s.view(latest)
	return &v
}

func (s *QRPassStore) Revoke(passID string, reason any, module string) (*RevokeResponse, *Problem) {
	s.mu.Lock()
	defer s.mu.Unlock()
	r, p := s.owned(passID, module)
	if p != nil {
		return nil, p
	}
	if r.revokedAt != nil {
		return &RevokeResponse{r.passID, isoSeconds(*r.revokedAt), *r.revocationListVersion}, nil
	}
	code := "unspecified"
	if reason != nil {
		c, ok := reason.(string)
		if !ok || !reasonRe.MatchString(c) {
			return nil, invalid("reason must be a short module code [a-z0-9_.-]{1,40} (no free text / PII)")
		}
		code = c
	}
	s.listVersion++
	at, v := s.now().Unix(), s.listVersion
	r.revokedAt, r.revocationReason, r.revocationListVersion = &at, &code, &v
	body := RevokeResponse{r.passID, isoSeconds(at), v}
	s.emit("pass.revoked", r.module, map[string]any{"pass_id": r.passID, "reason": code, "revoked_at": body.RevokedAt, "revocation_list_version": v})
	return &body, nil
}

// ScanInput carries raw JSON values from the reader.
type ScanInput struct {
	Payload           any
	PassID            *string
	DeviceID          any
	LocationRef       any
	ModuleDecisionRef any
}

func (s *QRPassStore) Scan(in ScanInput) (*ScanOutcome, *Problem) {
	s.mu.Lock()
	defer s.mu.Unlock()
	at := s.now()
	nowS := at.Unix()
	hasPayload := in.Payload != nil
	payloadStr, isStr := in.Payload.(string)
	if hasPayload && !isStr {
		return nil, invalid("payload must be the scanned QR string")
	}
	if !hasPayload && in.PassID == nil {
		return nil, invalid("payload is required")
	}
	optStr := func(v any, name string) (*string, *Problem) {
		if v == nil {
			return nil, nil
		}
		s, ok := v.(string)
		if !ok || s == "" || len([]rune(s)) > 120 {
			return nil, invalid(name + " must be a string (1-120)")
		}
		return &s, nil
	}
	device, p1 := optStr(in.DeviceID, "device_id")
	location, p2 := optStr(in.LocationRef, "location_ref")
	decision, p3 := optStr(in.ModuleDecisionRef, "module_decision_ref")
	for _, p := range []*Problem{p1, p2, p3} {
		if p != nil {
			return nil, p
		}
	}
	result := ""
	var claims *PassClaims
	var kid *string
	var record *passRecord
	if hasPayload {
		payload := strings.TrimSpace(payloadStr)
		err := func() error {
			if !strings.HasPrefix(payload, QRPrefix) {
				return cborErr("missing %s prefix", QRPrefix)
			}
			raw, err := Base45Decode(payload[len(QRPrefix):])
			if err != nil {
				return err
			}
			parsed, err := ParseCoseSign1(raw)
			if err != nil {
				return err
			}
			k := parsed.Kid
			kid = &k
			switch {
			case k != s.Kid:
				result = "UNKNOWN_KEY"
			case contains(s.revokedKids, k):
				result = "REJECTED_REVOKED"
			case !VerifyCoseSign1(parsed, s.pub):
				result = "REJECTED_SIGNATURE"
			default:
				c, err := decodeClaims(parsed.Payload)
				if err != nil {
					return err
				}
				claims = c
			}
			return nil
		}()
		if err != nil {
			result, claims = "REJECTED_SIGNATURE", nil
		}
		if claims != nil {
			if in.PassID != nil && claims.I != *in.PassID {
				return nil, invalid(fmt.Sprintf("payload is for pass %s, not %s", claims.I, *in.PassID))
			}
			record = s.passes[claims.I]
		}
	} else {
		r, ok := s.passes[*in.PassID]
		if !ok {
			return nil, &Problem{"pass-not-found", 404, "Pass not found", "pass " + *in.PassID + " does not exist"}
		}
		record = r
		nbf := r.nbf
		claims = &PassClaims{FormatVersion, purposeWire[r.purpose], r.module, r.subjectRef, r.passID, r.jti, &nbf, r.exp, r.useLimit, r.moduleRef}
		k := r.kid
		kid = &k
	}
	if result == "" && claims != nil {
		switch {
		case claims.P != purposeWire["VISITOR_ACCESS"]:
			result = "REJECTED_SIGNATURE"
		case record != nil && record.revokedAt != nil:
			result = "REJECTED_REVOKED"
		case nowS > claims.Exp+SkewSeconds:
			result = "REJECTED_EXPIRED"
		case claims.Nbf != nil && nowS < *claims.Nbf-SkewSeconds:
			result = "REJECTED_NOT_YET_VALID"
		case record == nil:
			result = "REJECTED_REVOKED"
		case claims.U == 1 && record.usesSeen >= 1:
			result = "REJECTED_REPLAY"
		case claims.U > 1 && record.usesSeen >= claims.U:
			result = "REJECTED_USE_LIMIT"
		default:
			record.usesSeen++
			result = "ACCEPTED"
		}
	}
	trusted := claims != nil && result != "REJECTED_SIGNATURE"
	dev := "pemo_demo_gate"
	if device != nil {
		dev = *device
	}
	scan := ScanRecord{ScanID: "scn_" + randomFrom(crockford, 16), DeviceID: dev, LocationRef: location, Kid: kid, Result: result,
		ScannedAt: isoNowOf(at), ReceivedAt: isoNowOf(at), RevocationListVersion: s.listVersion, ModuleDecisionRef: decision}
	if trusted {
		pid, jti := claims.I, claims.J
		purpose := claims.P
		for name, code := range purposeWire {
			if code == claims.P {
				purpose = name
			}
		}
		scan.PassID, scan.Jti, scan.Purpose = &pid, &jti, &purpose
	}
	s.scanLog = append(s.scanLog, scan)
	out := &ScanOutcome{Scan: scan}
	if trusted {
		out.Claims = claims
	}
	if record != nil && trusted {
		b, _ := json.Marshal(scan)
		var data map[string]any
		_ = json.Unmarshal(b, &data)
		s.emit("pass.scanned", record.module, data)
		v := s.view(record)
		out.Pass = &ScanPass{v.PassID, v.Status, v.UseLimit, v.UsesSeen, v.UsesRemaining, v.SubjectRef, v.ModuleRef}
	}
	return out, nil
}

func contains(xs []string, x string) bool {
	for _, v := range xs {
		if v == x {
			return true
		}
	}
	return false
}

func (s *QRPassStore) JWKS() map[string][]JWK {
	keys := []JWK{}
	if !contains(s.revokedKids, s.Kid) {
		keys = append(keys, JWK{"OKP", "Ed25519", b64url(s.pub), s.Kid, "sig", "EdDSA", s.keyCreated})
	}
	return map[string][]JWK{"keys": keys}
}

var cursorRe = regexp.MustCompile(`^rl_(\d{1,9})$`)

func (s *QRPassStore) Revocations(since string) (string, *RevocationList, *Problem) {
	s.mu.Lock()
	defer s.mu.Unlock()
	nowS := s.now().Unix()
	var sinceV *int64
	if since != "" {
		m := cursorRe.FindStringSubmatch(since)
		if m == nil {
			return "", nil, invalid("since must be a cursor returned by a previous list (rl_<n>)")
		}
		n, _ := strconv.ParseInt(m[1], 10, 64)
		if n > s.listVersion {
			return "", nil, &Problem{"cursor-expired", 410, "Cursor expired", "cursor " + since + " is not known; fetch a full snapshot"}
		}
		sinceV = &n
	}
	revoked, pruned := []RevokedEntry{}, []string{}
	for _, id := range s.order {
		r := s.passes[id]
		if r.revokedAt == nil || r.revocationListVersion == nil {
			continue
		}
		isPruned := nowS > r.exp+SkewSeconds
		switch {
		case sinceV == nil || *r.revocationListVersion > *sinceV:
			if !isPruned {
				revoked = append(revoked, RevokedEntry{r.passID, r.exp, isoSeconds(*r.revokedAt)})
			}
		case isPruned:
			pruned = append(pruned, r.passID)
		}
	}
	var sinceStr *string
	if sinceV != nil {
		v := fmt.Sprintf("rl_%d", *sinceV)
		sinceStr = &v
	}
	list := &RevocationList{s.listVersion, fmt.Sprintf("rl_%d", s.listVersion), sinceV == nil, sinceStr, isoNowOf(s.now()), MaxStaleSeconds,
		revoked, append([]string{}, s.revokedKids...), pruned}
	return s.signJWS(list), list, nil
}

type ScanQuery struct{ Module, PassID, Result, From, To, DeviceID string }

func (s *QRPassStore) Scans(q ScanQuery) map[string]any {
	s.mu.Lock()
	defer s.mu.Unlock()
	from, hasFrom := int64(0), false
	to, hasTo := int64(0), false
	if q.From != "" {
		from, hasFrom = parseInstant(q.From)
	}
	if q.To != "" {
		to, hasTo = parseInstant(q.To)
	}
	recs := []ScanRecord{}
	for _, sc := range s.scanLog {
		if sc.PassID == nil {
			continue
		}
		owner := s.passes[*sc.PassID]
		if owner == nil || owner.module != q.Module {
			continue
		}
		if (q.PassID != "" && *sc.PassID != q.PassID) || (q.Result != "" && sc.Result != q.Result) || (q.DeviceID != "" && sc.DeviceID != q.DeviceID) {
			continue
		}
		t, _ := time.Parse(time.RFC3339, sc.ScannedAt)
		if (hasFrom && t.Unix() < from) || (hasTo && t.Unix() > to) {
			continue
		}
		recs = append(recs, sc)
	}
	if len(recs) > 500 {
		recs = recs[len(recs)-500:]
	}
	return map[string]any{"records": recs, "next_cursor": nil}
}

func (s *QRPassStore) Outbox(typ, passID string) []Event {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []Event{}
	for _, e := range s.events {
		if (typ == "" || e.Type == typ) && (passID == "" || e.Data["pass_id"] == passID) {
			out = append(out, e)
		}
	}
	return out
}

// ---- visitor pass bridge ----

const DefaultVisitorPassWindowSeconds = 24 * 60 * 60

// EnsureVisitorPass issues (once) a pass for a demo visitor.
func (s *QRPassStore) EnsureVisitorPass(v Visitor, seed bool) *PassView {
	if existing := s.FindByModuleRef(v.VisitorID, DemoModule); existing != nil {
		return existing
	}
	nowS := time.Now().Unix()
	from, errF := time.Parse(time.RFC3339, v.ExpectedFrom)
	to, errT := time.Parse(time.RFC3339, v.ExpectedTo)
	nbf, exp := from.Unix(), to.Unix()
	if errF != nil || errT != nil || exp <= nbf || (seed && exp <= nowS) {
		nbf, exp = nowS, nowS+DefaultVisitorPassWindowSeconds
	}
	if exp-nbf > VisitorAccessMaxLifetimeSec {
		exp = nbf + VisitorAccessMaxLifetimeSec
	}
	_, _, p := s.Issue(IssueInput{"purpose": "VISITOR_ACCESS", "subject_ref": "vsr_" + randomFrom(crockford, 10),
		"not_before": time.Unix(nbf, 0).UTC().Format("2006-01-02T15:04:05.000Z"), "expires_at": time.Unix(exp, 0).UTC().Format("2006-01-02T15:04:05.000Z"),
		"module_ref": v.VisitorID}, DemoModule, "", true)
	if p != nil {
		return nil
	}
	return s.FindByModuleRef(v.VisitorID, DemoModule)
}

// ViewVisitorPass returns the visitor's pass, issuing one if missing.
func (s *QRPassStore) ViewVisitorPass(v Visitor) *PassView {
	if p := s.FindByModuleRef(v.VisitorID, DemoModule); p != nil {
		return p
	}
	return s.EnsureVisitorPass(v, false)
}
