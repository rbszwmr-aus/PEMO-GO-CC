package access

import (
	"context"
	"errors"
	"fmt"
	"time"

	"pemo/internal/platform"
)

// Result is a command outcome: a success kind with fields, or a refusal kind.
type Result struct {
	Kind         string
	GrantID      string
	MembershipID string
	GroupID      string
	PrincipalID  string
	Version      int64
	EffectiveTo  string
	LiveGrants   int64
	LiveMembers  int64
}

func refusal(kind string) Result { return Result{Kind: kind} }

func guardLiveGrant(ctx context.Context, tx platform.DB, groupID, role, nodeKind, nodeID string) error {
	if err := requireReadCommitted(ctx, tx, "grant guard"); err != nil {
		return err
	}
	return tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1 || E'\x1f' || $2 || E'\x1f' || $3 || E'\x1f' || $4, 0))`,
		groupID, role, nodeKind, nodeID)
}

var (
	grantCols          = []string{"grant_id", "group_id", "role", "node_kind", "node_id", "effective_from", "effective_to"}
	currentGrantForKey = platform.LatestAssertionSQL(platform.LatestAssertionQuery{Table: "scope_grant", InstanceKey: "grant_id",
		Columns: grantCols, Filter: "group_id = $1 AND role = $2 AND node_kind = $3 AND node_id = $4"})
	currentGrantForInstance = platform.LatestAssertionSQL(platform.LatestAssertionQuery{Table: "scope_grant", InstanceKey: "grant_id",
		Columns: grantCols, Filter: "grant_id = $1"})
)

// CurrentGrant is a grant's latest assertion.
type CurrentGrant struct {
	GrantID, GroupID, Role, NodeKind, NodeID string
	Version                                  int64
	EffectiveTo                              *time.Time
}

func toCurrentGrant(r platform.Row) *CurrentGrant {
	return &CurrentGrant{r.Str("grant_id"), r.Str("group_id"), r.Str("role"), r.Str("node_kind"), r.Str("node_id"), r.Int("version"), r.TimePtr("effective_to")}
}

// FindCurrentGrant reads a grant's current assertion.
func (a *Access) FindCurrentGrant(ctx context.Context, grantID string) (*CurrentGrant, error) {
	r, err := a.DB.QueryOne(ctx, `WITH current_assertion AS (`+currentGrantForInstance+`) SELECT * FROM current_assertion`, grantID)
	if err != nil || r == nil {
		return nil, err
	}
	return toCurrentGrant(r), nil
}

// ConferGrantInput confers a grant.
type ConferGrantInput struct {
	GrantID, GroupID, Role, NodeKind, NodeID string
	EffectiveFrom                            time.Time
}

// Confer appends a new grant if the node is inside the administrator's scope
// and no live grant for the same key exists.
func Confer(ctx context.Context, tx platform.DB, in ConferGrantInput, allowed *RoleScope) (Result, error) {
	if len(allowed.NodeKeys) == 0 {
		return refusal("out-of-scope"), nil
	}
	if err := guardLiveGrant(ctx, tx, in.GroupID, in.Role, in.NodeKind, in.NodeID); err != nil {
		return Result{}, err
	}
	live, err := tx.Query(ctx, `WITH current_assertion AS (`+currentGrantForKey+`)
       SELECT grant_id FROM current_assertion WHERE effective_to IS NULL OR effective_to > clock_timestamp()`,
		in.GroupID, in.Role, in.NodeKind, in.NodeID)
	if err != nil {
		return Result{}, err
	}
	if len(live) > 0 {
		return refusal("conflict"), nil
	}
	r, err := tx.QueryOne(ctx, `INSERT INTO scope_grant
         (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
       SELECT 'sgra_' || $1::text, 1, $1, $2, $3, $4, $5, $6
        WHERE ($4::text || ':' || $5::text) = ANY($7::text[])
       RETURNING grant_id, version`, in.GrantID, in.GroupID, in.Role, in.NodeKind, in.NodeID, in.EffectiveFrom, allowed.NodeKeys)
	if err != nil {
		return Result{}, err
	}
	if r == nil {
		return refusal("out-of-scope"), nil
	}
	return Result{Kind: "conferred", GrantID: r.Str("grant_id"), Version: r.Int("version")}, nil
}

func organizationOfGroup(ctx context.Context, tx platform.DB, groupID string) (string, error) {
	r, err := tx.QueryOne(ctx, `SELECT organization_id FROM user_group WHERE group_id = $1`, groupID)
	if err != nil {
		return "", err
	}
	if r == nil {
		return "", fmt.Errorf("grant guard: group %s has no organization, which a foreign key forbids", groupID)
	}
	return r.Str("organization_id"), nil
}

// Revoke appends an ended assertion of a live grant in scope, refusing to
// remove the organisation's last administrator.
func Revoke(ctx context.Context, tx platform.DB, grantID string, effectiveTo time.Time, allowed *RoleScope) (Result, error) {
	if len(allowed.NodeKeys) == 0 {
		return refusal("out-of-scope"), nil
	}
	q := `WITH current_assertion AS (` + currentGrantForInstance + `) SELECT * FROM current_assertion WHERE (node_kind || ':' || node_id) = ANY($2::text[])`
	seen, err := tx.QueryOne(ctx, q, grantID, allowed.NodeKeys)
	if err != nil {
		return Result{}, err
	}
	if seen == nil {
		return refusal("no-such-grant"), nil
	}
	org, err := organizationOfGroup(ctx, tx, seen.Str("group_id"))
	if err != nil {
		return Result{}, err
	}
	if err := LockOrganization(ctx, tx, org); err != nil {
		return Result{}, err
	}
	if err := guardLiveGrant(ctx, tx, seen.Str("group_id"), seen.Str("role"), seen.Str("node_kind"), seen.Str("node_id")); err != nil {
		return Result{}, err
	}
	lockedRow, err := tx.QueryOne(ctx, q, grantID, allowed.NodeKeys)
	if err != nil {
		return Result{}, err
	}
	if lockedRow == nil {
		return refusal("no-such-grant"), nil
	}
	locked := toCurrentGrant(lockedRow)
	if locked.EffectiveTo != nil && !locked.EffectiveTo.After(time.Now()) {
		return refusal("not-live"), nil
	}
	if locked.Role == "grant_administrator" {
		ws, err := EffectiveAdministrators(ctx, tx, org)
		if err != nil {
			return Result{}, err
		}
		if WouldRemoveLastAdministrator(ws, grantID, "") {
			return refusal("last-administrator"), nil
		}
	}
	next := locked.Version + 1
	r, err := tx.QueryOne(ctx, `INSERT INTO scope_grant
         (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from, effective_to)
       SELECT $1, $2, grant_id, group_id, role, node_kind, node_id, effective_from, $3::timestamptz
         FROM scope_grant WHERE grant_id = $4 AND version = $5
       RETURNING version, effective_to`, fmt.Sprintf("sgra_%s_v%d", grantID, next), next, effectiveTo, grantID, locked.Version)
	if err != nil {
		return Result{}, err
	}
	if r == nil {
		return refusal("not-live"), nil
	}
	return Result{Kind: "revoked", GrantID: grantID, Version: r.Int("version"), EffectiveTo: platform.ISO(r.Time("effective_to"))}, nil
}

// ProvisionInput bootstraps an organisation's first administrator.
type ProvisionInput struct {
	OrganizationID, GrantID, GroupID, GroupDisplayName string
	PrincipalID, ExternalID, DisplayName, MembershipID string
	EffectiveFrom                                      time.Time
}

// Provision creates principal, group, org-level admin grant and membership,
// once per organisation.
func Provision(ctx context.Context, tx platform.DB, in ProvisionInput) (Result, error) {
	if err := LockOrganization(ctx, tx, in.OrganizationID); err != nil {
		return Result{}, err
	}
	never, err := tx.QueryOne(ctx, `SELECT NOT EXISTS (SELECT 1 FROM scope_grant g JOIN user_group ug ON ug.group_id = g.group_id WHERE ug.organization_id = $1) AS never_held`, in.OrganizationID)
	if err != nil {
		return Result{}, err
	}
	if never == nil || !never.Bool("never_held") {
		return refusal("already-provisioned"), nil
	}
	if err := tx.Exec(ctx, `INSERT INTO staff_principal (principal_id, organization_id, display_name, identity_source, external_id)
       VALUES ($1, $2, $3, 'external', $4)`, in.PrincipalID, in.OrganizationID, in.DisplayName, in.ExternalID); err != nil {
		return Result{}, err
	}
	if err := tx.Exec(ctx, `INSERT INTO user_group (group_id, organization_id, display_name) VALUES ($1, $2, $3)`, in.GroupID, in.OrganizationID, in.GroupDisplayName); err != nil {
		return Result{}, err
	}
	r, err := tx.QueryOne(ctx, `INSERT INTO scope_grant (assertion_id, version, grant_id, group_id, role, node_kind, node_id, effective_from)
       VALUES ('sgra_' || $1::text, 1, $1, $2, 'grant_administrator', 'organization', $3, $4) RETURNING grant_id`, in.GrantID, in.GroupID, in.OrganizationID, in.EffectiveFrom)
	if err != nil {
		return Result{}, err
	}
	if r == nil {
		return Result{}, errors.New("provision: the grant INSERT returned no row, which should be impossible")
	}
	if err := tx.Exec(ctx, `INSERT INTO group_membership (assertion_id, version, membership_id, group_id, principal_id, effective_from)
       VALUES ('gma_' || $1::text, 1, $1, $2, $3, $4)`, in.MembershipID, in.GroupID, in.PrincipalID, in.EffectiveFrom); err != nil {
		return Result{}, err
	}
	return Result{Kind: "provisioned", GrantID: r.Str("grant_id")}, nil
}

// ---- memberships ----

var (
	membershipCols           = []string{"membership_id", "group_id", "principal_id", "effective_from", "effective_to"}
	currentMembershipForPair = platform.LatestAssertionSQL(platform.LatestAssertionQuery{Table: "group_membership", InstanceKey: "membership_id",
		Columns: membershipCols, Filter: "group_id = $1 AND principal_id = $2"})
	currentMembershipForInstance = platform.LatestAssertionSQL(platform.LatestAssertionQuery{Table: "group_membership", InstanceKey: "membership_id",
		Columns: membershipCols, Filter: "membership_id = $1"})
)

func guardLiveMembership(ctx context.Context, tx platform.DB, groupID, principalID string) error {
	if err := requireReadCommitted(ctx, tx, "membership guard"); err != nil {
		return err
	}
	return tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1 || E'\x1f' || $2, 0))`, groupID, principalID)
}

// CurrentMembership is a membership's latest assertion.
type CurrentMembership struct {
	MembershipID, GroupID, PrincipalID string
	Version                            int64
	EffectiveTo                        *time.Time
}

// FindCurrentMembership reads a membership's current assertion.
func (a *Access) FindCurrentMembership(ctx context.Context, id string) (*CurrentMembership, error) {
	r, err := a.DB.QueryOne(ctx, `WITH current_assertion AS (`+currentMembershipForInstance+`) SELECT * FROM current_assertion`, id)
	if err != nil || r == nil {
		return nil, err
	}
	return &CurrentMembership{r.Str("membership_id"), r.Str("group_id"), r.Str("principal_id"), r.Int("version"), r.TimePtr("effective_to")}, nil
}

// AddMembershipInput adds a principal to a group.
type AddMembershipInput struct {
	MembershipID, GroupID, PrincipalID, OrganizationID string
	EffectiveFrom                                      time.Time
}

// AddMembership appends a membership if the caller may administer the group.
func AddMembership(ctx context.Context, tx platform.DB, in AddMembershipInput, actor *RoleScope) (Result, error) {
	if len(actor.NodeKeys) == 0 {
		return refusal("not-an-administrator"), nil
	}
	owner, err := tx.QueryOne(ctx, `SELECT organization_id FROM user_group WHERE group_id = $1`, in.GroupID)
	if err != nil {
		return Result{}, err
	}
	if owner == nil || owner.Str("organization_id") != in.OrganizationID {
		return refusal("no-such-membership"), nil
	}
	if err := guardLiveMembership(ctx, tx, in.GroupID, in.PrincipalID); err != nil {
		return Result{}, err
	}
	live, err := tx.Query(ctx, `WITH current_assertion AS (`+currentMembershipForPair+`)
       SELECT membership_id FROM current_assertion WHERE effective_to IS NULL OR effective_to > clock_timestamp()`, in.GroupID, in.PrincipalID)
	if err != nil {
		return Result{}, err
	}
	if len(live) > 0 {
		return refusal("conflict"), nil
	}
	floor, err := MayAdministerGroup(ctx, tx, in.GroupID, in.OrganizationID, actor)
	if err != nil {
		return Result{}, err
	}
	if !floor.Admitted {
		return refusal("out-of-reach"), nil
	}
	reach, err := tx.QueryOne(ctx, `WITH current_grant AS (
    SELECT DISTINCT ON (grant_id) grant_id, group_id, role, node_kind, node_id, effective_from, effective_to, version
      FROM scope_grant WHERE group_id = $1 ORDER BY grant_id, version DESC
  ), live AS (
    SELECT * FROM current_grant WHERE effective_from <= clock_timestamp() AND (effective_to IS NULL OR effective_to > clock_timestamp())
  )
  SELECT count(*) FILTER (WHERE (node_kind || ':' || node_id) <> ALL($2::text[]))::int AS unreachable,
         count(*)::int AS live_grants FROM live`, in.GroupID, actor.NodeKeys)
	if err != nil {
		return Result{}, err
	}
	r, err := tx.QueryOne(ctx, `INSERT INTO group_membership (assertion_id, version, membership_id, group_id, principal_id, effective_from)
       VALUES ('gma_' || $1::text, 1, $1, $2, $3, $4) RETURNING membership_id, version`, in.MembershipID, in.GroupID, in.PrincipalID, in.EffectiveFrom)
	if err != nil {
		return Result{}, err
	}
	if r == nil {
		return Result{}, errors.New("add: the membership INSERT returned no row, which should be impossible")
	}
	members, err := tx.QueryOne(ctx, `WITH current_assertion AS (
         SELECT DISTINCT ON (membership_id) * FROM group_membership WHERE group_id = $1 ORDER BY membership_id, version DESC)
       SELECT count(*)::int AS n FROM current_assertion
        WHERE effective_from <= clock_timestamp() AND (effective_to IS NULL OR effective_to > clock_timestamp())`, in.GroupID)
	if err != nil {
		return Result{}, err
	}
	res := Result{Kind: "added", MembershipID: r.Str("membership_id"), Version: r.Int("version")}
	if reach != nil {
		res.LiveGrants = reach.Int("live_grants")
	}
	if members != nil {
		res.LiveMembers = members.Int("n")
	}
	return res, nil
}

// RemoveMembership appends an ended membership, refusing the last admin.
func RemoveMembership(ctx context.Context, tx platform.DB, membershipID string, effectiveTo time.Time, actor *RoleScope) (Result, error) {
	q := `WITH current_assertion AS (` + currentMembershipForInstance + `) SELECT * FROM current_assertion`
	seen, err := tx.QueryOne(ctx, q, membershipID)
	if err != nil {
		return Result{}, err
	}
	if seen == nil {
		return refusal("no-such-membership"), nil
	}
	orgRow, err := tx.QueryOne(ctx, `SELECT organization_id FROM user_group WHERE group_id = $1`, seen.Str("group_id"))
	if err != nil {
		return Result{}, err
	}
	if orgRow == nil {
		return refusal("no-such-membership"), nil
	}
	org := orgRow.Str("organization_id")
	if err := LockOrganization(ctx, tx, org); err != nil {
		return Result{}, err
	}
	if err := guardLiveMembership(ctx, tx, seen.Str("group_id"), seen.Str("principal_id")); err != nil {
		return Result{}, err
	}
	locked, err := tx.QueryOne(ctx, q, membershipID)
	if err != nil {
		return Result{}, err
	}
	if locked == nil {
		return refusal("no-such-membership"), nil
	}
	if t := locked.TimePtr("effective_to"); t != nil && !t.After(time.Now()) {
		return refusal("not-live"), nil
	}
	ws, err := EffectiveAdministrators(ctx, tx, org)
	if err != nil {
		return Result{}, err
	}
	if WouldRemoveLastAdministrator(ws, "", membershipID) {
		return refusal("last-administrator"), nil
	}
	floor, err := MayAdministerGroup(ctx, tx, locked.Str("group_id"), org, actor)
	if err != nil {
		return Result{}, err
	}
	if !floor.Admitted {
		return refusal("out-of-reach"), nil
	}
	next := locked.Int("version") + 1
	r, err := tx.QueryOne(ctx, `INSERT INTO group_membership
         (assertion_id, version, membership_id, group_id, principal_id, effective_from, effective_to)
       SELECT $1, $2, membership_id, group_id, principal_id, effective_from, $3::timestamptz
         FROM group_membership WHERE membership_id = $4 AND version = $5
       RETURNING version, effective_to`, fmt.Sprintf("gma_%s_v%d", membershipID, next), next, effectiveTo, membershipID, locked.Int("version"))
	if err != nil {
		return Result{}, err
	}
	if r == nil {
		return refusal("not-live"), nil
	}
	return Result{Kind: "removed", MembershipID: membershipID, GroupID: locked.Str("group_id"), PrincipalID: locked.Str("principal_id"),
		Version: r.Int("version"), EffectiveTo: platform.ISO(r.Time("effective_to"))}, nil
}

// ---- principals ----

// RecordedPrincipal is a principal as recorded.
type RecordedPrincipal struct {
	PrincipalID, OrganizationID, DisplayName, IdentitySource string
	ExternalID                                               *string
}

// FindPrincipalByExternalID looks a principal up by its IdP subject.
func (a *Access) FindPrincipalByExternalID(ctx context.Context, orgID, externalID string) (*RecordedPrincipal, error) {
	return findByExternal(ctx, a.DB, orgID, externalID)
}

func findByExternal(ctx context.Context, db platform.DB, orgID, externalID string) (*RecordedPrincipal, error) {
	r, err := db.QueryOne(ctx, `SELECT principal_id, organization_id, display_name, identity_source, external_id
         FROM staff_principal WHERE organization_id = $1 AND external_id = $2`, orgID, externalID)
	if err != nil || r == nil {
		return nil, err
	}
	return &RecordedPrincipal{r.Str("principal_id"), r.Str("organization_id"), r.Str("display_name"), r.Str("identity_source"), r.StrPtr("external_id")}, nil
}

// RegisterPrincipalInput records an IdP-backed principal.
type RegisterPrincipalInput struct{ PrincipalID, OrganizationID, ExternalID, DisplayName string }

// RegisterPrincipal records the principal once per (org, external id).
func RegisterPrincipal(ctx context.Context, tx platform.DB, in RegisterPrincipalInput) (Result, error) {
	seen, err := findByExternal(ctx, tx, in.OrganizationID, in.ExternalID)
	if err != nil {
		return Result{}, err
	}
	if seen != nil {
		return refusal("already-recorded"), nil
	}
	r, err := tx.QueryOne(ctx, `INSERT INTO staff_principal (principal_id, organization_id, display_name, identity_source, external_id)
       VALUES ($1, $2, $3, 'external', $4) RETURNING principal_id`, in.PrincipalID, in.OrganizationID, in.DisplayName, in.ExternalID)
	if err != nil {
		return Result{}, err
	}
	if r == nil {
		return Result{}, errors.New("register: the principal INSERT returned no row, which should be impossible")
	}
	return Result{Kind: "registered", PrincipalID: r.Str("principal_id")}, nil
}
