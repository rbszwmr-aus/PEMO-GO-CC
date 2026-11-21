package api

import (
	"context"
	"fmt"
	"time"

	"pemo/internal/access"
	"pemo/internal/platform"
)

// GenesisInputError is a malformed provisioning request.
type GenesisInputError struct{ msg string }

func (e *GenesisInputError) Error() string { return e.msg }

type GenesisInput struct {
	OrganizationID, ExternalID, DisplayName, GroupName string
	ReasonCode                                         *string
	Now                                                time.Time
	CorrelationID                                      string
}

// GenesisOutcome: provisioned | replayed (GrantID set) | refused (Reason set).
type GenesisOutcome struct{ Kind, GrantID, Reason string }

func genesisStr(v, name string, max int) error {
	if n := len([]rune(v)); n == 0 || n > max {
		return &GenesisInputError{fmt.Sprintf("%s is missing or malformed (1..%d chars).", name, max)}
	}
	return nil
}

// ProvisionOrganization creates the first principal, group, membership and
// organisation-level grant_administrator grant, once per organisation
// (idempotent on the organisation id).
func ProvisionOrganization(ctx context.Context, accessDB platform.DB, in GenesisInput) (GenesisOutcome, error) {
	for _, c := range []struct {
		v, n string
		max  int
	}{{in.OrganizationID, "organizationId", 120}, {in.ExternalID, "externalId", 200}, {in.DisplayName, "displayName", 200}, {in.GroupName, "groupName", 200}} {
		if err := genesisStr(c.v, c.n, c.max); err != nil {
			return GenesisOutcome{}, err
		}
	}
	now := in.Now
	if now.IsZero() {
		now = time.Now()
	}
	cid := in.CorrelationID
	if cid == "" {
		cid = platform.NewUUID()
	}
	const op = "provision_organization"
	key := in.OrganizationID
	grantID := platform.DeriveActID("gr", op, key)
	principalID := platform.DeriveActID("stf", op+".principal", key)
	groupID := platform.DeriveActID("grp", op+".group", key)
	membershipID := platform.DeriveActID("mem", op+".membership", key)
	reason := ""
	if in.ReasonCode != nil {
		reason = *in.ReasonCode
	}
	fp := platform.DeriveRequestFingerprint(in.OrganizationID, in.ExternalID, in.DisplayName, in.GroupName, reason)
	out, err := platform.IdempotentAuditedWrite(ctx, accessDB,
		platform.AuditRecord{Source: "provisioning", NodeKind: "organization", NodeID: in.OrganizationID, Action: op,
			TargetKind: "scope_grant", TargetID: grantID, OccurredAt: now, CorrelationID: cid, ReasonCode: in.ReasonCode},
		platform.IdempotencyKey{Operation: op, Key: key, ActKind: "scope_grant", ActID: grantID, RequestFingerprint: fp},
		func(tx platform.DB) (access.Result, error) {
			return access.Provision(ctx, tx, access.ProvisionInput{OrganizationID: in.OrganizationID, GrantID: grantID, GroupID: groupID,
				GroupDisplayName: in.GroupName, PrincipalID: principalID, ExternalID: in.ExternalID, DisplayName: in.DisplayName,
				MembershipID: membershipID, EffectiveFrom: now})
		}, platform.AuditOptions[access.Result]{Reasons: GrantReasons, Committed: committedKinds("conferred", "revoked", "provisioned")})
	if err != nil {
		return GenesisOutcome{}, err
	}
	if out.Kind == "replayed" {
		return GenesisOutcome{Kind: "replayed", GrantID: out.ActID}, nil
	}
	if out.Result.Kind != "provisioned" {
		return GenesisOutcome{Kind: "refused", Reason: out.Result.Kind}, nil
	}
	return GenesisOutcome{Kind: "provisioned", GrantID: grantID}, nil
}
