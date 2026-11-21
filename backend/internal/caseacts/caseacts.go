// Package caseacts holds the help-desk ticket and service-case acts (submit,
// triage, link, message, status, reopen, satisfaction; assign, note, status,
// external completion, close, reopen, resolve-from-case, open-from-ticket).
//
// Difference from the Node build: every audit row is written on the SAME
// transaction as the act it records (platform.AppendAuditInTx). The Node build
// wrote most of them through a separate access-pool transaction, so a rolled
// back act could leave an audit row behind and a failed audit could leave an
// unaudited act.
package caseacts

import (
	"context"
	"fmt"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"

	"pemo/internal/access"
	"pemo/internal/helpdesk"
	"pemo/internal/platform"
)

// ---- reasons ----

const (
	SubmitTicket             = "submit_ticket"
	TriageTicket             = "triage_ticket"
	LinkTicket               = "link_related_ticket"
	OpenCase                 = "open_case_from_ticket"
	PostTicketMessage        = "post_ticket_message"
	SetTicketStatus          = "set_ticket_status"
	ReopenTicket             = "reopen_ticket"
	RecordSatisfaction       = "record_satisfaction"
	AssignCase               = "assign_case"
	AddCaseNote              = "add_case_note"
	SetCaseStatus            = "set_case_status"
	RecordExternalCompletion = "record_external_completion"
	CloseCase                = "close_case"
	ReopenCase               = "reopen_case"
	ResolveTicketFromCase    = "resolve_ticket_from_case"
)

var closeCodes = []string{"work_completed", "no_fault_found", "resident_withdrew", "duplicate_case", "transferred_out"}

// Reasons is the case reason-code registry.
var Reasons = platform.ReasonCodeRegistry{
	SubmitTicket:             {Codes: []string{}},
	TriageTicket:             {Codes: []string{}},
	LinkTicket:               {Codes: []string{}},
	OpenCase:                 {Codes: []string{}},
	PostTicketMessage:        {Codes: []string{}},
	SetTicketStatus:          {Codes: []string{"fixed", "resident_withdrew", "duplicate_report", "no_action_required", "resolved_by_case"}},
	ReopenTicket:             {Codes: []string{"not_fixed", "recurred", "closed_in_error"}, Required: true},
	RecordSatisfaction:       {Codes: []string{}},
	AssignCase:               {Codes: []string{}},
	AddCaseNote:              {Codes: []string{}},
	SetCaseStatus:            {Codes: []string{}},
	RecordExternalCompletion: {Codes: []string{}},
	CloseCase:                {Codes: closeCodes, Required: true},
	ReopenCase:               {Codes: []string{"work_not_completed", "issue_recurred", "closed_in_error"}, Required: true},
	ResolveTicketFromCase:    {Codes: closeCodes, Required: true},
}

// Stances: which acts are keyed by the client and which by a derived key.
var Stances = map[string]string{
	SubmitTicket: "client-key", TriageTicket: "derived-key", LinkTicket: "derived-key", OpenCase: "derived-key",
	PostTicketMessage: "client-key", SetTicketStatus: "derived-key", ReopenTicket: "derived-key", RecordSatisfaction: "derived-key",
	AssignCase: "derived-key", AddCaseNote: "client-key", SetCaseStatus: "derived-key", RecordExternalCompletion: "derived-key",
	CloseCase: "derived-key", ReopenCase: "derived-key", ResolveTicketFromCase: "derived-key",
}

func hasCode(action, code string) bool { return slices.Contains(Reasons[action].Codes, code) }

// ---- permissions ----

var TicketTransitions = map[string][]string{
	"open":              {"triaged", "in_progress", "awaiting_resident", "resolved"},
	"triaged":           {"in_progress", "awaiting_resident", "resolved"},
	"in_progress":       {"awaiting_resident", "resolved"},
	"awaiting_resident": {"in_progress", "resolved"},
	"resolved":          {"closed", "in_progress"},
	"closed":            {},
}

var CaseTransitions = map[string][]string{
	"open":                 {"assigned", "in_progress"},
	"reopened":             {"assigned", "in_progress"},
	"assigned":             {"in_progress", "awaiting_external", "pending_verification", "resolved"},
	"in_progress":          {"awaiting_external", "pending_verification", "resolved"},
	"awaiting_external":    {"in_progress", "pending_verification"},
	"pending_verification": {"in_progress", "resolved"},
	"resolved":             {"in_progress"},
	"closed":               {},
}

var CaseClosableFrom = []string{"pending_verification", "resolved"}

func TicketMayMove(from, to string) bool { return slices.Contains(TicketTransitions[from], to) }
func CaseMayMove(from, to string) bool   { return slices.Contains(CaseTransitions[from], to) }

type TicketSubject struct {
	State     string
	NodeKeys  []string
	Anonymous bool
}

type CaseSubject struct {
	State           string
	NodeKeys        []string
	HasExternalLink bool
}

func covers(scope *access.RoleScope, nodes []string) bool {
	return scope != nil && len(nodes) > 0 && len(scope.Uncovered(nodes)) == 0
}

func floor(c access.CallerScopes, nodes []string) string {
	if covers(c["estate_staff"], nodes) {
		return ""
	}
	return "out-of-scope"
}

// Registry judges every case/ticket act (one verdict path per act).
var Registry = func() *access.ActRegistry {
	r := access.NewActRegistry()
	notClosed := func(t TicketSubject) string {
		if t.State == "closed" {
			return "invalid-transition"
		}
		return ""
	}
	ticketActs := map[string]func(TicketSubject) string{
		"triageTicket": notClosed, "linkRelatedTicket": notClosed, "openCaseFromTicket": notClosed, "postTicketMessage": notClosed,
		"setTicketStatus": func(t TicketSubject) string {
			if len(TicketTransitions[t.State]) == 0 {
				return "invalid-transition"
			}
			return ""
		},
		"reopenTicket": func(t TicketSubject) string {
			if t.State == "closed" {
				return ""
			}
			return "ticket-not-closed"
		},
		"recordSatisfaction": func(TicketSubject) string { return "not-the-reporter" },
	}
	caseNotClosed := func(c CaseSubject) string {
		if c.State == "closed" {
			return "invalid-transition"
		}
		return ""
	}
	closable := func(c CaseSubject) string {
		if slices.Contains(CaseClosableFrom, c.State) {
			return ""
		}
		return "case-not-closable"
	}
	caseActs := map[string]func(CaseSubject) string{
		"assignCase": caseNotClosed, "addCaseNote": caseNotClosed,
		"setCaseStatus": func(c CaseSubject) string {
			if len(CaseTransitions[c.State]) == 0 {
				return "invalid-transition"
			}
			return ""
		},
		"recordExternalCompletion": func(c CaseSubject) string {
			if slices.Contains([]string{"awaiting_external", "in_progress", "assigned"}, c.State) {
				return ""
			}
			return "invalid-transition"
		},
		"closeCase": closable, "resolveTicketFromCase": closable,
		"reopenCase": func(c CaseSubject) string {
			if c.State == "closed" {
				return ""
			}
			return "invalid-transition"
		},
	}
	for op, rule := range ticketActs {
		rule := rule
		r.Register(access.ActRegistration{OperationID: op, TargetKind: "ticket", Evaluate: func(_ context.Context, t access.ActTarget, c access.CallerScopes) (string, error) {
			s := t.Subject.(TicketSubject)
			if v := rule(s); v != "" {
				return v, nil
			}
			return floor(c, s.NodeKeys), nil
		}})
	}
	for op, rule := range caseActs {
		rule := rule
		r.Register(access.ActRegistration{OperationID: op, TargetKind: "case", Evaluate: func(_ context.Context, t access.ActTarget, c access.CallerScopes) (string, error) {
			s := t.Subject.(CaseSubject)
			if v := rule(s); v != "" {
				return v, nil
			}
			return floor(c, s.NodeKeys), nil
		}})
	}
	return r
}()

// ---- results ----

// Result is the outcome of an act: Kind "ok" or a refusal kind.
type Result struct {
	Kind, Detail                      string
	TicketID, CaseID, DisplayRef      string
	Version, CaseVersion              int64
	MessageID, NoteID, SatisfactionID string
	FirstTime                         bool
	Tickets                           []TicketVersion
	alreadyHadCase                    bool
}

type TicketVersion struct {
	TicketID string
	Version  int64
}

func refused(kind string, detail ...string) Result {
	r := Result{Kind: kind}
	if len(detail) > 0 {
		r.Detail = detail[0]
	}
	return r
}

func committed(r Result) bool { return r.Kind == "ok" && !r.alreadyHadCase }

var versionConflicts = []string{"ticket_version_unique", "ticket_pkey", "service_case_version_unique", "service_case_pkey"}

// staleOnConflict turns a concurrent version race into the stale-state refusal.
func staleOnConflict(r Result, err error) (Result, error) {
	if err != nil && platform.PgCode(err) == "23505" && slices.Contains(versionConflicts, platform.PgConstraint(err)) {
		return refused("stale-state", "the record changed while this act was in flight"), nil
	}
	return r, err
}

// ---- inputs ----

type StaffActor struct {
	OrganizationID, PrincipalID, CorrelationID string
	Now                                        time.Time
	Witness                                    struct{ GroupID, Role, NodeKind, NodeID string }
}

type ResidentReporter struct {
	OrganizationID, PrincipalID, ResidentID, CorrelationID string
	Now                                                    time.Time
}

type TicketIntake struct {
	ClientKey, Channel, Category, Description string
	UnitID, LocationID                        *string
	AttachmentIDs                             []string
	Anonymous                                 bool
}

type TriageInput struct {
	TicketType, Priority, Queue string
	DueAt                       *time.Time
	SetNode                     bool // NodeKind/NodeID given (may be nil)
	NodeKind, NodeID            *string
}

type MessageInput struct {
	ClientKey, Body, Visibility string
	AttachmentID                *string
}

type NoteInput struct {
	ClientKey, Body string
	Visibility      *string // any value is refused: case notes are internal
}

type ExternalLink struct {
	ExternalSystem, ExternalRef string
	DeepLink                    *string
}

// Deps are the ports the acts need.
type Deps struct {
	HelpdeskDB, CaseDB, PlatformDB platform.DB
	ServingScopeNodes              func(ctx context.Context, orgID, locationID string) ([]string, error)
	MayReport                      func(ctx context.Context, orgID, residentID string, t helpdesk.ReportTarget) (bool, error)
	OwnerCovers                    func(ctx context.Context, orgID, principalID string, nodeKeys []string) (bool, error)
	TicketsOfCase                  func(ctx context.Context, orgID, caseID string) ([]string, error)
}

// Acts implements every case act.
type Acts struct{ d Deps }

func New(d Deps) *Acts { return &Acts{d} }

var ticketChannels = []string{"resident_app", "staff_manual", "phone", "email", "kiosk", "external"}

type curTicket struct {
	TicketID, OrganizationID, Disposition, Status, Channel, Category, Description string
	Version                                                                       int64
	RecordedAt                                                                    time.Time
	ReporterRef, ReporterKind, LocationRef, NodeKind, NodeID                      *string
	TicketType, Priority, Queue, RelatedTicketRef, PrimaryCaseRef                 *string
	DueAt                                                                         *time.Time
}

func readTicket(ctx context.Context, tx platform.DB, id string) (*curTicket, error) {
	r, err := tx.QueryOne(ctx, `SELECT ticket_id, version, organization_id, disposition, status, recorded_at, channel, category, description,
            reporter_ref, reporter_kind, location_ref, node_kind, node_id, ticket_type, priority, queue, due_at, related_ticket_ref, primary_case_ref
       FROM ticket_current WHERE ticket_id = $1`, id)
	if err != nil || r == nil {
		return nil, err
	}
	return &curTicket{r.Str("ticket_id"), r.Str("organization_id"), r.Str("disposition"), r.Str("status"), r.Str("channel"), r.Str("category"),
		r.Str("description"), r.Int("version"), r.Time("recorded_at"), r.StrPtr("reporter_ref"), r.StrPtr("reporter_kind"), r.StrPtr("location_ref"),
		r.StrPtr("node_kind"), r.StrPtr("node_id"), r.StrPtr("ticket_type"), r.StrPtr("priority"), r.StrPtr("queue"), r.StrPtr("related_ticket_ref"),
		r.StrPtr("primary_case_ref"), r.TimePtr("due_at")}, nil
}

type curCase struct {
	CaseID, OrganizationID, State    string
	Version                          int64
	AssignedOwnerRef, ComplaintClass *string
	IsComplaint                      bool
	RespondBy                        *time.Time
	OriginatingTicketRef             *string
}

func readCase(ctx context.Context, tx platform.DB, id string) (*curCase, error) {
	r, err := tx.QueryOne(ctx, `SELECT case_id, version, organization_id, state, assigned_owner_ref, is_complaint, complaint_class,
            respond_by, originating_ticket_ref FROM case_current WHERE case_id = $1`, id)
	if err != nil || r == nil {
		return nil, err
	}
	return &curCase{r.Str("case_id"), r.Str("organization_id"), r.Str("state"), r.Int("version"), r.StrPtr("assigned_owner_ref"),
		r.StrPtr("complaint_class"), r.Bool("is_complaint"), r.TimePtr("respond_by"), r.StrPtr("originating_ticket_ref")}, nil
}

func (a *Acts) ticketNodes(ctx context.Context, nodeKind, nodeID, locationRef *string, org string) ([]string, error) {
	set := map[string]bool{}
	if nodeKind != nil && nodeID != nil {
		set[*nodeKind+":"+*nodeID] = true
	}
	if locationRef != nil {
		ns, err := a.d.ServingScopeNodes(ctx, org, *locationRef)
		if err != nil {
			return nil, err
		}
		for _, n := range ns {
			set[n] = true
		}
	}
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out, nil
}

func (a *Acts) staffFloor(ctx context.Context, nodeKind, nodeID, loc *string, org string, scope *access.RoleScope) (bool, error) {
	addressed, err := a.ticketNodes(ctx, nodeKind, nodeID, loc, org)
	if err != nil || len(addressed) == 0 {
		return false, err
	}
	return len(scope.Uncovered(addressed)) == 0, nil
}

func (a *Acts) can(ctx context.Context, op string, cur *curTicket, org string, scope *access.RoleScope) (string, error) {
	keys, err := a.ticketNodes(ctx, cur.NodeKind, cur.NodeID, cur.LocationRef, org)
	if err != nil {
		return "", err
	}
	return Registry.CanPerform(ctx, op, access.ActTarget{Kind: "ticket", Subject: TicketSubject{cur.Status, keys, cur.ReporterRef == nil}},
		access.CallerScopes{"estate_staff": scope})
}

func (a *Acts) caseSubject(ctx context.Context, tx platform.DB, cur *curCase, org string) (CaseSubject, error) {
	s := CaseSubject{State: cur.State, NodeKeys: []string{}}
	if cur.OriginatingTicketRef != nil {
		t, err := readTicket(ctx, a.helpdeskReader(tx), *cur.OriginatingTicketRef)
		if err != nil {
			return s, err
		}
		if t != nil {
			if s.NodeKeys, err = a.ticketNodes(ctx, t.NodeKind, t.NodeID, t.LocationRef, org); err != nil {
				return s, err
			}
		}
	}
	r, err := tx.QueryOne(ctx, `SELECT count(*)::int AS n FROM case_external_link WHERE case_id = $1`, cur.CaseID)
	if err != nil {
		return s, err
	}
	s.HasExternalLink = r != nil && r.Int("n") > 0
	return s, nil
}

// helpdeskReader reads helpdesk views: on a service_case transaction the
// Node build used a second (helpdesk) pool; here the same handle is used when
// it is already a helpdesk handle.
func (a *Acts) helpdeskReader(tx platform.DB) platform.DB {
	if tx.Schema() == "helpdesk" {
		return tx
	}
	return a.d.HelpdeskDB
}

func (a *Acts) caseCan(ctx context.Context, tx platform.DB, op string, cur *curCase, org string, scope *access.RoleScope) (CaseSubject, string, error) {
	s, err := a.caseSubject(ctx, tx, cur, org)
	if err != nil {
		return s, "", err
	}
	v, err := Registry.CanPerform(ctx, op, access.ActTarget{Kind: "case", Subject: s}, access.CallerScopes{"estate_staff": scope})
	return s, v, err
}

func audit(a StaffActor, action, targetKind, targetID string, reason *string) platform.AuditRecord {
	p, g, r := a.PrincipalID, a.Witness.GroupID, a.Witness.Role
	return platform.AuditRecord{Source: "principal", PrincipalID: &p, GroupID: &g, Role: &r, NodeKind: a.Witness.NodeKind, NodeID: a.Witness.NodeID,
		Action: action, TargetKind: targetKind, TargetID: targetID, OccurredAt: a.Now, CorrelationID: a.CorrelationID, ReasonCode: reason}
}

const insertTicketSQL = `INSERT INTO ticket (assertion_id, ticket_id, version, organization_id, disposition, status,
       channel, reporter_ref, reporter_kind, category, description, location_ref, node_kind, node_id, ticket_type, priority, queue,
       due_at, related_ticket_ref, primary_case_ref, closure_reason, reopen_reason, recorded_by)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`

type ticketOver struct {
	closureReason, reopenReason, primaryCaseRef, relatedTicketRef *string
	setPrimary, setRelated                                        bool
	nodeKind, nodeID, ticketType, priority, queue                 *string
	dueAt                                                         *time.Time
	setTriage, setNode                                            bool
}

func appendTicket(ctx context.Context, tx platform.DB, cur *curTicket, version int64, disposition, status string, o ticketOver, by string) error {
	primary, related := cur.PrimaryCaseRef, cur.RelatedTicketRef
	if o.setPrimary {
		primary = o.primaryCaseRef
	}
	if o.setRelated {
		related = o.relatedTicketRef
	}
	nk, ni := cur.NodeKind, cur.NodeID
	if o.setNode {
		nk, ni = o.nodeKind, o.nodeID
	}
	tt, pr, q, due := cur.TicketType, cur.Priority, cur.Queue, cur.DueAt
	if o.setTriage {
		tt, pr, q, due = o.ticketType, o.priority, o.queue, o.dueAt
	}
	return tx.Exec(ctx, insertTicketSQL, platform.DeriveActID("tkta", fmt.Sprintf("%s.%d", cur.TicketID, version), disposition), cur.TicketID, version,
		cur.OrganizationID, disposition, status, cur.Channel, cur.ReporterRef, cur.ReporterKind, cur.Category, cur.Description, cur.LocationRef,
		nk, ni, tt, pr, q, due, related, primary, o.closureReason, o.reopenReason, by)
}

type caseOver struct {
	owner                       *string
	setOwner                    bool
	closureReason, reopenReason *string
}

func appendCase(ctx context.Context, tx platform.DB, cur *curCase, version int64, disposition, state string, o caseOver, by string) error {
	owner := cur.AssignedOwnerRef
	if o.setOwner {
		owner = o.owner
	}
	return tx.Exec(ctx, `SELECT service_case.append_assertion($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
		platform.DeriveActID("csea", fmt.Sprintf("%s.%d", cur.CaseID, version), disposition), cur.CaseID, int32(version), cur.OrganizationID, state,
		disposition, owner, cur.IsComplaint, cur.ComplaintClass, cur.RespondBy, o.closureReason, o.reopenReason, cur.OriginatingTicketRef, by)
}

func (a *Acts) attachmentsExist(ctx context.Context, ids []string) (bool, error) {
	if len(ids) == 0 {
		return true, nil
	}
	r, err := a.d.PlatformDB.QueryOne(ctx, `SELECT count(*)::int AS n FROM attachment_ref WHERE attachment_id = ANY($1::text[])`, ids)
	if err != nil {
		return false, err
	}
	return r != nil && int(r.Int("n")) == len(ids), nil
}

var nonAlnum = regexp.MustCompile(`[^a-zA-Z0-9]`)

func nextDisplayRef(ctx context.Context, tx platform.DB, org string, year int) (string, error) {
	// The organisation's references are serialised: two concurrent submits
	// would otherwise count the same n and collide (the Node build relied on
	// the unique constraint to fail one of them).
	if err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "ticket_reference:"+org); err != nil {
		return "", err
	}
	r, err := tx.QueryOne(ctx, `SELECT count(*)::int AS n FROM ticket_reference WHERE organization_id = $1`, org)
	if err != nil {
		return "", err
	}
	n := int64(0)
	if r != nil {
		n = r.Int("n")
	}
	prefix := strings.ToUpper(nonAlnum.ReplaceAllString(org, ""))
	if len(prefix) > 3 {
		prefix = prefix[:3]
	}
	if prefix == "" {
		prefix = "TKT"
	}
	return fmt.Sprintf("%s-%d-%04d", prefix, year, n+1), nil
}

func (a *Acts) insertTicket(ctx context.Context, tx platform.DB, ticketID, org string, in TicketIntake, reporterRef, reporterKind *string, by string, now time.Time) (string, error) {
	var nodeKind *string
	if in.UnitID != nil {
		u := "unit"
		nodeKind = &u
	}
	if err := tx.Exec(ctx, `INSERT INTO ticket (assertion_id, ticket_id, version, organization_id, disposition, status,
           channel, reporter_ref, reporter_kind, category, description, location_ref, node_kind, node_id, recorded_by)
       VALUES ($1,$2,1,$3,'report_opened','open',$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
		platform.DeriveActID("tkta", ticketID+".1", "report_opened"), ticketID, org, in.Channel, reporterRef, reporterKind,
		in.Category, in.Description, in.LocationID, nodeKind, in.UnitID, by); err != nil {
		return "", err
	}
	ref, err := nextDisplayRef(ctx, tx, org, now.Year())
	if err != nil {
		return "", err
	}
	return ref, tx.Exec(ctx, `INSERT INTO ticket_reference (ticket_id, organization_id, display_ref) VALUES ($1,$2,$3)`, ticketID, org, ref)
}

func sp(s string) *string { return &s }

// inTx runs fn on a transaction of db and returns its result; a refusal
// result rolls nothing back by itself (nothing was written before it).
func inTx(ctx context.Context, db platform.DB, fn func(tx platform.DB) (Result, error)) (Result, error) {
	var out Result
	err := db.Tx(ctx, func(tx platform.DB) error {
		r, err := fn(tx)
		out = r
		return err
	})
	return out, err
}

// ---- ticket acts ----

func (a *Acts) SubmitByResident(ctx context.Context, in TicketIntake, rep ResidentReporter) (Result, error) {
	ticketID := platform.DeriveActID("tkt", SubmitTicket, rep.OrganizationID+"."+in.ClientKey)
	if in.Anonymous {
		ok, err := helpdesk.AllowsAnonymous(ctx, a.d.HelpdeskDB, rep.OrganizationID)
		if err != nil {
			return Result{}, err
		}
		if !ok {
			return refused("anonymous-not-permitted"), nil
		}
	}
	may, err := a.d.MayReport(ctx, rep.OrganizationID, rep.ResidentID, helpdesk.ReportTarget{UnitID: in.UnitID, LocationID: in.LocationID})
	if err != nil {
		return Result{}, err
	}
	if !may {
		return refused("not-reportable", "a resident may report about their own unit, or a Location that serves it"), nil
	}
	if ok, err := a.attachmentsExist(ctx, in.AttachmentIDs); err != nil || !ok {
		if err != nil {
			return Result{}, err
		}
		return refused("no-such-attachment"), nil
	}
	return inTx(ctx, a.d.HelpdeskDB, func(tx platform.DB) (Result, error) {
		seen, err := tx.QueryOne(ctx, `SELECT r.display_ref FROM ticket t JOIN ticket_reference r ON r.ticket_id = t.ticket_id
           WHERE t.ticket_id = $1 AND t.version = 1`, ticketID)
		if err != nil {
			return Result{}, err
		}
		if seen != nil {
			return Result{Kind: "ok", TicketID: ticketID, Version: 1, DisplayRef: seen.Str("display_ref")}, nil
		}
		var ref, kind *string
		if !in.Anonymous {
			ref, kind = sp(rep.ResidentID), sp("resident")
		}
		dr, err := a.insertTicket(ctx, tx, ticketID, rep.OrganizationID, in, ref, kind, rep.ResidentID, rep.Now)
		return Result{Kind: "ok", TicketID: ticketID, Version: 1, DisplayRef: dr}, err
	})
}

func (a *Acts) SubmitByStaff(ctx context.Context, in TicketIntake, actor StaffActor, scope *access.RoleScope) (Result, error) {
	if !slices.Contains(ticketChannels, in.Channel) {
		return refused("invalid-channel"), nil
	}
	ticketID := platform.DeriveActID("tkt", SubmitTicket, actor.OrganizationID+"."+in.ClientKey)
	var nk *string
	if in.UnitID != nil {
		nk = sp("unit")
	}
	ok, err := a.staffFloor(ctx, nk, in.UnitID, in.LocationID, actor.OrganizationID, scope)
	if err != nil {
		return Result{}, err
	}
	if !ok {
		return refused("out-of-scope"), nil
	}
	if ok, err := a.attachmentsExist(ctx, in.AttachmentIDs); err != nil || !ok {
		if err != nil {
			return Result{}, err
		}
		return refused("no-such-attachment"), nil
	}
	p := actor.PrincipalID
	out, err := platform.IdempotentAuditedWrite(ctx, a.d.HelpdeskDB, audit(actor, SubmitTicket, "ticket", ticketID, nil),
		platform.IdempotencyKey{PrincipalID: &p, Operation: SubmitTicket, Key: in.ClientKey, ActKind: "ticket", ActID: ticketID,
			RequestFingerprint: platform.DeriveRequestFingerprint(actor.OrganizationID, in.ClientKey, in.Category, in.Description)},
		func(tx platform.DB) (Result, error) {
			dr, err := a.insertTicket(ctx, tx, ticketID, actor.OrganizationID, in, &p, sp("staff_principal"), p, actor.Now)
			return Result{Kind: "ok", TicketID: ticketID, Version: 1, DisplayRef: dr}, err
		}, platform.AuditOptions[Result]{Reasons: Reasons, Committed: committed})
	if err != nil {
		return Result{}, err
	}
	if out.Kind == "replayed" {
		return Result{Kind: "ok", TicketID: ticketID, Version: 1}, nil
	}
	return out.Result, nil
}

// staffTicketAct is the shape every versioned staff ticket act shares: read,
// check org/version/scope, then act and audit on the same transaction.
func (a *Acts) staffTicketAct(ctx context.Context, ticketID string, fromVersion int64, strictStale bool, actor StaffActor,
	fn func(tx platform.DB, cur *curTicket) (Result, *string, string, error)) (Result, error) {
	return staleOnConflict(inTx(ctx, a.d.HelpdeskDB, func(tx platform.DB) (Result, error) {
		cur, err := readTicket(ctx, tx, ticketID)
		if err != nil {
			return Result{}, err
		}
		if cur == nil || cur.OrganizationID != actor.OrganizationID {
			return refused("no-such-ticket"), nil
		}
		if fromVersion >= 0 && cur.Version != fromVersion {
			if strictStale {
				return refused("stale-state", fmt.Sprintf("expected version %d, the ticket is at %d", fromVersion, cur.Version)), nil
			}
			return refused("stale-state"), nil
		}
		res, reason, action, err := fn(tx, cur)
		if err != nil || res.Kind != "ok" || action == "" {
			return res, err
		}
		return res, platform.AppendAuditInTx(ctx, tx, audit(actor, action, "ticket", ticketID, reason), Reasons)
	}))
}

func (a *Acts) TriageTicket(ctx context.Context, ticketID string, fromVersion int64, in TriageInput, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffTicketAct(ctx, ticketID, fromVersion, true, actor, func(tx platform.DB, cur *curTicket) (Result, *string, string, error) {
		ok, err := a.staffFloor(ctx, cur.NodeKind, cur.NodeID, cur.LocationRef, actor.OrganizationID, scope)
		if err != nil || !ok {
			return refused("out-of-scope"), nil, "", err
		}
		v := cur.Version + 1
		o := ticketOver{setTriage: true, ticketType: &in.TicketType, priority: &in.Priority, queue: &in.Queue, dueAt: in.DueAt,
			setNode: in.SetNode, nodeKind: in.NodeKind, nodeID: in.NodeID}
		err = appendTicket(ctx, tx, cur, v, "triage_recorded", "triaged", o, actor.PrincipalID)
		return Result{Kind: "ok", TicketID: ticketID, Version: v}, nil, TriageTicket, err
	})
}

func (a *Acts) LinkRelatedTicket(ctx context.Context, ticketID string, fromVersion int64, relatedID string, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffTicketAct(ctx, ticketID, fromVersion, false, actor, func(tx platform.DB, cur *curTicket) (Result, *string, string, error) {
		ok, err := a.staffFloor(ctx, cur.NodeKind, cur.NodeID, cur.LocationRef, actor.OrganizationID, scope)
		if err != nil || !ok {
			return refused("out-of-scope"), nil, "", err
		}
		other, err := readTicket(ctx, tx, relatedID)
		if err != nil {
			return Result{}, nil, "", err
		}
		if other == nil || other.OrganizationID != actor.OrganizationID {
			return refused("no-such-related-ticket"), nil, "", nil
		}
		if ok, err := a.staffFloor(ctx, other.NodeKind, other.NodeID, other.LocationRef, actor.OrganizationID, scope); err != nil || !ok {
			return refused("no-such-related-ticket"), nil, "", err
		}
		v := cur.Version + 1
		err = appendTicket(ctx, tx, cur, v, "status_set", cur.Status, ticketOver{setRelated: true, relatedTicketRef: &relatedID}, actor.PrincipalID)
		return Result{Kind: "ok", TicketID: ticketID, Version: v}, nil, LinkTicket, err
	})
}

func (a *Acts) PostTicketMessageAsStaff(ctx context.Context, ticketID string, in MessageInput, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffTicketAct(ctx, ticketID, -1, false, actor, func(tx platform.DB, cur *curTicket) (Result, *string, string, error) {
		v, err := a.can(ctx, "postTicketMessage", cur, actor.OrganizationID, scope)
		if err != nil || v != "" {
			return refused(v), nil, "", err
		}
		if cur.ReporterRef == nil && in.Visibility == "resident_visible" {
			return refused("anonymous-ticket"), nil, "", nil
		}
		if !slices.Contains([]string{"resident_visible", "internal"}, in.Visibility) {
			return refused("message-visibility-fixed"), nil, "", nil
		}
		if ok, err := a.attachmentsExist(ctx, optList(in.AttachmentID)); err != nil || !ok {
			return refused("no-such-attachment"), nil, "", err
		}
		id := platform.DeriveActID("tmsg", ticketID+"."+in.ClientKey, actor.PrincipalID)
		err = tx.Exec(ctx, `INSERT INTO ticket_message (message_id, ticket_id, author_ref, author_kind, body, visibility, attachment_ref)
           VALUES ($1,$2,$3,'staff_principal',$4,$5,$6) ON CONFLICT (message_id) DO NOTHING`, id, ticketID, actor.PrincipalID, in.Body, in.Visibility, in.AttachmentID)
		return Result{Kind: "ok", MessageID: id}, nil, PostTicketMessage, err
	})
}

func optList(s *string) []string {
	if s == nil || *s == "" {
		return nil
	}
	return []string{*s}
}

func (a *Acts) PostTicketMessageAsReporter(ctx context.Context, ticketID string, in MessageInput, rep ResidentReporter) (Result, error) {
	return staleOnConflict(inTx(ctx, a.d.HelpdeskDB, func(tx platform.DB) (Result, error) {
		cur, err := readTicket(ctx, tx, ticketID)
		if err != nil {
			return Result{}, err
		}
		switch {
		case cur == nil || cur.OrganizationID != rep.OrganizationID:
			return refused("no-such-ticket"), nil
		case cur.ReporterRef == nil:
			return refused("anonymous-ticket"), nil
		case *cur.ReporterRef != rep.ResidentID:
			return refused("not-the-reporter"), nil
		case cur.Status == "closed":
			return refused("invalid-transition", "the ticket is closed"), nil
		case in.Visibility != "resident_visible":
			return refused("message-visibility-fixed"), nil
		}
		if ok, err := a.attachmentsExist(ctx, optList(in.AttachmentID)); err != nil || !ok {
			return refused("no-such-attachment"), err
		}
		id := platform.DeriveActID("tmsg", ticketID+"."+in.ClientKey, rep.ResidentID)
		err = tx.Exec(ctx, `INSERT INTO ticket_message (message_id, ticket_id, author_ref, author_kind, body, visibility, attachment_ref)
           VALUES ($1,$2,$3,'resident',$4,'resident_visible',$5) ON CONFLICT (message_id) DO NOTHING`, id, ticketID, rep.ResidentID, in.Body, in.AttachmentID)
		return Result{Kind: "ok", MessageID: id}, err
	}))
}

func (a *Acts) SetTicketStatus(ctx context.Context, ticketID string, fromVersion int64, to string, closureReason, closingMessage *string, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffTicketAct(ctx, ticketID, fromVersion, true, actor, func(tx platform.DB, cur *curTicket) (Result, *string, string, error) {
		v, err := a.can(ctx, "setTicketStatus", cur, actor.OrganizationID, scope)
		if err != nil || v != "" {
			return refused(v), nil, "", err
		}
		if !TicketMayMove(cur.Status, to) {
			return refused("invalid-transition", cur.Status+" -> "+to), nil, "", nil
		}
		hasMsg := closingMessage != nil && *closingMessage != ""
		if to == "resolved" && !hasMsg && closureReason == nil {
			return refused("invalid-reason", "resolved needs a resident-visible message or a reason"), nil, "", nil
		}
		if to == "closed" && closureReason == nil {
			return refused("invalid-reason", "closed needs a closure reason"), nil, "", nil
		}
		if closureReason != nil && !hasCode(SetTicketStatus, *closureReason) {
			return refused("invalid-reason", *closureReason), nil, "", nil
		}
		ver := cur.Version + 1
		disp := "status_set"
		switch to {
		case "resolved":
			disp = "resolution_recorded"
		case "closed":
			disp = "closure_recorded"
		}
		var cr *string
		if to == "closed" {
			cr = closureReason
		}
		if err := appendTicket(ctx, tx, cur, ver, disp, to, ticketOver{closureReason: cr}, actor.PrincipalID); err != nil {
			return Result{}, nil, "", err
		}
		if to == "resolved" && hasMsg && cur.ReporterRef != nil {
			if err := tx.Exec(ctx, `INSERT INTO ticket_message (message_id, ticket_id, author_ref, author_kind, body, visibility)
               VALUES ($1,$2,$3,'staff_principal',$4,'resident_visible')`, platform.DeriveActID("tmsg", fmt.Sprintf("%s.%d", ticketID, ver), "resolution"),
				ticketID, actor.PrincipalID, *closingMessage); err != nil {
				return Result{}, nil, "", err
			}
		}
		return Result{Kind: "ok", TicketID: ticketID, Version: ver}, closureReason, SetTicketStatus, nil
	})
}

func (a *Acts) ReopenTicketAsStaff(ctx context.Context, ticketID string, fromVersion int64, reason string, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffTicketAct(ctx, ticketID, fromVersion, false, actor, func(tx platform.DB, cur *curTicket) (Result, *string, string, error) {
		v, err := a.can(ctx, "reopenTicket", cur, actor.OrganizationID, scope)
		if err != nil || v != "" {
			return refused(v), nil, "", err
		}
		if !hasCode(ReopenTicket, reason) {
			return refused("invalid-reason", reason), nil, "", nil
		}
		ver := cur.Version + 1
		err = appendTicket(ctx, tx, cur, ver, "reopening_recorded", "open", ticketOver{reopenReason: &reason}, actor.PrincipalID)
		return Result{Kind: "ok", TicketID: ticketID, Version: ver}, &reason, ReopenTicket, err
	})
}

func (a *Acts) ReopenTicketAsReporter(ctx context.Context, ticketID string, fromVersion int64, reason string, rep ResidentReporter) (Result, error) {
	return staleOnConflict(inTx(ctx, a.d.HelpdeskDB, func(tx platform.DB) (Result, error) {
		cur, err := readTicket(ctx, tx, ticketID)
		if err != nil {
			return Result{}, err
		}
		switch {
		case cur == nil || cur.OrganizationID != rep.OrganizationID:
			return refused("no-such-ticket"), nil
		case cur.ReporterRef == nil || *cur.ReporterRef != rep.ResidentID:
			return refused("not-the-reporter"), nil
		case cur.Version != fromVersion:
			return refused("stale-state"), nil
		case cur.Status != "closed":
			return refused("ticket-not-closed"), nil
		}
		p, err := tx.QueryOne(ctx, `SELECT resident_reopen_window_days AS days FROM reopen_policy WHERE organization_id = $1`, rep.OrganizationID)
		if err != nil {
			return Result{}, err
		}
		if p == nil {
			return refused("reopen-not-permitted", "no reopen policy for this organization"), nil
		}
		if time.Since(cur.RecordedAt) > time.Duration(p.Int("days"))*24*time.Hour {
			return refused("reopen-not-permitted", "the reopen window has closed"), nil
		}
		if !hasCode(ReopenTicket, reason) {
			return refused("invalid-reason", reason), nil
		}
		ver := cur.Version + 1
		err = appendTicket(ctx, tx, cur, ver, "reopening_recorded", "open", ticketOver{reopenReason: &reason}, rep.ResidentID)
		return Result{Kind: "ok", TicketID: ticketID, Version: ver}, err
	}))
}

func (a *Acts) RecordSatisfaction(ctx context.Context, ticketID string, rating int, comment *string, rep ResidentReporter) (Result, error) {
	return inTx(ctx, a.d.HelpdeskDB, func(tx platform.DB) (Result, error) {
		cur, err := readTicket(ctx, tx, ticketID)
		if err != nil {
			return Result{}, err
		}
		switch {
		case cur == nil || cur.OrganizationID != rep.OrganizationID:
			return refused("no-such-ticket"), nil
		case cur.ReporterRef == nil || *cur.ReporterRef != rep.ResidentID:
			return refused("not-the-reporter"), nil
		case cur.Status != "closed":
			return refused("ticket-not-closed"), nil
		case rating < 1 || rating > 5:
			return refused("invalid-reason", "rating is 1..5"), nil
		}
		id := platform.DeriveActID("tsat", fmt.Sprintf("%s.%d", ticketID, cur.Version), rep.ResidentID)
		ex, err := tx.QueryOne(ctx, `SELECT satisfaction_id, rating, comment FROM ticket_satisfaction WHERE ticket_id = $1 AND closure_version = $2`, ticketID, cur.Version)
		if err != nil {
			return Result{}, err
		}
		if ex != nil {
			c := ex.StrPtr("comment")
			if int(ex.Int("rating")) == rating && ((c == nil && comment == nil) || (c != nil && comment != nil && *c == *comment)) {
				return Result{Kind: "ok", SatisfactionID: ex.Str("satisfaction_id")}, nil
			}
			return refused("satisfaction-already-recorded"), nil
		}
		err = tx.Exec(ctx, `INSERT INTO ticket_satisfaction (satisfaction_id, ticket_id, closure_version, respondent_ref, rating, comment) VALUES ($1,$2,$3,$4,$5,$6)`,
			id, ticketID, cur.Version, rep.ResidentID, rating, comment)
		return Result{Kind: "ok", SatisfactionID: id, FirstTime: true}, err
	})
}

// ---- case acts ----

func (a *Acts) staffCaseAct(ctx context.Context, caseID string, fromVersion int64, actor StaffActor, op string, scope *access.RoleScope,
	fn func(tx platform.DB, cur *curCase, s CaseSubject) (Result, *string, string, error)) (Result, error) {
	return staleOnConflict(inTx(ctx, a.d.CaseDB, func(tx platform.DB) (Result, error) {
		cur, err := readCase(ctx, tx, caseID)
		if err != nil {
			return Result{}, err
		}
		if cur == nil || cur.OrganizationID != actor.OrganizationID {
			return refused("no-such-case"), nil
		}
		if fromVersion >= 0 && cur.Version != fromVersion {
			return refused("stale-state"), nil
		}
		subj, v, err := a.caseCan(ctx, tx, op, cur, actor.OrganizationID, scope)
		if err != nil || v != "" {
			return refused(v), err
		}
		res, reason, action, err := fn(tx, cur, subj)
		if err != nil || res.Kind != "ok" {
			return res, err
		}
		return res, platform.AppendAuditInTx(ctx, tx, audit(actor, action, "case", caseID, reason), Reasons)
	}))
}

func (a *Acts) AssignCase(ctx context.Context, caseID string, fromVersion int64, owner string, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffCaseAct(ctx, caseID, fromVersion, actor, "assignCase", scope, func(tx platform.DB, cur *curCase, s CaseSubject) (Result, *string, string, error) {
		ok, err := a.d.OwnerCovers(ctx, actor.OrganizationID, owner, s.NodeKeys)
		if err != nil || !ok {
			return refused("owner-cannot-see-case"), nil, "", err
		}
		v := cur.Version + 1
		state := cur.State
		if state == "open" || state == "reopened" {
			state = "assigned"
		}
		err = appendCase(ctx, tx, cur, v, "owner_assigned", state, caseOver{setOwner: true, owner: &owner}, actor.PrincipalID)
		return Result{Kind: "ok", CaseID: caseID, Version: v}, nil, AssignCase, err
	})
}

func (a *Acts) AddCaseNote(ctx context.Context, caseID string, in NoteInput, actor StaffActor, scope *access.RoleScope) (Result, error) {
	if in.Visibility != nil {
		return refused("note-visibility-refused"), nil
	}
	return a.staffCaseAct(ctx, caseID, -1, actor, "addCaseNote", scope, func(tx platform.DB, _ *curCase, _ CaseSubject) (Result, *string, string, error) {
		id := platform.DeriveActID("cnote", caseID+"."+in.ClientKey, actor.PrincipalID)
		err := tx.Exec(ctx, `INSERT INTO case_note (note_id, case_id, author_ref, body) VALUES ($1,$2,$3,$4) ON CONFLICT (note_id) DO NOTHING`,
			id, caseID, actor.PrincipalID, in.Body)
		return Result{Kind: "ok", NoteID: id}, nil, AddCaseNote, err
	})
}

func (a *Acts) SetCaseStatus(ctx context.Context, caseID string, fromVersion int64, to string, link *ExternalLink, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffCaseAct(ctx, caseID, fromVersion, actor, "setCaseStatus", scope, func(tx platform.DB, cur *curCase, s CaseSubject) (Result, *string, string, error) {
		if to == "closed" {
			return refused("case-not-closable", "closing is closeCase, by a person"), nil, "", nil
		}
		if !CaseMayMove(cur.State, to) {
			return refused("invalid-transition", cur.State+" -> "+to), nil, "", nil
		}
		if to == "awaiting_external" {
			if link != nil {
				if err := tx.Exec(ctx, `INSERT INTO case_external_link (link_id, case_id, external_system, external_ref, deep_link) VALUES ($1,$2,$3,$4,$5)`,
					platform.DeriveActID("clink", caseID+"."+link.ExternalSystem, link.ExternalRef), caseID, link.ExternalSystem, link.ExternalRef, link.DeepLink); err != nil {
					return Result{}, nil, "", err
				}
			} else if !s.HasExternalLink {
				return refused("external-link-required"), nil, "", nil
			}
		}
		v := cur.Version + 1
		err := appendCase(ctx, tx, cur, v, "status_changed", to, caseOver{}, actor.PrincipalID)
		return Result{Kind: "ok", CaseID: caseID, Version: v}, nil, SetCaseStatus, err
	})
}

func (a *Acts) RecordExternalCompletion(ctx context.Context, caseID string, fromVersion int64, _ string, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffCaseAct(ctx, caseID, fromVersion, actor, "recordExternalCompletion", scope, func(tx platform.DB, cur *curCase, s CaseSubject) (Result, *string, string, error) {
		if !s.HasExternalLink {
			return refused("external-link-required"), nil, "", nil
		}
		v := cur.Version + 1
		err := appendCase(ctx, tx, cur, v, "external_completion_recorded", "pending_verification", caseOver{}, actor.PrincipalID)
		return Result{Kind: "ok", CaseID: caseID, Version: v}, nil, RecordExternalCompletion, err
	})
}

func (a *Acts) CloseCase(ctx context.Context, caseID string, fromVersion int64, reason string, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffCaseAct(ctx, caseID, fromVersion, actor, "closeCase", scope, func(tx platform.DB, cur *curCase, _ CaseSubject) (Result, *string, string, error) {
		if !hasCode(CloseCase, reason) {
			return refused("invalid-reason", reason), nil, "", nil
		}
		v := cur.Version + 1
		err := appendCase(ctx, tx, cur, v, "closure_recorded", "closed", caseOver{closureReason: &reason}, actor.PrincipalID)
		return Result{Kind: "ok", CaseID: caseID, Version: v}, &reason, CloseCase, err
	})
}

func (a *Acts) ReopenCase(ctx context.Context, caseID string, fromVersion int64, reason string, actor StaffActor, scope *access.RoleScope) (Result, error) {
	return a.staffCaseAct(ctx, caseID, fromVersion, actor, "reopenCase", scope, func(tx platform.DB, cur *curCase, _ CaseSubject) (Result, *string, string, error) {
		if !hasCode(ReopenCase, reason) {
			return refused("invalid-reason", reason), nil, "", nil
		}
		v := cur.Version + 1
		err := appendCase(ctx, tx, cur, v, "reopening_recorded", "reopened", caseOver{reopenReason: &reason}, actor.PrincipalID)
		return Result{Kind: "ok", CaseID: caseID, Version: v}, &reason, ReopenCase, err
	})
}

// ResolveTicketFromCase closes the case and resolves its open tickets in one
// helpdesk transaction (the case assertion goes through the definer function).
func (a *Acts) ResolveTicketFromCase(ctx context.Context, caseID string, fromVersion int64, reason, residentMessage string, actor StaffActor, scope *access.RoleScope) (Result, error) {
	// Checked before the audited write: the Node build let the audit layer
	// throw on an unknown code, so the caller saw a 500 instead of a refusal.
	if !hasCode(ResolveTicketFromCase, reason) {
		return refused("invalid-reason", reason), nil
	}
	return staleOnConflict(platform.AuditedWrite(ctx, a.d.HelpdeskDB, audit(actor, ResolveTicketFromCase, "case", caseID, &reason), func(tx platform.DB) (Result, error) {
		caseTx, err := platform.TxOnSchema(tx, "service_case")
		if err != nil {
			return Result{}, err
		}
		cur, err := readCase(ctx, caseTx, caseID)
		if err != nil {
			return Result{}, err
		}
		if cur == nil || cur.OrganizationID != actor.OrganizationID {
			return refused("no-such-case"), nil
		}
		if cur.Version != fromVersion {
			return refused("stale-state"), nil
		}
		_, v, err := a.caseCan(ctx, caseTx, "resolveTicketFromCase", cur, actor.OrganizationID, scope)
		if err != nil || v != "" {
			return refused(v), err
		}
		if !hasCode(ResolveTicketFromCase, reason) {
			return refused("invalid-reason", reason), nil
		}
		cv := cur.Version + 1
		if err := appendCase(ctx, caseTx, cur, cv, "closure_recorded", "closed", caseOver{closureReason: &reason}, actor.PrincipalID); err != nil {
			return Result{}, err
		}
		ids, err := a.d.TicketsOfCase(ctx, actor.OrganizationID, caseID)
		if err != nil {
			return Result{}, err
		}
		tickets := []TicketVersion{}
		for _, id := range ids {
			t, err := readTicket(ctx, tx, id)
			if err != nil {
				return Result{}, err
			}
			if t == nil || t.Status == "closed" {
				continue
			}
			ver := t.Version + 1
			if err := appendTicket(ctx, tx, t, ver, "resolution_recorded", "resolved", ticketOver{}, actor.PrincipalID); err != nil {
				return Result{}, err
			}
			if t.ReporterRef != nil {
				if err := tx.Exec(ctx, `INSERT INTO ticket_message (message_id, ticket_id, author_ref, author_kind, body, visibility) VALUES ($1,$2,$3,'staff_principal',$4,'resident_visible')`,
					platform.DeriveActID("tmsg", fmt.Sprintf("%s.%d", id, ver), "case-resolution"), id, actor.PrincipalID, residentMessage); err != nil {
					return Result{}, err
				}
			}
			tickets = append(tickets, TicketVersion{id, ver})
		}
		return Result{Kind: "ok", CaseID: caseID, CaseVersion: cv, Tickets: tickets}, nil
	}, platform.AuditOptions[Result]{Reasons: Reasons, Committed: committed}))
}

// OpenCaseFromTicket opens (once) the case for a ticket.
func (a *Acts) OpenCaseFromTicket(ctx context.Context, ticketID string, actor StaffActor, scope *access.RoleScope) (Result, error) {
	caseID := platform.DeriveActID("cse", OpenCase, ticketID)
	return platform.AuditedWrite(ctx, a.d.HelpdeskDB, audit(actor, OpenCase, "service_case", caseID, nil), func(tx platform.DB) (Result, error) {
		caseTx, err := platform.TxOnSchema(tx, "service_case")
		if err != nil {
			return Result{}, err
		}
		if err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, "open_case:"+ticketID); err != nil {
			return Result{}, err
		}
		cur, err := readTicket(ctx, tx, ticketID)
		if err != nil {
			return Result{}, err
		}
		if cur == nil || cur.OrganizationID != actor.OrganizationID {
			return refused("no-such-ticket"), nil
		}
		ok, err := a.staffFloor(ctx, cur.NodeKind, cur.NodeID, cur.LocationRef, actor.OrganizationID, scope)
		if err != nil || !ok {
			return refused("out-of-scope"), err
		}
		if cur.PrimaryCaseRef != nil {
			return Result{Kind: "ok", CaseID: *cur.PrimaryCaseRef, TicketID: ticketID, alreadyHadCase: true}, nil
		}
		if err := caseTx.Exec(ctx, `SELECT service_case.open_from_ticket($1,$2,$3,$4,$5)`,
			platform.DeriveActID("csea", caseID+".1", "case_opened"), caseID, actor.OrganizationID, ticketID, actor.PrincipalID); err != nil {
			return Result{}, err
		}
		ver := cur.Version + 1
		err = appendTicket(ctx, tx, cur, ver, "status_set", cur.Status, ticketOver{setPrimary: true, primaryCaseRef: &caseID}, actor.PrincipalID)
		return Result{Kind: "ok", CaseID: caseID, TicketID: ticketID}, err
	}, platform.AuditOptions[Result]{Reasons: Reasons, Committed: committed})
}
