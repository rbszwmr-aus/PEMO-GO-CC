package demo

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

const (
	FixtureHouseholdID = "hh_wfg_a_12_a1"
	FixtureUnitID      = "unit_wfg_a_12_a1"
	DemoAsOf           = "2026-09-25"
)

var InvoiceStatuses = []string{"UNPAID", "PARTIAL", "PAID", "OVERDUE"}

func IsInvoiceStatus(v string) bool {
	for _, s := range InvoiceStatuses {
		if s == v {
			return true
		}
	}
	return false
}

type InvoiceLineItem struct {
	Description   LocalizedText `json:"description"`
	ChargeType    string        `json:"chargeType"`
	Quantity      int           `json:"quantity"`
	UnitAmountHkd int           `json:"unitAmountHkd"`
	AmountHkd     int           `json:"amountHkd"`
}

type InvoicePayment struct {
	PaymentID string `json:"paymentId"`
	PaidAt    string `json:"paidAt"`
	Method    string `json:"method"`
	AmountHkd int    `json:"amountHkd"`
	Reference string `json:"reference"`
}

type InvoiceRow struct {
	InvoiceID     string        `json:"invoiceId"`
	InvoiceNumber string        `json:"invoiceNumber"`
	HouseholdID   string        `json:"householdId"`
	UnitID        string        `json:"unitId"`
	UnitLabel     LocalizedText `json:"unitLabel"`
	Period        string        `json:"period"`
	PeriodLabel   LocalizedText `json:"periodLabel"`
	Title         LocalizedText `json:"title"`
	IssueDate     string        `json:"issueDate"`
	DueDate       string        `json:"dueDate"`
	Status        string        `json:"status"`
	Currency      string        `json:"currency"`
	AmountHkd     int           `json:"amountHkd"`
	PaidHkd       int           `json:"paidHkd"`
	BalanceHkd    int           `json:"balanceHkd"`
}

type InvoiceDetail struct {
	InvoiceRow
	LineItems       []InvoiceLineItem `json:"lineItems"`
	PaymentsApplied []InvoicePayment  `json:"paymentsApplied"`
	PdfURL          *string           `json:"pdfUrl"`
}

type InvoiceSummary struct {
	HouseholdID           *string       `json:"householdId"`
	Currency              string        `json:"currency"`
	AsOf                  string        `json:"asOf"`
	Counts                InvoiceCounts `json:"counts"`
	TotalCount            int           `json:"totalCount"`
	OutstandingBalanceHkd int           `json:"outstandingBalanceHkd"`
	OverdueBalanceHkd     int           `json:"overdueBalanceHkd"`
}

type InvoiceCounts struct {
	Unpaid  int `json:"UNPAID"`
	Partial int `json:"PARTIAL"`
	Paid    int `json:"PAID"`
	Overdue int `json:"OVERDUE"`
}

func DeriveInvoiceStatus(amount, paid int, dueDate, asOf string) string {
	switch {
	case amount-paid <= 0:
		return "PAID"
	case dueDate < asOf:
		return "OVERDUE"
	case paid > 0:
		return "PARTIAL"
	}
	return "UNPAID"
}

var monthsEn = []string{"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}

func PeriodLabel(period string) LocalizedText {
	parts := strings.SplitN(period, "-", 2)
	y, m := parts[0], ""
	if len(parts) > 1 {
		m = parts[1]
	}
	n, _ := strconv.Atoi(m)
	en := m
	if n >= 1 && n <= 12 {
		en = monthsEn[n-1]
	}
	return lt(en+" "+y, fmt.Sprintf("%s年%d月", y, n))
}

func SeedInvoices(asOf string) []InvoiceDetail {
	unit := lt("Block A · 12/F · Flat A1", "A座 12樓 A1室")
	fee := lt("Monthly management fee", "每月管理費")
	line := func(d LocalizedText, t string, q, u int) InvoiceLineItem { return InvoiceLineItem{d, t, q, u, q * u} }
	type seed struct {
		id, num, period string
		title           LocalizedText
		issue, due      string
		lines           []InvoiceLineItem
		pays            []InvoicePayment
	}
	rows := []seed{
		{"chg_wfg_a1_202609", "INV-WFG-A1-202609", "2026-09", fee, "2026-09-01", "2026-09-30", []InvoiceLineItem{line(fee, "management_fee", 1, 3280)}, nil},
		{"chg_wfg_a1_202609_cp", "INV-WFG-A1-202609-CP", "2026-09", lt("Car park licence fee", "車位牌照費"), "2026-09-01", "2026-09-30",
			[]InvoiceLineItem{line(lt("Car park licence — bay P2-017", "車位牌照 — P2-017 車位"), "carpark_licence", 1, 2400)},
			[]InvoicePayment{{"pay_wfg_r1012", "2026-09-12T19:40:00+08:00", "octopus", 1200, "Octopus stub · tap 19:40"}}},
		{"chg_wfg_a1_202607_lv", "INV-WFG-A1-202607-LV", "2026-07", lt("Special levy — external wall repair", "特別徵費 — 外牆維修"), "2026-07-15", "2026-08-15",
			[]InvoiceLineItem{line(lt("External wall repair levy, instalment 1 of 4", "外牆維修徵費（第 1 期，共 4 期）"), "special_levy", 1, 4800),
				line(lt("Sinking fund top-up (2 months × HKD 400)", "維修基金補足（2 個月 × 400 港元）"), "sinking_fund", 2, 400)}, nil},
		{"chg_wfg_a1_202608", "INV-WFG-A1-202608", "2026-08", fee, "2026-08-01", "2026-08-31", []InvoiceLineItem{line(fee, "management_fee", 1, 3280)},
			[]InvoicePayment{{"pay_wfg_r1001", "2026-08-03T10:15:00+08:00", "fps", 3280, "FPS stub · WFG-A1-0803"}}},
		{"chg_wfg_a1_202607", "INV-WFG-A1-202607", "2026-07", fee, "2026-07-01", "2026-07-31", []InvoiceLineItem{line(fee, "management_fee", 1, 3280)},
			[]InvoicePayment{{"pay_wfg_r0962", "2026-07-06T11:30:00+08:00", "cheque", 3280, "Cheque stub · HSBC 004512"}}},
		{"chg_wfg_a1_202606", "INV-WFG-A1-202606", "2026-06", fee, "2026-06-01", "2026-06-30", []InvoiceLineItem{line(fee, "management_fee", 1, 3280)},
			[]InvoicePayment{{"pay_wfg_r0917", "2026-06-04T09:05:00+08:00", "fps", 3280, "FPS stub · WFG-A1-0604"}}},
	}
	out := make([]InvoiceDetail, 0, len(rows))
	for _, r := range rows {
		amount, paid := 0, 0
		for _, l := range r.lines {
			amount += l.AmountHkd
		}
		for _, p := range r.pays {
			paid += p.AmountHkd
		}
		if r.pays == nil {
			r.pays = []InvoicePayment{}
		}
		bal := amount - paid
		if bal < 0 {
			bal = 0
		}
		out = append(out, InvoiceDetail{InvoiceRow{r.id, r.num, FixtureHouseholdID, FixtureUnitID, unit, r.period, PeriodLabel(r.period), r.title,
			r.issue, r.due, DeriveInvoiceStatus(amount, paid, r.due, asOf), "HKD", amount, paid, bal}, r.lines, r.pays, nil})
	}
	return out
}

// InvoiceStore is read-only after construction.
type InvoiceStore struct {
	invoices   []InvoiceDetail
	households map[string]string
	asOf       string
}

func NewInvoiceStore() *InvoiceStore {
	return &InvoiceStore{SeedInvoices(DemoAsOf), map[string]string{FixtureResidentID: FixtureHouseholdID}, DemoAsOf}
}

func (s *InvoiceStore) HouseholdForResident(ref string) *string {
	if h, ok := s.households[ref]; ok {
		return &h
	}
	return nil
}

func (s *InvoiceStore) forHousehold(h string) []InvoiceDetail {
	out := []InvoiceDetail{}
	for _, i := range s.invoices {
		if i.HouseholdID == h {
			out = append(out, i)
		}
	}
	sort.SliceStable(out, func(a, b int) bool {
		if out[a].IssueDate == out[b].IssueDate {
			return out[a].InvoiceID < out[b].InvoiceID
		}
		return out[a].IssueDate > out[b].IssueDate
	})
	return out
}

func (s *InvoiceStore) ListForHousehold(h, status string) []InvoiceRow {
	out := []InvoiceRow{}
	for _, i := range s.forHousehold(h) {
		if status == "" || i.Status == status {
			out = append(out, i.InvoiceRow)
		}
	}
	return out
}

func (s *InvoiceStore) GetForHousehold(h, id string) *InvoiceDetail {
	for _, i := range s.invoices {
		if i.InvoiceID == id {
			if i.HouseholdID == h {
				c := i
				return &c
			}
			return nil
		}
	}
	return nil
}

func (s *InvoiceStore) SummaryForHousehold(h *string) InvoiceSummary {
	var rows []InvoiceDetail
	if h != nil {
		rows = s.forHousehold(*h)
	}
	sum := InvoiceSummary{HouseholdID: h, Currency: "HKD", AsOf: s.asOf, TotalCount: len(rows)}
	for _, r := range rows {
		switch r.Status {
		case "UNPAID":
			sum.Counts.Unpaid++
		case "PARTIAL":
			sum.Counts.Partial++
		case "PAID":
			sum.Counts.Paid++
		case "OVERDUE":
			sum.Counts.Overdue++
		}
		if r.Status != "PAID" {
			sum.OutstandingBalanceHkd += r.BalanceHkd
		}
		if r.Status == "OVERDUE" {
			sum.OverdueBalanceHkd += r.BalanceHkd
		}
	}
	return sum
}
