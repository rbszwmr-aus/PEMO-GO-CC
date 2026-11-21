package demo

import (
	"sort"
	"strings"
	"sync"
)

const FixtureVisitorUnitID = "unt_demo_a_12f_a1"

type Notice struct {
	NoticeID    string `json:"noticeId"`
	Title       string `json:"title"`
	Body        string `json:"body"`
	PublishedAt string `json:"publishedAt"`
	Severity    string `json:"severity"`
	Category    string `json:"category"`
}

type Visitor struct {
	VisitorID    string  `json:"visitorId"`
	Name         string  `json:"name"`
	Purpose      *string `json:"purpose"`
	ExpectedFrom string  `json:"expectedFrom"`
	ExpectedTo   string  `json:"expectedTo"`
	HostUnitID   *string `json:"hostUnitId"`
	IDStub       *string `json:"idStub"`
	ResidentRef  string  `json:"residentRef"`
	Status       string  `json:"status"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
	CheckedOutAt *string `json:"checkedOutAt"`
}

var VisitorStatuses = []string{"expected", "checked_in", "checked_out", "cancelled"}

func SeedNotices() []Notice {
	return []Notice{
		{"ntc_seed_lift_maintenance", "Lift B maintenance — 24 Sep",
			"Lift B in Block A will be out of service 09:00–17:00 on 24 Sep for scheduled maintenance. Use Lift A or the stairs. Enquiries: management office.",
			"2026-09-21T09:00:00+08:00", "warning", "maintenance"},
		{"ntc_seed_water_tank", "Water tank cleaning — overnight",
			"Estate water tank cleaning overnight 25–26 Sep. Expect brief low pressure around 01:00–04:00. Fill bottles beforehand if needed.",
			"2026-09-20T16:30:00+08:00", "info", "utilities"},
		{"ntc_seed_fire_drill", "Annual fire drill — 28 Sep 10:00",
			"Please evacuate via nearest stairwell when the alarm sounds. Assembly point: podium garden. Pets must be on leads.",
			"2026-09-19T11:00:00+08:00", "critical", "safety"},
		{"ntc_seed_clubhouse_hours", "Clubhouse extended hours this weekend",
			"Clubhouse open until 22:00 Fri–Sun this week for Mid-Autumn activities. Booking still required for private rooms.",
			"2026-09-18T14:00:00+08:00", "info", "amenities"},
	}
}

func SeedVisitors() []Visitor {
	return []Visitor{
		{"vis_seed_courier", "SF Express courier", sp("Parcel delivery"), "2026-09-23T14:00:00+08:00", "2026-09-23T16:00:00+08:00",
			sp(FixtureVisitorUnitID), nil, FixtureResidentID, "expected", "2026-09-22T10:00:00+08:00", "2026-09-22T10:00:00+08:00", nil},
		{"vis_seed_plumber", "Wong Kai-ming", sp("Kitchen U-bend repair"), "2026-09-21T09:00:00+08:00", "2026-09-21T12:00:00+08:00",
			sp(FixtureVisitorUnitID), sp("HKID****1234"), FixtureResidentID, "checked_out", "2026-09-20T18:00:00+08:00", "2026-09-21T11:45:00+08:00",
			sp("2026-09-21T11:45:00+08:00")},
	}
}

type NoticeStore struct{ notices []Notice }

func NewNoticeStore() *NoticeStore { return &NoticeStore{SeedNotices()} }

func (s *NoticeStore) ListAll() []Notice {
	out := append([]Notice(nil), s.notices...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].PublishedAt > out[j].PublishedAt })
	return out
}

func (s *NoticeStore) Get(id string) *Notice {
	for _, n := range s.notices {
		if n.NoticeID == id {
			c := n
			return &c
		}
	}
	return nil
}

type VisitorStore struct {
	mu       sync.Mutex
	visitors []Visitor
}

func NewVisitorStore() *VisitorStore { return &VisitorStore{visitors: SeedVisitors()} }

func (s *VisitorStore) ListForResident(ref string) []Visitor {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []Visitor{}
	for _, v := range s.visitors {
		if v.ResidentRef == ref {
			out = append(out, v)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].UpdatedAt > out[j].UpdatedAt })
	return out
}

func (s *VisitorStore) Get(id string) *Visitor {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, v := range s.visitors {
		if v.VisitorID == id {
			c := v
			return &c
		}
	}
	return nil
}

type CreateVisitorInput struct {
	Name, ExpectedFrom, ExpectedTo, ResidentRef string
	Purpose, HostUnitID, IDStub                 *string
}

func optTrim(v *string, fallback *string) *string {
	if v != nil {
		if t := strings.TrimSpace(*v); t != "" {
			return &t
		}
	}
	return fallback
}

func (s *VisitorStore) Create(in CreateVisitorInput) Visitor {
	at := hkNow()
	v := Visitor{VisitorID: newID("vis"), Name: strings.TrimSpace(in.Name), Purpose: optTrim(in.Purpose, nil),
		ExpectedFrom: strings.TrimSpace(in.ExpectedFrom), ExpectedTo: strings.TrimSpace(in.ExpectedTo),
		HostUnitID: optTrim(in.HostUnitID, sp(FixtureVisitorUnitID)), IDStub: optTrim(in.IDStub, nil),
		ResidentRef: firstNonEmpty(in.ResidentRef, FixtureResidentID), Status: "expected", CreatedAt: at, UpdatedAt: at}
	s.mu.Lock()
	s.visitors = append([]Visitor{v}, s.visitors...)
	s.mu.Unlock()
	return v
}

func (s *VisitorStore) SetStatus(id, status string) *Visitor {
	ok := false
	for _, v := range VisitorStatuses {
		ok = ok || v == status
	}
	if !ok {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.visitors {
		if s.visitors[i].VisitorID == id {
			at := hkNow()
			s.visitors[i].Status, s.visitors[i].UpdatedAt = status, at
			if status == "checked_out" {
				s.visitors[i].CheckedOutAt = &at
			}
			c := s.visitors[i]
			return &c
		}
	}
	return nil
}

func (s *VisitorStore) CheckOut(id string) *Visitor { return s.SetStatus(id, "checked_out") }
