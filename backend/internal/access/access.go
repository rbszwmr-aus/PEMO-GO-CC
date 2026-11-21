// Package access is staff identity and authority: principals, groups, scope
// grants on hierarchy nodes, memberships and the audit log (ADR-010/012).
package access

import (
	"context"
	"fmt"
	"slices"
	"sort"
	"time"

	"pemo/internal/platform"
)

// ScopeNodeKinds are the nodes a grant can be made on.
var ScopeNodeKinds = []string{"organization", "portfolio", "estate", "phase", "building", "floor", "unit", "location"}

// ScopeRoles are the roles a grant confers.
var ScopeRoles = []string{"estate_staff", "approver", "integration_support", "grant_administrator", "resident"}

// ScopeNode is a node of the access hierarchy.
type ScopeNode struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}

// Key is "kind:id".
func (n ScopeNode) Key() string { return n.Kind + ":" + n.ID }

// ScopeGrant is one live grant held through a group.
type ScopeGrant struct {
	GrantID       string    `json:"grantId"`
	GroupID       string    `json:"groupId"`
	Role          string    `json:"role"`
	Node          ScopeNode `json:"node"`
	EffectiveFrom string    `json:"effectiveFrom"`
	EffectiveTo   *string   `json:"effectiveTo"`
}

// ResolvedScope is a principal's grants as at an instant.
type ResolvedScope struct {
	PrincipalID    string       `json:"principalId"`
	OrganizationID string       `json:"organizationId"`
	AsAt           string       `json:"asAt"`
	Grants         []ScopeGrant `json:"grants"`
}

// Access is the module facade.
type Access struct{ DB platform.DB }

// New binds the module to its pool.
func New(db platform.DB) *Access { return &Access{DB: db} }

// StaffPrincipal is a staff identity.
type StaffPrincipal struct{ PrincipalID, OrganizationID, DisplayName string }

// FindPrincipal reads one staff principal.
func (a *Access) FindPrincipal(ctx context.Context, id string) (*StaffPrincipal, error) {
	r, err := a.DB.QueryOne(ctx, `SELECT principal_id, organization_id, display_name FROM staff_principal WHERE principal_id = $1`, id)
	if err != nil || r == nil {
		return nil, err
	}
	return &StaffPrincipal{r.Str("principal_id"), r.Str("organization_id"), r.Str("display_name")}, nil
}

var (
	currentGrantForPrincipal = platform.LatestAssertionSQL(platform.LatestAssertionQuery{Table: "scope_grant", InstanceKey: "grant_id",
		Columns: []string{"grant_id", "group_id", "role", "node_kind", "node_id", "effective_from", "effective_to"},
		Filter:  "group_id IN (SELECT group_id FROM group_membership WHERE principal_id = $1)"})
	currentMembershipForPrincipal = platform.LatestAssertionSQL(platform.LatestAssertionQuery{Table: "group_membership", InstanceKey: "membership_id",
		Columns: []string{"membership_id", "group_id", "principal_id", "effective_from", "effective_to"}, Filter: "principal_id = $1"})
)

// FindGrantsAsAt resolves a principal's live grants at asAt (grant AND
// membership both live).
func (a *Access) FindGrantsAsAt(ctx context.Context, principalID string, asAt time.Time) ([]ScopeGrant, error) {
	rows, err := a.DB.Query(ctx, `WITH current_grant AS (`+currentGrantForPrincipal+`), current_membership AS (`+currentMembershipForPrincipal+`)
     SELECT DISTINCT g.grant_id, g.group_id, g.role, g.node_kind, g.node_id, g.effective_from, g.effective_to
       FROM current_grant g JOIN current_membership m ON m.group_id = g.group_id
      WHERE m.principal_id = $1
        AND (g.effective_from <= $2 AND (g.effective_to IS NULL OR g.effective_to > $2))
        AND (m.effective_from <= $2 AND (m.effective_to IS NULL OR m.effective_to > $2))
      ORDER BY g.node_kind, g.node_id`, principalID, asAt)
	if err != nil {
		return nil, err
	}
	out := make([]ScopeGrant, 0, len(rows))
	for _, r := range rows {
		var to *string
		if t := r.TimePtr("effective_to"); t != nil {
			s := platform.ISO(*t)
			to = &s
		}
		out = append(out, ScopeGrant{GrantID: r.Str("grant_id"), GroupID: r.Str("group_id"), Role: r.Str("role"),
			Node: ScopeNode{r.Str("node_kind"), r.Str("node_id")}, EffectiveFrom: platform.ISO(r.Time("effective_from")), EffectiveTo: to})
	}
	return out, nil
}

// GetPrincipal resolves the principal's scope as at now.
func (a *Access) GetPrincipal(ctx context.Context, id string) (*ResolvedScope, error) {
	return a.ResolveAsAt(ctx, id, time.Now())
}

// ResolveAsAt resolves the principal's scope as at asAt.
func (a *Access) ResolveAsAt(ctx context.Context, id string, asAt time.Time) (*ResolvedScope, error) {
	p, err := a.FindPrincipal(ctx, id)
	if err != nil || p == nil {
		return nil, err
	}
	g, err := a.FindGrantsAsAt(ctx, id, asAt)
	if err != nil {
		return nil, err
	}
	return &ResolvedScope{p.PrincipalID, p.OrganizationID, platform.ISO(asAt), g}, nil
}

// Admission says whether, and how, a scope admits a target.
type Admission struct {
	Admitted bool
	By       string // hierarchy | location | unassigned
}

// Admits checks the target and its ancestry against the grants.
func Admits(s *ResolvedScope, target ScopeNode, ancestry []ScopeNode) Admission {
	for _, g := range s.Grants {
		match := g.Node == target || slices.Contains(ancestry, g.Node)
		if !match {
			continue
		}
		if g.Node.Kind == "location" {
			return Admission{true, "location"}
		}
		return Admission{true, "hierarchy"}
	}
	return Admission{}
}

// AdmitsUnassigned admits an unplaced record of the caller's own organisation.
func AdmitsUnassigned(s *ResolvedScope, owningOrg string) Admission {
	if s.OrganizationID != owningOrg || len(s.Grants) == 0 {
		return Admission{}
	}
	return Admission{true, "unassigned"}
}

// ---- role scopes ----

// RoleScope is the expanded node set one role reaches. The membership set is
// built once per scope (O(1) coverage checks).
type RoleScope struct {
	Role     string
	NodeKeys []string
	set      map[string]bool
}

// NewRoleScope expands the grants of role through expand.
func NewRoleScope(ctx context.Context, role string, grants []ScopeGrant, expand func(context.Context, []ScopeNode) ([]string, error)) (*RoleScope, error) {
	var held []ScopeNode
	for _, g := range grants {
		if g.Role == role {
			held = append(held, g.Node)
		}
	}
	keys, err := expand(ctx, held)
	if err != nil {
		return nil, err
	}
	if keys == nil {
		keys = []string{}
	}
	return &RoleScope{Role: role, NodeKeys: keys}, nil
}

// NoRoleScope is the empty scope of role.
func NoRoleScope(role string) *RoleScope { return &RoleScope{Role: role, NodeKeys: []string{}} }

func (r *RoleScope) members() map[string]bool {
	if r.set == nil {
		r.set = make(map[string]bool, len(r.NodeKeys))
		for _, k := range r.NodeKeys {
			r.set[k] = true
		}
	}
	return r.set
}

// Covers reports whether nodeKey is in scope.
func (r *RoleScope) Covers(nodeKey string) bool { return r != nil && r.members()[nodeKey] }

// Uncovered returns the required keys outside the scope.
func (r *RoleScope) Uncovered(required []string) []string {
	out := []string{}
	m := map[string]bool{}
	if r != nil {
		m = r.members()
	}
	for _, k := range required {
		if !m[k] {
			out = append(out, k)
		}
	}
	return out
}

// CallerScopes is the role scopes a caller holds.
type CallerScopes map[string]*RoleScope

// ---- act registry ----

// ActTarget is what an act is judged against.
type ActTarget struct {
	Kind    string // notice | node | ticket | case
	Subject any
	NodeKey string
}

// ActRegistration judges one operation.
type ActRegistration struct {
	OperationID string
	TargetKind  string
	Evaluate    func(ctx context.Context, target ActTarget, caller CallerScopes) (string, error)
}

// ActRegistry holds exactly one verdict path per act.
type ActRegistry struct{ regs map[string]ActRegistration }

// NewActRegistry is empty.
func NewActRegistry() *ActRegistry { return &ActRegistry{regs: map[string]ActRegistration{}} }

// Register adds a registration; a duplicate is a programming error.
func (a *ActRegistry) Register(r ActRegistration) {
	if _, dup := a.regs[r.OperationID]; dup {
		panic(r.OperationID + " is registered twice — two verdict paths for one act")
	}
	a.regs[r.OperationID] = r
}

// CanPerform returns "" when permitted, else the refusal reason.
func (a *ActRegistry) CanPerform(ctx context.Context, op string, t ActTarget, c CallerScopes) (string, error) {
	r, ok := a.regs[op]
	if !ok {
		return "", fmt.Errorf("%s has no registration — nothing can judge it", op)
	}
	if r.TargetKind != t.Kind {
		return "", fmt.Errorf("%s is judged against a %s, not a %s", op, r.TargetKind, t.Kind)
	}
	return r.Evaluate(ctx, t, c)
}

// Permitted lists, sorted, every act the caller may perform on t.
func (a *ActRegistry) Permitted(ctx context.Context, t ActTarget, c CallerScopes) ([]string, error) {
	out := []string{}
	for _, r := range a.regs {
		if r.TargetKind != t.Kind {
			continue
		}
		v, err := r.Evaluate(ctx, t, c)
		if err != nil {
			return nil, err
		}
		if v == "" {
			out = append(out, r.OperationID)
		}
	}
	sort.Strings(out)
	return out, nil
}

// ActOperationIDs is every act a principal can perform.
var ActOperationIDs = []string{"addCaseNote", "addEstateContact", "addMembership", "approveNotice", "assignCase", "closeCase",
	"composeNotice", "conferGrant", "correctNotice", "declineNotice", "endOccupancy", "linkRelatedTicket",
	"openCaseFromTicket", "postTicketMessage", "provisionOrganization", "publishManagementUpdate", "publishNotice",
	"recordExternalCompletion", "recordOccupancy", "recordSatisfaction", "registerPrincipal", "removeMembership",
	"reopenCase", "reopenTicket", "resolveTicketFromCase", "reviseNotice", "revokeGrant", "setCaseStatus",
	"setTicketStatus", "submitNotice", "submitTicket", "triageTicket", "withdrawNotice"}

// AllRefusalKinds is every refusal the access commands return.
var AllRefusalKinds = []string{"out-of-scope", "conflict", "not-live", "no-such-grant", "already-provisioned",
	"last-administrator", "no-such-membership", "out-of-reach", "not-an-administrator", "already-recorded"}

// ---- administrators ----

// AdministratorWitness is one live grant_administrator path to a principal.
type AdministratorWitness struct{ PrincipalID, GrantID, GroupIDOfGrant, MembershipID string }

const effectiveAdministratorsSQL = `
  WITH current_grant AS (
    SELECT DISTINCT ON (g.grant_id) g.*, ug.organization_id
      FROM scope_grant g JOIN user_group ug ON ug.group_id = g.group_id
     WHERE ug.organization_id = $1 ORDER BY g.grant_id, g.version DESC
  ), live_admin_grant AS (
    SELECT * FROM current_grant WHERE role = 'grant_administrator'
       AND effective_from <= clock_timestamp() AND (effective_to IS NULL OR effective_to > clock_timestamp())
  ), current_membership AS (
    SELECT DISTINCT ON (membership_id) * FROM group_membership
     WHERE group_id IN (SELECT group_id FROM live_admin_grant) ORDER BY membership_id, version DESC
  ), live_membership AS (
    SELECT * FROM current_membership
     WHERE effective_from <= clock_timestamp() AND (effective_to IS NULL OR effective_to > clock_timestamp())
  )
  SELECT m.principal_id, g.grant_id, g.group_id, m.membership_id
    FROM live_admin_grant g JOIN live_membership m ON m.group_id = g.group_id`

// EffectiveAdministrators lists every live administrator path in the org.
func EffectiveAdministrators(ctx context.Context, db platform.DB, orgID string) ([]AdministratorWitness, error) {
	rows, err := db.Query(ctx, effectiveAdministratorsSQL, orgID)
	if err != nil {
		return nil, err
	}
	out := make([]AdministratorWitness, 0, len(rows))
	for _, r := range rows {
		out = append(out, AdministratorWitness{r.Str("principal_id"), r.Str("grant_id"), r.Str("group_id"), r.Str("membership_id")})
	}
	return out, nil
}

// WouldRemoveLastAdministrator: removing the grant or membership leaves none.
func WouldRemoveLastAdministrator(ws []AdministratorWitness, grantID, membershipID string) bool {
	if len(ws) == 0 {
		return false
	}
	for _, w := range ws {
		if grantID != "" && w.GrantID != grantID {
			return false
		}
		if membershipID != "" && w.MembershipID != membershipID {
			return false
		}
	}
	return true
}

func requireReadCommitted(ctx context.Context, tx platform.DB, what string) error {
	r, err := tx.QueryOne(ctx, "SHOW transaction_isolation")
	if err != nil {
		return err
	}
	if r == nil || r.Str("transaction_isolation") != "read committed" {
		return fmt.Errorf("%s requires READ COMMITTED and this transaction is %s; refusing rather than guarding nothing", what, r.Str("transaction_isolation"))
	}
	return nil
}

// LockOrganization serialises administrator-floor checks per organisation.
func LockOrganization(ctx context.Context, tx platform.DB, orgID string) error {
	if err := requireReadCommitted(ctx, tx, "the administrator guard"); err != nil {
		return err
	}
	return tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, orgID)
}

// AdministrationFloorResult explains a group-administration decision.
type AdministrationFloorResult struct {
	Admitted              bool
	RequiredNodes         []string
	UncoveredNodes        []string
	ViaEmptyGroupFallback bool
}

// MayAdministerGroup: the caller must cover every node the group's live
// grants reach; an empty group needs the organisation node.
func MayAdministerGroup(ctx context.Context, tx platform.DB, groupID, orgID string, caller *RoleScope) (AdministrationFloorResult, error) {
	rows, err := tx.Query(ctx, `WITH current_assertion AS (
    SELECT DISTINCT ON (grant_id) grant_id, group_id, role, node_kind, node_id, effective_from, effective_to, version
      FROM scope_grant WHERE group_id = $1 ORDER BY grant_id, version DESC)
  SELECT DISTINCT node_kind, node_id FROM current_assertion
   WHERE effective_from <= clock_timestamp() AND (effective_to IS NULL OR effective_to > clock_timestamp())`, groupID)
	if err != nil {
		return AdministrationFloorResult{}, err
	}
	var required []string
	for _, r := range rows {
		required = append(required, r.Str("node_kind")+":"+r.Str("node_id"))
	}
	if len(required) == 0 {
		org := "organization:" + orgID
		ok := caller.Covers(org)
		unc := []string{}
		if !ok {
			unc = []string{org}
		}
		return AdministrationFloorResult{ok, []string{org}, unc, true}, nil
	}
	unc := caller.Uncovered(required)
	return AdministrationFloorResult{len(unc) == 0, required, unc, false}, nil
}

// IsEffectiveAdministratorAt: covered node AND a live administrator path.
func IsEffectiveAdministratorAt(ctx context.Context, tx platform.DB, orgID, principalID string, caller *RoleScope, nodeKey string) (bool, error) {
	if !caller.Covers(nodeKey) {
		return false, nil
	}
	ws, err := EffectiveAdministrators(ctx, tx, orgID)
	if err != nil {
		return false, err
	}
	for _, w := range ws {
		if w.PrincipalID == principalID {
			return true, nil
		}
	}
	return false, nil
}
