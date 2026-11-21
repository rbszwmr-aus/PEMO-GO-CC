package api

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"pemo/internal/caseacts"
	"pemo/internal/helpdesk"
	"pemo/internal/notices"
	"pemo/internal/platform"
)

// The Node build PROJECTED these vocabularies into TypeScript with
// generate-*.mjs and failed `--check` on drift. The Go build keeps them as Go
// literals and this test is the drift check: the contract JSON stays the one
// source of truth.

func contractFile(t *testing.T, name string, v any) {
	t.Helper()
	root, err := platform.FindRepoRoot(".")
	if err != nil {
		t.Skip("repository root not found")
	}
	b, err := os.ReadFile(filepath.Join(root, "packages", "api-contracts", name))
	if err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(b, v); err != nil {
		t.Fatal(err)
	}
}

func sameSet(t *testing.T, what string, got, want []string) {
	t.Helper()
	g, w := slices.Clone(got), slices.Clone(want)
	slices.Sort(g)
	slices.Sort(w)
	if !slices.Equal(g, w) {
		t.Errorf("%s drifted from the contract:\n  go:       %v\n  contract: %v", what, g, w)
	}
}

func TestNoticeReasonsMatchContract(t *testing.T) {
	var f struct {
		Acts map[string]struct {
			Required bool     `json:"required"`
			Codes    []string `json:"codes"`
		} `json:"acts"`
	}
	contractFile(t, "notice-reasons.json", &f)
	for act, want := range f.Acts {
		got, ok := NoticeReasons[act]
		if !ok {
			t.Errorf("%s missing from NoticeReasons", act)
			continue
		}
		sameSet(t, act, got.Codes, want.Codes)
		if got.Required != want.Required {
			t.Errorf("%s required: go %v, contract %v", act, got.Required, want.Required)
		}
	}
}

func TestNoticeTypesMatchContract(t *testing.T) {
	var f struct {
		Types map[string]any `json:"types"`
	}
	contractFile(t, "notice-types.json", &f)
	var want []string
	for k := range f.Types {
		want = append(want, k)
	}
	sameSet(t, "notice types", notices.NoticeTypes, want)
}

func TestCaseVocabulariesMatchContract(t *testing.T) {
	var f struct {
		Vocabularies map[string]struct {
			Values []string `json:"values"`
		} `json:"vocabularies"`
	}
	contractFile(t, "case-vocabularies.json", &f)
	goVocab := map[string][]string{
		"ticket_channel": helpdesk.TicketChannel, "ticket_disposition": helpdesk.TicketDisposition,
		"ticket_message_visibility": helpdesk.TicketMessageVisibility, "ticket_status": helpdesk.TicketStatus,
		"ticket_closure_reason": helpdesk.TicketClosureReason, "ticket_reopen_reason": helpdesk.TicketReopenReason,
		"case_state": helpdesk.CaseState, "case_disposition": helpdesk.CaseDisposition,
		"case_closure_reason": helpdesk.CaseClosureReason, "case_reopen_reason": helpdesk.CaseReopenReason,
	}
	for name, v := range f.Vocabularies {
		got, ok := goVocab[name]
		if !ok {
			t.Errorf("vocabulary %s has no Go counterpart", name)
			continue
		}
		sameSet(t, name, got, v.Values)
	}
	// The act layer's reason registry must use the same codes.
	sameSet(t, "close_case reasons", caseacts.Reasons[caseacts.CloseCase].Codes, f.Vocabularies["case_closure_reason"].Values)
	sameSet(t, "reopen_case reasons", caseacts.Reasons[caseacts.ReopenCase].Codes, f.Vocabularies["case_reopen_reason"].Values)
	sameSet(t, "set_ticket_status reasons", caseacts.Reasons[caseacts.SetTicketStatus].Codes, f.Vocabularies["ticket_closure_reason"].Values)
	sameSet(t, "reopen_ticket reasons", caseacts.Reasons[caseacts.ReopenTicket].Codes, f.Vocabularies["ticket_reopen_reason"].Values)
}
