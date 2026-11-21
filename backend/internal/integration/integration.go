// Package integration resolves inbound device events as at an instant:
// event vocabulary, severity policy and device-to-location mapping. It has no
// pool of its own (a library, deliberately unwired, as in the Node build).
package integration

import (
	"context"
	"time"

	"pemo/internal/platform"
)

// SourceSystem identifies an upstream system and version.
type SourceSystem struct {
	Type    string `json:"type"`
	Version string `json:"version"`
}

// VocabularyEntry maps a source event code to a normalised type.
type VocabularyEntry struct {
	VocabularyID        string       `json:"vocabularyId"`
	SourceSystem        SourceSystem `json:"sourceSystem"`
	SourceEventCode     string       `json:"sourceEventCode"`
	NormalisedEventType string       `json:"normalisedEventType"`
	SourceSeverityRank  *int64       `json:"sourceSeverityRank"`
	EffectiveFrom       string       `json:"effectiveFrom"`
	EffectiveTo         *string      `json:"effectiveTo"`
}

// PolicyEntry maps (event type, location class) to a PEMO severity.
type PolicyEntry struct {
	PolicyID            string  `json:"policyId"`
	PolicyVersion       string  `json:"policyVersion"`
	NormalisedEventType string  `json:"normalisedEventType"`
	LocationClass       string  `json:"locationClass"`
	PemoSeverity        string  `json:"pemoSeverity"`
	ResidentCopyRef     string  `json:"residentCopyRef"`
	ApprovedBy          string  `json:"approvedBy"`
	ApprovedOn          string  `json:"approvedOn"`
	ApprovalReference   string  `json:"approvalReference"`
	EffectiveFrom       string  `json:"effectiveFrom"`
	EffectiveTo         *string `json:"effectiveTo"`
}

// MappingEntry maps a device/zone to a PEMO node.
type MappingEntry struct {
	MappingID       string       `json:"mappingId"`
	SourceSystem    SourceSystem `json:"sourceSystem"`
	SourceDeviceRef string       `json:"sourceDeviceRef"`
	SourceZoneRef   string       `json:"sourceZoneRef"`
	OrganizationID  string       `json:"organizationId"`
	TargetType      string       `json:"targetType"`
	TargetID        string       `json:"targetId"`
	EffectiveFrom   string       `json:"effectiveFrom"`
	EffectiveTo     *string      `json:"effectiveTo"`
}

// Resolution is a resolved value or an unresolved quarantine reason.
type Resolution[T any] struct {
	Kind   string
	Value  *T
	Reason string
}

func asAt(n string) string {
	return "effective_from <= $" + n + " AND (effective_to IS NULL OR effective_to > $" + n + ")"
}

func toPtr(r platform.Row, k string) *string {
	if t := r.TimePtr(k); t != nil {
		s := platform.ISO(*t)
		return &s
	}
	return nil
}

// ResolveEventType looks up the vocabulary entry live at asAt.
func ResolveEventType(ctx context.Context, db platform.DB, sysType, sysVersion, code string, at time.Time) (Resolution[VocabularyEntry], error) {
	r, err := db.QueryOne(ctx, `SELECT * FROM event_vocabulary WHERE source_system_type = $1 AND source_system_version = $2
        AND source_event_code = $3 AND `+asAt("4"), sysType, sysVersion, code, at)
	if err != nil {
		return Resolution[VocabularyEntry]{}, err
	}
	if r == nil {
		return Resolution[VocabularyEntry]{Kind: "unresolved", Reason: "unknown_event_code"}, nil
	}
	var rank *int64
	if r["source_severity_rank"] != nil {
		n := r.Int("source_severity_rank")
		rank = &n
	}
	return Resolution[VocabularyEntry]{Kind: "resolved", Value: &VocabularyEntry{r.Str("vocabulary_id"),
		SourceSystem{r.Str("source_system_type"), r.Str("source_system_version")}, r.Str("source_event_code"),
		r.Str("normalised_event_type"), rank, platform.ISO(r.Time("effective_from")), toPtr(r, "effective_to")}}, nil
}

// ResolveSeverity looks up the severity policy live at asAt.
func ResolveSeverity(ctx context.Context, db platform.DB, eventType, locationClass string, at time.Time) (Resolution[PolicyEntry], error) {
	r, err := db.QueryOne(ctx, `SELECT * FROM severity_policy WHERE normalised_event_type = $1 AND location_class = $2 AND `+asAt("3"), eventType, locationClass, at)
	if err != nil {
		return Resolution[PolicyEntry]{}, err
	}
	if r == nil {
		return Resolution[PolicyEntry]{Kind: "unresolved", Reason: "no_policy_entry"}, nil
	}
	return Resolution[PolicyEntry]{Kind: "resolved", Value: &PolicyEntry{r.Str("policy_id"), r.Str("policy_version"),
		r.Str("normalised_event_type"), r.Str("location_class"), r.Str("pemo_severity"), r.Str("resident_copy_ref"),
		r.Str("approved_by"), platform.ISO(r.Time("approved_on"))[:10], r.Str("approval_reference"),
		platform.ISO(r.Time("effective_from")), toPtr(r, "effective_to")}}, nil
}

// ResolveLocation looks up the device mapping live at asAt.
func ResolveLocation(ctx context.Context, db platform.DB, sysType, sysVersion, deviceRef, zoneRef string, at time.Time) (Resolution[MappingEntry], error) {
	r, err := db.QueryOne(ctx, `SELECT * FROM device_location_mapping WHERE source_system_type = $1 AND source_system_version = $2
        AND source_device_ref = $3 AND source_zone_ref = $4 AND `+asAt("5"), sysType, sysVersion, deviceRef, zoneRef, at)
	if err != nil {
		return Resolution[MappingEntry]{}, err
	}
	if r == nil {
		return Resolution[MappingEntry]{Kind: "unresolved", Reason: "unmapped_device"}, nil
	}
	return Resolution[MappingEntry]{Kind: "resolved", Value: &MappingEntry{r.Str("mapping_id"),
		SourceSystem{r.Str("source_system_type"), r.Str("source_system_version")}, r.Str("source_device_ref"),
		r.Str("source_zone_ref"), r.Str("organization_id"), r.Str("target_type"), r.Str("target_id"),
		platform.ISO(r.Time("effective_from")), toPtr(r, "effective_to")}}, nil
}
