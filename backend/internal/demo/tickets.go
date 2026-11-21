// Package demo holds the in-memory demo stores (tickets, invoices, notices
// and visitors, QR passes). They hold no database state and are only
// reachable when PEMO_ENABLE_DEMO_ROUTES=1 or from cmd/pemo-demo.
package demo

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"sort"
	"strings"
	"sync"
	"time"
)

// LocalizedText is the bilingual pair the demo stores use.
type LocalizedText struct {
	En     string `json:"en"`
	ZhHant string `json:"zh-Hant"`
}

func lt(en, zh string) LocalizedText { return LocalizedText{en, zh} }

const (
	FixtureResidentID   = "res_demo_ho_mei_yi"
	FixtureResidentName = "Ho Mei-yi 何美儀"
	FixtureUnitLabel    = "A · 12/F A1"
)

var TicketStatuses = []string{"open", "triaged", "in_progress", "awaiting_resident", "resolved", "closed"}

func IsTicketStatus(v string) bool {
	for _, s := range TicketStatuses {
		if s == v {
			return true
		}
	}
	return false
}

type TimelineEvent struct {
	ID              string  `json:"id"`
	At              string  `json:"at"`
	Kind            string  `json:"kind"`
	Actor           string  `json:"actor"`
	MessageEn       string  `json:"messageEn"`
	MessageZh       string  `json:"messageZh"`
	Status          *string `json:"status,omitempty"`
	ResidentVisible *bool   `json:"residentVisible,omitempty"`
}

type Ticket struct {
	ID                  string          `json:"id"`
	Subject             string          `json:"subject"`
	Body                string          `json:"body"`
	Category            string          `json:"category"`
	Status              string          `json:"status"`
	AssignedAdminID     *string         `json:"assignedAdminId"`
	AssignedAdminLabel  *string         `json:"assignedAdminLabel"`
	UnitLabel           string          `json:"unitLabel"`
	Channel             string          `json:"channel"`
	ReporterRef         string          `json:"reporterRef"`
	CreatedByResidentID string          `json:"createdByResidentId"`
	CreatedByName       string          `json:"createdByName"`
	CreatedAt           string          `json:"createdAt"`
	UpdatedAt           string          `json:"updatedAt"`
	DueAt               *string         `json:"dueAt"`
	Timeline            []TimelineEvent `json:"timeline"`
}

func (t Ticket) clone() Ticket {
	t.Timeline = append([]TimelineEvent(nil), t.Timeline...)
	return t
}

type Admin struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

var DemoAdmins = []Admin{
	{"stf_wfg_manager", "Chan Mei-ling 陳美玲"},
	{"stf_wfg_block_a", "Lau Chi-wai 劉志偉"},
	{"stf_wfg_counter", "Ng Siu-fong 吳小芳"},
}

func sp(s string) *string { return &s }
func bp(b bool) *bool     { return &b }

// hkNow is the demo stores' clock string (fixed +08:00, as before).
func hkNow() string {
	return time.Now().UTC().Add(8*time.Hour).Format("2006-01-02T15:04:05") + "+08:00"
}

const base36 = "0123456789abcdefghijklmnopqrstuvwxyz"

func randomFrom(alphabet string, n int) string {
	var b strings.Builder
	max := big.NewInt(int64(len(alphabet)))
	for i := 0; i < n; i++ {
		x, _ := rand.Int(rand.Reader, max)
		b.WriteByte(alphabet[x.Int64()])
	}
	return b.String()
}

func newID(prefix string) string {
	return fmt.Sprintf("%s_%s_%s", prefix, randomFrom(base36, 8), big.NewInt(time.Now().UnixMilli()).Text(36))
}

func SeedTickets() []Ticket {
	now := "2026-09-20T10:00:00+08:00"
	created := func(id, at string) TimelineEvent {
		return TimelineEvent{id, at, "created", "resident", "Ticket opened via resident portal.", "住戶已於住戶入門網站開立服務單。", sp("open"), bp(true)}
	}
	base := func(id, subject, body, category, status string, adminID, adminLabel *string, createdAt, updatedAt string, tl []TimelineEvent) Ticket {
		return Ticket{id, subject, body, category, status, adminID, adminLabel, FixtureUnitLabel, "app", FixtureResidentID, FixtureResidentID,
			FixtureResidentName, createdAt, updatedAt, nil, tl}
	}
	return []Ticket{
		base("tkt_seed_renovation", "Renovation permit form — which version applies?",
			"We plan kitchen works next month. Which permit form version should we use?", "enquiry", "open", nil, nil,
			"2026-09-20T09:58:00+08:00", "2026-09-20T09:58:00+08:00",
			[]TimelineEvent{created("tln_seed_reno_1", "2026-09-20T09:58:00+08:00")}),
		base("tkt_seed_leak", "Water drip under kitchen sink", "Slow drip from the U-bend since Tuesday evening. Cup catches it for now.",
			"maintenance", "triaged", sp("stf_wfg_block_a"), sp("Lau Chi-wai 劉志偉"), "2026-09-18T09:12:00+08:00", "2026-09-19T14:30:00+08:00",
			[]TimelineEvent{created("tln_seed_leak_1", "2026-09-18T09:12:00+08:00"),
				{"tln_seed_leak_2", "2026-09-18T11:05:00+08:00", "status", "staff", "Status set to triaged.", "狀態已設為已分流。", sp("triaged"), bp(true)},
				{"tln_seed_leak_3", "2026-09-19T14:30:00+08:00", "assign", "staff", "Assigned to Lau Chi-wai 劉志偉.", "已指派予劉志偉。", nil, bp(true)}}),
		base("tkt_seed_noise", "Late-night renovation noise — floor above", "Drilling after 22:00 on 17 Sep. Please remind the unit of quiet hours.",
			"noise", "in_progress", sp("stf_wfg_manager"), sp("Chan Mei-ling 陳美玲"), "2026-09-17T22:40:00+08:00", now,
			[]TimelineEvent{created("tln_seed_noise_1", "2026-09-17T22:40:00+08:00"),
				{"tln_seed_noise_2", "2026-09-18T08:15:00+08:00", "assign", "staff", "Assigned to Chan Mei-ling 陳美玲.", "已指派予陳美玲。", nil, bp(true)},
				{"tln_seed_noise_3", now, "status", "staff", "Status set to in_progress.", "狀態已設為處理中。", sp("in_progress"), bp(true)}}),
	}
}

// TicketStore is the in-memory ticket store (safe for concurrent use).
type TicketStore struct {
	mu      sync.Mutex
	tickets []Ticket
}

func NewTicketStore(initial []Ticket) *TicketStore {
	s := &TicketStore{}
	for _, t := range initial {
		s.tickets = append(s.tickets, t.clone())
	}
	return s
}

func byUpdatedDesc(ts []Ticket) {
	sort.SliceStable(ts, func(i, j int) bool { return ts[i].UpdatedAt > ts[j].UpdatedAt })
}

func (s *TicketStore) ListAll() []Ticket {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]Ticket, len(s.tickets))
	for i, t := range s.tickets {
		out[i] = t.clone()
	}
	byUpdatedDesc(out)
	return out
}

func (s *TicketStore) ListForReporter(ref string) []Ticket {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []Ticket{}
	for _, t := range s.tickets {
		if t.ReporterRef == ref || t.CreatedByResidentID == ref {
			out = append(out, t.clone())
		}
	}
	byUpdatedDesc(out)
	return out
}

func (s *TicketStore) Get(id string) *Ticket {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, t := range s.tickets {
		if t.ID == id {
			c := t.clone()
			return &c
		}
	}
	return nil
}

type CreateTicketInput struct {
	Subject, Body, Category, UnitLabel, ReporterRef, CreatedByResidentID, CreatedByName string
}

func firstNonEmpty(vs ...string) string {
	for _, v := range vs {
		if t := strings.TrimSpace(v); t != "" {
			return t
		}
	}
	return ""
}

func (s *TicketStore) Create(in CreateTicketInput) Ticket {
	at := hkNow()
	reporter := firstNonEmpty(in.ReporterRef, in.CreatedByResidentID, FixtureResidentID)
	category := firstNonEmpty(in.Category, "general")
	t := Ticket{ID: newID("tkt"), Subject: strings.TrimSpace(in.Subject), Body: strings.TrimSpace(in.Body), Category: category,
		Status: "open", UnitLabel: firstNonEmpty(in.UnitLabel, FixtureUnitLabel), Channel: "app", ReporterRef: reporter,
		CreatedByResidentID: reporter, CreatedByName: firstNonEmpty(in.CreatedByName, FixtureResidentName), CreatedAt: at, UpdatedAt: at,
		Timeline: []TimelineEvent{{newID("tln"), at, "created", "resident", "Ticket opened via resident portal.", "住戶已於住戶入門網站開立服務單。", sp("open"), bp(true)}}}
	s.mu.Lock()
	s.tickets = append([]Ticket{t}, s.tickets...)
	s.mu.Unlock()
	return t.clone()
}

func (s *TicketStore) update(id string, fn func(*Ticket)) *Ticket {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.tickets {
		if s.tickets[i].ID == id {
			next := s.tickets[i].clone()
			fn(&next)
			s.tickets[i] = next
			c := next.clone()
			return &c
		}
	}
	return nil
}

func (s *TicketStore) Assign(id, adminID, adminLabel string) *Ticket {
	return s.update(id, func(t *Ticket) {
		at := hkNow()
		t.AssignedAdminID, t.AssignedAdminLabel, t.UpdatedAt = &adminID, &adminLabel, at
		t.Timeline = append(t.Timeline, TimelineEvent{newID("tln"), at, "assign", "staff", "Assigned to " + adminLabel + ".", "已指派予 " + adminLabel + "。", nil, bp(true)})
	})
}

func (s *TicketStore) SetStatus(id, status, note string) *Ticket {
	if !IsTicketStatus(status) {
		return nil
	}
	return s.update(id, func(t *Ticket) {
		at := hkNow()
		t.Status, t.UpdatedAt = status, at
		t.Timeline = append(t.Timeline, TimelineEvent{newID("tln"), at, "status", "staff", "Status set to " + status + ".", "狀態已設為 " + status + "。", sp(status), bp(true)})
		if n := strings.TrimSpace(note); n != "" {
			t.Timeline = append(t.Timeline, TimelineEvent{newID("tln"), at, "note", "staff", n, n, nil, bp(false)})
		}
	})
}

// ---- adapters ----

func StatusToStaffChrome(status string, dueAt *string, now time.Time) string {
	switch status {
	case "closed", "resolved":
		return "closed"
	case "in_progress", "awaiting_resident":
		return "in_progress"
	}
	if dueAt != nil {
		if d, err := time.Parse(time.RFC3339, *dueAt); err == nil && d.Before(now) {
			return "overdue"
		}
	}
	return "waiting"
}

func toneFor(state string) string {
	switch state {
	case "overdue":
		return "critical"
	case "waiting":
		return "warning"
	case "in_progress":
		return "info"
	}
	return "normal"
}

func waitLabels(state string, t Ticket, now time.Time) LocalizedText {
	mins := 0
	if opened, err := time.Parse(time.RFC3339, t.CreatedAt); err == nil {
		if m := int(now.Sub(opened).Minutes()); m > 0 {
			mins = m
		}
	}
	enM, zhM := fmt.Sprintf("%dm", mins), fmt.Sprintf("%d 分鐘", mins)
	if mins >= 60 {
		enM, zhM = fmt.Sprintf("%dh %dm", mins/60, mins%60), fmt.Sprintf("%d 小時 %d 分鐘", mins/60, mins%60)
	}
	switch state {
	case "closed":
		return lt("Closed", "已完結")
	case "in_progress":
		return lt("In progress "+enM, "處理中 "+zhM)
	}
	return lt(enM, zhM)
}

type QueueRow struct {
	ID                 string        `json:"id"`
	Channel            string        `json:"channel"`
	Who                string        `json:"who"`
	Unit               string        `json:"unit"`
	Subject            LocalizedText `json:"subject"`
	Wait               LocalizedText `json:"wait"`
	State              string        `json:"state"`
	Tone               string        `json:"tone"`
	AssignedAdminLabel *string       `json:"assignedAdminLabel"`
	DemoStatus         string        `json:"demoStatus"`
}

func ToQueueRow(t Ticket, now time.Time) QueueRow {
	state := StatusToStaffChrome(t.Status, t.DueAt, now)
	return QueueRow{t.ID, "app", t.CreatedByName, t.UnitLabel, lt(t.Subject, t.Subject), waitLabels(state, t, now), state, toneFor(state), t.AssignedAdminLabel, t.Status}
}

type TimelineTurn struct {
	At      string        `json:"at"`
	Who     LocalizedText `json:"who"`
	Channel string        `json:"channel"`
	Body    LocalizedText `json:"body"`
}

type ContactDetail struct {
	ID                 string         `json:"id"`
	Channel            string         `json:"channel"`
	Who                string         `json:"who"`
	Unit               string         `json:"unit"`
	Subject            LocalizedText  `json:"subject"`
	Wait               LocalizedText  `json:"wait"`
	State              string         `json:"state"`
	Tone               string         `json:"tone"`
	OpenedAt           string         `json:"openedAt"`
	LinkedCaseRef      *string        `json:"linkedCaseRef"`
	Disposition        LocalizedText  `json:"disposition"`
	AssignedAdminID    *string        `json:"assignedAdminId"`
	AssignedAdminLabel *string        `json:"assignedAdminLabel"`
	DemoStatus         string         `json:"demoStatus"`
	Timeline           []TimelineTurn `json:"timeline"`
}

func ToContactDetail(t Ticket, now time.Time) ContactDetail {
	row := ToQueueRow(t, now)
	disp := lt("Waiting at the desk", "服務台等候中")
	if t.Status == "closed" || t.Status == "resolved" {
		disp = lt("Closed at the desk", "已於服務台完結")
	} else if t.AssignedAdminLabel != nil && *t.AssignedAdminLabel != "" {
		disp = lt("Assigned · "+*t.AssignedAdminLabel, "已指派 · "+*t.AssignedAdminLabel)
	}
	turns := make([]TimelineTurn, 0, len(t.Timeline))
	for _, ev := range t.Timeline {
		var who LocalizedText
		switch ev.Actor {
		case "resident":
			who = lt(t.CreatedByName, t.CreatedByName)
		case "system":
			who = lt("System", "系統")
		default:
			who = lt("Help desk", "服務台")
			if t.AssignedAdminLabel != nil {
				who = lt(*t.AssignedAdminLabel, *t.AssignedAdminLabel)
			}
		}
		ch := "system"
		if ev.Actor == "resident" {
			ch = "app"
		}
		turns = append(turns, TimelineTurn{ev.At, who, ch, lt(ev.MessageEn, ev.MessageZh)})
	}
	return ContactDetail{t.ID, row.Channel, row.Who, row.Unit, row.Subject, row.Wait, row.State, row.Tone, t.CreatedAt, nil, disp,
		t.AssignedAdminID, t.AssignedAdminLabel, t.Status, turns}
}

type PortalSummary struct {
	ID                 string  `json:"id"`
	Subject            string  `json:"subject"`
	Category           string  `json:"category"`
	Status             string  `json:"status"`
	AssignedAdminLabel *string `json:"assignedAdminLabel"`
	OpenedAt           string  `json:"openedAt"`
	UpdatedAt          string  `json:"updatedAt"`
	UnitLabel          string  `json:"unitLabel"`
}

func ToPortalSummary(t Ticket) PortalSummary {
	return PortalSummary{t.ID, t.Subject, t.Category, t.Status, t.AssignedAdminLabel, t.CreatedAt, t.UpdatedAt, t.UnitLabel}
}

type PortalTimelineEntry struct {
	ID      string        `json:"id"`
	At      string        `json:"at"`
	Kind    string        `json:"kind"`
	Actor   string        `json:"actor"`
	Message LocalizedText `json:"message"`
	Status  *string       `json:"status,omitempty"`
}

type PortalDetail struct {
	ID                 string                `json:"id"`
	Subject            string                `json:"subject"`
	Body               string                `json:"body"`
	Category           string                `json:"category"`
	Status             string                `json:"status"`
	AssignedAdminLabel *string               `json:"assignedAdminLabel"`
	OpenedAt           string                `json:"openedAt"`
	UpdatedAt          string                `json:"updatedAt"`
	UnitLabel          string                `json:"unitLabel"`
	Timeline           []PortalTimelineEntry `json:"timeline"`
}

func ToPortalDetail(t Ticket) PortalDetail {
	tl := []PortalTimelineEntry{}
	for _, ev := range t.Timeline {
		visible := ev.Kind != "note"
		if ev.ResidentVisible != nil {
			visible = *ev.ResidentVisible
		}
		if visible {
			tl = append(tl, PortalTimelineEntry{ev.ID, ev.At, ev.Kind, ev.Actor, lt(ev.MessageEn, ev.MessageZh), ev.Status})
		}
	}
	return PortalDetail{t.ID, t.Subject, t.Body, t.Category, t.Status, t.AssignedAdminLabel, t.CreatedAt, t.UpdatedAt, t.UnitLabel, tl}
}
