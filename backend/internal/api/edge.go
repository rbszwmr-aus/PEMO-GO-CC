// Package api is the HTTP surface: the resident-mobile and management-web
// contracts, authentication, composition of module reads, and the acts.
package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"pemo/internal/platform"
)

// ---- development auth stub ----

const devMarker = "pemo-dev"

// devClaims field order matches the Node build so tokens interoperate.
type devClaims struct {
	Marker     string `json:"marker"`
	ResidentID string `json:"residentId"`
	IssuedAt   string `json:"issuedAt"`
}

// ClockSkew is how far in the future a token's issue time may be. The Node
// build accepted any future issue time (review S1); this one refuses it.
const ClockSkew = 60 * time.Second

// DevAuth issues and verifies development HMAC tokens. It exists only in
// development builds; a real identity provider replaces it (decision 3).
type DevAuth struct {
	secret []byte
	ttl    time.Duration
}

// NewDevAuth refuses to exist outside development.
func NewDevAuth(c *platform.Config) *DevAuth {
	if c.Environment != "development" {
		panic("The development authentication stub was constructed outside a development environment.")
	}
	return &DevAuth{[]byte(c.DevTokenSecret), time.Duration(c.DevTokenTTLSeconds) * time.Second}
}

func (a *DevAuth) sign(payload string) string {
	m := hmac.New(sha256.New, a.secret)
	m.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(m.Sum(nil))
}

// Issue signs a token for subject.
func (a *DevAuth) Issue(subject string, issuedAt time.Time) string {
	b, _ := json.Marshal(devClaims{devMarker, subject, platform.ISO(issuedAt)})
	p := base64.RawURLEncoding.EncodeToString(b)
	return p + "." + a.sign(p)
}

// Verify checks an Authorization header. failure is "" on success.
func (a *DevAuth) Verify(header string, now time.Time) (subject, failure string) {
	if header == "" {
		return "", "absent"
	}
	parts := strings.Split(header, " ")
	if len(parts) < 2 || strings.ToLower(parts[0]) != "bearer" {
		return "", "absent"
	}
	tok := strings.Split(parts[1], ".")
	if len(tok) < 2 {
		return "", "malformed"
	}
	payload, sig := tok[0], tok[1]
	expected := []byte(a.sign(payload))
	if len(expected) != len(sig) || subtle.ConstantTimeCompare(expected, []byte(sig)) != 1 {
		return "", "bad_signature"
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(payload, "="))
	if err != nil {
		return "", "bad_claims"
	}
	var c map[string]any
	if json.Unmarshal(raw, &c) != nil {
		return "", "bad_claims"
	}
	sub, ok := c["residentId"].(string)
	if c["marker"] != devMarker || !ok {
		return "", "bad_claims"
	}
	ia, _ := c["issuedAt"].(string)
	issued, err := parseJSDate(ia)
	if err != nil {
		return "", "bad_claims"
	}
	age := now.Sub(issued)
	if age < -ClockSkew {
		return "", "bad_claims" // issued in the future: refused (review S1, fix F2)
	}
	if age >= a.ttl {
		return "", "expired"
	}
	return sub, ""
}

// StaffAuth is the dev stub with the "staff:" subject prefix.
type StaffAuth struct{ inner *DevAuth }

const staffPrefix = "staff:"

// NewStaffAuth wraps the dev stub for staff tokens.
func NewStaffAuth(d *DevAuth) *StaffAuth { return &StaffAuth{d} }

// Issue signs a staff token.
func (s *StaffAuth) Issue(principalID string, at time.Time) string {
	return s.inner.Issue(staffPrefix+principalID, at)
}

// Verify returns the principal id, or a failure.
func (s *StaffAuth) Verify(header string, now time.Time) (string, string) {
	sub, f := s.inner.Verify(header, now)
	if f != "" {
		return "", f
	}
	if !strings.HasPrefix(sub, staffPrefix) {
		return "", "bad_claims"
	}
	return strings.TrimPrefix(sub, staffPrefix), ""
}

// parseJSDate accepts what Date.parse accepted for ISO strings.
func parseJSDate(s string) (time.Time, error) {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02T15:04:05.000Z07:00", "2006-01-02T15:04:05Z07:00", "2006-01-02T15:04:05", "2006-01-02"} {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unparseable date %q", s)
}

// ---- dev seam (development-only request overrides) ----

// DevOverrides are x-pemo-dev-* headers, honoured only in development.
type DevOverrides struct {
	Now      *time.Time
	Fault    string
	Scenario string
}

func readDevOverrides(c *platform.Config, r *http.Request) DevOverrides {
	if c.Environment != "development" {
		return DevOverrides{}
	}
	o := DevOverrides{}
	if raw := r.Header.Get("x-pemo-dev-now"); raw != "" {
		if t, err := parseJSDate(raw); err == nil {
			o.Now = &t
		}
	}
	switch f := r.Header.Get("x-pemo-dev-fault"); f {
	case "integration-unavailable", "internal-error", "partial":
		o.Fault = f
	}
	o.Scenario = r.Header.Get("x-pemo-dev-scenario")
	return o
}

// ---- correlation ids ----

var uuidRe = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// ResolveCorrelationID keeps a client UUID, otherwise mints one (review S9:
// arbitrary client text never reaches the logs).
func ResolveCorrelationID(supplied string) string {
	if uuidRe.MatchString(supplied) {
		return supplied
	}
	return platform.NewUUID()
}

// ---- local timestamps ----

// FormatLocal renders t in loc with an explicit offset, dropping .000 like
// the Node formatHongKong did.
func FormatLocal(t time.Time, loc *time.Location) string {
	l := t.In(loc)
	base := l.Format("2006-01-02T15:04:05")
	if ms := l.Nanosecond() / 1e6; ms != 0 {
		base += fmt.Sprintf(".%03d", ms)
	}
	return base + l.Format("-07:00")
}

// ---- edge validation ----

var (
	unitIDRe  = regexp.MustCompile(`^unit_[A-Za-z0-9_]{6,32}$`)
	eventIDRe = regexp.MustCompile(`^evt_[A-Za-z0-9_]{6,32}$`)
)

// MaxInputLength bounds every edge string.
const MaxInputLength = 256

// EdgeFailure says which field failed and how.
type EdgeFailure struct{ Kind, Field string }

func checkedString(raw any, field string) (string, *EdgeFailure) {
	if raw == nil || raw == "" {
		return "", &EdgeFailure{"missing", field}
	}
	s, ok := raw.(string)
	if !ok {
		return "", &EdgeFailure{"malformed", field}
	}
	if len([]rune(s)) > MaxInputLength {
		return "", &EdgeFailure{"too_long", field}
	}
	return s, nil
}

func validateUnitID(raw any) (string, *EdgeFailure) {
	s, f := checkedString(raw, "unitId")
	if f != nil {
		return "", f
	}
	if !unitIDRe.MatchString(s) {
		return "", &EdgeFailure{"malformed", "unitId"}
	}
	return s, nil
}

func validateEventID(raw any) (string, *EdgeFailure) {
	s, f := checkedString(raw, "eventId")
	if f != nil {
		return "", f
	}
	if !eventIDRe.MatchString(s) {
		return "", &EdgeFailure{"malformed", "eventId"}
	}
	return s, nil
}

func validateAcknowledgementKey(raw any) (string, *EdgeFailure) {
	s, f := checkedString(raw, "acknowledgementKey")
	if f != nil {
		return "", f
	}
	if !uuidRe.MatchString(s) {
		return "", &EdgeFailure{"malformed", "acknowledgementKey"}
	}
	return s, nil
}

func validateAction(raw any) (string, *EdgeFailure) {
	s, f := checkedString(raw, "action")
	if f != nil {
		return "", f
	}
	if s != "seen" && s != "i_am_safe" {
		return "", &EdgeFailure{"malformed", "action"}
	}
	return s, nil
}

func validateOptionalOccurredAt(raw any) (*string, *EdgeFailure) {
	if raw == nil {
		return nil, nil
	}
	s, f := checkedString(raw, "occurredAt")
	if f != nil {
		return nil, f
	}
	if !platform.IsRFC3339(s) {
		return nil, &EdgeFailure{"malformed", "occurredAt"}
	}
	if _, err := time.Parse(time.RFC3339Nano, s); err != nil {
		return nil, &EdgeFailure{"malformed", "occurredAt"}
	}
	return &s, nil
}

func describeEdge(f *EdgeFailure) string {
	switch f.Kind {
	case "missing":
		return f.Field + " is required"
	case "malformed":
		return f.Field + " is not in the format this endpoint accepts"
	default:
		return fmt.Sprintf("%s exceeds the maximum accepted length of %d characters", f.Field, MaxInputLength)
	}
}

// ---- contract versions ----

var versionRe = regexp.MustCompile(`(?m)^info:\s*\n(?:[ \t]+.*\n)*?[ \t]+version:\s*['"]?([^'"\s]+)`)

// ReadContractVersion reads info.version from the pinned OpenAPI document.
func ReadContractVersion(root, surface string) (string, error) {
	file := filepath.Join(root, "packages", "api-contracts", surface, "openapi.yaml")
	b, err := os.ReadFile(file)
	if err != nil {
		return "", err
	}
	m := versionRe.FindSubmatch(b)
	if m == nil {
		return "", fmt.Errorf("the pinned contract at %s declares no info.version", file)
	}
	return string(m[1]), nil
}
