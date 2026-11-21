// Package resident holds residents, households and effective-dated occupancy
// (who lives where), and authorises a resident for a unit at an instant.
package resident

import (
	"context"
	"fmt"
	"sort"
	"time"

	"pemo/internal/platform"
)

// Bilingual is English + Traditional Chinese.
type Bilingual = platform.LocalizedText

// ResidentRecord is one resident.
type ResidentRecord struct {
	ResidentID        string `json:"residentId"`
	OrganizationID    string `json:"organizationId"`
	DisplayName       string `json:"displayName"`
	PreferredLanguage string `json:"preferredLanguage"`
}

// UnitRelationship is the current assertion of one occupancy.
type UnitRelationship struct {
	OccupancyID   string  `json:"occupancyId"`
	ResidentID    string  `json:"residentId"`
	UnitID        string  `json:"unitId"`
	UnitClass     string  `json:"unitClass"`
	Role          string  `json:"role"`
	Status        string  `json:"status"`
	EffectiveFrom string  `json:"effectiveFrom"`
	EffectiveTo   *string `json:"effectiveTo"`
}

// NotificationPreference is one resident notification switch.
type NotificationPreference struct {
	PreferenceKey string     `json:"preferenceKey"`
	Label         Bilingual  `json:"label"`
	Description   *Bilingual `json:"description"`
	Enabled       bool       `json:"enabled"`
	Locked        bool       `json:"locked"`
	LockReason    *Bilingual `json:"lockReason"`
	Channels      []string   `json:"channels"`
}

// ResidentPass is an identity reference; it carries no access.
type ResidentPass struct {
	ResidentID    string    `json:"residentId"`
	PassReference string    `json:"passReference"`
	CarriesAccess bool      `json:"carriesAccess"`
	Note          Bilingual `json:"note"`
}

// AuthorizationOutcome is authorized, expired (with endedAt) or denied.
type AuthorizationOutcome struct {
	Kind         string
	Role         string
	Relationship *UnitRelationship
	EndedAt      string
}

// Resident is the module facade.
type Resident struct{ DB platform.DB }

// New binds the module to its pool.
func New(db platform.DB) *Resident { return &Resident{DB: db} }

// GetResident reads one resident.
func (m *Resident) GetResident(ctx context.Context, id string) (*ResidentRecord, error) {
	r, err := m.DB.QueryOne(ctx, `SELECT resident_id, organization_id, display_name, preferred_language FROM resident WHERE resident_id = $1`, id)
	if err != nil || r == nil {
		return nil, err
	}
	return &ResidentRecord{r.Str("resident_id"), r.Str("organization_id"), r.Str("display_name"), r.Str("preferred_language")}, nil
}

// GetResidents reads several residents in one query (the Node build ran one
// query per id).
func (m *Resident) GetResidents(ctx context.Context, ids []string) (map[string]ResidentRecord, error) {
	out := map[string]ResidentRecord{}
	var unique []string
	seen := map[string]bool{}
	for _, id := range ids {
		if id != "" && !seen[id] {
			seen[id] = true
			unique = append(unique, id)
		}
	}
	if len(unique) == 0 {
		return out, nil
	}
	rows, err := m.DB.Query(ctx, `SELECT resident_id, organization_id, display_name, preferred_language FROM resident WHERE resident_id = ANY($1::text[])`, unique)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.Str("resident_id")] = ResidentRecord{r.Str("resident_id"), r.Str("organization_id"), r.Str("display_name"), r.Str("preferred_language")}
	}
	return out, nil
}

var occupancyColumns = []string{"occupancy_id", "resident_id", "unit_id", "unit_class", "role", "status", "effective_from", "effective_to"}

func toRelationship(r platform.Row) UnitRelationship {
	var to *string
	if t := r.TimePtr("effective_to"); t != nil {
		s := platform.ISO(*t)
		to = &s
	}
	return UnitRelationship{r.Str("occupancy_id"), r.Str("resident_id"), r.Str("unit_id"), r.Str("unit_class"),
		r.Str("role"), r.Str("status"), platform.ISO(r.Time("effective_from")), to}
}

func (m *Resident) relationships(ctx context.Context, filter, order string, args ...any) ([]UnitRelationship, error) {
	q := `WITH current_assertion AS (` + platform.LatestAssertionSQL(platform.LatestAssertionQuery{Table: "occupancy",
		InstanceKey: "occupancy_id", Columns: occupancyColumns, Filter: filter}) + `) SELECT * FROM current_assertion ORDER BY ` + order
	rows, err := m.DB.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	out := make([]UnitRelationship, 0, len(rows))
	for _, r := range rows {
		out = append(out, toRelationship(r))
	}
	return out, nil
}

// ListAllRelationships returns every current occupancy of a resident.
func (m *Resident) ListAllRelationships(ctx context.Context, residentID string) ([]UnitRelationship, error) {
	return m.relationships(ctx, "resident_id = $1", "effective_from ASC, occupancy_id", residentID)
}

func isActiveAt(r UnitRelationship, now time.Time) bool {
	from, _ := platform.ParseISO(r.EffectiveFrom)
	if from.After(now) {
		return false
	}
	if r.EffectiveTo != nil {
		to, _ := platform.ParseISO(*r.EffectiveTo)
		if !to.After(now) {
			return false
		}
	}
	return true
}

func endedBy(r UnitRelationship, now time.Time) bool {
	if r.EffectiveTo == nil {
		return false
	}
	to, _ := platform.ParseISO(*r.EffectiveTo)
	return !to.After(now)
}

func latestEnded(rs []UnitRelationship, now time.Time) *UnitRelationship {
	var ended []UnitRelationship
	for _, r := range rs {
		if r.UnitClass == "residential" && endedBy(r, now) {
			ended = append(ended, r)
		}
	}
	if len(ended) == 0 {
		return nil
	}
	sort.SliceStable(ended, func(i, j int) bool { return *ended[i].EffectiveTo > *ended[j].EffectiveTo })
	return &ended[0]
}

// AuthorizeUnit is computed at operation time: authorised while a residential
// occupancy is live; "expired" names the most recent end.
func (m *Resident) AuthorizeUnit(ctx context.Context, residentID, unitID string, now time.Time) (AuthorizationOutcome, error) {
	rs, err := m.relationships(ctx, "resident_id = $1 AND unit_id = $2", "effective_from DESC", residentID, unitID)
	if err != nil {
		return AuthorizationOutcome{}, err
	}
	for i := range rs {
		if rs[i].UnitClass == "residential" && isActiveAt(rs[i], now) {
			return AuthorizationOutcome{Kind: "authorized", Role: rs[i].Role, Relationship: &rs[i]}, nil
		}
	}
	if e := latestEnded(rs, now); e != nil {
		return AuthorizationOutcome{Kind: "expired", Role: e.Role, EndedAt: *e.EffectiveTo}, nil
	}
	return AuthorizationOutcome{Kind: "denied"}, nil
}

// ListAuthorizedUnits returns the live residential occupancies.
func (m *Resident) ListAuthorizedUnits(ctx context.Context, residentID string, now time.Time) ([]UnitRelationship, error) {
	rs, err := m.ListAllRelationships(ctx, residentID)
	if err != nil {
		return nil, err
	}
	out := []UnitRelationship{}
	for _, r := range rs {
		if r.UnitClass == "residential" && isActiveAt(r, now) {
			out = append(out, r)
		}
	}
	return out, nil
}

// Expired is the most recently ended relationship.
type Expired struct{ Role, EndedAt string }

// Summary is the resident's live units, or why there are none.
type Summary struct {
	Active  []UnitRelationship
	Expired *Expired
}

// Summarize returns live residential units, or the latest ended one.
func (m *Resident) Summarize(ctx context.Context, residentID string, now time.Time) (Summary, error) {
	rs, err := m.ListAllRelationships(ctx, residentID)
	if err != nil {
		return Summary{}, err
	}
	s := Summary{Active: []UnitRelationship{}}
	for _, r := range rs {
		if r.UnitClass == "residential" && isActiveAt(r, now) {
			s.Active = append(s.Active, r)
		}
	}
	if len(s.Active) == 0 {
		if e := latestEnded(rs, now); e != nil {
			s.Expired = &Expired{e.Role, *e.EffectiveTo}
		}
	}
	return s, nil
}

// ListPreferences returns a resident's notification preferences.
func (m *Resident) ListPreferences(ctx context.Context, residentID string) ([]NotificationPreference, error) {
	rows, err := m.DB.Query(ctx, `SELECT preference_key, label_en, label_zh_hant, description_en, description_zh_hant,
            enabled, locked, lock_reason_en, lock_reason_zh_hant, channels
       FROM notification_preference WHERE resident_id = $1 ORDER BY sort_order, preference_key`, residentID)
	if err != nil {
		return nil, err
	}
	out := make([]NotificationPreference, 0, len(rows))
	for _, r := range rows {
		p := NotificationPreference{PreferenceKey: r.Str("preference_key"), Label: Bilingual{En: r.Str("label_en"), ZhHant: r.Str("label_zh_hant")},
			Enabled: r.Bool("enabled"), Locked: r.Bool("locked"), Channels: r.Strings("channels")}
		if r["description_en"] != nil && r["description_zh_hant"] != nil {
			p.Description = &Bilingual{En: r.Str("description_en"), ZhHant: r.Str("description_zh_hant")}
		}
		if r["lock_reason_en"] != nil && r["lock_reason_zh_hant"] != nil {
			p.LockReason = &Bilingual{En: r.Str("lock_reason_en"), ZhHant: r.Str("lock_reason_zh_hant")}
		}
		out = append(out, p)
	}
	return out, nil
}

// GetPass reads the resident's pass reference.
func (m *Resident) GetPass(ctx context.Context, residentID string) (*ResidentPass, error) {
	r, err := m.DB.QueryOne(ctx, `SELECT resident_id, pass_reference, note_en, note_zh_hant FROM resident_pass WHERE resident_id = $1`, residentID)
	if err != nil || r == nil {
		return nil, err
	}
	return &ResidentPass{r.Str("resident_id"), r.Str("pass_reference"), false, Bilingual{En: r.Str("note_en"), ZhHant: r.Str("note_zh_hant")}}, nil
}

// HouseholdContact is a household's contact email for a unit.
type HouseholdContact struct {
	HouseholdID  string
	UnitID       string
	ContactEmail *string
}

// HouseholdContactsByIDs reads household contact emails in the organisation.
func (m *Resident) HouseholdContactsByIDs(ctx context.Context, orgID string, ids []string) ([]HouseholdContact, error) {
	if len(ids) == 0 {
		return []HouseholdContact{}, nil
	}
	rows, err := m.DB.Query(ctx, `SELECT household_id, unit_id, contact_email FROM household
        WHERE organization_id = $1 AND household_id = ANY($2::text[])`, orgID, ids)
	if err != nil {
		return nil, err
	}
	out := make([]HouseholdContact, 0, len(rows))
	for _, r := range rows {
		out = append(out, HouseholdContact{r.Str("household_id"), r.Str("unit_id"), r.StrPtr("contact_email")})
	}
	return out, nil
}

// OccupantRecipient is one resident living in a unit at an instant.
type OccupantRecipient struct {
	ResidentID  string
	HouseholdID *string
	UnitID      string
}

// OccupantsOfUnits returns who lives in the units as at asAt.
func (m *Resident) OccupantsOfUnits(ctx context.Context, unitIDs []string, asAt time.Time) ([]OccupantRecipient, error) {
	if len(unitIDs) == 0 {
		return []OccupantRecipient{}, nil
	}
	rows, err := m.DB.Query(ctx, `
  WITH current_assertion AS (
    SELECT DISTINCT ON (occupancy_id) occupancy_id, resident_id, household_id, unit_id, unit_class,
           effective_from, effective_to, version
      FROM occupancy WHERE unit_id = ANY($1) ORDER BY occupancy_id, version DESC)
  SELECT DISTINCT resident_id, household_id, unit_id FROM current_assertion
   WHERE unit_class = 'residential' AND effective_from <= $2 AND (effective_to IS NULL OR effective_to > $2)
   ORDER BY resident_id`, unitIDs, asAt)
	if err != nil {
		return nil, err
	}
	out := make([]OccupantRecipient, 0, len(rows))
	for _, r := range rows {
		out = append(out, OccupantRecipient{r.Str("resident_id"), r.StrPtr("household_id"), r.Str("unit_id")})
	}
	return out, nil
}

// ---- occupancy commands ----

func guardLiveOccupancy(ctx context.Context, tx platform.DB, residentID, unitID string) error {
	r, err := tx.QueryOne(ctx, "SHOW transaction_isolation")
	if err != nil {
		return err
	}
	if r == nil || r.Str("transaction_isolation") != "read committed" {
		return fmt.Errorf("occupancy guard requires READ COMMITTED; refusing rather than guarding nothing")
	}
	return tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1 || E'\x1f' || $2, 0))`, residentID, unitID)
}

var currentOccupancyForPair = platform.LatestAssertionSQL(platform.LatestAssertionQuery{Table: "occupancy", InstanceKey: "occupancy_id",
	Columns: []string{"occupancy_id", "resident_id", "unit_id", "role", "status", "effective_from", "effective_to"},
	Filter:  "resident_id = $1 AND unit_id = $2"})

var currentOccupancyInstance = platform.LatestAssertionSQL(platform.LatestAssertionQuery{Table: "occupancy", InstanceKey: "occupancy_id",
	Columns: []string{"occupancy_id", "resident_id", "unit_id", "effective_to"}, Filter: "occupancy_id = $1"})

// LiveOccupancy is a live occupancy found by (resident, unit).
type LiveOccupancy struct{ OccupancyID, Role string }

// FindLiveOccupancy finds a live occupancy inside allowed units.
func (m *Resident) FindLiveOccupancy(ctx context.Context, residentID, unitID string, allowed []string, at time.Time) (*LiveOccupancy, error) {
	if len(allowed) == 0 {
		return nil, nil
	}
	r, err := m.DB.QueryOne(ctx, `SELECT occupancy_id, role FROM occupancy
        WHERE resident_id = $1 AND unit_id = $2 AND unit_id = ANY($3::text[]) AND status = 'active'
          AND effective_from <= $4 AND (effective_to IS NULL OR effective_to > $4) LIMIT 1`, residentID, unitID, allowed, at)
	if err != nil || r == nil {
		return nil, err
	}
	return &LiveOccupancy{r.Str("occupancy_id"), r.Str("role")}, nil
}

// RecordOccupancyInput records who lives where from when.
type RecordOccupancyInput struct {
	OccupancyID, ResidentID string
	HouseholdID             *string
	UnitID, UnitClass, Role string
	Source                  string
	EffectiveFrom           time.Time
}

// OccupancyResult is recorded / ended or a refusal kind.
type OccupancyResult struct {
	Kind          string
	OccupancyID   string
	EffectiveFrom string
	Version       int64
	EffectiveTo   string
}

// RecordOccupancy appends a new occupancy if none is live for the pair and
// the unit is in scope.
func RecordOccupancy(ctx context.Context, tx platform.DB, in RecordOccupancyInput, allowed []string) (OccupancyResult, error) {
	if len(allowed) == 0 {
		return OccupancyResult{Kind: "out-of-scope"}, nil
	}
	if err := guardLiveOccupancy(ctx, tx, in.ResidentID, in.UnitID); err != nil {
		return OccupancyResult{}, err
	}
	live, err := tx.Query(ctx, `WITH current_assertion AS (`+currentOccupancyForPair+`)
       SELECT occupancy_id, effective_to FROM current_assertion WHERE effective_to IS NULL OR effective_to > clock_timestamp()`, in.ResidentID, in.UnitID)
	if err != nil {
		return OccupancyResult{}, err
	}
	if len(live) > 0 {
		return OccupancyResult{Kind: "conflict"}, nil
	}
	r, err := tx.QueryOne(ctx, `INSERT INTO occupancy
         (assertion_id, version, occupancy_id, resident_id, household_id, unit_id, unit_class, role, status, source, effective_from)
       SELECT 'occa_' || $1::text, 1, $1, $2, $3, $4, $5, $6, 'active', $7, $8
        WHERE $4::text = ANY($9::text[])
       RETURNING occupancy_id, effective_from`, in.OccupancyID, in.ResidentID, in.HouseholdID, in.UnitID, in.UnitClass, in.Role, in.Source, in.EffectiveFrom, allowed)
	if err != nil {
		return OccupancyResult{}, err
	}
	if r == nil {
		return OccupancyResult{Kind: "out-of-scope"}, nil
	}
	return OccupancyResult{Kind: "recorded", OccupancyID: r.Str("occupancy_id"), EffectiveFrom: platform.ISO(r.Time("effective_from"))}, nil
}

// CurrentOccupancy is an occupancy's current assertion.
type CurrentOccupancy struct {
	OccupancyID, ResidentID, UnitID string
	Version                         int64
	EffectiveTo                     *string
}

// FindCurrentInstance reads an occupancy inside allowed units.
func (m *Resident) FindCurrentInstance(ctx context.Context, occupancyID string, allowed []string) (*CurrentOccupancy, error) {
	if len(allowed) == 0 {
		return nil, nil
	}
	r, err := m.DB.QueryOne(ctx, `WITH current_assertion AS (`+currentOccupancyInstance+`) SELECT * FROM current_assertion WHERE unit_id = ANY($2::text[])`, occupancyID, allowed)
	if err != nil || r == nil {
		return nil, err
	}
	var to *string
	if t := r.TimePtr("effective_to"); t != nil {
		s := platform.ISO(*t)
		to = &s
	}
	return &CurrentOccupancy{r.Str("occupancy_id"), r.Str("resident_id"), r.Str("unit_id"), r.Int("version"), to}, nil
}

// EndOccupancyInput ends one occupancy instance.
type EndOccupancyInput struct {
	OccupancyID, AssertionID string
	EffectiveTo              time.Time
}

// EndOccupancy appends an "ended" assertion of a live occupancy in scope.
func EndOccupancy(ctx context.Context, tx platform.DB, in EndOccupancyInput, allowed []string) (OccupancyResult, error) {
	if len(allowed) == 0 {
		return OccupancyResult{Kind: "out-of-scope"}, nil
	}
	cur, err := tx.QueryOne(ctx, `WITH current_assertion AS (`+currentOccupancyInstance+`) SELECT * FROM current_assertion WHERE unit_id = ANY($2::text[])`, in.OccupancyID, allowed)
	if err != nil {
		return OccupancyResult{}, err
	}
	if cur == nil {
		return OccupancyResult{Kind: "out-of-scope"}, nil
	}
	if err := guardLiveOccupancy(ctx, tx, cur.Str("resident_id"), cur.Str("unit_id")); err != nil {
		return OccupancyResult{}, err
	}
	locked, err := tx.QueryOne(ctx, `WITH current_assertion AS (`+currentOccupancyInstance+`) SELECT * FROM current_assertion`, in.OccupancyID)
	if err != nil {
		return OccupancyResult{}, err
	}
	if locked == nil {
		return OccupancyResult{Kind: "out-of-scope"}, nil
	}
	if t := locked.TimePtr("effective_to"); t != nil && !t.After(time.Now()) {
		return OccupancyResult{Kind: "not-live"}, nil
	}
	next := locked.Int("version") + 1
	r, err := tx.QueryOne(ctx, `INSERT INTO occupancy
         (assertion_id, version, occupancy_id, resident_id, household_id, unit_id, unit_class, role, status, source, effective_from, effective_to)
       SELECT $1, $2, occupancy_id, resident_id, household_id, unit_id, unit_class, role, 'ended', source, effective_from, $3::timestamptz
         FROM occupancy WHERE occupancy_id = $4 AND version = $5
       RETURNING version, effective_to`, in.AssertionID, next, in.EffectiveTo, in.OccupancyID, locked.Int("version"))
	if err != nil {
		return OccupancyResult{}, err
	}
	if r == nil {
		return OccupancyResult{Kind: "not-live"}, nil
	}
	return OccupancyResult{Kind: "ended", OccupancyID: in.OccupancyID, Version: r.Int("version"), EffectiveTo: platform.ISO(r.Time("effective_to"))}, nil
}
