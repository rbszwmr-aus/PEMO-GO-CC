package api

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"net/http"
	"slices"
	"strings"
	"time"

	"pemo/internal/access"
	"pemo/internal/homesafety"
	"pemo/internal/platform"
	"pemo/internal/property"
	"pemo/internal/resident"
)

const mgmt = "/api/management-web/v0"

func lz(en, zh string) platform.LocalizedText { return platform.LocalizedText{En: en, ZhHant: zh} }

func (s *Server) authenticateStaff(w http.ResponseWriter, r *http.Request) *StaffContext {
	o := readDevOverrides(s.cfg, r)
	if o.Fault == "internal-error" {
		s.sendStaffProblem(w, r, staffProblems.InternalError())
		return nil
	}
	header := r.Header.Get("authorization")
	principal, failure := s.staffAuth.Verify(header, time.Now())
	if failure != "" {
		s.log.Warn("staff credential refused", map[string]any{"correlationId": correlationOf(r), "cause": failure, "route": r.URL.Path})
		if failure == "expired" {
			s.sendStaffProblem(w, r, staffProblems.SessionExpired())
		} else {
			s.sendStaffProblem(w, r, staffProblems.InvalidCredential())
		}
		return nil
	}
	now := time.Now()
	if o.Now != nil {
		now = *o.Now
	}
	resolved, err := s.acc.GetPrincipal(r.Context(), principal)
	if err != nil {
		s.handleManagementError(w, r, err)
		return nil
	}
	if resolved == nil {
		s.log.Warn("staff credential refused", map[string]any{"correlationId": correlationOf(r), "cause": "no-principal", "route": r.URL.Path})
		s.sendStaffProblem(w, r, staffProblems.InvalidCredential())
		return nil
	}
	return &StaffContext{resolved.PrincipalID, resolved.OrganizationID, correlationOf(r), now, resolved}
}

func (s *Server) handleManagementError(w http.ResponseWriter, r *http.Request, err error) {
	var sp *StaffProblem
	var p *platform.Problem
	var ce *cursorExpiredError
	var conflict *platform.IdempotencyConflictError
	var rc *platform.ReasonCodeError
	switch {
	case errors.As(err, &sp):
		s.sendStaffProblem(w, r, sp)
	case errors.As(err, &p):
		s.sendProblem(w, r, p)
	case errors.Is(err, errInvalidPageLimit):
		s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("limit must be a positive integer.", "limit 必須為正整數。")))
	case errors.As(err, &ce):
		s.sendStaffProblem(w, r, staffProblems.CursorExpired())
	case errors.Is(err, ErrCommunicationsUnavailable):
		s.sendStaffProblem(w, r, staffProblems.CommunicationsUnavailable())
	case errors.As(err, &conflict):
		s.sendStaffProblem(w, r, staffProblems.IdempotencyKeyConflict())
	case errors.As(err, &rc):
		s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("A declared reasonCode is required for this operation.", "此操作必須提供已宣告的原因代碼。")))
	default:
		s.log.Error("unhandled management read failure", map[string]any{"correlationId": correlationOf(r), "error": err.Error()})
		s.sendStaffProblem(w, r, staffProblems.InternalError())
	}
}

// ---- body field helpers (typeof checks of the Node build) ----

func str(body map[string]any, k string) (string, bool) { v, ok := body[k].(string); return v, ok }

func present(body map[string]any, k string) bool { _, ok := body[k]; return ok }

func isoField(body map[string]any, k string, def time.Time) (time.Time, bool, bool) {
	raw, ok := body[k]
	if !ok {
		return def, true, false
	}
	s, isStr := raw.(string)
	if !isStr {
		return def, false, true
	}
	t, err := parseJSDate(s)
	if err != nil {
		return def, false, true
	}
	return t, true, true
}

func jsonInt(v any) (int, bool) {
	n, ok := v.(json.Number)
	if !ok {
		return 0, false
	}
	f, err := n.Float64()
	if err != nil || f != math.Trunc(f) {
		return 0, false
	}
	return int(f), true
}

func idemKey(r *http.Request) (string, bool) {
	vals, ok := r.Header["Idempotency-Key"]
	if !ok || len(vals) == 0 {
		return "", false
	}
	k := vals[0]
	return k, len(k) >= 8 && len(k) <= 200
}

func validID(v string) bool { return v != "" && len(v) <= 120 }

// ---- scope, tree, overview ----

func (s *Server) staffRoutes() {
	s.handle("GET", mgmt+"/scope", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		p, err := parsePageParams(r.URL.Query())
		if err == nil {
			var out any
			if out, err = s.composeScopeTree(r.Context(), sc, p); err == nil {
				s.writeJSON(w, 200, out)
				return
			}
		}
		s.handleManagementError(w, r, err)
	})
	s.handle("GET", mgmt+"/properties/tree", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		req, ok := parseScopeParam(r.URL.Query())
		if !ok {
			s.sendStaffProblem(w, r, staffProblems.ScopeNotFound())
			return
		}
		p, err := parsePageParams(r.URL.Query())
		if err == nil {
			var out any
			if out, err = s.composePropertyTree(r.Context(), sc, req, p); err == nil {
				s.writeJSON(w, 200, out)
				return
			}
		}
		s.handleManagementError(w, r, err)
	})
	s.handle("GET", mgmt+"/overview", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		req, ok := parseScopeParam(r.URL.Query())
		if !ok {
			s.sendStaffProblem(w, r, staffProblems.ScopeNotFound())
			return
		}
		out, err := s.composeOverview(r.Context(), sc, req)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		s.writeJSON(w, 200, out)
	})
	s.grantRoutes()
	s.writeRoutes()
	s.noticeRoutes()
	s.helpdeskRoutes()
	s.strataRoutes()
	s.mailRoutes()
}

// ---- grants, principals, memberships ----

func (s *Server) grantReply(w http.ResponseWriter, r *http.Request, sc *StaffContext, grantID string, replayed bool, status int) {
	g, err := s.acc.FindCurrentGrant(r.Context(), grantID)
	if err != nil {
		s.handleManagementError(w, r, err)
		return
	}
	if g == nil {
		s.handleManagementError(w, r, errors.New("grant "+grantID+" vanished between the act and its response"))
		return
	}
	var to any
	if g.EffectiveTo != nil {
		to = s.fmtLocal(*g.EffectiveTo)
	}
	s.writeJSON(w, status, obj("meta", s.managementMeta(sc), "replayed", replayed,
		"grant", obj("grantId", g.GrantID, "groupId", g.GroupID, "role", g.Role, "node", obj("kind", g.NodeKind, "id", g.NodeID),
			"version", g.Version, "effectiveTo", to)))
}

func (s *Server) grantProblem(w http.ResponseWriter, r *http.Request, kind string) {
	switch kind {
	case "conflict":
		s.sendStaffProblem(w, r, staffProblems.GrantExists())
	case "not-live":
		s.sendStaffProblem(w, r, staffProblems.GrantNotLive())
	case "last-administrator":
		s.sendStaffProblem(w, r, staffProblems.LastGrantAdministrator())
	case "already-provisioned":
		s.sendStaffProblem(w, r, staffProblems.OrganizationAlreadyProvisioned())
	default:
		s.sendStaffProblem(w, r, staffProblems.GrantTargetNotFound())
	}
}

func (s *Server) membershipProblem(w http.ResponseWriter, r *http.Request, kind string) {
	switch kind {
	case "out-of-reach", "not-an-administrator":
		s.sendStaffProblem(w, r, staffProblems.AdministrationFloor())
	case "conflict":
		s.sendStaffProblem(w, r, staffProblems.MembershipExists())
	case "not-live":
		s.sendStaffProblem(w, r, staffProblems.MembershipNotLive())
	case "last-administrator":
		s.sendStaffProblem(w, r, staffProblems.LastGrantAdministrator())
	default:
		s.sendStaffProblem(w, r, staffProblems.PrincipalTargetNotFound())
	}
}

// GrantReasons is the access reason-code registry.
var GrantReasons = platform.ReasonCodeRegistry{
	"confer_grant":           {Codes: []string{"new_appointment", "role_change", "cover_absence", "contractor_engagement"}, Required: true},
	"revoke_grant":           {Codes: []string{"staff_departed", "role_change", "cover_ended", "granted_in_error"}, Required: true},
	"register_principal":     {Codes: []string{}, Required: false},
	"add_membership":         {Codes: []string{"new_appointment", "role_change", "cover_absence", "contractor_engagement"}, Required: true},
	"remove_membership":      {Codes: []string{"staff_departed", "role_change", "cover_ended", "added_in_error"}, Required: true},
	"provision_organization": {Codes: []string{"organization_provisioned"}, Required: true},
}

func strPtr(s string) *string { return &s }

func optReason(body map[string]any) (*string, bool) {
	v, ok := body["reasonCode"]
	if !ok {
		return nil, true
	}
	s, isStr := v.(string)
	if !isStr {
		return nil, false
	}
	return &s, true
}

func reasonStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func committedKinds(kinds ...string) func(access.Result) bool {
	return func(r access.Result) bool { return slices.Contains(kinds, r.Kind) }
}

func (s *Server) witnessAudit(sc *StaffContext, groupID, role, nodeKind, nodeID, action, targetKind, targetID string, reason *string, at time.Time) platform.AuditRecord {
	p := sc.PrincipalID
	return platform.AuditRecord{Source: "principal", PrincipalID: &p, GroupID: &groupID, Role: &role, NodeKind: nodeKind, NodeID: nodeID,
		Action: action, TargetKind: targetKind, TargetID: targetID, OccurredAt: at, CorrelationID: sc.CorrelationID, ReasonCode: reason}
}

func (s *Server) grantRoutes() {
	bad := func(w http.ResponseWriter, r *http.Request, en, zh string) {
		s.sendStaffProblem(w, r, staffProblems.BadRequest(lz(en, zh)))
	}
	const keyEn, keyZh = "An Idempotency-Key header of 8 to 200 characters is required.", "必須提供長度為 8 至 200 個字元的 Idempotency-Key 標頭。"

	s.handle("POST", mgmt+"/grants", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		key, ok := idemKey(r)
		if !ok {
			bad(w, r, keyEn, keyZh)
			return
		}
		groupID, ok := str(body, "groupId")
		if !ok || !validID(groupID) {
			bad(w, r, "A group identifier is required.", "必須提供群組識別碼。")
			return
		}
		role, ok := str(body, "role")
		if !ok || !slices.Contains(access.ScopeRoles, role) {
			bad(w, r, "The role must be one of: "+strings.Join(access.ScopeRoles, ", ")+".", "角色必須為指定選項之一。")
			return
		}
		nodeKind, ok := str(body, "nodeKind")
		if !ok || !slices.Contains(access.ScopeNodeKinds, nodeKind) {
			bad(w, r, "The node kind must be one of: "+strings.Join(access.ScopeNodeKinds, ", ")+".", "節點類型不正確。")
			return
		}
		nodeID, ok := str(body, "nodeId")
		if !ok || !validID(nodeID) {
			bad(w, r, "A node identifier is required.", "必須提供節點識別碼。")
			return
		}
		from, ok, _ := isoField(body, "effectiveFrom", sc.Now)
		if !ok {
			bad(w, r, "effectiveFrom must be an RFC 3339 instant.", "生效時間格式不正確。")
			return
		}
		reason, ok := optReason(body)
		if !ok {
			bad(w, r, "reasonCode must be a string.", "原因代碼格式不正確。")
			return
		}
		ctx := r.Context()
		admin := grantsOfRole(sc.Scope, "grant_administrator")
		allowed, err := access.NewRoleScope(ctx, "grant_administrator", sc.Scope.Grants, s.expandToNodeKeys(sc.OrganizationID))
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		auth, err := s.findAuthorizingGrant(ctx, sc.OrganizationID, admin, nodeKind, nodeID)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if auth == nil {
			s.sendStaffProblem(w, r, staffProblems.GrantTargetNotFound())
			return
		}
		grantID := platform.DeriveActID("gr", "confer_grant", key)
		rawFrom, _ := str(body, "effectiveFrom")
		fp := platform.DeriveRequestFingerprint(groupID, role, nodeKind, nodeID, rawFrom, reasonStr(reason))
		p := sc.PrincipalID
		out, err := platform.IdempotentAuditedWrite(ctx, s.accessDB,
			s.witnessAudit(sc, auth.GroupID, auth.Role, auth.Node.Kind, auth.Node.ID, "confer_grant", "scope_grant", grantID, reason, sc.Now),
			platform.IdempotencyKey{PrincipalID: &p, Operation: "confer_grant", Key: key, ActKind: "scope_grant", ActID: grantID, RequestFingerprint: fp},
			func(tx platform.DB) (access.Result, error) {
				return access.Confer(ctx, tx, access.ConferGrantInput{GrantID: grantID, GroupID: groupID, Role: role, NodeKind: nodeKind, NodeID: nodeID, EffectiveFrom: from}, allowed)
			}, platform.AuditOptions[access.Result]{Reasons: GrantReasons, Committed: committedKinds("conferred", "revoked", "provisioned")})
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if out.Kind == "replayed" {
			s.grantReply(w, r, sc, out.ActID, true, 200)
			return
		}
		if out.Result.Kind != "conferred" {
			s.grantProblem(w, r, out.Result.Kind)
			return
		}
		s.grantReply(w, r, sc, grantID, false, 201)
	})

	s.handle("POST", mgmt+"/grants/{grantId}/revoke", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		key, ok := idemKey(r)
		if !ok {
			bad(w, r, keyEn, keyZh)
			return
		}
		grantID := r.PathValue("grantId")
		if !validID(grantID) {
			bad(w, r, "The grant identifier is missing or malformed.", "授權識別碼缺少或格式不正確。")
			return
		}
		to, ok, _ := isoField(body, "effectiveTo", sc.Now)
		if !ok {
			bad(w, r, "effectiveTo must be an RFC 3339 instant.", "結束時間格式不正確。")
			return
		}
		reason, ok := optReason(body)
		if !ok {
			bad(w, r, "reasonCode must be a string.", "原因代碼格式不正確。")
			return
		}
		ctx := r.Context()
		admin := grantsOfRole(sc.Scope, "grant_administrator")
		allowed, err := access.NewRoleScope(ctx, "grant_administrator", sc.Scope.Grants, s.expandToNodeKeys(sc.OrganizationID))
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		target, err := s.acc.FindCurrentGrant(ctx, grantID)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if target == nil || !allowed.Covers(target.NodeKind+":"+target.NodeID) {
			s.sendStaffProblem(w, r, staffProblems.GrantTargetNotFound())
			return
		}
		auth, err := s.findAuthorizingGrant(ctx, sc.OrganizationID, admin, target.NodeKind, target.NodeID)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if auth == nil {
			s.sendStaffProblem(w, r, staffProblems.GrantTargetNotFound())
			return
		}
		rawTo, _ := str(body, "effectiveTo")
		fp := platform.DeriveRequestFingerprint(grantID, rawTo, reasonStr(reason))
		p := sc.PrincipalID
		out, err := platform.IdempotentAuditedWrite(ctx, s.accessDB,
			s.witnessAudit(sc, auth.GroupID, auth.Role, auth.Node.Kind, auth.Node.ID, "revoke_grant", "scope_grant", grantID, reason, sc.Now),
			platform.IdempotencyKey{PrincipalID: &p, Operation: "revoke_grant", Key: key, ActKind: "scope_grant", ActID: grantID, RequestFingerprint: fp},
			func(tx platform.DB) (access.Result, error) { return access.Revoke(ctx, tx, grantID, to, allowed) },
			platform.AuditOptions[access.Result]{Reasons: GrantReasons, Committed: committedKinds("conferred", "revoked", "provisioned")})
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if out.Kind == "replayed" {
			s.grantReply(w, r, sc, grantID, true, 200)
			return
		}
		if out.Result.Kind != "revoked" {
			s.grantProblem(w, r, out.Result.Kind)
			return
		}
		s.grantReply(w, r, sc, grantID, false, 200)
	})

	type reachT struct {
		scope   *access.RoleScope
		witness *access.AdministratorWitness
	}
	administratorReach := func(ctx context.Context, sc *StaffContext) (reachT, error) {
		scope, err := access.NewRoleScope(ctx, "grant_administrator", sc.Scope.Grants, s.expandToNodeKeys(sc.OrganizationID))
		if err != nil {
			return reachT{}, err
		}
		ws, err := access.EffectiveAdministrators(ctx, s.accessDB, sc.OrganizationID)
		if err != nil {
			return reachT{}, err
		}
		for i := range ws {
			if ws[i].PrincipalID == sc.PrincipalID {
				return reachT{scope, &ws[i]}, nil
			}
		}
		return reachT{scope, nil}, nil
	}

	s.handle("POST", mgmt+"/principals", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		orgID, ok := str(body, "organizationId")
		if !ok || orgID == "" {
			bad(w, r, "An organization identifier is required.", "必須提供機構識別碼。")
			return
		}
		ext, ok := str(body, "externalId")
		if !ok || ext == "" || len(ext) > 200 {
			bad(w, r, "An external identity is required.", "必須提供外部身分識別碼。")
			return
		}
		name, ok := str(body, "displayName")
		if !ok || name == "" || len(name) > 200 {
			bad(w, r, "A display name is required.", "必須提供顯示名稱。")
			return
		}
		if orgID != sc.OrganizationID {
			s.sendStaffProblem(w, r, staffProblems.PrincipalTargetNotFound())
			return
		}
		ctx := r.Context()
		reach, err := administratorReach(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if reach.witness == nil || !reach.scope.Covers("organization:"+sc.OrganizationID) {
			s.sendStaffProblem(w, r, staffProblems.AdministrationFloor())
			return
		}
		key := orgID + "\u001f" + ext
		principalID := platform.DeriveActID("stf", "register_principal", key)
		p := sc.PrincipalID
		out, err := platform.IdempotentAuditedWrite(ctx, s.accessDB,
			s.witnessAudit(sc, reach.witness.GroupIDOfGrant, "grant_administrator", "organization", sc.OrganizationID, "register_principal", "staff_principal", principalID, nil, sc.Now),
			platform.IdempotencyKey{PrincipalID: &p, Operation: "register_principal", Key: key, ActKind: "staff_principal", ActID: principalID,
				RequestFingerprint: platform.DeriveRequestFingerprint(orgID, ext, name)},
			func(tx platform.DB) (access.Result, error) {
				return access.RegisterPrincipal(ctx, tx, access.RegisterPrincipalInput{PrincipalID: principalID, OrganizationID: orgID, ExternalID: ext, DisplayName: name})
			}, platform.AuditOptions[access.Result]{Reasons: GrantReasons, Committed: committedKinds("registered")})
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if out.Kind == "replayed" {
			s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "replayed", true, "principal", obj("principalId", out.ActID, "organizationId", orgID, "displayName", name)))
			return
		}
		if out.Result.Kind != "registered" {
			s.sendStaffProblem(w, r, staffProblems.IdentityAlreadyRecorded())
			return
		}
		s.writeJSON(w, 201, obj("meta", s.managementMeta(sc), "replayed", false, "principal", obj("principalId", principalID, "organizationId", orgID, "displayName", name)))
	})

	s.handle("POST", mgmt+"/groups/{groupId}/members", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		key, ok := idemKey(r)
		if !ok {
			bad(w, r, keyEn, keyZh)
			return
		}
		groupID := r.PathValue("groupId")
		if !validID(groupID) {
			bad(w, r, "The group identifier is missing or malformed.", "群組識別碼缺少或格式不正確。")
			return
		}
		principalID, ok := str(body, "principalId")
		if !ok || !validID(principalID) {
			bad(w, r, "A principal identifier is required.", "必須提供人員識別碼。")
			return
		}
		from, ok, _ := isoField(body, "effectiveFrom", sc.Now)
		if !ok {
			bad(w, r, "effectiveFrom must be an RFC 3339 instant.", "生效時間格式不正確。")
			return
		}
		reason, ok := optReason(body)
		if !ok {
			bad(w, r, "reasonCode must be a string.", "原因代碼格式不正確。")
			return
		}
		ctx := r.Context()
		reach, err := administratorReach(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if reach.witness == nil {
			s.sendStaffProblem(w, r, staffProblems.AdministrationFloor())
			return
		}
		membershipID := platform.DeriveActID("mem", "add_membership", key)
		rawFrom, _ := str(body, "effectiveFrom")
		p := sc.PrincipalID
		out, err := platform.IdempotentAuditedWrite(ctx, s.accessDB,
			s.witnessAudit(sc, reach.witness.GroupIDOfGrant, "grant_administrator", "organization", sc.OrganizationID, "add_membership", "group_membership", membershipID, reason, sc.Now),
			platform.IdempotencyKey{PrincipalID: &p, Operation: "add_membership", Key: key, ActKind: "group_membership", ActID: membershipID,
				RequestFingerprint: platform.DeriveRequestFingerprint(groupID, principalID, rawFrom, reasonStr(reason))},
			func(tx platform.DB) (access.Result, error) {
				return access.AddMembership(ctx, tx, access.AddMembershipInput{MembershipID: membershipID, GroupID: groupID, PrincipalID: principalID,
					EffectiveFrom: from, OrganizationID: sc.OrganizationID}, reach.scope)
			}, platform.AuditOptions[access.Result]{Reasons: GrantReasons, Committed: committedKinds("added")})
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if out.Kind == "replayed" {
			s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "replayed", true,
				"membership", obj("membershipId", out.ActID, "groupId", groupID, "principalId", principalID, "version", 1)))
			return
		}
		if out.Result.Kind != "added" {
			s.membershipProblem(w, r, out.Result.Kind)
			return
		}
		s.writeJSON(w, 201, obj("meta", s.managementMeta(sc), "replayed", false,
			"membership", obj("membershipId", membershipID, "groupId", groupID, "principalId", principalID, "version", out.Result.Version)))
	})

	s.handle("POST", mgmt+"/memberships/{membershipId}/remove", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		key, ok := idemKey(r)
		if !ok {
			bad(w, r, keyEn, keyZh)
			return
		}
		mid := r.PathValue("membershipId")
		if !validID(mid) {
			bad(w, r, "The membership identifier is missing or malformed.", "成員資格識別碼缺少或格式不正確。")
			return
		}
		to, ok, _ := isoField(body, "effectiveTo", sc.Now)
		if !ok {
			bad(w, r, "effectiveTo must be an RFC 3339 instant.", "結束時間格式不正確。")
			return
		}
		reason, ok := optReason(body)
		if !ok {
			bad(w, r, "reasonCode must be a string.", "原因代碼格式不正確。")
			return
		}
		ctx := r.Context()
		reach, err := administratorReach(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if reach.witness == nil {
			s.sendStaffProblem(w, r, staffProblems.AdministrationFloor())
			return
		}
		rawTo, _ := str(body, "effectiveTo")
		p := sc.PrincipalID
		out, err := platform.IdempotentAuditedWrite(ctx, s.accessDB,
			s.witnessAudit(sc, reach.witness.GroupIDOfGrant, "grant_administrator", "organization", sc.OrganizationID, "remove_membership", "group_membership", mid, reason, sc.Now),
			platform.IdempotencyKey{PrincipalID: &p, Operation: "remove_membership", Key: key, ActKind: "group_membership", ActID: mid,
				RequestFingerprint: platform.DeriveRequestFingerprint(mid, rawTo, reasonStr(reason))},
			func(tx platform.DB) (access.Result, error) {
				return access.RemoveMembership(ctx, tx, mid, to, reach.scope)
			},
			platform.AuditOptions[access.Result]{Reasons: GrantReasons, Committed: committedKinds("removed")})
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if out.Kind == "replayed" {
			cur, err := s.acc.FindCurrentMembership(ctx, mid)
			if err != nil {
				s.handleManagementError(w, r, err)
				return
			}
			g, pr, v := "", "", int64(0)
			if cur != nil {
				g, pr, v = cur.GroupID, cur.PrincipalID, cur.Version
			}
			s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "replayed", true,
				"membership", obj("membershipId", mid, "groupId", g, "principalId", pr, "version", v)))
			return
		}
		if out.Result.Kind != "removed" {
			s.membershipProblem(w, r, out.Result.Kind)
			return
		}
		s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "replayed", false,
			"membership", obj("membershipId", mid, "groupId", out.Result.GroupID, "principalId", out.Result.PrincipalID, "version", out.Result.Version)))
	})
}

// ---- safety updates, occupancies, estate contacts ----

func (s *Server) estateStaffExpanded(ctx context.Context, sc *StaffContext) ([]access.ScopeGrant, property.ExpandedScope, error) {
	gs := grantsOfRole(sc.Scope, "estate_staff")
	e, err := s.prop.Expand(ctx, sc.OrganizationID, grantNodes(gs))
	return gs, e, err
}

func textField(body map[string]any, k string, max int) (string, bool) {
	v, ok := body[k].(string)
	if !ok || strings.TrimSpace(v) == "" || len([]rune(v)) > max {
		return "", false
	}
	return v, true
}

func (s *Server) writeRoutes() {
	bad := func(w http.ResponseWriter, r *http.Request, en, zh string) {
		s.sendStaffProblem(w, r, staffProblems.BadRequest(lz(en, zh)))
	}

	s.handle("POST", mgmt+"/safety/events/{eventId}/updates", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		eventID := r.PathValue("eventId")
		bodyEn, okEn := textField(body, "bodyEn", 4000)
		bodyZh, okZh := textField(body, "bodyZhHant", 4000)
		if !validID(eventID) {
			bad(w, r, "The event identifier is missing or malformed.", "事件識別碼缺少或格式不正確。")
			return
		}
		if !okEn || !okZh {
			bad(w, r, "An update requires text in both English and Traditional Chinese.", "更新須同時提供英文及繁體中文內容。")
			return
		}
		allClear := false
		if v, ok := body["isAllClear"]; ok {
			b, isBool := v.(bool)
			if !isBool {
				bad(w, r, "The all-clear flag must be true or false.", "解除警報標記必須為 true 或 false。")
				return
			}
			allClear = b
		}
		ctx := r.Context()
		gs, e, err := s.estateStaffExpanded(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		ev, err := s.hs.FindEventInScope(ctx, eventID, e.EstateIDs)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if ev == nil {
			s.sendStaffProblem(w, r, staffProblems.EventNotFound())
			return
		}
		auth, err := s.findAuthorizingGrant(ctx, sc.OrganizationID, gs, "estate", ev.EstateID)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if auth == nil {
			s.log.Error("event resolved in scope but no grant expands to its estate", map[string]any{"correlationId": sc.CorrelationID, "eventId": ev.EventID})
			s.sendStaffProblem(w, r, staffProblems.InternalError())
			return
		}
		updateID := "upd_" + platform.NewUUID()
		at, _ := platform.ParseISO(sc.Scope.AsAt)
		type pub struct{ id, at string }
		res, err := platform.AuditedWrite(ctx, s.homeSafetyDB,
			s.witnessAudit(sc, auth.GroupID, auth.Role, auth.Node.Kind, auth.Node.ID, "publish_management_update", "management_update", updateID, nil, at),
			func(tx platform.DB) (pub, error) {
				id, pa, err := homesafety.PublishUpdate(ctx, tx, homesafety.ManagementUpdateInput{UpdateID: updateID, EventID: ev.EventID,
					BodyEn: bodyEn, BodyZhHant: bodyZh, IsAllClear: allClear, PublishedAt: at})
				return pub{id, pa}, err
			}, platform.AuditOptions[pub]{Committed: func(pub) bool { return true }})
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		s.writeJSON(w, 201, obj("meta", s.managementMeta(sc), "eventId", ev.EventID,
			"update", obj("updateId", res.id, "publishedAt", s.fmtLocalStr(res.at), "isAllClear", allClear)))
	})

	roles := []string{"owner_occupier", "tenant", "household_member", "caregiver"}
	s.handle("POST", mgmt+"/units/{unitId}/occupancies", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		unitID := r.PathValue("unitId")
		if !validID(unitID) {
			bad(w, r, "The unit identifier is missing or malformed.", "單位識別碼缺少或格式不正確。")
			return
		}
		residentID, ok := str(body, "residentId")
		if !ok || !validID(residentID) {
			bad(w, r, "A resident identifier is required.", "必須提供住戶識別碼。")
			return
		}
		role, ok := str(body, "role")
		if !ok || !slices.Contains(roles, role) {
			bad(w, r, "The role must be one of: "+strings.Join(roles, ", ")+".", "身分必須為指定選項之一。")
			return
		}
		from, ok, _ := isoField(body, "effectiveFrom", sc.Now)
		if !ok {
			bad(w, r, "effectiveFrom must be an RFC 3339 instant.", "生效時間格式不正確。")
			return
		}
		ctx := r.Context()
		gs, e, err := s.estateStaffExpanded(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		unit, err := s.prop.GetResidentialUnit(ctx, sc.OrganizationID, unitID)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		rec, err := s.res.GetResident(ctx, residentID)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if unit == nil || rec == nil || rec.OrganizationID != sc.OrganizationID {
			s.sendStaffProblem(w, r, staffProblems.OccupancyTargetNotFound())
			return
		}
		auth, err := s.findAuthorizingGrant(ctx, sc.OrganizationID, gs, "unit", unitID)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if auth == nil {
			s.sendStaffProblem(w, r, staffProblems.OccupancyTargetNotFound())
			return
		}
		occID := "occ_" + platform.NewUUID()
		at, _ := platform.ParseISO(sc.Scope.AsAt)
		res, err := platform.AuditedWrite(ctx, s.residentDB,
			s.witnessAudit(sc, auth.GroupID, auth.Role, auth.Node.Kind, auth.Node.ID, "record_occupancy", "occupancy", occID, nil, at),
			func(tx platform.DB) (resident.OccupancyResult, error) {
				return resident.RecordOccupancy(ctx, tx, resident.RecordOccupancyInput{OccupancyID: occID, ResidentID: residentID, UnitID: unitID,
					UnitClass: "residential", Role: role, Source: "management_web", EffectiveFrom: from}, e.UnitIDs)
			}, platform.AuditOptions[resident.OccupancyResult]{Committed: func(r resident.OccupancyResult) bool { return r.Kind == "recorded" }})
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if res.Kind == "conflict" {
			s.sendStaffProblem(w, r, staffProblems.OccupancyExists())
			return
		}
		if res.Kind != "recorded" {
			s.sendStaffProblem(w, r, staffProblems.OccupancyTargetNotFound())
			return
		}
		s.writeJSON(w, 201, obj("meta", s.managementMeta(sc), "unitId", unitID,
			"occupancy", obj("occupancyId", res.OccupancyID, "residentId", residentID, "role", role, "effectiveFrom", s.fmtLocalStr(res.EffectiveFrom))))
	})

	s.handle("POST", mgmt+"/occupancies/{occupancyId}/end", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		occID := r.PathValue("occupancyId")
		if !validID(occID) {
			bad(w, r, "The occupancy identifier is missing or malformed.", "居住紀錄識別碼缺少或格式不正確。")
			return
		}
		to, ok, _ := isoField(body, "effectiveTo", sc.Now)
		if !ok {
			bad(w, r, "effectiveTo must be an RFC 3339 instant.", "結束時間格式不正確。")
			return
		}
		ctx := r.Context()
		gs, e, err := s.estateStaffExpanded(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		cur, err := s.res.FindCurrentInstance(ctx, occID, e.UnitIDs)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if cur == nil {
			s.sendStaffProblem(w, r, staffProblems.OccupancyTargetNotFound())
			return
		}
		auth, err := s.findAuthorizingGrant(ctx, sc.OrganizationID, gs, "unit", cur.UnitID)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if auth == nil {
			s.log.Error("occupancy resolved in scope but no grant expands to its unit", map[string]any{"correlationId": sc.CorrelationID, "occupancyId": occID})
			s.sendStaffProblem(w, r, staffProblems.InternalError())
			return
		}
		at, _ := platform.ParseISO(sc.Scope.AsAt)
		res, err := platform.AuditedWrite(ctx, s.residentDB,
			s.witnessAudit(sc, auth.GroupID, auth.Role, auth.Node.Kind, auth.Node.ID, "end_occupancy", "occupancy", occID, nil, at),
			func(tx platform.DB) (resident.OccupancyResult, error) {
				return resident.EndOccupancy(ctx, tx, resident.EndOccupancyInput{OccupancyID: occID, AssertionID: "occa_" + platform.NewUUID(), EffectiveTo: to}, e.UnitIDs)
			}, platform.AuditOptions[resident.OccupancyResult]{Committed: func(r resident.OccupancyResult) bool { return r.Kind == "ended" }})
		if err != nil {
			if platform.PgCode(err) == "23505" && platform.PgConstraint(err) == "occupancy_version_unique" {
				s.sendStaffProblem(w, r, staffProblems.OccupancyNotLive())
				return
			}
			s.handleManagementError(w, r, err)
			return
		}
		switch res.Kind {
		case "not-live":
			s.sendStaffProblem(w, r, staffProblems.OccupancyNotLive())
			return
		case "ended":
		default:
			s.sendStaffProblem(w, r, staffProblems.OccupancyTargetNotFound())
			return
		}
		s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "occupancyId", res.OccupancyID,
			"occupancy", obj("version", res.Version, "effectiveTo", s.fmtLocalStr(res.EffectiveTo))))
	})

	kinds := []string{"management_office", "emergency", "approved_service"}
	s.handle("POST", mgmt+"/estates/{estateId}/contacts", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		estateID := r.PathValue("estateId")
		if !validID(estateID) {
			bad(w, r, "The estate identifier is missing or malformed.", "屋苑識別碼缺少或格式不正確。")
			return
		}
		kind, ok := str(body, "contactKind")
		if !ok || !slices.Contains(kinds, kind) {
			bad(w, r, "contactKind must be one of: "+strings.Join(kinds, ", ")+".", "聯絡類別必須為指定選項之一。")
			return
		}
		nameEn, ok1 := textField(body, "nameEn", 200)
		nameZh, ok2 := textField(body, "nameZhHant", 200)
		if !ok1 || !ok2 {
			bad(w, r, "A contact requires a name in both English and Traditional Chinese.", "聯絡資料須同時提供英文及繁體中文名稱。")
			return
		}
		optional := func(k string, max int) (*string, bool) {
			v, ok := body[k]
			if !ok || v == nil {
				return nil, true
			}
			t, good := textField(body, k, max)
			if !good {
				return nil, false
			}
			return &t, true
		}
		tel, okT := optional("telephone", 40)
		hEn, okH1 := optional("hoursEn", 200)
		hZh, okH2 := optional("hoursZhHant", 200)
		if !okT || !okH1 || !okH2 {
			bad(w, r, "telephone and hours must be strings when supplied.", "電話及服務時間格式不正確。")
			return
		}
		sortOrder := 0
		if v, ok := body["sortOrder"]; ok {
			n, isInt := jsonInt(v)
			if !isInt {
				bad(w, r, "sortOrder must be an integer.", "排序必須為整數。")
				return
			}
			sortOrder = n
		}
		ctx := r.Context()
		gs, e, err := s.estateStaffExpanded(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		estate, err := s.prop.FindEstateInScope(ctx, estateID, e.EstateIDs)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if estate == nil {
			s.sendStaffProblem(w, r, staffProblems.EstateNotFound())
			return
		}
		if kind == "management_office" {
			n, err := s.prop.CountContactsOfKind(ctx, estate.EstateID, "management_office")
			if err != nil {
				s.handleManagementError(w, r, err)
				return
			}
			if n > 0 {
				s.sendStaffProblem(w, r, staffProblems.ManagementOfficeExists())
				return
			}
		}
		auth, err := s.findAuthorizingGrant(ctx, sc.OrganizationID, gs, "estate", estate.EstateID)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if auth == nil {
			s.log.Error("estate admitted by the scope filter but no grant expands to it", map[string]any{"correlationId": sc.CorrelationID, "estateId": estate.EstateID})
			s.sendStaffProblem(w, r, staffProblems.InternalError())
			return
		}
		contactID := "ctc_" + platform.NewUUID()
		at, _ := platform.ParseISO(sc.Scope.AsAt)
		_, err = platform.AuditedWrite(ctx, s.propertyDB,
			s.witnessAudit(sc, auth.GroupID, auth.Role, auth.Node.Kind, auth.Node.ID, "add_estate_contact", "estate_contact", contactID, nil, at),
			func(tx platform.DB) (bool, error) {
				return true, property.AddContact(ctx, tx, property.AddEstateContactInput{ContactID: contactID, EstateID: estate.EstateID, ContactKind: kind,
					NameEn: nameEn, NameZhHant: nameZh, Telephone: tel, HoursEn: hEn, HoursZhHant: hZh, SortOrder: sortOrder})
			}, platform.AuditOptions[bool]{Committed: func(bool) bool { return true }})
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		s.writeJSON(w, 201, obj("meta", s.managementMeta(sc), "estateId", estate.EstateID,
			"contact", obj("contactId", contactID, "contactKind", kind, "nameEn", nameEn, "nameZhHant", nameZh)))
	})
}
