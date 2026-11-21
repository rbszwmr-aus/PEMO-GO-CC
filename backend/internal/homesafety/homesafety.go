// Package homesafety is the resident safety picture: unit safety state,
// installed services, safety events with their audience, acknowledgements,
// management updates and quarantine of events that cannot be placed.
package homesafety

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"pemo/internal/platform"
)

// Bilingual is English + Traditional Chinese.
type Bilingual = platform.LocalizedText

func bi(en, zh string) Bilingual { return Bilingual{En: en, ZhHant: zh} }

func biPtr(r platform.Row, en, zh string) *Bilingual {
	if r[en] == nil || r[zh] == nil {
		return nil
	}
	b := bi(r.Str(en), r.Str(zh))
	return &b
}

// Freshness is how old the reading is against its window.
type Freshness struct {
	Status        string `json:"status"`
	AgeSeconds    int64  `json:"ageSeconds"`
	WindowSeconds int64  `json:"windowSeconds"`
}

// SafetySummary is the unit's headline safety state.
type SafetySummary struct {
	Severity           string     `json:"severity"`
	MonitoringCoverage string     `json:"monitoringCoverage"`
	Headline           Bilingual  `json:"headline"`
	Detail             *Bilingual `json:"detail"`
	ObservedAt         string     `json:"observedAt"`
	ReceivedAt         string     `json:"receivedAt"`
	Freshness          Freshness  `json:"freshness"`
	Disclaimer         Bilingual  `json:"disclaimer"`
}

// InstalledService is one sensor or device in the unit.
type InstalledService struct {
	ServiceKey string    `json:"serviceKey"`
	Name       Bilingual `json:"name"`
	Location   Bilingual `json:"location"`
	State      Bilingual `json:"state"`
	Severity   string    `json:"severity"`
	ObservedAt string    `json:"observedAt"`
}

// SafetyLocation says where an event happened and how its audience was found.
type SafetyLocation struct {
	Label             Bilingual  `json:"label"`
	LocationClass     string     `json:"locationClass"`
	AudienceSource    string     `json:"audienceSource"`
	ServingScopeLabel *Bilingual `json:"servingScopeLabel"`
}

// SafetyEventSummary is a list entry.
type SafetyEventSummary struct {
	EventID    string         `json:"eventId"`
	Severity   string         `json:"severity"`
	Title      Bilingual      `json:"title"`
	OccurredAt string         `json:"occurredAt"`
	ReceivedAt string         `json:"receivedAt"`
	Location   SafetyLocation `json:"location"`
	StatusNote *Bilingual     `json:"statusNote"`
}

// ManagementUpdate is a staff update on an event.
type ManagementUpdate struct {
	UpdateID    string    `json:"updateId"`
	PublishedAt string    `json:"publishedAt"`
	Body        Bilingual `json:"body"`
	IsAllClear  bool      `json:"isAllClear"`
}

// ResponseAction is what a resident can do about an event.
type ResponseAction struct {
	ActionKey string    `json:"actionKey"`
	Label     Bilingual `json:"label"`
	Kind      string    `json:"kind"`
	Telephone *string   `json:"telephone"`
}

// AcknowledgementState is the resident's acknowledgement of an event.
type AcknowledgementState struct {
	Required       bool    `json:"required"`
	Acknowledged   bool    `json:"acknowledged"`
	AcknowledgedAt *string `json:"acknowledgedAt"`
}

// EventRevision describes corrections.
type EventRevision struct {
	RevisionNumber int64      `json:"revisionNumber"`
	IsCorrection   bool       `json:"isCorrection"`
	Supersedes     *string    `json:"supersedes"`
	CorrectionNote *Bilingual `json:"correctionNote"`
}

// SafetyEventDetail is one event for a resident in its audience.
type SafetyEventDetail struct {
	EventID                 string               `json:"eventId"`
	OrganizationID          string               `json:"organizationId"`
	Severity                string               `json:"severity"`
	Title                   Bilingual            `json:"title"`
	Instruction             Bilingual            `json:"instruction"`
	Location                SafetyLocation       `json:"location"`
	OccurredAt              string               `json:"occurredAt"`
	ReceivedAt              string               `json:"receivedAt"`
	ReportedBy              Bilingual            `json:"reportedBy"`
	Actions                 []ResponseAction     `json:"actions"`
	ManagementUpdates       []ManagementUpdate   `json:"managementUpdates"`
	ManagementUpdatePending bool                 `json:"managementUpdatePending"`
	Acknowledgement         AcknowledgementState `json:"acknowledgement"`
	Disclaimer              Bilingual            `json:"disclaimer"`
	Revision                EventRevision        `json:"revision"`
	Retracted               bool                 `json:"retracted"`
	SupersededBy            *string              `json:"supersededBy"`
}

// QuarantinedEvent is an event that could not be placed.
type QuarantinedEvent struct {
	QuarantineID    string  `json:"quarantineId"`
	OrganizationID  string  `json:"organizationId"`
	SourceReference string  `json:"sourceReference"`
	Reason          string  `json:"reason"`
	Severity        string  `json:"severity"`
	OccurredAt      string  `json:"occurredAt"`
	ReceivedAt      string  `json:"receivedAt"`
	Status          string  `json:"status"`
	ResolvedUnitID  *string `json:"resolvedUnitId"`
}

// HomeSafety is the module facade.
type HomeSafety struct{ DB platform.DB }

// New binds the module to its pool.
func New(db platform.DB) *HomeSafety { return &HomeSafety{DB: db} }

// ComputeFreshness: stale when older than the window.
func ComputeFreshness(observedAt, now time.Time, window int64) Freshness {
	age := int64(math.Max(0, math.Floor(now.Sub(observedAt).Seconds()+0.5)))
	status := "current"
	if age > window {
		status = "stale"
	}
	return Freshness{status, age, window}
}

// ApplyStalenessRule: a stale "normal" is unknown; a stale alarm stays.
func ApplyStalenessRule(severity string, f Freshness) string {
	if f.Status == "stale" && severity == "normal" {
		return "unknown"
	}
	return severity
}

func (h *HomeSafety) unitState(ctx context.Context, unitID string) (platform.Row, error) {
	return h.DB.QueryOne(ctx, `SELECT * FROM unit_safety_state WHERE unit_id = $1`, unitID)
}

// GetSummary returns the unit's safety summary, or nil.
func (h *HomeSafety) GetSummary(ctx context.Context, unitID string, now time.Time) (*SafetySummary, error) {
	r, err := h.unitState(ctx, unitID)
	if err != nil || r == nil {
		return nil, err
	}
	f := ComputeFreshness(r.Time("observed_at"), now, r.Int("freshness_window_seconds"))
	return &SafetySummary{Severity: ApplyStalenessRule(r.Str("severity"), f), MonitoringCoverage: r.Str("monitoring_coverage"),
		Headline: bi(r.Str("headline_en"), r.Str("headline_zh_hant")), Detail: biPtr(r, "detail_en", "detail_zh_hant"),
		ObservedAt: platform.ISO(r.Time("observed_at")), ReceivedAt: platform.ISO(r.Time("received_at")), Freshness: f,
		Disclaimer: bi(r.Str("disclaimer_en"), r.Str("disclaimer_zh_hant"))}, nil
}

// ListInstalledServices lists the unit's services with staleness applied.
func (h *HomeSafety) ListInstalledServices(ctx context.Context, unitID string, now time.Time) ([]InstalledService, error) {
	state, err := h.unitState(ctx, unitID)
	if err != nil {
		return nil, err
	}
	rows, err := h.DB.Query(ctx, `SELECT service_key, name_en, name_zh_hant, location_en, location_zh_hant,
            state_en, state_zh_hant, severity, observed_at
       FROM installed_service WHERE unit_id = $1 ORDER BY sort_order, service_key`, unitID)
	if err != nil {
		return nil, err
	}
	window := int64(3600)
	if state != nil {
		window = state.Int("freshness_window_seconds")
	}
	out := make([]InstalledService, 0, len(rows))
	for _, r := range rows {
		f := ComputeFreshness(r.Time("observed_at"), now, window)
		out = append(out, InstalledService{r.Str("service_key"), bi(r.Str("name_en"), r.Str("name_zh_hant")),
			bi(r.Str("location_en"), r.Str("location_zh_hant")), bi(r.Str("state_en"), r.Str("state_zh_hant")),
			ApplyStalenessRule(r.Str("severity"), f), platform.ISO(r.Time("observed_at"))})
	}
	return out, nil
}

// GetInstalledServicesNote returns the unit's installed-services note.
func (h *HomeSafety) GetInstalledServicesNote(ctx context.Context, unitID string) (*Bilingual, error) {
	r, err := h.DB.QueryOne(ctx, `SELECT note_en, note_zh_hant FROM installed_services_note WHERE unit_id = $1`, unitID)
	if err != nil || r == nil {
		return nil, err
	}
	b := bi(r.Str("note_en"), r.Str("note_zh_hant"))
	return &b, nil
}

func toLocation(r platform.Row) SafetyLocation {
	return SafetyLocation{bi(r.Str("location_label_en"), r.Str("location_label_zh_hant")), r.Str("location_class"),
		r.Str("audience_source"), biPtr(r, "serving_scope_label_en", "serving_scope_label_zh_hant")}
}

func toSummary(r platform.Row) SafetyEventSummary {
	return SafetyEventSummary{r.Str("event_id"), r.Str("severity"), bi(r.Str("title_en"), r.Str("title_zh_hant")),
		platform.ISO(r.Time("occurred_at")), platform.ISO(r.Time("received_at")), toLocation(r),
		biPtr(r, "status_note_en", "status_note_zh_hant")}
}

// ListRecentForUnit lists up to 10 recent un-retracted events for the unit.
func (h *HomeSafety) ListRecentForUnit(ctx context.Context, unitID string) ([]SafetyEventSummary, error) {
	rows, err := h.DB.Query(ctx, `SELECT e.* FROM safety_event e JOIN safety_event_audience a ON a.event_id = e.event_id
      WHERE a.unit_id = $1 AND e.retracted = false ORDER BY e.occurred_at DESC, e.event_id LIMIT $2`, unitID, 10)
	if err != nil {
		return nil, err
	}
	out := make([]SafetyEventSummary, 0, len(rows))
	for _, r := range rows {
		out = append(out, toSummary(r))
	}
	return out, nil
}

// GetForAudience returns the event only when one of unitIDs is in its audience.
func (h *HomeSafety) GetForAudience(ctx context.Context, eventID string, unitIDs []string, residentID string) (*SafetyEventDetail, error) {
	r, err := h.DB.QueryOne(ctx, `SELECT * FROM safety_event WHERE event_id = $1`, eventID)
	if err != nil || r == nil {
		return nil, err
	}
	if len(unitIDs) == 0 {
		return nil, nil
	}
	present, err := h.DB.QueryOne(ctx, `SELECT true AS present FROM safety_event_audience WHERE event_id = $1 AND unit_id = ANY($2::text[]) LIMIT 1`, eventID, unitIDs)
	if err != nil || present == nil {
		return nil, err
	}
	var missing []string
	for _, c := range []string{"instruction_en", "instruction_zh_hant", "reported_by_en", "reported_by_zh_hant"} {
		if r.Str(c) == "" {
			missing = append(missing, c)
		}
	}
	if len(missing) > 0 {
		return nil, fmt.Errorf("safety event %s is resident-visible but has no resident-facing text: %s", r.Str("event_id"), strings.Join(missing, ", "))
	}
	updates, err := h.ManagementUpdates(ctx, eventID)
	if err != nil {
		return nil, err
	}
	arows, err := h.DB.Query(ctx, `SELECT action_key, label_en, label_zh_hant, kind, telephone FROM event_action WHERE event_id = $1 ORDER BY sort_order, action_key`, eventID)
	if err != nil {
		return nil, err
	}
	actions := make([]ResponseAction, 0, len(arows))
	for _, a := range arows {
		actions = append(actions, ResponseAction{a.Str("action_key"), bi(a.Str("label_en"), a.Str("label_zh_hant")), a.Str("kind"), a.StrPtr("telephone")})
	}
	ack, err := h.DB.QueryOne(ctx, `SELECT * FROM acknowledgement WHERE event_id = $1 AND resident_id = $2`, eventID, residentID)
	if err != nil {
		return nil, err
	}
	state := AcknowledgementState{Required: r.Bool("acknowledgement_required"), Acknowledged: ack != nil}
	if ack != nil {
		s := platform.ISO(ack.Time("occurred_at"))
		state.AcknowledgedAt = &s
	}
	return &SafetyEventDetail{EventID: r.Str("event_id"), OrganizationID: r.Str("organization_id"), Severity: r.Str("severity"),
		Title: bi(r.Str("title_en"), r.Str("title_zh_hant")), Instruction: bi(r.Str("instruction_en"), r.Str("instruction_zh_hant")),
		Location: toLocation(r), OccurredAt: platform.ISO(r.Time("occurred_at")), ReceivedAt: platform.ISO(r.Time("received_at")),
		ReportedBy: bi(r.Str("reported_by_en"), r.Str("reported_by_zh_hant")), Actions: actions, ManagementUpdates: updates,
		ManagementUpdatePending: r.Bool("management_update_pending"), Acknowledgement: state,
		Disclaimer: bi(r.Str("disclaimer_en"), r.Str("disclaimer_zh_hant")),
		Revision: EventRevision{r.Int("revision_number"), r.Bool("is_correction"), r.StrPtr("supersedes_event_id"),
			biPtr(r, "correction_note_en", "correction_note_zh_hant")},
		Retracted: r.Bool("retracted"), SupersededBy: r.StrPtr("superseded_by_event_id")}, nil
}

// ManagementUpdates lists an event's staff updates in publication order.
func (h *HomeSafety) ManagementUpdates(ctx context.Context, eventID string) ([]ManagementUpdate, error) {
	rows, err := h.DB.Query(ctx, `SELECT update_id, published_at, body_en, body_zh_hant, is_all_clear FROM management_update WHERE event_id = $1 ORDER BY published_at, update_id`, eventID)
	if err != nil {
		return nil, err
	}
	out := make([]ManagementUpdate, 0, len(rows))
	for _, r := range rows {
		out = append(out, ManagementUpdate{r.Str("update_id"), platform.ISO(r.Time("published_at")), bi(r.Str("body_en"), r.Str("body_zh_hant")), r.Bool("is_all_clear")})
	}
	return out, nil
}

// InsertAudience records an event's audience in ONE statement (review P1:
// the Node build issued one INSERT per unit).
func InsertAudience(ctx context.Context, db platform.DB, eventID string, unitIDs []string) error {
	if len(unitIDs) == 0 {
		return nil
	}
	return db.Exec(ctx, `INSERT INTO safety_event_audience (event_id, unit_id)
       SELECT $1, u FROM unnest($2::text[]) AS u ON CONFLICT DO NOTHING`, eventID, unitIDs)
}

// ---- overview reads ----

// SafetyEventWindowItem is an event inside the overview window.
type SafetyEventWindowItem struct {
	EventID, Severity, TitleEn, TitleZhHant, OccurredAt string
}

// SafetyEventsInWindow lists events affecting the units within windowHours.
func (h *HomeSafety) SafetyEventsInWindow(ctx context.Context, unitIDs []string, windowHours int) ([]SafetyEventWindowItem, error) {
	if len(unitIDs) == 0 {
		return []SafetyEventWindowItem{}, nil
	}
	rows, err := h.DB.Query(ctx, `SELECT DISTINCT e.event_id, e.severity, e.title_en, e.title_zh_hant, e.occurred_at
         FROM safety_event e JOIN safety_event_audience a ON a.event_id = e.event_id
        WHERE e.retracted = false AND e.occurred_at >= now() - make_interval(hours => $2)
          AND a.unit_id = ANY($1::text[])
        ORDER BY e.occurred_at DESC, e.event_id`, unitIDs, windowHours)
	if err != nil {
		return nil, err
	}
	out := make([]SafetyEventWindowItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, SafetyEventWindowItem{r.Str("event_id"), r.Str("severity"), r.Str("title_en"), r.Str("title_zh_hant"), platform.ISO(r.Time("occurred_at"))})
	}
	return out, nil
}

// UnitUnknownStateItem is a unit whose safety state is unknown or offline.
type UnitUnknownStateItem struct{ UnitID, Severity string }

// UnitsInUnknownState lists units reporting unknown/offline.
func (h *HomeSafety) UnitsInUnknownState(ctx context.Context, unitIDs []string) ([]UnitUnknownStateItem, error) {
	if len(unitIDs) == 0 {
		return []UnitUnknownStateItem{}, nil
	}
	rows, err := h.DB.Query(ctx, `SELECT unit_id, severity FROM unit_safety_state
        WHERE unit_id = ANY($1::text[]) AND severity = ANY($2::text[]) ORDER BY unit_id`, unitIDs, []string{"unknown", "offline"})
	if err != nil {
		return nil, err
	}
	out := make([]UnitUnknownStateItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, UnitUnknownStateItem{r.Str("unit_id"), r.Str("severity")})
	}
	return out, nil
}

// ---- acknowledgements ----

// AcknowledgeInput is one resident acknowledgement.
type AcknowledgeInput struct {
	EventID, ResidentID, AcknowledgementKey, Action string
	OccurredAt, ReceivedAt, CorrelationID           string
}

// AcknowledgeResult is recorded, replayed (same key) or duplicate.
type AcknowledgeResult struct {
	Kind  string
	State AcknowledgementState
}

// Acknowledge records the acknowledgement once per (event, resident); the
// same key replays, a different key is a duplicate.
func (h *HomeSafety) Acknowledge(ctx context.Context, in AcknowledgeInput) (AcknowledgeResult, error) {
	byKey, err := h.DB.QueryOne(ctx, `SELECT * FROM acknowledgement WHERE acknowledgement_key = $1`, in.AcknowledgementKey)
	if err != nil {
		return AcknowledgeResult{}, err
	}
	if byKey != nil {
		if byKey.Str("event_id") != in.EventID || byKey.Str("resident_id") != in.ResidentID {
			return AcknowledgeResult{Kind: "duplicate"}, nil
		}
		s := platform.ISO(byKey.Time("occurred_at"))
		return AcknowledgeResult{"replayed", AcknowledgementState{true, true, &s}}, nil
	}
	existing, err := h.DB.QueryOne(ctx, `SELECT * FROM acknowledgement WHERE event_id = $1 AND resident_id = $2`, in.EventID, in.ResidentID)
	if err != nil {
		return AcknowledgeResult{}, err
	}
	if existing != nil {
		return AcknowledgeResult{Kind: "duplicate"}, nil
	}
	row, err := h.DB.QueryOne(ctx, `INSERT INTO acknowledgement
       (acknowledgement_id, acknowledgement_key, event_id, resident_id, action, occurred_at, received_at, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`, "ack_"+platform.NewUUID(), in.AcknowledgementKey, in.EventID,
		in.ResidentID, in.Action, in.OccurredAt, in.ReceivedAt, in.CorrelationID)
	if err != nil {
		return AcknowledgeResult{}, err
	}
	if row == nil {
		return AcknowledgeResult{}, errors.New("acknowledgement insert returned no row")
	}
	s := platform.ISO(row.Time("occurred_at"))
	return AcknowledgeResult{"recorded", AcknowledgementState{true, true, &s}}, nil
}

// ---- management updates ----

// ScopedEvent is an event inside the caller's estates.
type ScopedEvent struct {
	EventID, OrganizationID, EstateID string
	Retracted                         bool
}

// FindEventInScope returns the event only inside estateIDs.
func (h *HomeSafety) FindEventInScope(ctx context.Context, eventID string, estateIDs []string) (*ScopedEvent, error) {
	if len(estateIDs) == 0 {
		return nil, nil
	}
	r, err := h.DB.QueryOne(ctx, `SELECT event_id, organization_id, estate_id, retracted FROM safety_event WHERE event_id = $1 AND estate_id = ANY($2::text[])`, eventID, estateIDs)
	if err != nil || r == nil {
		return nil, err
	}
	return &ScopedEvent{r.Str("event_id"), r.Str("organization_id"), r.Str("estate_id"), r.Bool("retracted")}, nil
}

// ManagementUpdateInput publishes a staff update.
type ManagementUpdateInput struct {
	UpdateID, EventID, BodyEn, BodyZhHant string
	IsAllClear                            bool
	PublishedAt                           time.Time
}

// PublishUpdate inserts the update on the caller's transaction.
func PublishUpdate(ctx context.Context, tx platform.DB, in ManagementUpdateInput) (updateID, publishedAt string, err error) {
	r, err := tx.QueryOne(ctx, `INSERT INTO management_update (update_id, event_id, published_at, body_en, body_zh_hant, is_all_clear)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING update_id, published_at`, in.UpdateID, in.EventID, in.PublishedAt, in.BodyEn, in.BodyZhHant, in.IsAllClear)
	if err != nil {
		return "", "", err
	}
	if r == nil {
		return "", "", errors.New("management_update insert returned no row")
	}
	return r.Str("update_id"), platform.ISO(r.Time("published_at")), nil
}

// ---- audience resolution ----

// AudienceResolution is resolved (units + source) or unresolved (reason).
type AudienceResolution struct {
	Kind    string
	UnitIDs []string
	Source  string
	Reason  string
}

// ServingScopeLookup and UnitExistenceLookup are the ports Property fills.
type ServingScopeLookup func(ctx context.Context, orgID, locationID string) ([]string, error)
type UnitExistenceLookup func(ctx context.Context, orgID, unitID string) (bool, error)

// ResolveAudience: a unit event reaches that unit; a location event reaches
// its serving scope; anything else is unresolved.
func ResolveAudience(ctx context.Context, served ServingScopeLookup, known UnitExistenceLookup, orgID string, sourceUnitID, sourceLocationID *string) (AudienceResolution, error) {
	if sourceUnitID != nil {
		ok, err := known(ctx, orgID, *sourceUnitID)
		if err != nil {
			return AudienceResolution{}, err
		}
		if !ok {
			return AudienceResolution{Kind: "unresolved", Reason: "unmapped_unit"}, nil
		}
		return AudienceResolution{Kind: "resolved", UnitIDs: []string{*sourceUnitID}, Source: "unit"}, nil
	}
	if sourceLocationID == nil {
		return AudienceResolution{Kind: "unresolved", Reason: "unknown_location"}, nil
	}
	units, err := served(ctx, orgID, *sourceLocationID)
	if err != nil {
		return AudienceResolution{}, err
	}
	if len(units) == 0 {
		return AudienceResolution{Kind: "unresolved", Reason: "ambiguous_audience"}, nil
	}
	return AudienceResolution{Kind: "resolved", UnitIDs: units, Source: "serving_scope"}, nil
}

// ---- quarantine ----

// QuarantineInput holds an event that could not be placed.
type QuarantineInput struct {
	OrganizationID, SourceReference, Reason, Severity string
	Detail                                            any
	OccurredAt, ReceivedAt, CorrelationID             string
}

func toQuarantined(r platform.Row) QuarantinedEvent {
	return QuarantinedEvent{r.Str("quarantine_id"), r.Str("organization_id"), r.Str("source_reference"), r.Str("reason"),
		r.Str("severity"), platform.ISO(r.Time("occurred_at")), platform.ISO(r.Time("received_at")), r.Str("status"), r.StrPtr("resolved_unit_id")}
}

// Hold quarantines an event.
func (h *HomeSafety) Hold(ctx context.Context, in QuarantineInput) (*QuarantinedEvent, error) {
	d, _ := json.Marshal(in.Detail)
	r, err := h.DB.QueryOne(ctx, `INSERT INTO event_quarantine
       (quarantine_id, organization_id, source_reference, reason, severity, detail, occurred_at, received_at, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9) RETURNING *`, "qtn_"+platform.NewUUID(), in.OrganizationID,
		in.SourceReference, in.Reason, in.Severity, string(d), in.OccurredAt, in.ReceivedAt, in.CorrelationID)
	if err != nil {
		return nil, err
	}
	if r == nil {
		return nil, errors.New("quarantine insert returned no row")
	}
	q := toQuarantined(r)
	return &q, nil
}

// ListHeld lists held quarantine entries, newest first.
func (h *HomeSafety) ListHeld(ctx context.Context, orgID string) ([]QuarantinedEvent, error) {
	rows, err := h.DB.Query(ctx, `SELECT * FROM event_quarantine WHERE organization_id = $1 AND status = 'held' ORDER BY received_at DESC`, orgID)
	if err != nil {
		return nil, err
	}
	out := make([]QuarantinedEvent, 0, len(rows))
	for _, r := range rows {
		out = append(out, toQuarantined(r))
	}
	return out, nil
}
