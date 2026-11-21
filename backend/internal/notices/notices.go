// Package notices holds staff notices: append-only assertions, targets,
// audience snapshots at publication, and resident read/acknowledge/response.
package notices

import (
	"context"
	"slices"
	"sort"
	"time"

	"pemo/internal/platform"
)

// NoticeTypes is the closed set of notice types.
var NoticeTypes = []string{"emergency", "event_community", "general", "planned_interruption"}

// IsNoticeType reports whether v is a notice type.
func IsNoticeType(v string) bool { return slices.Contains(NoticeTypes, v) }

// NoticeDispositions are what an assertion records.
var NoticeDispositions = []string{"approval_granted", "approval_requested", "draft_saved", "publication_released", "withdrawal_recorded"}

// NoticeLifecycleStates are what notice_current derives.
var NoticeLifecycleStates = []string{"approved", "draft", "expired", "live", "pending_approval", "scheduled", "withdrawn"}

// Target is one audience target: a hierarchy node or a location.
type Target struct {
	NodeKind        *string `json:"nodeKind"`
	NodeID          *string `json:"nodeId"`
	LocationID      *string `json:"locationId"`
	ResidentGroupID *string `json:"-"`
}

// AudienceRule is an organisation plus its targets.
type AudienceRule struct {
	OrganizationID string
	Targets        []Target
}

// Recipient is one resident addressed by a notice.
type Recipient struct {
	ResidentID  string
	HouseholdID *string
	UnitID      string
}

// Ports the composition root fills from Property and Resident.
type (
	UnitsUnder        func(ctx context.Context, orgID string, nodes [][2]string) ([]string, error)
	ServedUnitsMany   func(ctx context.Context, orgID string, locationIDs []string) (map[string][]string, error)
	OccupantsOfUnits  func(ctx context.Context, unitIDs []string, asAt time.Time) ([]Recipient, error)
	VisibleLocations  func(ctx context.Context, orgID string, scopeNodeKeys []string) ([]string, error)
	ServingScopeNodes func(ctx context.Context, orgID, locationID string) ([]string, error)
)

// AudienceResolver resolves a rule to the residents living there as at asAt.
type AudienceResolver struct {
	Units     UnitsUnder
	Served    ServedUnitsMany
	Occupants OccupantsOfUnits
}

// Resolve returns one recipient per resident.
func (a *AudienceResolver) Resolve(ctx context.Context, rule AudienceRule, asAt time.Time) ([]Recipient, error) {
	var nodes [][2]string
	var locations []string
	for _, t := range rule.Targets {
		if t.NodeKind != nil && t.NodeID != nil {
			nodes = append(nodes, [2]string{*t.NodeKind, *t.NodeID})
		}
		if t.LocationID != nil {
			locations = append(locations, *t.LocationID)
		}
	}
	units := map[string]bool{}
	if len(nodes) > 0 {
		us, err := a.Units(ctx, rule.OrganizationID, nodes)
		if err != nil {
			return nil, err
		}
		for _, u := range us {
			units[u] = true
		}
	}
	if len(locations) > 0 {
		served, err := a.Served(ctx, rule.OrganizationID, locations)
		if err != nil {
			return nil, err
		}
		for _, us := range served {
			for _, u := range us {
				units[u] = true
			}
		}
	}
	if len(units) == 0 {
		return []Recipient{}, nil
	}
	ids := make([]string, 0, len(units))
	for u := range units {
		ids = append(ids, u)
	}
	sort.Strings(ids)
	occ, err := a.Occupants(ctx, ids, asAt)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	out := []Recipient{}
	for _, o := range occ {
		if !seen[o.ResidentID] {
			seen[o.ResidentID] = true
			out = append(out, o)
		}
	}
	return out, nil
}

// ResidentNoticeItem is a notice as one resident sees it.
type ResidentNoticeItem struct {
	NoticeID, NoticeType   string
	TitleEn, TitleZhHant   string
	BodyEn, BodyZhHant     string
	PublishedAt, ExpiresAt *time.Time
	Expired, MandatoryAck  bool
	ResponseOptions        []string
	HasResponseOptions     bool
	MyRead, MyAcknowledged *time.Time
	MyResponse             *string
}

// Notices is the module facade.
type Notices struct {
	DB               platform.DB
	VisibleLocations VisibleLocations
}

// ForResident lists live/expired notices addressed to the resident.
func (n *Notices) ForResident(ctx context.Context, residentID string, asAt time.Time) ([]ResidentNoticeItem, error) {
	rows, err := n.DB.Query(ctx, `SELECT c.notice_id, c.notice_type, c.title_en, c.title_zh_hant,
              c.body_en, c.body_zh_hant, c.publish_at, c.expire_at, c.lifecycle_state,
              c.mandatory_ack, c.response_options,
              max(a.occurred_at) FILTER (WHERE a.kind = 'read')         AS my_read,
              max(a.occurred_at) FILTER (WHERE a.kind = 'acknowledged') AS my_acknowledged,
              (array_agg(a.response ORDER BY a.occurred_at DESC, a.received_at DESC)
                 FILTER (WHERE a.kind = 'responded'))[1]                AS my_response
         FROM notice_current c
         JOIN notice_audience au ON au.notice_id = c.notice_id AND au.resident_id = $1
         LEFT JOIN notice_acknowledgement a ON a.notice_id = c.notice_id AND a.resident_id = $1
        WHERE c.lifecycle_state IN ('live', 'expired')
          AND (c.publish_at IS NULL OR c.publish_at <= $2)
        GROUP BY c.notice_id, c.notice_type, c.title_en, c.title_zh_hant, c.body_en, c.body_zh_hant,
                 c.publish_at, c.expire_at, c.lifecycle_state, c.mandatory_ack, c.response_options
        ORDER BY c.publish_at DESC NULLS LAST, c.notice_id`, residentID, asAt)
	if err != nil {
		return nil, err
	}
	out := make([]ResidentNoticeItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, ResidentNoticeItem{NoticeID: r.Str("notice_id"), NoticeType: r.Str("notice_type"),
			TitleEn: r.Str("title_en"), TitleZhHant: r.Str("title_zh_hant"), BodyEn: r.Str("body_en"), BodyZhHant: r.Str("body_zh_hant"),
			PublishedAt: r.TimePtr("publish_at"), ExpiresAt: r.TimePtr("expire_at"), Expired: r.Str("lifecycle_state") == "expired",
			MandatoryAck: r.Bool("mandatory_ack"), ResponseOptions: r.Strings("response_options"), HasResponseOptions: r["response_options"] != nil,
			MyRead: r.TimePtr("my_read"), MyAcknowledged: r.TimePtr("my_acknowledged"), MyResponse: r.StrPtr("my_response")})
	}
	return out, nil
}

// StaffNoticeListItem is a list row.
type StaffNoticeListItem struct {
	NoticeID, NoticeType, TitleEn, TitleZhHant, LifecycleState string
	StateEnteredAt                                             time.Time
	PublishAt, ExpireAt                                        *time.Time
	MandatoryAck                                               bool
	Version                                                    int64
}

// HistoryEntry is one assertion of a notice.
type HistoryEntry struct {
	Version     int64
	Disposition string
	RecordedAt  time.Time
	RecordedBy  string
}

// StaffNoticeDetail is the full notice as staff see it.
type StaffNoticeDetail struct {
	StaffNoticeListItem
	BodyEn, BodyZhHant string
	ResponseOptions    []string
	HasResponseOptions bool
	Targets            []Target
	History            []HistoryEntry
}

// RecipientStatus is one addressed resident's read/ack/response.
type RecipientStatus struct {
	ResidentID, UnitID string
	Read, Acknowledged *time.Time
	Response           *string
}

const intersects = `
  EXISTS (SELECT 1 FROM notice_target t
     WHERE t.assertion_id = c.assertion_id
       AND ( (t.node_kind IS NOT NULL AND (t.node_kind || ':' || t.node_id) = ANY($2))
          OR (t.location_id IS NOT NULL AND t.location_id = ANY($3)) ))`

func nz(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

// List lists notices whose targets intersect the caller's scope.
func (n *Notices) List(ctx context.Context, orgID string, scopeKeys []string, states, types []string) ([]StaffNoticeListItem, error) {
	locs, err := n.VisibleLocations(ctx, orgID, scopeKeys)
	if err != nil {
		return nil, err
	}
	var st, ty []string
	if len(states) > 0 {
		st = states
	}
	if len(types) > 0 {
		ty = types
	}
	rows, err := n.DB.Query(ctx, `SELECT c.notice_id, c.notice_type, c.title_en, c.title_zh_hant, c.lifecycle_state,
              c.recorded_at, c.publish_at, c.expire_at, c.mandatory_ack, c.version
         FROM notice_current c
        WHERE c.organization_id = $1 AND `+intersects+`
          AND ($4::text[] IS NULL OR c.lifecycle_state = ANY($4))
          AND ($5::text[] IS NULL OR c.notice_type = ANY($5))
        ORDER BY c.mandatory_ack DESC, c.publish_at DESC NULLS FIRST, c.notice_id`, orgID, nz(scopeKeys), nz(locs), st, ty)
	if err != nil {
		return nil, err
	}
	out := make([]StaffNoticeListItem, 0, len(rows))
	for _, r := range rows {
		out = append(out, listItem(r))
	}
	return out, nil
}

func listItem(r platform.Row) StaffNoticeListItem {
	return StaffNoticeListItem{r.Str("notice_id"), r.Str("notice_type"), r.Str("title_en"), r.Str("title_zh_hant"),
		r.Str("lifecycle_state"), r.Time("recorded_at"), r.TimePtr("publish_at"), r.TimePtr("expire_at"), r.Bool("mandatory_ack"), r.Int("version")}
}

// Detail returns the notice if it intersects the caller's scope.
func (n *Notices) Detail(ctx context.Context, orgID, noticeID string, scopeKeys []string) (*StaffNoticeDetail, error) {
	locs, err := n.VisibleLocations(ctx, orgID, scopeKeys)
	if err != nil {
		return nil, err
	}
	r, err := n.DB.QueryOne(ctx, `SELECT c.* FROM notice_current c WHERE c.organization_id = $1 AND c.notice_id = $4 AND `+intersects,
		orgID, nz(scopeKeys), nz(locs), noticeID)
	if err != nil || r == nil {
		return nil, err
	}
	trows, err := n.DB.Query(ctx, `SELECT node_kind, node_id, location_id FROM notice_target WHERE assertion_id = $1 ORDER BY target_id`, r.Str("assertion_id"))
	if err != nil {
		return nil, err
	}
	hrows, err := n.DB.Query(ctx, `SELECT version, disposition, recorded_at, recorded_by FROM notice WHERE notice_id = $1 ORDER BY version`, noticeID)
	if err != nil {
		return nil, err
	}
	d := &StaffNoticeDetail{StaffNoticeListItem: listItem(r), BodyEn: r.Str("body_en"), BodyZhHant: r.Str("body_zh_hant"),
		ResponseOptions: r.Strings("response_options"), HasResponseOptions: r["response_options"] != nil, Targets: []Target{}, History: []HistoryEntry{}}
	for _, t := range trows {
		d.Targets = append(d.Targets, Target{NodeKind: t.StrPtr("node_kind"), NodeID: t.StrPtr("node_id"), LocationID: t.StrPtr("location_id")})
	}
	for _, h := range hrows {
		d.History = append(d.History, HistoryEntry{h.Int("version"), h.Str("disposition"), h.Time("recorded_at"), h.Str("recorded_by")})
	}
	return d, nil
}

// Outstanding lists each addressed resident's status, unacknowledged first.
func (n *Notices) Outstanding(ctx context.Context, orgID, noticeID string, scopeKeys []string) ([]RecipientStatus, error) {
	d, err := n.Detail(ctx, orgID, noticeID, scopeKeys)
	if err != nil || d == nil {
		return []RecipientStatus{}, err
	}
	rows, err := n.DB.Query(ctx, `SELECT au.resident_id, au.unit_id,
              max(a.occurred_at) FILTER (WHERE a.kind = 'read') AS read_at,
              max(a.occurred_at) FILTER (WHERE a.kind = 'acknowledged') AS acknowledged_at,
              (array_agg(a.response ORDER BY a.occurred_at DESC, a.received_at DESC) FILTER (WHERE a.kind = 'responded'))[1] AS response
         FROM notice_audience au
         LEFT JOIN notice_acknowledgement a ON a.notice_id = au.notice_id AND a.resident_id = au.resident_id
        WHERE au.notice_id = $1
        GROUP BY au.resident_id, au.unit_id
        ORDER BY (max(a.occurred_at) FILTER (WHERE a.kind = 'acknowledged')) NULLS FIRST, au.resident_id`, noticeID)
	if err != nil {
		return nil, err
	}
	out := make([]RecipientStatus, 0, len(rows))
	for _, r := range rows {
		out = append(out, RecipientStatus{r.Str("resident_id"), r.Str("unit_id"), r.TimePtr("read_at"), r.TimePtr("acknowledged_at"), r.StrPtr("response")})
	}
	return out, nil
}
