package api

import (
	"context"
	"errors"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"pemo/internal/access"
	"pemo/internal/notices"
	"pemo/internal/platform"
)

// Notice act names (audit actions) and their reason vocabularies.
const (
	ComposeNotice     = "compose_notice"
	ReviseNotice      = "revise_notice"
	SubmitNotice      = "submit_notice"
	ApproveNotice     = "approve_notice"
	DeclineNotice     = "decline_notice"
	PublishNotice     = "publish_notice"
	CorrectNotice     = "correct_notice"
	WithdrawNotice    = "withdraw_notice"
	MarkNoticeRead    = "mark_notice_read"
	AcknowledgeNotice = "acknowledge_notice"
	RespondToNotice   = "respond_to_notice"
)

var (
	ApproveNoticeCodes  = []string{"approved_as_submitted", "with_amendments"}
	CorrectNoticeCodes  = []string{"factual_error", "wrong_schedule", "translation_error", "clarification"}
	DeclineNoticeCodes  = []string{"inaccurate", "wrong_audience", "poor_timing", "needs_translation", "not_required"}
	WithdrawNoticeCodes = []string{"issued_in_error", "no_longer_applicable", "superseded", "wrong_audience"}
)

// NoticeReasons is the notice reason-code registry (ADR-014).
var NoticeReasons = platform.ReasonCodeRegistry{
	ComposeNotice: {Codes: []string{}}, ReviseNotice: {Codes: []string{}}, SubmitNotice: {Codes: []string{}},
	ApproveNotice:  {Codes: ApproveNoticeCodes, Required: false},
	DeclineNotice:  {Codes: DeclineNoticeCodes, Required: true},
	CorrectNotice:  {Codes: CorrectNoticeCodes, Required: true},
	WithdrawNotice: {Codes: WithdrawNoticeCodes, Required: true},
	PublishNotice:  {Codes: []string{}}, MarkNoticeRead: {Codes: []string{}},
	AcknowledgeNotice: {Codes: []string{}}, RespondToNotice: {Codes: []string{}},
}

// NoticeActSubject is what a notice act is judged against.
type NoticeActSubject struct {
	State             string
	Gated             bool
	AddressedNodeKeys []string
}

var published = []string{"live", "scheduled", "expired"}

func stateRefusal(op, state string, gated bool) string {
	switch op {
	case "reviseNotice":
		if state == "draft" {
			return ""
		}
	case "submitNotice":
		if state == "draft" && gated {
			return ""
		}
	case "approveNotice", "declineNotice":
		if state == "pending_approval" {
			return ""
		}
	case "publishNotice":
		if gated {
			if state == "approved" {
				return ""
			}
			return "approval-required"
		}
		if state == "draft" {
			return ""
		}
	case "correctNotice", "withdrawNotice":
		if slices.Contains(published, state) {
			return ""
		}
	}
	return "wrong-state"
}

func coversRS(s *access.RoleScope, addressed []string) bool {
	return s != nil && len(addressed) > 0 && len(s.Uncovered(addressed)) == 0
}

func floorRefusal(role string, c access.CallerScopes, addressed []string) string {
	switch role {
	case "estate_staff":
		if coversRS(c["estate_staff"], addressed) {
			return ""
		}
	case "approver":
		if coversRS(c["approver"], addressed) {
			return ""
		}
	default:
		if coversRS(c["estate_staff"], addressed) || coversRS(c["approver"], addressed) {
			return ""
		}
	}
	return "out-of-scope"
}

var noticeActRoles = map[string]string{"reviseNotice": "estate_staff", "submitNotice": "estate_staff", "publishNotice": "estate_staff",
	"correctNotice": "estate_staff", "withdrawNotice": "either", "approveNotice": "approver", "declineNotice": "approver"}

func newNoticeActRegistry() *access.ActRegistry {
	r := access.NewActRegistry()
	for op, role := range noticeActRoles {
		op, role := op, role
		r.Register(access.ActRegistration{OperationID: op, TargetKind: "notice",
			Evaluate: func(_ context.Context, t access.ActTarget, c access.CallerScopes) (string, error) {
				n := t.Subject.(NoticeActSubject)
				if s := stateRefusal(op, n.State, n.Gated); s != "" {
					return s, nil
				}
				return floorRefusal(role, c, n.AddressedNodeKeys), nil
			}})
	}
	r.Register(access.ActRegistration{OperationID: "composeNotice", TargetKind: "node",
		Evaluate: func(_ context.Context, t access.ActTarget, c access.CallerScopes) (string, error) {
			return floorRefusal("estate_staff", c, []string{t.NodeKey}), nil
		}})
	return r
}

// noticeActRegistry is the one registry for the process.
var noticeActRegistry = newNoticeActRegistry()

// ---- the acts ----

// NoticeResult is ok (id + version) or a refusal kind with detail.
type NoticeResult struct {
	Kind     string
	NoticeID string
	Version  int64
	Detail   string
}

func refusedN(kind string, detail ...string) NoticeResult {
	r := NoticeResult{Kind: kind}
	if len(detail) > 0 {
		r.Detail = detail[0]
	}
	return r
}

type currentNotice struct {
	NoticeID, OrganizationID, State, NoticeType string
	Version                                     int64
	TitleEn, TitleZhHant, BodyEn, BodyZhHant    string
	PublishAt, ExpireAt                         *time.Time
	MandatoryAck                                bool
	IncidentRef                                 *string
	ResponseOptions                             []string
	HasResponseOptions                          bool
	AssertionID                                 string
}

func readCurrentNotice(ctx context.Context, tx platform.DB, id string) (*currentNotice, error) {
	r, err := tx.QueryOne(ctx, `SELECT notice_id, version, organization_id, lifecycle_state, notice_type,
            title_en, title_zh_hant, body_en, body_zh_hant, publish_at, expire_at, mandatory_ack, incident_ref,
            response_options, assertion_id FROM notice_current WHERE notice_id = $1`, id)
	if err != nil || r == nil {
		return nil, err
	}
	return &currentNotice{NoticeID: r.Str("notice_id"), OrganizationID: r.Str("organization_id"), State: r.Str("lifecycle_state"),
		NoticeType: r.Str("notice_type"), Version: r.Int("version"), TitleEn: r.Str("title_en"), TitleZhHant: r.Str("title_zh_hant"),
		BodyEn: r.Str("body_en"), BodyZhHant: r.Str("body_zh_hant"), PublishAt: r.TimePtr("publish_at"), ExpireAt: r.TimePtr("expire_at"),
		MandatoryAck: r.Bool("mandatory_ack"), IncidentRef: r.StrPtr("incident_ref"), ResponseOptions: r.Strings("response_options"),
		HasResponseOptions: r["response_options"] != nil, AssertionID: r.Str("assertion_id")}, nil
}

func readTargets(ctx context.Context, tx platform.DB, assertionID string) ([]notices.Target, error) {
	rows, err := tx.Query(ctx, `SELECT node_kind, node_id, location_id, resident_group_id FROM notice_target WHERE assertion_id = $1 ORDER BY target_id`, assertionID)
	if err != nil {
		return nil, err
	}
	out := make([]notices.Target, 0, len(rows))
	for _, r := range rows {
		out = append(out, notices.Target{NodeKind: r.StrPtr("node_kind"), NodeID: r.StrPtr("node_id"), LocationID: r.StrPtr("location_id"), ResidentGroupID: r.StrPtr("resident_group_id")})
	}
	return out, nil
}

// addressedNodes: every node a target names, a location contributing its
// whole serving scope (GEN-040 D2).
func (s *Server) addressedNodes(ctx context.Context, targets []notices.Target, orgID string) ([]string, error) {
	set := map[string]bool{}
	for _, t := range targets {
		if t.NodeKind != nil && t.NodeID != nil {
			set[*t.NodeKind+":"+*t.NodeID] = true
		}
		if t.LocationID != nil {
			ns, err := s.prop.ResolveServingScopeNodes(ctx, orgID, *t.LocationID)
			if err != nil {
				return nil, err
			}
			for _, n := range ns {
				set[n] = true
			}
		}
	}
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out, nil
}

func requiresApproval(ctx context.Context, db platform.DB, orgID, noticeType string) (bool, error) {
	r, err := db.QueryOne(ctx, `SELECT requires_approval FROM approval_policy WHERE organization_id = $1 AND notice_type = $2`, orgID, noticeType)
	if err != nil {
		return true, err
	}
	if r == nil {
		return true, nil // fail closed: no policy row means approval required
	}
	return r.Bool("requires_approval"), nil
}

// NoticeContent is the editable content of a notice. Set* flags mark which
// fields a partial (revise/correct) update supplies.
type NoticeContent struct {
	NoticeType, TitleEn, TitleZhHant, BodyEn, BodyZhHant string
	PublishAt, ExpireAt                                  *time.Time
	MandatoryAck                                         bool
	IncidentRef                                          *string
	ResponseOptions                                      []string
	Set                                                  map[string]bool
}

func (c NoticeContent) has(k string) bool { return c.Set == nil || c.Set[k] }

func merge(cur *currentNotice, o NoticeContent) currentNotice {
	m := *cur
	if o.has("noticeType") {
		m.NoticeType = o.NoticeType
	}
	if o.has("titleEn") {
		m.TitleEn = o.TitleEn
	}
	if o.has("titleZhHant") {
		m.TitleZhHant = o.TitleZhHant
	}
	if o.has("bodyEn") {
		m.BodyEn = o.BodyEn
	}
	if o.has("bodyZhHant") {
		m.BodyZhHant = o.BodyZhHant
	}
	if o.has("publishAt") {
		m.PublishAt = o.PublishAt
	}
	if o.has("expireAt") {
		m.ExpireAt = o.ExpireAt
	}
	if o.has("mandatoryAck") {
		m.MandatoryAck = o.MandatoryAck
	}
	if o.has("incidentRef") {
		m.IncidentRef = o.IncidentRef
	}
	if o.has("responseOptions") {
		m.ResponseOptions, m.HasResponseOptions = o.ResponseOptions, o.ResponseOptions != nil
	}
	return m
}

func respOpts(has bool, v []string) any {
	if !has {
		return nil
	}
	if v == nil {
		return []string{}
	}
	return v
}

func appendNoticeAssertion(ctx context.Context, tx platform.DB, cur *currentNotice, version int64, disposition string, over NoticeContent, by string) (string, error) {
	id := platform.DeriveActID("nota", cur.NoticeID+"."+itoa(version), disposition)
	c := merge(cur, over)
	err := tx.Exec(ctx, `INSERT INTO notice (assertion_id, notice_id, version, organization_id, disposition,
                         notice_type, title_en, title_zh_hant, body_en, body_zh_hant,
                         publish_at, expire_at, mandatory_ack, incident_ref, response_options, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`, id, cur.NoticeID, version, cur.OrganizationID, disposition,
		c.NoticeType, c.TitleEn, c.TitleZhHant, c.BodyEn, c.BodyZhHant, c.PublishAt, c.ExpireAt, c.MandatoryAck, c.IncidentRef,
		respOpts(c.HasResponseOptions, c.ResponseOptions), by)
	return id, err
}

func copyTargets(ctx context.Context, tx platform.DB, from, to string) error {
	return tx.Exec(ctx, `INSERT INTO notice_target (assertion_id, node_kind, node_id, location_id, resident_group_id)
     SELECT $2, node_kind, node_id, location_id, resident_group_id FROM notice_target WHERE assertion_id = $1`, from, to)
}

// insertTargets writes all targets in one statement.
func insertTargets(ctx context.Context, tx platform.DB, assertionID string, ts []notices.Target) error {
	if len(ts) == 0 {
		return nil
	}
	nk, ni, li, rg := make([]*string, len(ts)), make([]*string, len(ts)), make([]*string, len(ts)), make([]*string, len(ts))
	for i, t := range ts {
		nk[i], ni[i], li[i], rg[i] = t.NodeKind, t.NodeID, t.LocationID, t.ResidentGroupID
	}
	return tx.Exec(ctx, `INSERT INTO notice_target (assertion_id, node_kind, node_id, location_id, resident_group_id)
       SELECT $1, k, i, l, g FROM unnest($2::text[], $3::text[], $4::text[], $5::text[]) WITH ORDINALITY AS x(k, i, l, g, n) ORDER BY n`,
		assertionID, nk, ni, li, rg)
}

func scheduleInverted(publishAt, expireAt *time.Time) bool {
	return publishAt != nil && expireAt != nil && !expireAt.After(*publishAt)
}

var targetNodeKinds = []string{"organization", "estate", "building", "floor", "unit"}

func invalidTarget(ts []notices.Target) string {
	for _, t := range ts {
		if t.NodeKind != nil && !slices.Contains(targetNodeKinds, *t.NodeKind) {
			return "node kind " + *t.NodeKind + " is not addressable"
		}
		if (t.NodeKind == nil) != (t.NodeID == nil) {
			return "a node kind and a node id go together"
		}
		if t.NodeID == nil && t.LocationID == nil {
			return "a target names a node or a location"
		}
	}
	return ""
}

// ActorContext is who acts, and the grant that authorises them (the witness).
type ActorContext struct {
	OrganizationID, PrincipalID, CorrelationID string
	Now                                        time.Time
	Witness                                    struct{ GroupID, Role, NodeKind, NodeID string }
}

func (a ActorContext) audit(action, targetKind, targetID string, reason *string) platform.AuditRecord {
	p, g, r := a.PrincipalID, a.Witness.GroupID, a.Witness.Role
	return platform.AuditRecord{Source: "principal", PrincipalID: &p, GroupID: &g, Role: &r, NodeKind: a.Witness.NodeKind,
		NodeID: a.Witness.NodeID, Action: action, TargetKind: targetKind, TargetID: targetID, OccurredAt: a.Now,
		CorrelationID: a.CorrelationID, ReasonCode: reason}
}

func isVersionConflict(err error) bool {
	c := platform.PgConstraint(err)
	return platform.PgCode(err) == "23505" && (c == "notice_version_unique" || c == "notice_pkey")
}

func uncoveredDetail(u []string) string { return "uncovered: " + strings.Join(u, ", ") }

type noticeBody func(ctx context.Context, tx platform.DB, cur *currentNotice) (NoticeResult, error)

// transition runs one act on the notice's current version, in ONE notices
// transaction that also carries the audit row.
func (s *Server) transition(ctx context.Context, noticeID string, from int64, actor ActorContext, body noticeBody) (NoticeResult, error) {
	var out NoticeResult
	err := s.noticesDB.Tx(ctx, func(tx platform.DB) error {
		cur, err := readCurrentNotice(ctx, tx, noticeID)
		if err != nil {
			return err
		}
		if cur == nil || cur.OrganizationID != actor.OrganizationID {
			out = refusedN("no-such-notice")
			return nil
		}
		if cur.Version != from {
			out = refusedN("stale-state", "expected version "+itoa(from)+", the notice is at "+itoa(cur.Version))
			return nil
		}
		res, err := body(ctx, tx, cur)
		if err != nil {
			return err
		}
		out = res
		if res.Kind != "ok" {
			return errRollback
		}
		return nil
	})
	if errors.Is(err, errRollback) {
		return out, nil
	}
	if err != nil && isVersionConflict(err) {
		return refusedN("stale-state", "the notice changed while this act was in flight"), nil
	}
	return out, err
}

var errRollback = errors.New("refused: roll back")

func (s *Server) subjectFor(ctx context.Context, tx platform.DB, cur *currentNotice, orgID string) (NoticeActSubject, error) {
	gated, err := requiresApproval(ctx, tx, orgID, cur.NoticeType)
	if err != nil {
		return NoticeActSubject{}, err
	}
	ts, err := readTargets(ctx, tx, cur.AssertionID)
	if err != nil {
		return NoticeActSubject{}, err
	}
	addr, err := s.addressedNodes(ctx, ts, orgID)
	return NoticeActSubject{cur.State, gated, addr}, err
}

func (s *Server) floorFor(ctx context.Context, tx platform.DB, assertionID, orgID string, scope *access.RoleScope) (*NoticeResult, error) {
	ts, err := readTargets(ctx, tx, assertionID)
	if err != nil {
		return nil, err
	}
	addr, err := s.addressedNodes(ctx, ts, orgID)
	if err != nil {
		return nil, err
	}
	if u := scope.Uncovered(addr); len(u) > 0 {
		r := refusedN("out-of-scope", uncoveredDetail(u))
		return &r, nil
	}
	return nil, nil
}

// gate runs the registry check for op and maps a refusal.
func (s *Server) gate(ctx context.Context, tx platform.DB, cur *currentNotice, actor ActorContext, op string, caller access.CallerScopes) (*NoticeResult, NoticeActSubject, error) {
	subj, err := s.subjectFor(ctx, tx, cur, actor.OrganizationID)
	if err != nil {
		return nil, subj, err
	}
	sr, err := noticeActRegistry.CanPerform(ctx, op, access.ActTarget{Kind: "notice", Subject: subj}, caller)
	if err != nil || sr == "" {
		return nil, subj, err
	}
	d := "state is " + cur.State
	if sr == "out-of-scope" {
		d = "floor not covered"
	}
	r := refusedN(sr, d)
	return &r, subj, nil
}

// ComposeNotice creates a draft under a client idempotency key. The draft, its
// targets, the idempotency key and the audit row commit together.
func (s *Server) ComposeNotice(ctx context.Context, clientKey string, content NoticeContent, targets []notices.Target, actor ActorContext, scope *access.RoleScope) (NoticeResult, error) {
	if bad := invalidTarget(targets); bad != "" {
		return refusedN("invalid-target", bad), nil
	}
	if scheduleInverted(content.PublishAt, content.ExpireAt) {
		return refusedN("schedule-inverted", "expireAt precedes publishAt"), nil
	}
	noticeID := platform.DeriveActID("ntc", ComposeNotice, actor.OrganizationID+"."+clientKey)
	fp := platform.DeriveRequestFingerprint(actor.OrganizationID, clientKey, content.TitleEn, content.BodyEn)
	p := actor.PrincipalID
	out, err := platform.IdempotentAuditedWrite(ctx, s.noticesDB, actor.audit(ComposeNotice, "notice", noticeID, nil),
		platform.IdempotencyKey{PrincipalID: &p, Operation: ComposeNotice, Key: clientKey, ActKind: "notice", ActID: noticeID, RequestFingerprint: fp},
		func(tx platform.DB) (NoticeResult, error) {
			addr, err := s.addressedNodes(ctx, targets, actor.OrganizationID)
			if err != nil {
				return NoticeResult{}, err
			}
			if len(addr) == 0 {
				return refusedN("empty-audience", "the rule addresses no node"), nil
			}
			if u := scope.Uncovered(addr); len(u) > 0 {
				return refusedN("out-of-scope", uncoveredDetail(u)), nil
			}
			aid := platform.DeriveActID("nota", noticeID+".1", "draft_saved")
			c := content
			if err := tx.Exec(ctx, `INSERT INTO notice (assertion_id, notice_id, version, organization_id, disposition,
                                 notice_type, title_en, title_zh_hant, body_en, body_zh_hant,
                                 publish_at, expire_at, mandatory_ack, incident_ref, response_options, recorded_by)
             VALUES ($1,$2,1,$3,'draft_saved',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, aid, noticeID, actor.OrganizationID,
				c.NoticeType, c.TitleEn, c.TitleZhHant, c.BodyEn, c.BodyZhHant, c.PublishAt, c.ExpireAt, c.MandatoryAck, c.IncidentRef,
				respOpts(c.ResponseOptions != nil, c.ResponseOptions), actor.PrincipalID); err != nil {
				return NoticeResult{}, err
			}
			if err := insertTargets(ctx, tx, aid, targets); err != nil {
				return NoticeResult{}, err
			}
			return NoticeResult{Kind: "ok", NoticeID: noticeID, Version: 1}, nil
		}, platform.AuditOptions[NoticeResult]{Committed: func(r NoticeResult) bool { return r.Kind == "ok" }, Reasons: NoticeReasons})
	if err != nil {
		return NoticeResult{}, err
	}
	if out.Kind == "replayed" {
		return NoticeResult{Kind: "ok", NoticeID: noticeID, Version: 1}, nil
	}
	return out.Result, nil
}

func (s *Server) auditOK(ctx context.Context, tx platform.DB, actor ActorContext, action, noticeID string, reason *string, version int64) (NoticeResult, error) {
	if err := platform.AppendAuditInTx(ctx, tx, actor.audit(action, "notice", noticeID, reason), NoticeReasons); err != nil {
		return NoticeResult{}, err
	}
	return NoticeResult{Kind: "ok", NoticeID: noticeID, Version: version}, nil
}

// ReviseNoticeAct revises a draft's content and/or targets.
func (s *Server) ReviseNoticeAct(ctx context.Context, noticeID string, from int64, clientKey string, content NoticeContent, targets []notices.Target, targetsGiven bool, actor ActorContext, scope *access.RoleScope) (NoticeResult, error) {
	_ = clientKey
	return s.transition(ctx, noticeID, from, actor, func(ctx context.Context, tx platform.DB, cur *currentNotice) (NoticeResult, error) {
		if r, _, err := s.gate(ctx, tx, cur, actor, "reviseNotice", access.CallerScopes{"estate_staff": scope}); err != nil || r != nil {
			return deref(r), err
		}
		if targetsGiven {
			if bad := invalidTarget(targets); bad != "" {
				return refusedN("invalid-target", bad), nil
			}
		}
		ts := targets
		if !targetsGiven {
			var err error
			if ts, err = readTargets(ctx, tx, cur.AssertionID); err != nil {
				return NoticeResult{}, err
			}
		}
		addr, err := s.addressedNodes(ctx, ts, actor.OrganizationID)
		if err != nil {
			return NoticeResult{}, err
		}
		if len(addr) == 0 {
			return refusedN("empty-audience", "the rule addresses no node"), nil
		}
		if u := scope.Uncovered(addr); len(u) > 0 {
			return refusedN("out-of-scope", uncoveredDetail(u)), nil
		}
		version := cur.Version + 1
		m := merge(cur, content)
		if scheduleInverted(m.PublishAt, m.ExpireAt) {
			return refusedN("schedule-inverted", "expireAt precedes publishAt"), nil
		}
		next, err := appendNoticeAssertion(ctx, tx, cur, version, "draft_saved", content, actor.PrincipalID)
		if err != nil {
			return NoticeResult{}, err
		}
		if !targetsGiven {
			err = copyTargets(ctx, tx, cur.AssertionID, next)
		} else {
			err = insertTargets(ctx, tx, next, targets)
		}
		if err != nil {
			return NoticeResult{}, err
		}
		return s.auditOK(ctx, tx, actor, ReviseNotice, noticeID, nil, version)
	})
}

func deref(r *NoticeResult) NoticeResult {
	if r == nil {
		return NoticeResult{}
	}
	return *r
}

func targetKey(ts []notices.Target) string {
	keys := make([]string, 0, len(ts))
	v := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	for _, t := range ts {
		keys = append(keys, v(t.NodeKind)+"|"+v(t.NodeID)+"|"+v(t.LocationID)+"|"+v(t.ResidentGroupID))
	}
	sort.Strings(keys)
	return strings.Join(keys, ";")
}

// CorrectNoticeAct corrects a published notice's content/schedule (never its audience).
func (s *Server) CorrectNoticeAct(ctx context.Context, noticeID string, from int64, content NoticeContent, targets []notices.Target, targetsGiven bool, reason string, actor ActorContext, scope *access.RoleScope) (NoticeResult, error) {
	return s.transition(ctx, noticeID, from, actor, func(ctx context.Context, tx platform.DB, cur *currentNotice) (NoticeResult, error) {
		if r, _, err := s.gate(ctx, tx, cur, actor, "correctNotice", access.CallerScopes{"estate_staff": scope}); err != nil || r != nil {
			return deref(r), err
		}
		existing, err := readTargets(ctx, tx, cur.AssertionID)
		if err != nil {
			return NoticeResult{}, err
		}
		if targetsGiven && targetKey(targets) != targetKey(existing) {
			return refusedN("retargeting-forbidden", "a correction may change content and schedule only; retarget by withdrawing and issuing a new notice"), nil
		}
		if r, err := s.floorFor(ctx, tx, cur.AssertionID, actor.OrganizationID, scope); err != nil || r != nil {
			return deref(r), err
		}
		version := cur.Version + 1
		m := merge(cur, content)
		if scheduleInverted(m.PublishAt, m.ExpireAt) {
			return refusedN("schedule-inverted", "expireAt precedes publishAt"), nil
		}
		next, err := appendNoticeAssertion(ctx, tx, cur, version, "publication_released", content, actor.PrincipalID)
		if err != nil {
			return NoticeResult{}, err
		}
		if err := copyTargets(ctx, tx, cur.AssertionID, next); err != nil {
			return NoticeResult{}, err
		}
		return s.auditOK(ctx, tx, actor, CorrectNotice, noticeID, &reason, version)
	})
}

// simpleTransition covers submit / approve / decline / withdraw.
func (s *Server) simpleTransition(ctx context.Context, noticeID string, from int64, op, action, disposition string, reason *string,
	caller access.CallerScopes, scope *access.RoleScope, actor ActorContext, event string) (NoticeResult, error) {
	return s.transition(ctx, noticeID, from, actor, func(ctx context.Context, tx platform.DB, cur *currentNotice) (NoticeResult, error) {
		r, subj, err := s.gate(ctx, tx, cur, actor, op, caller)
		if err != nil {
			return NoticeResult{}, err
		}
		if r != nil {
			if op == "submitNotice" {
				d := "state is " + cur.State
				if cur.State == "draft" && !subj.Gated {
					d = "this type is not gated; publish directly"
				}
				r.Detail = d
			}
			return *r, nil
		}
		if r, err := s.floorFor(ctx, tx, cur.AssertionID, actor.OrganizationID, scope); err != nil || r != nil {
			return deref(r), err
		}
		version := cur.Version + 1
		next, err := appendNoticeAssertion(ctx, tx, cur, version, disposition, NoticeContent{Set: map[string]bool{}}, actor.PrincipalID)
		if err != nil {
			return NoticeResult{}, err
		}
		if err := copyTargets(ctx, tx, cur.AssertionID, next); err != nil {
			return NoticeResult{}, err
		}
		if event != "" {
			if err := s.publishEvent(ctx, tx, event, map[string]any{"notice_id": noticeID, "version": version, "withdrawn_at": platform.ISO(actor.Now)}); err != nil {
				return NoticeResult{}, err
			}
		}
		return s.auditOK(ctx, tx, actor, action, noticeID, reason, version)
	})
}

// SubmitNoticeAct asks for approval of a gated draft.
func (s *Server) SubmitNoticeAct(ctx context.Context, id string, from int64, actor ActorContext, scope *access.RoleScope) (NoticeResult, error) {
	return s.simpleTransition(ctx, id, from, "submitNotice", SubmitNotice, "approval_requested", nil, access.CallerScopes{"estate_staff": scope}, scope, actor, "")
}

// ApproveNoticeAct approves a pending notice.
func (s *Server) ApproveNoticeAct(ctx context.Context, id string, from int64, reason *string, actor ActorContext, scope *access.RoleScope) (NoticeResult, error) {
	return s.simpleTransition(ctx, id, from, "approveNotice", ApproveNotice, "approval_granted", reason, access.CallerScopes{"approver": scope}, scope, actor, "")
}

// DeclineNoticeAct returns a pending notice to draft.
func (s *Server) DeclineNoticeAct(ctx context.Context, id string, from int64, reason string, actor ActorContext, scope *access.RoleScope) (NoticeResult, error) {
	return s.simpleTransition(ctx, id, from, "declineNotice", DeclineNotice, "draft_saved", &reason, access.CallerScopes{"approver": scope}, scope, actor, "")
}

// WithdrawNoticeAct withdraws a published notice.
func (s *Server) WithdrawNoticeAct(ctx context.Context, id string, from int64, reason string, actor ActorContext, scope *access.RoleScope) (NoticeResult, error) {
	return s.simpleTransition(ctx, id, from, "withdrawNotice", WithdrawNotice, "withdrawal_recorded", &reason,
		access.CallerScopes{"estate_staff": scope, "approver": scope}, scope, actor, "notice.withdrawn")
}

// PublishNoticeAct releases the notice and snapshots its audience as at now.
func (s *Server) PublishNoticeAct(ctx context.Context, noticeID string, from int64, actor ActorContext, scope *access.RoleScope) (NoticeResult, error) {
	return s.transition(ctx, noticeID, from, actor, func(ctx context.Context, tx platform.DB, cur *currentNotice) (NoticeResult, error) {
		if r, _, err := s.gate(ctx, tx, cur, actor, "publishNotice", access.CallerScopes{"estate_staff": scope}); err != nil || r != nil {
			return deref(r), err
		}
		for _, f := range [][2]string{{"title_en", cur.TitleEn}, {"title_zh_hant", cur.TitleZhHant}, {"body_en", cur.BodyEn}, {"body_zh_hant", cur.BodyZhHant}} {
			if strings.TrimSpace(f[1]) == "" {
				return refusedN("incomplete-translation", f[0]+" is empty"), nil
			}
		}
		if scheduleInverted(cur.PublishAt, cur.ExpireAt) {
			return refusedN("schedule-inverted"), nil
		}
		if r, err := s.floorFor(ctx, tx, cur.AssertionID, actor.OrganizationID, scope); err != nil || r != nil {
			return deref(r), err
		}
		rule, err := readTargets(ctx, tx, cur.AssertionID)
		if err != nil {
			return NoticeResult{}, err
		}
		recipients, err := s.noticeAudience.Resolve(ctx, notices.AudienceRule{OrganizationID: actor.OrganizationID, Targets: rule}, actor.Now)
		if err != nil {
			return NoticeResult{}, err
		}
		if len(recipients) == 0 {
			return refusedN("empty-audience"), nil
		}
		version := cur.Version + 1
		next, err := appendNoticeAssertion(ctx, tx, cur, version, "publication_released", NoticeContent{Set: map[string]bool{}}, actor.PrincipalID)
		if err != nil {
			return NoticeResult{}, err
		}
		if err := copyTargets(ctx, tx, cur.AssertionID, next); err != nil {
			return NoticeResult{}, err
		}
		// One statement for the whole audience (review P1: the Node build issued
		// one INSERT per recipient inside this transaction).
		hh, rs, us := make([]*string, len(recipients)), make([]string, len(recipients)), make([]string, len(recipients))
		for i, r := range recipients {
			hh[i], rs[i], us[i] = r.HouseholdID, r.ResidentID, r.UnitID
		}
		if err := tx.Exec(ctx, `INSERT INTO notice_audience (notice_id, publishing_version, household_id, resident_id, unit_id)
           SELECT $1, $2, h, r, u FROM unnest($3::text[], $4::text[], $5::text[]) AS x(h, r, u)
           ON CONFLICT (notice_id, publishing_version, resident_id) DO NOTHING`, noticeID, version, hh, rs, us); err != nil {
			return NoticeResult{}, err
		}
		if err := s.publishEvent(ctx, tx, "notice.published", map[string]any{"notice_id": noticeID, "version": version, "published_at": platform.ISO(actor.Now)}); err != nil {
			return NoticeResult{}, err
		}
		return s.auditOK(ctx, tx, actor, PublishNotice, noticeID, nil, version)
	})
}

// publishEvent writes the platform outbox message on the notices transaction.
func (s *Server) publishEvent(ctx context.Context, tx platform.DB, typ string, payload map[string]any) error {
	now := platform.ISO(time.Now())
	org := ""
	if v, ok := payload["organization_id"]; ok {
		org, _ = v.(string)
	}
	return platform.Publish(ctx, tx, platform.Envelope{MessageID: platform.NewUUID(), ContractName: typ, ContractVersion: "1.0.0",
		OccurredAt: now, ReceivedAt: now, Source: "pemo.notices", CorrelationID: platform.NewUUID(),
		Scope: map[string]any{"organizationId": org}, Payload: payload})
}

// NoticePermissionsFor lists permitted acts for each notice (dry run).
func (s *Server) NoticePermissionsFor(ctx context.Context, orgID string, ids []string, caller access.CallerScopes) (map[string][]string, error) {
	out := map[string][]string{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := s.noticesDB.Query(ctx, `SELECT notice_id, assertion_id, notice_type, lifecycle_state FROM notice_current WHERE organization_id = $1 AND notice_id = ANY($2)`, orgID, ids)
	if err != nil {
		return nil, err
	}
	var aids, types []string
	seenType := map[string]bool{}
	for _, r := range rows {
		aids = append(aids, r.Str("assertion_id"))
		if !seenType[r.Str("notice_type")] {
			seenType[r.Str("notice_type")] = true
			types = append(types, r.Str("notice_type"))
		}
	}
	byAssertion := map[string][]notices.Target{}
	if len(aids) > 0 {
		trs, err := s.noticesDB.Query(ctx, `SELECT assertion_id, node_kind, node_id, location_id, resident_group_id FROM notice_target WHERE assertion_id = ANY($1) ORDER BY assertion_id, target_id`, aids)
		if err != nil {
			return nil, err
		}
		for _, t := range trs {
			byAssertion[t.Str("assertion_id")] = append(byAssertion[t.Str("assertion_id")], notices.Target{NodeKind: t.StrPtr("node_kind"), NodeID: t.StrPtr("node_id"), LocationID: t.StrPtr("location_id"), ResidentGroupID: t.StrPtr("resident_group_id")})
		}
	}
	gatedBy := map[string]bool{}
	if len(types) > 0 {
		prs, err := s.noticesDB.Query(ctx, `SELECT notice_type, requires_approval FROM approval_policy WHERE organization_id = $1 AND notice_type = ANY($2)`, orgID, types)
		if err != nil {
			return nil, err
		}
		for _, p := range prs {
			gatedBy[p.Str("notice_type")] = p.Bool("requires_approval")
		}
	}
	for _, r := range rows {
		addr, err := s.addressedNodes(ctx, byAssertion[r.Str("assertion_id")], orgID)
		if err != nil {
			return nil, err
		}
		gated, ok := gatedBy[r.Str("notice_type")]
		if !ok {
			gated = true
		}
		p, err := noticeActRegistry.Permitted(ctx, access.ActTarget{Kind: "notice", Subject: NoticeActSubject{r.Str("lifecycle_state"), gated, addr}}, caller)
		if err != nil {
			return nil, err
		}
		out[r.Str("notice_id")] = p
	}
	return out, nil
}

func itoa(n int64) string { return strconv.FormatInt(n, 10) }
