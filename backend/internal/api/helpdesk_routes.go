package api

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"time"

	"pemo/internal/helpdesk"
	"pemo/internal/platform"
	"pemo/internal/property"
)

func mapChannel(c string) string {
	switch c {
	case "phone":
		return "phone"
	case "staff_manual", "kiosk":
		return "counter"
	}
	return "app"
}

func mapTicketState(t helpdesk.TicketRow, now time.Time) string {
	switch t.Status {
	case "closed", "resolved":
		return "closed"
	case "in_progress", "awaiting_resident":
		return "in_progress"
	}
	if t.DueAt != nil && t.DueAt.Before(now) {
		return "overdue"
	}
	return "waiting"
}

func mapTone(state string) string {
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

func minutesSince(t, now time.Time) int {
	m := int(now.Sub(t).Minutes())
	if m < 0 {
		return 0
	}
	return m
}

func waitLabels(state, channel string, opened, now time.Time) platform.LocalizedText {
	mins := minutesSince(opened, now)
	enM, zhM := fmt.Sprintf("%dm", mins), fmt.Sprintf("%d 分鐘", mins)
	if mins >= 60 {
		enM, zhM = fmt.Sprintf("%dh %dm", mins/60, mins%60), fmt.Sprintf("%d 小時 %d 分鐘", mins/60, mins%60)
	}
	switch state {
	case "closed":
		return lz("Closed", "已完結")
	case "in_progress":
		switch channel {
		case "phone":
			return lz("On call "+enM, "通話中 "+zhM)
		case "counter":
			return lz("At desk", "在櫃台")
		}
		return lz("In progress "+enM, "處理中 "+zhM)
	}
	return lz(enM, zhM)
}

func dispositionText(t helpdesk.TicketRow) platform.LocalizedText {
	switch t.Status {
	case "closed", "resolved":
		reason := t.Disposition
		if t.ClosureReason != nil {
			reason = *t.ClosureReason
		}
		return lz("Closed at the desk · "+reason, "已於服務台完結 · "+reason)
	case "in_progress", "awaiting_resident":
		if t.PrimaryCaseRef != nil {
			return lz("In progress · linked case "+*t.PrimaryCaseRef, "處理中 · 已連結個案 "+*t.PrimaryCaseRef)
		}
		return lz("In progress at the desk — no case yet.", "服務台處理中 — 尚未轉個案。")
	}
	if t.PrimaryCaseRef != nil {
		c := *t.PrimaryCaseRef
		return lz("Waiting — linked case "+c+"; help desk must not own safety work.", "等候中 — 已連結個案 "+c+"；服務台不可接管安全工作。")
	}
	return lz("Still at the desk — answer here; no case yet.", "仍在服務台處理 — 於此回覆；尚未轉個案。")
}

type labelMaps struct {
	label  map[string]property.Bilingual
	parent map[string]string
}

func (s *Server) labelMaps(ctx context.Context, e property.ExpandedScope) (labelMaps, error) {
	nodes, err := s.prop.NodesInScope(ctx, e)
	if err != nil {
		return labelMaps{}, err
	}
	m := labelMaps{map[string]property.Bilingual{}, map[string]string{}}
	for _, n := range nodes {
		k := nk(n.Kind, n.ID)
		m.label[k] = n.Label
		if n.ParentKind != nil && n.ParentID != nil {
			m.parent[k] = nk(*n.ParentKind, *n.ParentID)
		}
	}
	return m, nil
}

func (m labelMaps) unitLabel(t helpdesk.TicketRow) string {
	if t.NodeKind == nil || t.NodeID == nil {
		return "—"
	}
	k := nk(*t.NodeKind, *t.NodeID)
	own := *t.NodeID
	if l, ok := m.label[k]; ok {
		own = l.En
	}
	if *t.NodeKind != "unit" {
		return own
	}
	floorKey, hasFloor := m.parent[k]
	var floor, building *string
	if hasFloor {
		if l, ok := m.label[floorKey]; ok {
			floor = &l.En
		}
		if bk, ok := m.parent[floorKey]; ok {
			if l, ok := m.label[bk]; ok {
				building = &l.En
			}
		}
	}
	if building != nil && floor != nil {
		return *building + " · " + *floor + " " + own
	}
	if floor != nil {
		return *floor + " " + own
	}
	return own
}

func whoOf(t helpdesk.TicketRow, names map[string]string) string {
	if t.ReporterRef != nil && t.ReporterKind != nil {
		switch *t.ReporterKind {
		case "resident":
			if n, ok := names[*t.ReporterRef]; ok {
				return n
			}
			return *t.ReporterRef
		case "staff_principal":
			return *t.ReporterRef
		}
	}
	return "Anonymous"
}

func (s *Server) residentNames(ctx context.Context, ids []string) (map[string]string, error) {
	rs, err := s.res.GetResidents(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := map[string]string{}
	for id, r := range rs {
		out[id] = r.DisplayName
	}
	return out, nil
}

func helpdeskScope(org string, e property.ExpandedScope) helpdesk.Scope {
	return helpdesk.Scope{OrganizationID: org, UnitIDs: e.UnitIDs, FloorIDs: e.FloorIDs, BuildingIDs: e.BuildingIDs, EstateIDs: e.EstateIDs, LocationIDs: e.LocationIDs}
}

// startOfLocalDay is midnight in the organisation's zone (was Hong Kong only).
func (s *Server) startOfLocalDay(now time.Time) time.Time {
	l := now.In(s.cfg.TimeZone)
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, s.cfg.TimeZone)
}

func (s *Server) composeHelpdeskQueue(ctx context.Context, sc *StaffContext, p PageParams) (any, error) {
	e, err := s.prop.Expand(ctx, sc.OrganizationID, scopeGrantNodes(sc))
	if err != nil {
		return nil, err
	}
	tickets, err := s.helpdesk.ListInScope(ctx, helpdeskScope(sc.OrganizationID, e))
	if err != nil {
		return nil, err
	}
	var rids []string
	for _, t := range tickets {
		if t.ReporterKind != nil && *t.ReporterKind == "resident" && t.ReporterRef != nil {
			rids = append(rids, *t.ReporterRef)
		}
	}
	names, err := s.residentNames(ctx, rids)
	if err != nil {
		return nil, err
	}
	lm, err := s.labelMaps(ctx, e)
	if err != nil {
		return nil, err
	}
	now := sc.Now
	ordered := append([]helpdesk.TicketRow{}, tickets...)
	sort.SliceStable(ordered, func(i, j int) bool {
		if !ordered[i].OpenedAt.Equal(ordered[j].OpenedAt) {
			return ordered[i].OpenedAt.Before(ordered[j].OpenedAt)
		}
		return ordered[i].TicketID < ordered[j].TicketID
	})
	rows := []O{}
	states := map[string]string{}
	for _, t := range ordered {
		ch, st := mapChannel(t.Channel), mapTicketState(t, now)
		states[t.TicketID] = st
		rows = append(rows, obj("id", t.TicketID, "channel", ch, "who", whoOf(t, names), "unit", lm.unitLabel(t),
			"subject", lz(t.Description, t.Description), "wait", waitLabels(st, ch, t.OpenedAt, now), "state", st, "tone", mapTone(st)))
	}
	page, meta, err := slicePage(rows, func(o O) string { return o.get("id").(string) }, p)
	if err != nil {
		return nil, err
	}
	// stats
	waitingN, longest := 0, 0
	for _, t := range tickets {
		if st := states[t.TicketID]; st == "waiting" || st == "overdue" {
			waitingN++
			if m := minutesSince(t.OpenedAt, now); m > longest {
				longest = m
			}
		}
	}
	dayStart := s.startOfLocalDay(now)
	answered, raised := 0, 0
	for _, t := range tickets {
		if t.Status != "open" && t.Status != "triaged" && !t.CurrentRecordedAt.Before(dayStart) {
			answered++
		}
		if t.PrimaryCaseRef != nil {
			raised++
		}
	}
	waitNote, waitTone := lz(fmt.Sprintf("longest %d minutes", longest), fmt.Sprintf("最長 %d 分鐘", longest)), "warning"
	if waitingN == 0 {
		waitNote, waitTone = lz("queue clear", "佇列清空"), "normal"
	}
	raisedNote := lz("linked tickets in scope", "範圍內已連結個案的聯絡")
	if answered != 0 {
		raisedNote = lz(fmt.Sprintf("of %d answered · linked in scope", answered), fmt.Sprintf("共 %d 宗已回覆 · 範圍內已連結", answered))
	}
	stats := []O{
		obj("id", "waiting", "label", lz("WAITING", "等候中"), "value", fmt.Sprint(waitingN), "note", waitNote, "tone", waitTone),
		obj("id", "answered", "label", lz("ANSWERED TODAY", "今日已回覆"), "value", fmt.Sprint(answered), "note", lz("status moved off waiting today", "今日已離開等候狀態"), "tone", "normal"),
		obj("id", "raised", "label", lz("RAISED AS CASES", "已轉為個案"), "value", fmt.Sprint(raised), "note", raisedNote, "tone", "info"),
		obj("id", "hours", "label", lz("OFFICE HOURS", "辦公時間"), "value", "08:00", "note", lz("to 20:00 · out of hours goes to phone", "至 20:00 · 非辦公時間轉電話"), "tone", "unknown"),
	}
	return obj("meta", s.managementMeta(sc), "stats", stats, "rows", page, "page", meta), nil
}

func (s *Server) composeHelpdeskContact(ctx context.Context, sc *StaffContext, id string) (any, error) {
	e, err := s.prop.Expand(ctx, sc.OrganizationID, scopeGrantNodes(sc))
	if err != nil {
		return nil, err
	}
	t, err := s.helpdesk.GetInScope(ctx, helpdeskScope(sc.OrganizationID, e), id)
	if err != nil {
		return nil, err
	}
	if t == nil {
		return nil, staffProblems.HelpdeskContactNotFound()
	}
	lm, err := s.labelMaps(ctx, e)
	if err != nil {
		return nil, err
	}
	now := sc.Now
	ch, st := mapChannel(t.Channel), mapTicketState(*t, now)
	msgs, err := s.helpdesk.MessagesFor(ctx, t.TicketID)
	if err != nil {
		return nil, err
	}
	var ids []string
	if t.ReporterKind != nil && *t.ReporterKind == "resident" && t.ReporterRef != nil {
		ids = append(ids, *t.ReporterRef)
	}
	for _, m := range msgs {
		if m.AuthorKind == "resident" {
			ids = append(ids, m.AuthorRef)
		}
	}
	names, err := s.residentNames(ctx, ids)
	if err != nil {
		return nil, err
	}
	timeline := []O{}
	if len(msgs) == 0 {
		timeline = append(timeline, obj("at", s.fmtLocal(t.OpenedAt), "who", lz("System", "系統"), "channel", "system",
			"body", lz("Queued for Help desk · waiting time started.", "已加入服務台佇列 · 開始計算等候時間。")))
	}
	for _, m := range msgs {
		who := lz("System", "系統")
		switch m.AuthorKind {
		case "resident":
			n := m.AuthorRef
			if v, ok := names[m.AuthorRef]; ok {
				n = v
			}
			who = lz(n, n)
		case "staff_principal":
			who = lz("Desk · "+m.AuthorRef, "服務台 · "+m.AuthorRef)
		}
		timeline = append(timeline, obj("at", s.fmtLocal(m.CreatedAt), "who", who, "channel", ch, "body", lz(m.Body, m.Body)))
	}
	return obj("meta", s.managementMeta(sc), "contact", obj("id", t.TicketID, "channel", ch, "who", whoOf(*t, names),
		"unit", lm.unitLabel(*t), "subject", lz(t.Description, t.Description), "wait", waitLabels(st, ch, t.OpenedAt, now),
		"state", st, "tone", mapTone(st), "openedAt", s.fmtLocal(t.OpenedAt), "linkedCaseRef", nilStr(t.PrimaryCaseRef),
		"disposition", dispositionText(*t), "timeline", timeline)), nil
}

func (s *Server) helpdeskRoutes() {
	s.handle("GET", mgmt+"/helpdesk/queue", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		if demo, ok := s.tryDemoHelpdeskQueue(r, sc); ok {
			s.writeJSON(w, 200, demo)
			return
		}
		p, err := parsePageParams(r.URL.Query())
		if err == nil {
			var out any
			if out, err = s.composeHelpdeskQueue(r.Context(), sc, p); err == nil {
				s.writeJSON(w, 200, out)
				return
			}
		}
		s.handleManagementError(w, r, err)
	})
	s.handle("GET", mgmt+"/helpdesk/contacts/{contactId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		id := r.PathValue("contactId")
		if !validID(id) {
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("The contact identifier is missing or malformed.", "聯絡識別碼缺少或格式不正確。")))
			return
		}
		if demo, handled, found := s.tryDemoHelpdeskContact(r, sc, id); handled {
			if !found {
				s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("Contact not found in the demo store.", "示範庫中找不到此聯絡。")))
				return
			}
			s.writeJSON(w, 200, demo)
			return
		}
		out, err := s.composeHelpdeskContact(r.Context(), sc, id)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		s.writeJSON(w, 200, out)
	})
}
