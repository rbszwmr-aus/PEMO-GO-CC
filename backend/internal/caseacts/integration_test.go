package caseacts

import (
	"context"
	"os"
	"testing"
	"time"

	"pemo/internal/access"
	"pemo/internal/helpdesk"
	"pemo/internal/platform"
)

// Runs against a bootstrapped, seeded database when PEMO_TEST_DB=1 and the
// usual PEMO_DB_* variables are set (see tests/go/run-all.sh). The helpdesk
// acts run on the helpdesk MODULE LOGIN, so the test also proves the grants:
// ticket writes, the service_case definer commands and the in-transaction
// audit row all work without owner rights.
func TestCaseActsAgainstDatabase(t *testing.T) {
	if os.Getenv("PEMO_TEST_DB") != "1" {
		t.Skip("set PEMO_TEST_DB=1 with a seeded database to run")
	}
	ctx := context.Background()
	cfg, err := platform.LoadConfig()
	if err != nil {
		t.Fatal(err)
	}
	helpdeskDB, err := platform.NewModuleDB(ctx, "helpdesk", cfg.ModuleDatabases["helpdesk"], cfg.DBPool)
	if err != nil {
		t.Fatal(err)
	}
	defer helpdeskDB.Close()
	// service_case has no login of its own: the helpdesk login reads it and
	// appends through the definer commands.
	caseDB, err := platform.NewModuleDB(ctx, "service_case", cfg.ModuleDatabases["helpdesk"], cfg.DBPool)
	if err != nil {
		t.Fatal(err)
	}
	defer caseDB.Close()
	owner, err := platform.NewAdminDB(ctx, cfg.DatabaseOwner, cfg.DBPool)
	if err != nil {
		t.Fatal(err)
	}
	defer owner.Close()
	const org, unit = "org_wingfu_holdings", "unit_wfg_a_12_a1"
	acts := New(Deps{HelpdeskDB: helpdeskDB, CaseDB: caseDB, PlatformDB: owner,
		ServingScopeNodes: func(context.Context, string, string) ([]string, error) { return nil, nil },
		MayReport:         func(context.Context, string, string, helpdesk.ReportTarget) (bool, error) { return true, nil },
		OwnerCovers:       func(context.Context, string, string, []string) (bool, error) { return true, nil },
		TicketsOfCase: func(ctx context.Context, o, c string) ([]string, error) {
			ts, err := helpdesk.New(helpdeskDB).TicketsForCase(ctx, o, c)
			ids := make([]string, len(ts))
			for i, t := range ts {
				ids[i] = t.TicketID
			}
			return ids, err
		}})
	actor := StaffActor{OrganizationID: org, PrincipalID: "stf_wfg_manager", CorrelationID: platform.NewUUID(), Now: time.Now()}
	actor.Witness.GroupID, actor.Witness.Role, actor.Witness.NodeKind, actor.Witness.NodeID = "grp_of_one_stf_wfg_manager", "estate_staff", "estate", "est_wing_fu_garden"
	scope := &access.RoleScope{Role: "estate_staff", NodeKeys: []string{"unit:" + unit}}
	outside := &access.RoleScope{Role: "estate_staff", NodeKeys: []string{"unit:unit_elsewhere"}}
	u := unit
	key := "go-it-" + platform.NewUUID()

	if r, _ := acts.SubmitByStaff(ctx, TicketIntake{ClientKey: key, Channel: "phone", Category: "plumbing", Description: "drip", UnitID: &u}, actor, outside); r.Kind != "out-of-scope" {
		t.Fatalf("outside scope: %+v", r)
	}
	if r, _ := acts.SubmitByStaff(ctx, TicketIntake{ClientKey: key, Channel: "pigeon", Category: "x", Description: "x", UnitID: &u}, actor, scope); r.Kind != "invalid-channel" {
		t.Fatalf("channel: %+v", r)
	}
	tk, err := acts.SubmitByStaff(ctx, TicketIntake{ClientKey: key, Channel: "phone", Category: "plumbing", Description: "drip", UnitID: &u}, actor, scope)
	if err != nil || tk.Kind != "ok" || tk.DisplayRef == "" {
		t.Fatalf("submit: %+v %v", tk, err)
	}
	again, err := acts.SubmitByStaff(ctx, TicketIntake{ClientKey: key, Channel: "phone", Category: "plumbing", Description: "drip", UnitID: &u}, actor, scope)
	if err != nil || again.TicketID != tk.TicketID {
		t.Fatalf("replay: %+v %v", again, err)
	}
	if r, _ := acts.TriageTicket(ctx, tk.TicketID, 9, TriageInput{TicketType: "repair", Priority: "normal", Queue: "estate"}, actor, scope); r.Kind != "stale-state" {
		t.Fatalf("stale: %+v", r)
	}
	tr, err := acts.TriageTicket(ctx, tk.TicketID, 1, TriageInput{TicketType: "repair", Priority: "normal", Queue: "estate"}, actor, scope)
	if err != nil || tr.Kind != "ok" || tr.Version != 2 {
		t.Fatalf("triage: %+v %v", tr, err)
	}
	cs, err := acts.OpenCaseFromTicket(ctx, tk.TicketID, actor, scope)
	if err != nil || cs.Kind != "ok" {
		t.Fatalf("open case: %+v %v", cs, err)
	}
	if again, _ := acts.OpenCaseFromTicket(ctx, tk.TicketID, actor, scope); again.CaseID != cs.CaseID {
		t.Fatal("a ticket opens one case")
	}
	as, err := acts.AssignCase(ctx, cs.CaseID, 1, "stf_wfg_block_a", actor, scope)
	if err != nil || as.Kind != "ok" {
		t.Fatalf("assign: %+v %v", as, err)
	}
	if r, _ := acts.CloseCase(ctx, cs.CaseID, as.Version, "work_completed", actor, scope); r.Kind != "case-not-closable" {
		t.Fatalf("close from assigned: %+v", r)
	}
	// The two acts that write service_case tables directly (note, external link)
	// must work on the helpdesk login (review finding 6).
	if note, err := acts.AddCaseNote(ctx, cs.CaseID, NoteInput{ClientKey: "n1", Body: "Called the contractor."}, actor, scope); err != nil || note.Kind != "ok" {
		t.Fatalf("case note: %+v %v", note, err)
	}
	aw, err := acts.SetCaseStatus(ctx, cs.CaseID, as.Version, "awaiting_external", &ExternalLink{ExternalSystem: "cmms", ExternalRef: "WO-" + key}, actor, scope)
	if err != nil || aw.Kind != "ok" {
		t.Fatalf("awaiting external with link: %+v %v", aw, err)
	}
	ip, err := acts.RecordExternalCompletion(ctx, cs.CaseID, aw.Version, "contractor done", actor, scope)
	if err != nil || ip.Kind != "ok" {
		t.Fatalf("external completion: %+v %v", ip, err)
	}
	if r, _ := acts.ResolveTicketFromCase(ctx, cs.CaseID, ip.Version, "not_a_code", "done", actor, scope); r.Kind != "invalid-reason" {
		t.Fatalf("reason: %+v", r)
	}
	rs, err := acts.ResolveTicketFromCase(ctx, cs.CaseID, ip.Version, "work_completed", "Fixed, thank you.", actor, scope)
	if err != nil || rs.Kind != "ok" || len(rs.Tickets) != 1 {
		t.Fatalf("resolve from case: %+v %v", rs, err)
	}
	// Every committed staff act left exactly one audit row; refusals left none.
	row, err := owner.QueryOne(ctx, `SELECT count(*)::int AS n FROM access.audit_event WHERE correlation_id = $1`, actor.CorrelationID)
	if err != nil {
		t.Fatal(err)
	}
	if n := row.Int("n"); n != 8 { // submit, triage, open, assign, note, set status, external completion, resolve
		t.Fatalf("audit rows: %d", n)
	}
}
