package demo

import (
	"testing"
	"time"
)

func TestTicketFlow(t *testing.T) {
	s := NewTicketStore(SeedTickets())
	if len(s.ListAll()) != 3 {
		t.Fatal("seed")
	}
	tk := s.Create(CreateTicketInput{Subject: "  Leak  "})
	if tk.Subject != "Leak" || tk.Category != "general" || tk.ReporterRef != FixtureResidentID {
		t.Fatalf("create: %+v", tk)
	}
	if s.ListAll()[0].ID != tk.ID {
		t.Fatal("newest first")
	}
	if got := s.Assign(tk.ID, "stf_x", "X"); got == nil || *got.AssignedAdminLabel != "X" {
		t.Fatal("assign")
	}
	if s.SetStatus(tk.ID, "bogus", "") != nil {
		t.Fatal("bad status accepted")
	}
	got := s.SetStatus(tk.ID, "resolved", "internal note")
	if got == nil || got.Status != "resolved" {
		t.Fatal("status")
	}
	d := ToPortalDetail(*got)
	for _, e := range d.Timeline {
		if e.Kind == "note" {
			t.Fatal("internal note leaked to the resident")
		}
	}
	if c := ToContactDetail(*got, time.Now()); c.State != "closed" || c.Tone != "normal" {
		t.Fatalf("chrome: %+v", c)
	}
	// the store hands out copies
	all := s.ListAll()
	all[0].Timeline = nil
	if len(s.Get(all[0].ID).Timeline) == 0 {
		t.Fatal("store mutated through a returned value")
	}
}

func TestInvoices(t *testing.T) {
	s := NewInvoiceStore()
	h := s.HouseholdForResident(FixtureResidentID)
	sum := s.SummaryForHousehold(h)
	if sum.TotalCount != 6 || sum.Counts.Overdue != 1 || sum.Counts.Partial != 1 || sum.OutstandingBalanceHkd != 10080 {
		t.Fatalf("summary: %+v", sum)
	}
	if s.GetForHousehold("hh_other", "chg_wfg_a1_202609") != nil {
		t.Fatal("another household's invoice was readable")
	}
	if PeriodLabel("2026-09").ZhHant != "2026年9月" {
		t.Fatal("period label")
	}
}
