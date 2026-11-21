package caseacts

import (
	"context"
	"testing"

	"pemo/internal/access"
)

func TestTransitions(t *testing.T) {
	if !TicketMayMove("open", "triaged") || TicketMayMove("closed", "open") || TicketMayMove("open", "closed") {
		t.Fatal("ticket transitions")
	}
	if !CaseMayMove("assigned", "awaiting_external") || CaseMayMove("closed", "in_progress") {
		t.Fatal("case transitions")
	}
}

func TestRegistryVerdicts(t *testing.T) {
	ctx := context.Background()
	scope := &access.RoleScope{Role: "estate_staff", NodeKeys: []string{"building:blk_a", "unit:u1"}}
	caller := access.CallerScopes{"estate_staff": scope}
	v, _ := Registry.CanPerform(ctx, "triageTicket", access.ActTarget{Kind: "ticket", Subject: TicketSubject{State: "open", NodeKeys: []string{"unit:u1"}}}, caller)
	if v != "" {
		t.Fatalf("covered ticket refused: %s", v)
	}
	v, _ = Registry.CanPerform(ctx, "triageTicket", access.ActTarget{Kind: "ticket", Subject: TicketSubject{State: "open", NodeKeys: []string{"unit:u9"}}}, caller)
	if v != "out-of-scope" {
		t.Fatalf("uncovered ticket: %s", v)
	}
	v, _ = Registry.CanPerform(ctx, "reopenTicket", access.ActTarget{Kind: "ticket", Subject: TicketSubject{State: "open", NodeKeys: []string{"unit:u1"}}}, caller)
	if v != "ticket-not-closed" {
		t.Fatalf("reopen open ticket: %s", v)
	}
	v, _ = Registry.CanPerform(ctx, "closeCase", access.ActTarget{Kind: "case", Subject: CaseSubject{State: "assigned", NodeKeys: []string{"unit:u1"}}}, caller)
	if v != "case-not-closable" {
		t.Fatalf("close an assigned case: %s", v)
	}
	if _, err := Registry.CanPerform(ctx, "noSuchAct", access.ActTarget{Kind: "case"}, caller); err == nil {
		t.Fatal("an unregistered act must be an error")
	}
}

func TestReasonRegistryCoversEveryAct(t *testing.T) {
	for act := range Stances {
		if _, ok := Reasons[act]; !ok {
			t.Fatalf("%s has a stance but no reason entry", act)
		}
	}
	if !hasCode(CloseCase, "work_completed") || hasCode(CloseCase, "fixed") {
		t.Fatal("close codes")
	}
}
