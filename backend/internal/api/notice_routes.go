package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"pemo/internal/notices"
	"pemo/internal/platform"
)

func (s *Server) noticeRefusal(w http.ResponseWriter, r *http.Request, res NoticeResult) {
	join := func(prefix string) string { return strings.TrimSpace(prefix + " " + res.Detail) }
	switch res.Kind {
	case "out-of-scope":
		s.sendStaffProblem(w, r, staffProblems.NoticeOutOfScope())
	case "wrong-state":
		s.sendStaffProblem(w, r, staffProblems.NoticeWrongState(lz(join("This notice cannot accept that act right now."), "此通告目前不可執行該操作。")))
	case "stale-state":
		s.sendStaffProblem(w, r, staffProblems.NoticeStaleVersion(lz(join("The notice has changed."), "通告已被更新，請重新載入。")))
	case "approval-required":
		s.sendStaffProblem(w, r, staffProblems.NoticeApprovalRequired())
	case "incomplete-translation":
		s.sendStaffProblem(w, r, staffProblems.NoticeIncompleteTranslation())
	case "empty-audience":
		s.sendStaffProblem(w, r, staffProblems.NoticeEmptyAudience())
	case "schedule-inverted":
		s.sendStaffProblem(w, r, staffProblems.NoticeScheduleInverted())
	case "invalid-target":
		s.sendStaffProblem(w, r, staffProblems.NoticeInvalidTarget())
	case "retargeting-forbidden":
		s.sendStaffProblem(w, r, staffProblems.NoticeRetargetingForbidden())
	default:
		s.sendStaffProblem(w, r, staffProblems.NoticeNotFound())
	}
}

// noticeWitness is the grant recorded as the authority (first estate_staff,
// else first approver grant).
func noticeWitness(sc *StaffContext) *ActorContext {
	for _, role := range []string{"estate_staff", "approver"} {
		for _, g := range sc.Scope.Grants {
			if g.Role == role {
				a := &ActorContext{OrganizationID: sc.OrganizationID, PrincipalID: sc.PrincipalID, CorrelationID: sc.CorrelationID, Now: sc.Now}
				a.Witness.GroupID, a.Witness.Role, a.Witness.NodeKind, a.Witness.NodeID = g.GroupID, g.Role, g.Node.Kind, g.Node.ID
				return a
			}
		}
	}
	return nil
}

func parseTargets(raw []any) []notices.Target {
	out := make([]notices.Target, 0, len(raw))
	for _, x := range raw {
		m, _ := x.(map[string]any)
		get := func(k string) *string {
			if v, ok := m[k].(string); ok {
				return &v
			}
			return nil
		}
		out = append(out, notices.Target{NodeKind: get("nodeKind"), NodeID: get("nodeId"), LocationID: get("locationId")})
	}
	return out
}

func stringsOf(v any) []string {
	arr, _ := v.([]any)
	out := make([]string, 0, len(arr))
	for _, x := range arr {
		switch y := x.(type) {
		case string:
			out = append(out, y)
		case json.Number:
			out = append(out, y.String())
		default:
			b, _ := json.Marshal(y)
			out = append(out, string(b))
		}
	}
	return out
}

func timePtr(t time.Time) *time.Time { return &t }

func (s *Server) noticeListItem(n notices.StaffNoticeListItem) O {
	return obj("noticeId", n.NoticeID, "noticeType", n.NoticeType, "titleEn", n.TitleEn, "titleZhHant", n.TitleZhHant,
		"lifecycleState", n.LifecycleState, "stateEnteredAt", n.StateEnteredAt, "publishAt", jt(n.PublishAt), "expireAt", jt(n.ExpireAt),
		"mandatoryAck", n.MandatoryAck, "version", n.Version)
}

func (s *Server) noticeRoutes() {
	bad := func(w http.ResponseWriter, r *http.Request, en, zh string) {
		s.sendStaffProblem(w, r, staffProblems.BadRequest(lz(en, zh)))
	}
	s.handle("POST", mgmt+"/notices", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		key, ok := idemKey(r)
		if !ok {
			bad(w, r, "An Idempotency-Key header of 8 to 200 characters is required.", "必須提供長度為 8 至 200 個字元的 Idempotency-Key 標頭。")
			return
		}
		nt, ok := str(body, "noticeType")
		if !ok || !notices.IsNoticeType(nt) {
			bad(w, r, "The notice type must be one of: "+strings.Join(notices.NoticeTypes, ", ")+".", "通告類型不正確。")
			return
		}
		for _, f := range []string{"titleEn", "titleZhHant", "bodyEn", "bodyZhHant"} {
			if _, ok := str(body, f); !ok {
				bad(w, r, f+" is required.", "必須提供內容。")
				return
			}
		}
		rawTargets, ok := body["targets"].([]any)
		if !ok || len(rawTargets) == 0 {
			bad(w, r, "At least one target is required.", "必須提供至少一個目標。")
			return
		}
		actor := noticeWitness(sc)
		if actor == nil {
			s.sendStaffProblem(w, r, staffProblems.NoticeOutOfScope())
			return
		}
		c := NoticeContent{NoticeType: nt, MandatoryAck: body["mandatoryAck"] == true}
		c.TitleEn, _ = str(body, "titleEn")
		c.TitleZhHant, _ = str(body, "titleZhHant")
		c.BodyEn, _ = str(body, "bodyEn")
		c.BodyZhHant, _ = str(body, "bodyZhHant")
		if v, ok := str(body, "publishAt"); ok {
			if t, err := parseJSDate(v); err == nil {
				c.PublishAt = &t
			}
		}
		if v, ok := str(body, "expireAt"); ok {
			if t, err := parseJSDate(v); err == nil {
				c.ExpireAt = &t
			}
		}
		if v, ok := str(body, "incidentRef"); ok {
			c.IncidentRef = &v
		}
		if _, ok := body["responseOptions"].([]any); ok {
			c.ResponseOptions = stringsOf(body["responseOptions"])
		}
		scope, err := s.roleScope(r.Context(), sc, "estate_staff")
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		res, err := s.ComposeNotice(r.Context(), key, c, parseTargets(rawTargets), *actor, scope)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if res.Kind != "ok" {
			s.noticeRefusal(w, r, res)
			return
		}
		s.writeJSON(w, 201, obj("meta", s.managementMeta(sc), "noticeId", res.NoticeID, "version", res.Version))
	})

	type transition struct {
		path   string
		reason bool
	}
	for _, t := range []transition{{"revise", false}, {"submit", false}, {"approve", false}, {"decline", true}, {"publish", false}, {"correct", true}, {"withdraw", true}} {
		t := t
		s.handle("POST", mgmt+"/notices/{noticeId}/"+t.path, func(w http.ResponseWriter, r *http.Request, body map[string]any) {
			sc := s.authenticateStaff(w, r)
			if sc == nil {
				return
			}
			noticeID := r.PathValue("noticeId")
			if noticeID == "" {
				bad(w, r, "A notice identifier is required.", "必須提供通告識別碼。")
				return
			}
			version, ok := jsonInt(body["fromVersion"])
			if !ok || version < 1 {
				bad(w, r, "fromVersion must be the integer version this act was prepared against.", "fromVersion 必須為整數版本。")
				return
			}
			var reason *string
			if v, ok := str(body, "reasonCode"); ok {
				reason = &v
			}
			patch := NoticeContent{Set: map[string]bool{}}
			for _, f := range []string{"titleEn", "titleZhHant", "bodyEn", "bodyZhHant"} {
				if v, ok := str(body, f); ok {
					patch.Set[f] = true
					switch f {
					case "titleEn":
						patch.TitleEn = v
					case "titleZhHant":
						patch.TitleZhHant = v
					case "bodyEn":
						patch.BodyEn = v
					case "bodyZhHant":
						patch.BodyZhHant = v
					}
				}
			}
			for _, f := range []string{"publishAt", "expireAt"} {
				raw, present := body[f]
				if !present {
					continue
				}
				var tp *time.Time
				if v, ok := raw.(string); ok {
					tt, err := parseJSDate(v)
					if err != nil {
						bad(w, r, f+" must be an RFC 3339 instant.", "時間格式不正確。")
						return
					}
					tp = &tt
				} else if raw != nil {
					continue
				}
				patch.Set[f] = true
				if f == "publishAt" {
					patch.PublishAt = tp
				} else {
					patch.ExpireAt = tp
				}
			}
			if b, ok := body["mandatoryAck"].(bool); ok {
				patch.Set["mandatoryAck"], patch.MandatoryAck = true, b
			}
			if _, ok := body["responseOptions"].([]any); ok {
				patch.Set["responseOptions"], patch.ResponseOptions = true, stringsOf(body["responseOptions"])
			} else if v, present := body["responseOptions"]; present && v == nil {
				patch.Set["responseOptions"], patch.ResponseOptions = true, nil
			}
			rawTargets, targetsGiven := body["targets"].([]any)
			targets := parseTargets(rawTargets)
			if t.reason && reason == nil {
				bad(w, r, "A reasonCode is required for this act.", "此操作必須提供原因代碼。")
				return
			}
			actor := noticeWitness(sc)
			if actor == nil {
				s.sendStaffProblem(w, r, staffProblems.NoticeOutOfScope())
				return
			}
			ctx := r.Context()
			role := "estate_staff"
			if t.path == "approve" || t.path == "decline" {
				role = "approver"
			}
			scope, err := s.roleScope(ctx, sc, role)
			if err != nil {
				s.handleManagementError(w, r, err)
				return
			}
			var res NoticeResult
			switch t.path {
			case "approve":
				res, err = s.ApproveNoticeAct(ctx, noticeID, int64(version), reason, *actor, scope)
			case "decline":
				res, err = s.DeclineNoticeAct(ctx, noticeID, int64(version), *reason, *actor, scope)
			case "revise":
				k, _ := idemKey(r)
				res, err = s.ReviseNoticeAct(ctx, noticeID, int64(version), k, patch, targets, targetsGiven, *actor, scope)
			case "correct":
				res, err = s.CorrectNoticeAct(ctx, noticeID, int64(version), patch, targets, targetsGiven, *reason, *actor, scope)
			case "submit":
				res, err = s.SubmitNoticeAct(ctx, noticeID, int64(version), *actor, scope)
			case "publish":
				res, err = s.PublishNoticeAct(ctx, noticeID, int64(version), *actor, scope)
			default:
				res, err = s.WithdrawNoticeAct(ctx, noticeID, int64(version), *reason, *actor, scope)
			}
			if err != nil {
				var rc *platform.ReasonCodeError
				if errors.As(err, &rc) {
					s.sendStaffProblem(w, r, staffProblems.BadRequest(lz(rc.Msg, "原因代碼不正確。")))
					return
				}
				s.handleManagementError(w, r, err)
				return
			}
			if res.Kind != "ok" {
				s.noticeRefusal(w, r, res)
				return
			}
			s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "noticeId", res.NoticeID, "version", res.Version))
		})
	}

	s.handle("GET", mgmt+"/notices", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		ctx := r.Context()
		caller, err := s.noticeCaller(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		q := r.URL.Query()
		list, err := s.notices.List(ctx, sc.OrganizationID, caller["estate_staff"].NodeKeys, q["lifecycleState"], q["noticeType"])
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		ids := make([]string, len(list))
		for i, n := range list {
			ids[i] = n.NoticeID
		}
		perm, err := s.NoticePermissionsFor(ctx, sc.OrganizationID, ids, caller)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		out := make([]O, 0, len(list))
		for _, n := range list {
			p := perm[n.NoticeID]
			if p == nil {
				p = []string{}
			}
			out = append(out, s.noticeListItem(n).with("permittedActions", p))
		}
		s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "notices", out))
	})

	detail := func(ctx context.Context, sc *StaffContext, id string) (*notices.StaffNoticeDetail, error) {
		es, err := s.roleScope(ctx, sc, "estate_staff")
		if err != nil {
			return nil, err
		}
		return s.notices.Detail(ctx, sc.OrganizationID, id, es.NodeKeys)
	}

	s.handle("GET", mgmt+"/notices/{noticeId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		ctx := r.Context()
		id := r.PathValue("noticeId")
		caller, err := s.noticeCaller(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		d, err := s.notices.Detail(ctx, sc.OrganizationID, id, caller["estate_staff"].NodeKeys)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if d == nil {
			s.sendStaffProblem(w, r, staffProblems.NoticeNotFound())
			return
		}
		perm, err := s.NoticePermissionsFor(ctx, sc.OrganizationID, []string{id}, caller)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		p := perm[id]
		if p == nil {
			p = []string{}
		}
		targets := make([]O, 0, len(d.Targets))
		for _, t := range d.Targets {
			targets = append(targets, obj("nodeKind", nilStr(t.NodeKind), "nodeId", nilStr(t.NodeID), "locationId", nilStr(t.LocationID)))
		}
		hist := make([]O, 0, len(d.History))
		for _, h := range d.History {
			hist = append(hist, obj("version", h.Version, "disposition", h.Disposition, "recordedAt", h.RecordedAt, "recordedBy", h.RecordedBy))
		}
		var ro any
		if d.HasResponseOptions {
			ro = d.ResponseOptions
		}
		n := obj("noticeId", d.NoticeID, "noticeType", d.NoticeType, "titleEn", d.TitleEn, "titleZhHant", d.TitleZhHant,
			"bodyEn", d.BodyEn, "bodyZhHant", d.BodyZhHant, "lifecycleState", d.LifecycleState, "stateEnteredAt", d.StateEnteredAt,
			"publishAt", jt(d.PublishAt), "expireAt", jt(d.ExpireAt), "mandatoryAck", d.MandatoryAck, "version", d.Version,
			"responseOptions", ro, "targets", targets, "history", hist, "permittedActions", p)
		s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "notice", n))
	})

	s.handle("GET", mgmt+"/notices/{noticeId}/acknowledgements", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		ctx := r.Context()
		id := r.PathValue("noticeId")
		d, err := detail(ctx, sc, id)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if d == nil {
			s.sendStaffProblem(w, r, staffProblems.NoticeNotFound())
			return
		}
		es, _ := s.roleScope(ctx, sc, "estate_staff")
		recips, err := s.notices.Outstanding(ctx, sc.OrganizationID, id, es.NodeKeys)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		out := make([]O, 0, len(recips))
		for _, x := range recips {
			out = append(out, obj("residentId", x.ResidentID, "unitId", x.UnitID, "read", jt(x.Read), "acknowledged", jt(x.Acknowledged), "response", nilStr(x.Response)))
		}
		s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "noticeId", id, "mandatoryAck", d.MandatoryAck, "recipients", out))
	})

	// ---- resident notice acts ----
	for _, act := range []string{"read", "acknowledge", "respond"} {
		act := act
		s.handle("POST", "/api/resident-mobile/v0/notices/{noticeId}/"+act, func(w http.ResponseWriter, r *http.Request, body map[string]any) {
			a := s.authenticate(w, r)
			if a == nil {
				return
			}
			id := r.PathValue("noticeId")
			at := time.Now()
			var res ackResult
			var err error
			switch act {
			case "read":
				res, err = s.recordOnce(r.Context(), id, a.ctx, "read", at)
			case "acknowledge":
				res, err = s.recordOnce(r.Context(), id, a.ctx, "acknowledged", at)
			default:
				opt, ok := str(body, "option")
				if !ok || opt == "" {
					s.writeProblemJSON(w, 400, obj("type", "https://pemo.local/problems/bad-request", "title", "An option key is required",
						"status", 400, "correlationId", correlationOf(r)))
					return
				}
				k := r.Header.Get("idempotency-key")
				if _, has := r.Header["Idempotency-Key"]; !has {
					k = platform.NewUUID()
				}
				res, err = s.respond(r.Context(), id, opt, k, a.ctx, at)
			}
			if err != nil {
				s.handleReadError(w, r, err)
				return
			}
			if res.kind != "ok" {
				s.residentAckRefusal(w, r, res.kind)
				return
			}
			s.writeJSON(w, 200, obj("recorded", true, "firstTime", res.firstTime))
		})
	}

	s.handle("GET", "/api/resident-mobile/v0/notices", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		a := s.authenticate(w, r)
		if a == nil {
			return
		}
		items, err := s.notices.ForResident(r.Context(), a.ctx.ResidentID, time.Now())
		if err != nil {
			s.handleReadError(w, r, err)
			return
		}
		out := make([]O, 0, len(items))
		for _, n := range items {
			var ro any
			if n.HasResponseOptions {
				ro = n.ResponseOptions
			}
			out = append(out, obj("noticeId", n.NoticeID, "noticeType", n.NoticeType, "titleEn", n.TitleEn, "titleZhHant", n.TitleZhHant,
				"bodyEn", n.BodyEn, "bodyZhHant", n.BodyZhHant, "publishedAt", jt(n.PublishedAt), "expiresAt", jt(n.ExpiresAt),
				"expired", n.Expired, "mandatoryAck", n.MandatoryAck, "responseOptions", ro, "myRead", jt(n.MyRead),
				"myAcknowledged", jt(n.MyAcknowledged), "myResponse", nilStr(n.MyResponse)))
		}
		s.writeJSON(w, 200, obj("notices", out))
	})
}

func (s *Server) writeProblemJSON(w http.ResponseWriter, status int, body O) {
	w.Header().Set("content-type", "application/problem+json; charset=utf-8")
	w.WriteHeader(status)
	b, _ := json.Marshal(body)
	_, _ = w.Write(b)
}

var residentAckMap = map[string][4]string{
	"not-addressed":     {"404", "notice-not-addressed", "This notice is not available.", "無法使用此通告。"},
	"no-such-notice":    {"404", "notice-not-addressed", "This notice is not available.", "無法使用此通告。"},
	"not-this-resident": {"403", "notice-not-this-resident", "You may only record this for yourself.", "只可為自己記錄。"},
	"not-yet-visible":   {"404", "notice-not-yet-visible", "This notice is not available.", "無法使用此通告。"},
	"wrong-state":       {"404", "notice-not-addressed", "This notice is not available.", "無法使用此通告。"},
	"no-question-asked": {"422", "notice-no-question-asked", "This notice does not ask for a response.", "此通告並無徵詢回覆。"},
	"undeclared-option": {"422", "notice-undeclared-option", "That is not one of the offered options.", "該選項不在提供的選擇之內。"},
}

func (s *Server) residentAckRefusal(w http.ResponseWriter, r *http.Request, kind string) {
	m, ok := residentAckMap[kind]
	if !ok {
		m = residentAckMap["not-addressed"]
	}
	status := 404
	switch m[0] {
	case "403":
		status = 403
	case "422":
		status = 422
	}
	s.writeProblemJSON(w, status, obj("type", "https://pemo.local/problems/"+m[1], "title", m[2], "status", status,
		"detail", lz(m[2], m[3]), "correlationId", correlationOf(r)))
}

type ackResult struct {
	kind      string
	firstTime bool
}

type addressedNotice struct {
	state           string
	publishAt       *time.Time
	responseOptions []string
	hasOptions      bool
}

func (s *Server) guardedAck(ctx context.Context, noticeID string, c RequestContext, at time.Time, body func(tx platform.DB, a addressedNotice) (ackResult, error)) (ackResult, error) {
	bound, err := s.res.GetResident(ctx, c.ResidentID)
	if err != nil {
		return ackResult{}, err
	}
	if bound == nil || bound.ResidentID != c.ResidentID {
		return ackResult{kind: "not-this-resident"}, nil
	}
	var out ackResult
	err = s.noticesDB.Tx(ctx, func(tx platform.DB) error {
		n, err := tx.QueryOne(ctx, `SELECT lifecycle_state, publish_at, response_options FROM notice_current WHERE notice_id = $1`, noticeID)
		if err != nil {
			return err
		}
		if n == nil {
			out = ackResult{kind: "no-such-notice"}
			return nil
		}
		seat, err := tx.QueryOne(ctx, `SELECT publishing_version FROM notice_audience WHERE notice_id = $1 AND resident_id = $2 ORDER BY publishing_version DESC LIMIT 1`, noticeID, c.ResidentID)
		if err != nil {
			return err
		}
		if seat == nil {
			out = ackResult{kind: "not-addressed"}
			return nil
		}
		a := addressedNotice{n.Str("lifecycle_state"), n.TimePtr("publish_at"), n.Strings("response_options"), n["response_options"] != nil}
		if !slices.Contains([]string{"live", "scheduled", "expired"}, a.state) {
			out = ackResult{kind: "wrong-state"}
			return nil
		}
		if a.publishAt != nil && a.publishAt.After(at) {
			out = ackResult{kind: "not-yet-visible"}
			return nil
		}
		out, err = body(tx, a)
		return err
	})
	return out, err
}

func (s *Server) recordOnce(ctx context.Context, noticeID string, c RequestContext, kind string, at time.Time) (ackResult, error) {
	return s.guardedAck(ctx, noticeID, c, at, func(tx platform.DB, _ addressedNotice) (ackResult, error) {
		row, err := tx.QueryOne(ctx, `INSERT INTO notice_acknowledgement (notice_id, resident_id, kind, occurred_at, received_at, correlation_id)
           VALUES ($1,$2,$3,$4, now(), $5)
           ON CONFLICT (notice_id, resident_id, kind) WHERE kind IN ('read','acknowledged') DO NOTHING
           RETURNING acknowledgement_id`, noticeID, c.ResidentID, kind, at, c.CorrelationID)
		if err != nil {
			return ackResult{}, err
		}
		return ackResult{"ok", row != nil}, nil
	})
}

func (s *Server) respond(ctx context.Context, noticeID, option, key string, c RequestContext, at time.Time) (ackResult, error) {
	return s.guardedAck(ctx, noticeID, c, at, func(tx platform.DB, a addressedNotice) (ackResult, error) {
		if !a.hasOptions || len(a.responseOptions) == 0 {
			return ackResult{kind: "no-question-asked"}, nil
		}
		if !slices.Contains(a.responseOptions, option) {
			return ackResult{kind: "undeclared-option"}, nil
		}
		row, err := tx.QueryOne(ctx, `INSERT INTO notice_acknowledgement
             (notice_id, resident_id, kind, response, occurred_at, received_at, correlation_id, response_key)
           VALUES ($1,$2,'responded',$3,$4, now(), $5, $6)
           ON CONFLICT (response_key) WHERE response_key IS NOT NULL DO NOTHING
           RETURNING acknowledgement_id`, noticeID, c.ResidentID, option, at, c.CorrelationID, key)
		if err != nil {
			return ackResult{}, err
		}
		return ackResult{"ok", row != nil}, nil
	})
}

var _ = timePtr
