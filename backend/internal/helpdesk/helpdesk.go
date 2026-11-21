// Package helpdesk owns tickets (resident reports) and their messages. A
// ticket references its case through service_case's named commands only.
// The service-case vocabularies live here too (the service_case schema has
// no login of its own).
package helpdesk

import (
	"context"
	"slices"
	"time"

	"pemo/internal/platform"
)

// Vocabularies (generated in the Node build from one JSON source).
var (
	TicketChannel           = []string{"email", "external", "kiosk", "phone", "resident_app", "staff_manual"}
	TicketClosureReason     = []string{"duplicate_report", "fixed", "no_action_required", "resident_withdrew", "resolved_by_case"}
	TicketDisposition       = []string{"closure_recorded", "escalation_recorded", "reopening_recorded", "report_opened", "resolution_recorded", "status_set", "triage_recorded"}
	TicketMessageVisibility = []string{"internal", "resident_visible"}
	TicketReopenReason      = []string{"closed_in_error", "not_fixed", "recurred"}
	TicketStatus            = []string{"awaiting_resident", "closed", "in_progress", "open", "resolved", "triaged"}

	CaseClosureReason = []string{"duplicate_case", "no_fault_found", "resident_withdrew", "transferred_out", "work_completed"}
	CaseDisposition   = []string{"case_opened", "closure_recorded", "external_completion_recorded", "owner_assigned", "reopening_recorded", "status_changed"}
	CaseReopenReason  = []string{"closed_in_error", "issue_recurred", "work_not_completed"}
	CaseState         = []string{"assigned", "awaiting_external", "closed", "in_progress", "open", "pending_verification", "reopened", "resolved"}
)

// Is reports membership of a vocabulary.
func Is(vocab []string, v string) bool { return slices.Contains(vocab, v) }

// TicketRow is a ticket as staff see it.
type TicketRow struct {
	TicketID, OrganizationID, Status, Disposition, Channel string
	Category, Description                                  string
	ReporterRef, ReporterKind, NodeKind, NodeID            *string
	DueAt                                                  *time.Time
	PrimaryCaseRef, ClosureReason, DisplayRef              *string
	CurrentRecordedAt, OpenedAt                            time.Time
}

// TicketMessage is one message on a ticket.
type TicketMessage struct {
	MessageID, TicketID, AuthorRef, AuthorKind, Body, Visibility string
	CreatedAt                                                    time.Time
}

// Scope is the caller's expanded node sets.
type Scope struct {
	OrganizationID                                         string
	UnitIDs, FloorIDs, BuildingIDs, EstateIDs, LocationIDs []string
}

// Helpdesk is the module facade.
type Helpdesk struct{ DB platform.DB }

// New binds the module to its pool.
func New(db platform.DB) *Helpdesk { return &Helpdesk{DB: db} }

const selectTicket = `
  SELECT c.ticket_id, c.organization_id, c.status, c.disposition, c.channel,
         c.category, c.description, c.reporter_ref, c.reporter_kind,
         c.node_kind, c.node_id, c.due_at, c.primary_case_ref, c.closure_reason,
         r.display_ref, c.recorded_at AS current_recorded_at, o.opened_at
    FROM ticket_current c
    LEFT JOIN ticket_reference r ON r.ticket_id = c.ticket_id
    INNER JOIN (SELECT ticket_id, MIN(recorded_at) AS opened_at FROM ticket GROUP BY ticket_id) o ON o.ticket_id = c.ticket_id`

const inScope = `
  c.organization_id = $1 AND c.node_kind IS NOT NULL AND c.node_id IS NOT NULL
  AND (   (c.node_kind = 'unit' AND c.node_id = ANY($2::text[]))
       OR (c.node_kind = 'floor' AND c.node_id = ANY($3::text[]))
       OR (c.node_kind = 'building' AND c.node_id = ANY($4::text[]))
       OR (c.node_kind = 'estate' AND c.node_id = ANY($5::text[]))
       OR (c.node_kind = 'location' AND c.node_id = ANY($6::text[])))`

func nz(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func mapTicket(r platform.Row) TicketRow {
	return TicketRow{r.Str("ticket_id"), r.Str("organization_id"), r.Str("status"), r.Str("disposition"), r.Str("channel"),
		r.Str("category"), r.Str("description"), r.StrPtr("reporter_ref"), r.StrPtr("reporter_kind"), r.StrPtr("node_kind"),
		r.StrPtr("node_id"), r.TimePtr("due_at"), r.StrPtr("primary_case_ref"), r.StrPtr("closure_reason"), r.StrPtr("display_ref"),
		r.Time("current_recorded_at"), r.Time("opened_at")}
}

// ListInScope lists tickets placed on a node the caller covers, oldest first.
func (h *Helpdesk) ListInScope(ctx context.Context, s Scope) ([]TicketRow, error) {
	rows, err := h.DB.Query(ctx, selectTicket+" WHERE "+inScope+" ORDER BY o.opened_at ASC, c.ticket_id ASC",
		s.OrganizationID, nz(s.UnitIDs), nz(s.FloorIDs), nz(s.BuildingIDs), nz(s.EstateIDs), nz(s.LocationIDs))
	if err != nil {
		return nil, err
	}
	out := make([]TicketRow, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapTicket(r))
	}
	return out, nil
}

// GetInScope returns one ticket if the caller covers its node.
func (h *Helpdesk) GetInScope(ctx context.Context, s Scope, ticketID string) (*TicketRow, error) {
	r, err := h.DB.QueryOne(ctx, selectTicket+" WHERE c.ticket_id = $7 AND "+inScope,
		s.OrganizationID, nz(s.UnitIDs), nz(s.FloorIDs), nz(s.BuildingIDs), nz(s.EstateIDs), nz(s.LocationIDs), ticketID)
	if err != nil || r == nil {
		return nil, err
	}
	t := mapTicket(r)
	return &t, nil
}

// MessagesFor lists all messages of a ticket (staff view).
func (h *Helpdesk) MessagesFor(ctx context.Context, ticketID string) ([]TicketMessage, error) {
	rows, err := h.DB.Query(ctx, `SELECT message_id, ticket_id, author_ref, author_kind, body, visibility, created_at
         FROM ticket_message WHERE ticket_id = $1 ORDER BY created_at ASC, message_id ASC`, ticketID)
	if err != nil {
		return nil, err
	}
	out := make([]TicketMessage, 0, len(rows))
	for _, r := range rows {
		out = append(out, TicketMessage{r.Str("message_id"), r.Str("ticket_id"), r.Str("author_ref"), r.Str("author_kind"), r.Str("body"), r.Str("visibility"), r.Time("created_at")})
	}
	return out, nil
}

// ResidentVisibleMessages lists only resident-visible messages.
func (h *Helpdesk) ResidentVisibleMessages(ctx context.Context, ticketID string) ([]TicketMessage, error) {
	rows, err := h.DB.Query(ctx, `SELECT message_id, ticket_id, body, author_kind, created_at FROM ticket_message
        WHERE ticket_id = $1 AND visibility = 'resident_visible' ORDER BY created_at`, ticketID)
	if err != nil {
		return nil, err
	}
	out := make([]TicketMessage, 0, len(rows))
	for _, r := range rows {
		out = append(out, TicketMessage{MessageID: r.Str("message_id"), TicketID: r.Str("ticket_id"), Body: r.Str("body"), AuthorKind: r.Str("author_kind"), CreatedAt: r.Time("created_at")})
	}
	return out, nil
}

// TicketOfCase is a ticket whose primary case is the given case.
type TicketOfCase struct {
	TicketID                              string
	DisplayRef, ReporterRef, ReporterKind *string
}

// TicketsForCase lists the tickets a case was opened from (its reporters).
func (h *Helpdesk) TicketsForCase(ctx context.Context, orgID, caseID string) ([]TicketOfCase, error) {
	rows, err := h.DB.Query(ctx, `SELECT c.ticket_id, r.display_ref, c.reporter_ref, c.reporter_kind
         FROM ticket_current c LEFT JOIN ticket_reference r ON r.ticket_id = c.ticket_id
        WHERE c.organization_id = $1 AND c.primary_case_ref = $2 ORDER BY c.ticket_id`, orgID, caseID)
	if err != nil {
		return nil, err
	}
	out := make([]TicketOfCase, 0, len(rows))
	for _, r := range rows {
		out = append(out, TicketOfCase{r.Str("ticket_id"), r.StrPtr("display_ref"), r.StrPtr("reporter_ref"), r.StrPtr("reporter_kind")})
	}
	return out, nil
}

// ReportTarget is a unit or a location a resident reports against.
type ReportTarget struct{ UnitID, LocationID *string }

// MayReport: the resident must live in the unit, or in a unit the location serves.
func MayReport(ctx context.Context, occupied func(context.Context, string, string, time.Time) ([]string, error),
	served func(context.Context, string, string) ([]string, error), orgID, residentID string, t ReportTarget) (bool, error) {
	if t.UnitID == nil && t.LocationID == nil {
		return false, nil
	}
	mine, err := occupied(ctx, orgID, residentID, time.Now())
	if err != nil || len(mine) == 0 {
		return false, err
	}
	if t.UnitID != nil && !slices.Contains(mine, *t.UnitID) {
		return false, nil
	}
	if t.LocationID != nil {
		s, err := served(ctx, orgID, *t.LocationID)
		if err != nil {
			return false, err
		}
		ok := false
		for _, u := range s {
			if slices.Contains(mine, u) {
				ok = true
				break
			}
		}
		if !ok {
			return false, nil
		}
	}
	return true, nil
}

// AllowsAnonymous reads the organisation's intake policy.
func AllowsAnonymous(ctx context.Context, db platform.DB, orgID string) (bool, error) {
	r, err := db.QueryOne(ctx, `SELECT allow_anonymous FROM intake_policy WHERE organization_id = $1`, orgID)
	if err != nil || r == nil {
		return false, err
	}
	return r.Bool("allow_anonymous"), nil
}
