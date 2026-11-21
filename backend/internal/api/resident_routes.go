package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"pemo/internal/homesafety"
	"pemo/internal/platform"
	"pemo/internal/property"
	"pemo/internal/resident"
)

// RequestContext is the authenticated resident for one request.
type RequestContext struct {
	ResidentID, OrganizationID, CorrelationID string
	Now                                       time.Time
	Language                                  string
	Overrides                                 DevOverrides
}

type authenticated struct {
	ctx      RequestContext
	scenario string
}

// DegradedSection marks a section served partially (dev fault seam).
type DegradedSection struct {
	Section string                 `json:"section"`
	Reason  platform.LocalizedText `json:"reason"`
}

func (s *Server) formatEndedOn(endedAt string) platform.LocalizedText {
	t, _ := platform.ParseISO(endedAt)
	l := t.In(s.cfg.TimeZone)
	return platform.LocalizedText{En: fmt.Sprintf("%d %s", l.Day(), l.Month().String()), ZhHant: fmt.Sprintf("%d月%d日", int(l.Month()), l.Day())}
}

func (s *Server) fmtLocal(t time.Time) string { return FormatLocal(t, s.cfg.TimeZone) }

func (s *Server) fmtLocalStr(iso string) string {
	t, err := platform.ParseISO(iso)
	if err != nil {
		return iso
	}
	return s.fmtLocal(t)
}

func (s *Server) authenticate(w http.ResponseWriter, r *http.Request) *authenticated {
	o := readDevOverrides(s.cfg, r)
	switch o.Fault {
	case "integration-unavailable":
		s.sendProblem(w, r, problems.IntegrationUnavailable())
		return nil
	case "internal-error":
		s.sendProblem(w, r, problems.InternalError())
		return nil
	}
	sub, failure := s.devAuth.Verify(r.Header.Get("authorization"), time.Now())
	if failure != "" {
		s.log.Warn("credential refused", map[string]any{"correlationId": correlationOf(r), "cause": failure, "route": r.URL.Path})
		if failure == "expired" {
			s.sendProblem(w, r, problems.SessionExpired())
		} else {
			s.sendProblem(w, r, problems.InvalidCredential())
		}
		return nil
	}
	res, err := s.res.GetResident(r.Context(), sub)
	if err != nil {
		s.handleReadError(w, r, err)
		return nil
	}
	if res == nil {
		s.log.Warn("credential refused", map[string]any{"correlationId": correlationOf(r), "cause": "unknown_resident", "route": r.URL.Path})
		s.sendProblem(w, r, problems.InvalidCredential())
		return nil
	}
	now := time.Now()
	if o.Now != nil {
		now = *o.Now
	}
	lang := "en"
	if r.Header.Get("accept-language") == "zh-Hant" {
		lang = "zh-Hant"
	}
	rc := RequestContext{res.ResidentID, res.OrganizationID, correlationOf(r), now, lang, o}
	sum, err := s.res.Summarize(r.Context(), rc.ResidentID, rc.Now)
	if err != nil {
		s.handleReadError(w, r, err)
		return nil
	}
	if len(sum.Active) == 0 {
		if sum.Expired == nil {
			s.sendProblem(w, r, problems.NotAuthorizedForUnit())
		} else {
			s.sendProblem(w, r, problems.CaregiverScopeExpired(s.formatEndedOn(sum.Expired.EndedAt)))
		}
		return nil
	}
	sc := o.Scenario
	if sc == "" {
		sc = "default"
	}
	return &authenticated{rc, sc}
}

func (s *Server) authorizeUnit(w http.ResponseWriter, r *http.Request, a *authenticated, raw any) *property.UnitRecord {
	unitID, f := validateUnitID(raw)
	if f != nil {
		s.log.Warn("unit identifier rejected at the edge", map[string]any{"correlationId": correlationOf(r), "field": f.Field, "reason": f.Kind})
		s.sendProblem(w, r, problems.NotAuthorizedForUnit())
		return nil
	}
	out, err := s.res.AuthorizeUnit(r.Context(), a.ctx.ResidentID, unitID, a.ctx.Now)
	if err != nil {
		s.handleReadError(w, r, err)
		return nil
	}
	switch out.Kind {
	case "expired":
		s.sendProblem(w, r, problems.CaregiverScopeExpired(s.formatEndedOn(out.EndedAt)))
		return nil
	case "denied":
		s.sendProblem(w, r, problems.NotAuthorizedForUnit())
		return nil
	}
	u, err := s.prop.GetResidentialUnit(r.Context(), a.ctx.OrganizationID, unitID)
	if err != nil {
		s.handleReadError(w, r, err)
		return nil
	}
	if u == nil {
		s.sendProblem(w, r, problems.NotAuthorizedForUnit())
		return nil
	}
	return u
}

func queryAny(r *http.Request, k string) any {
	if v, ok := r.URL.Query()[k]; ok && len(v) > 0 {
		return v[0]
	}
	return nil
}

type unitNotMappedError struct{ unitID string }

func (e *unitNotMappedError) Error() string {
	return "unit " + e.unitID + " has no safety projection and is not mapped to a monitored location"
}

func (s *Server) handleReadError(w http.ResponseWriter, r *http.Request, err error) {
	var unm *unitNotMappedError
	var p *platform.Problem
	switch {
	case errors.As(err, &unm):
		s.sendProblem(w, r, problems.UnmappedUnit())
	case errors.As(err, &p):
		s.sendProblem(w, r, p)
	default:
		s.log.Error("unhandled read failure", map[string]any{"correlationId": correlationOf(r), "error": err.Error()})
		s.sendProblem(w, r, problems.InternalError())
	}
}

// ---- composition helpers ----

func (s *Server) buildMeta(c RequestContext, degraded []DegradedSection) O {
	m := obj("correlationId", c.CorrelationID, "contractVersion", s.residentContract, "generatedAt", s.fmtLocal(c.Now))
	if len(degraded) == 0 {
		return m
	}
	return m.with("partial", true, "degraded", degraded)
}

func (s *Server) screenContent(ctx context.Context, screen, section, scenario string) (any, bool, error) {
	r, err := s.scaffoldDB.QueryOne(ctx, `SELECT payload FROM screen_content WHERE screen = $1 AND section = $2 AND scenario = $3`, screen, section, scenario)
	if err != nil || r == nil {
		return nil, false, err
	}
	return r["payload"], r["payload"] != nil, nil
}

func (s *Server) degradedFor(ctx context.Context, screen string, a *authenticated) ([]DegradedSection, error) {
	if a.ctx.Overrides.Fault != "partial" {
		return nil, nil
	}
	v, ok, err := s.screenContent(ctx, screen, "degraded", a.scenario)
	if err != nil || !ok {
		return nil, err
	}
	arr, _ := v.([]any)
	out := []DegradedSection{}
	for _, x := range arr {
		m, _ := x.(map[string]any)
		reason, _ := m["reason"].(map[string]any)
		en, _ := reason["en"].(string)
		zh, _ := reason["zh-Hant"].(string)
		sec, _ := m["section"].(string)
		out = append(out, DegradedSection{sec, platform.LocalizedText{En: en, ZhHant: zh}})
	}
	return out, nil
}

func hasSection(d []DegradedSection, sec string) bool {
	for _, x := range d {
		if x.Section == sec {
			return true
		}
	}
	return false
}

func (s *Server) greeting(now time.Time) platform.LocalizedText {
	h := now.In(s.cfg.TimeZone).Hour()
	switch {
	case h < 12:
		return platform.LocalizedText{En: "Good morning", ZhHant: "早晨"}
	case h < 18:
		return platform.LocalizedText{En: "Good afternoon", ZhHant: "午安"}
	}
	return platform.LocalizedText{En: "Good evening", ZhHant: "晚安"}
}

var floorRe = regexp.MustCompile(`(?i)^(\d+)/F$`)

func chineseFloor(label string) string {
	if strings.EqualFold(label, "G/F") {
		return "地下"
	}
	if m := floorRe.FindStringSubmatch(label); m != nil {
		return m[1] + "樓"
	}
	return label
}

func displayLine(u property.UnitRecord) platform.LocalizedText {
	return platform.LocalizedText{
		En:     u.EstateName.En + " · " + u.BlockName.En + " · " + u.FloorLabel + " Flat " + u.FlatLabel,
		ZhHant: u.EstateName.ZhHant + " · " + u.BlockName.ZhHant + " · " + chineseFloor(u.FloorLabel) + " " + u.FlatLabel + "室",
	}
}

func unitContext(u property.UnitRecord) O {
	return obj("unitId", u.UnitID, "estateName", u.EstateName, "blockName", u.BlockName, "floor", u.FloorLabel,
		"flat", u.FlatLabel, "displayLine", displayLine(u))
}

func (s *Server) membership(u property.UnitRecord, rel resident.UnitRelationship, current string) O {
	var to any
	if rel.EffectiveTo != nil {
		to = s.fmtLocalStr(*rel.EffectiveTo)
	}
	return obj("unitId", u.UnitID, "displayLine", displayLine(u), "role", rel.Role, "isCurrent", u.UnitID == current, "effectiveTo", to)
}

func (s *Server) safetySummary(ctx context.Context, unitID string, c RequestContext) (O, error) {
	sum, err := s.hs.GetSummary(ctx, unitID, c.Now)
	if err != nil {
		return nil, err
	}
	if sum == nil {
		return nil, &unitNotMappedError{unitID}
	}
	return obj("severity", sum.Severity, "monitoringCoverage", sum.MonitoringCoverage, "headline", sum.Headline).
		when(sum.Detail != nil, "detail", sum.Detail).
		with("observedAt", s.fmtLocalStr(sum.ObservedAt), "receivedAt", s.fmtLocalStr(sum.ReceivedAt),
			"freshness", sum.Freshness, "disclaimer", sum.Disclaimer), nil
}

func orEmpty(v any, ok bool) any {
	if !ok || v == nil {
		return []any{}
	}
	return v
}

func (s *Server) composeHome(ctx context.Context, a *authenticated, u *property.UnitRecord, degraded []DegradedSection) (any, error) {
	c := a.ctx
	res, err := s.res.GetResident(ctx, c.ResidentID)
	if err != nil {
		return nil, err
	}
	if res == nil {
		return nil, fmt.Errorf("resident %s vanished mid-request", c.ResidentID)
	}
	rels, err := s.res.ListAuthorizedUnits(ctx, c.ResidentID, c.Now)
	if err != nil {
		return nil, err
	}
	summary, err := s.safetySummary(ctx, u.UnitID, c)
	if err != nil {
		return nil, err
	}
	var noticesV any = []any{}
	if !hasSection(degraded, "notices") {
		v, ok, err := s.screenContent(ctx, "mob-02-home", "notices", a.scenario)
		if err != nil {
			return nil, err
		}
		noticesV = orEmpty(v, ok)
	}
	openCase, _, err := s.screenContent(ctx, "mob-02-home", "openCase", a.scenario)
	if err != nil {
		return nil, err
	}
	quick, qok, err := s.screenContent(ctx, "mob-02-home", "quickServices", a.scenario)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(rels))
	for i, r := range rels {
		ids[i] = r.UnitID
	}
	units, err := s.prop.GetResidentialUnits(ctx, c.OrganizationID, ids)
	if err != nil {
		return nil, err
	}
	by := map[string]property.UnitRecord{}
	for _, x := range units {
		by[x.UnitID] = x
	}
	switcher := []O{}
	for _, rel := range rels {
		if rec, ok := by[rel.UnitID]; ok {
			switcher = append(switcher, s.membership(rec, rel, u.UnitID))
		}
	}
	sort.SliceStable(switcher, func(i, j int) bool {
		ci, cj := switcher[i].get("isCurrent").(bool), switcher[j].get("isCurrent").(bool)
		if ci == cj {
			return switcher[i].get("unitId").(string) < switcher[j].get("unitId").(string)
		}
		return ci
	})
	return obj("meta", s.buildMeta(c, degraded),
		"resident", obj("residentId", res.ResidentID, "displayName", res.DisplayName, "greeting", s.greeting(c.Now)),
		"unit", unitContext(*u), "unitSwitcher", switcher, "safety", summary, "openCase", openCase,
		"notices", noticesV, "quickServices", orEmpty(quick, qok)), nil
}

func (s *Server) isOpenNow(c property.EstateContact, now time.Time) bool {
	if c.OpensAt == nil || c.ClosesAt == nil {
		return false
	}
	l := now.In(s.cfg.TimeZone)
	mins := l.Hour()*60 + l.Minute()
	hm := func(v string) int {
		p := strings.Split(v, ":")
		h, _ := strconv.Atoi(p[0])
		m := 0
		if len(p) > 1 {
			m, _ = strconv.Atoi(p[1])
		}
		return h*60 + m
	}
	return mins >= hm(*c.OpensAt) && mins < hm(*c.ClosesAt)
}

func (s *Server) composeServices(ctx context.Context, a *authenticated, u *property.UnitRecord, degraded []DegradedSection) (any, error) {
	office, err := s.prop.GetManagementOffice(ctx, u.EstateID)
	if err != nil {
		return nil, err
	}
	services, sok, err := s.screenContent(ctx, "mob-03-services", "services", a.scenario)
	if err != nil {
		return nil, err
	}
	note, nok, err := s.screenContent(ctx, "mob-03-services", "comingSoonNote", a.scenario)
	if err != nil {
		return nil, err
	}
	if office == nil {
		return nil, fmt.Errorf("estate %s has no management office contact (PRP-04)", u.EstateID)
	}
	empty := platform.LocalizedText{}
	hours, avail := empty, empty
	if office.Hours != nil {
		hours = *office.Hours
	}
	if office.Instructions != nil {
		avail = *office.Instructions
	}
	help := obj("openNow", !hasSection(degraded, "helpDesk") && s.isOpenNow(*office, a.ctx.Now), "hours", hours,
		"availability", avail, "telephoneAvailable", office.Telephone != nil).
		when(office.TypicalReplyMinutes != nil, "typicalReplyMinutes", office.TypicalReplyMinutes)
	return obj("meta", s.buildMeta(a.ctx, degraded), "unit", unitContext(*u), "helpDesk", help,
		"services", orEmpty(services, sok)).when(nok, "comingSoonNote", note), nil
}

func locationView(l homesafety.SafetyLocation) O {
	return obj("label", l.Label, "locationClass", l.LocationClass, "audienceSource", l.AudienceSource).
		when(l.ServingScopeLabel != nil, "servingScopeLabel", l.ServingScopeLabel)
}

func (s *Server) composeSafetyOverview(ctx context.Context, a *authenticated, u *property.UnitRecord, degraded []DegradedSection) (any, error) {
	c := a.ctx
	summary, err := s.safetySummary(ctx, u.UnitID, c)
	if err != nil {
		return nil, err
	}
	svcs, err := s.hs.ListInstalledServices(ctx, u.UnitID, c.Now)
	if err != nil {
		return nil, err
	}
	note, err := s.hs.GetInstalledServicesNote(ctx, u.UnitID)
	if err != nil {
		return nil, err
	}
	events := []homesafety.SafetyEventSummary{}
	if !hasSection(degraded, "recentEvents") {
		if events, err = s.hs.ListRecentForUnit(ctx, u.UnitID); err != nil {
			return nil, err
		}
	}
	sv := make([]O, 0, len(svcs))
	for _, x := range svcs {
		sv = append(sv, obj("serviceKey", x.ServiceKey, "name", x.Name, "location", x.Location, "state", x.State,
			"severity", x.Severity, "observedAt", s.fmtLocalStr(x.ObservedAt)))
	}
	ev := make([]O, 0, len(events))
	for _, e := range events {
		ev = append(ev, obj("eventId", e.EventID, "severity", e.Severity, "title", e.Title, "occurredAt", s.fmtLocalStr(e.OccurredAt),
			"receivedAt", s.fmtLocalStr(e.ReceivedAt), "location", locationView(e.Location)).when(e.StatusNote != nil, "statusNote", e.StatusNote))
	}
	return obj("meta", s.buildMeta(c, degraded), "unit", unitContext(*u), "safety", summary, "installedServices", sv).
		when(note != nil, "installedServicesNote", note).with("recentEvents", ev), nil
}

func (s *Server) composeSafetyEvent(c RequestContext, e *homesafety.SafetyEventDetail, degraded []DegradedSection) any {
	actions := make([]O, 0, len(e.Actions))
	for _, a := range e.Actions {
		actions = append(actions, obj("actionKey", a.ActionKey, "label", a.Label, "kind", a.Kind).when(a.Telephone != nil, "telephone", a.Telephone))
	}
	updates := []O{}
	if !hasSection(degraded, "managementUpdates") {
		for _, u := range e.ManagementUpdates {
			updates = append(updates, obj("updateId", u.UpdateID, "publishedAt", s.fmtLocalStr(u.PublishedAt), "body", u.Body, "isAllClear", u.IsAllClear))
		}
	}
	var ackAt any
	if e.Acknowledgement.AcknowledgedAt != nil {
		ackAt = s.fmtLocalStr(*e.Acknowledgement.AcknowledgedAt)
	}
	return obj("meta", s.buildMeta(c, degraded), "event", obj("eventId", e.EventID, "severity", e.Severity, "title", e.Title,
		"instruction", e.Instruction, "location", locationView(e.Location), "occurredAt", s.fmtLocalStr(e.OccurredAt),
		"receivedAt", s.fmtLocalStr(e.ReceivedAt), "reportedBy", e.ReportedBy, "actions", actions, "managementUpdates", updates,
		"managementUpdatePending", e.ManagementUpdatePending,
		"acknowledgement", obj("required", e.Acknowledgement.Required, "acknowledged", e.Acknowledgement.Acknowledged, "acknowledgedAt", ackAt),
		"disclaimer", e.Disclaimer,
		"revision", obj("revisionNumber", e.Revision.RevisionNumber, "isCorrection", e.Revision.IsCorrection, "supersedes", nilStr(e.Revision.Supersedes)).
			when(e.Revision.CorrectionNote != nil, "correctionNote", e.Revision.CorrectionNote)))
}

func (s *Server) composeAccount(ctx context.Context, a *authenticated, degraded []DegradedSection) (any, error) {
	c := a.ctx
	res, err := s.res.GetResident(ctx, c.ResidentID)
	if err != nil {
		return nil, err
	}
	pass, err := s.res.GetPass(ctx, c.ResidentID)
	if err != nil {
		return nil, err
	}
	prefs, err := s.res.ListPreferences(ctx, c.ResidentID)
	if err != nil {
		return nil, err
	}
	rels, err := s.res.ListAllRelationships(ctx, c.ResidentID)
	if err != nil {
		return nil, err
	}
	if res == nil {
		return nil, fmt.Errorf("resident %s vanished mid-request", c.ResidentID)
	}
	if pass == nil {
		return nil, fmt.Errorf("resident %s has no pass record", c.ResidentID)
	}
	cutoff := c.Now.Add(-30 * 24 * time.Hour)
	var visible []resident.UnitRelationship
	for _, r := range rels {
		if r.UnitClass != "residential" {
			continue
		}
		if r.EffectiveTo == nil {
			visible = append(visible, r)
			continue
		}
		if t, _ := platform.ParseISO(*r.EffectiveTo); !t.Before(cutoff) {
			visible = append(visible, r)
		}
	}
	if hasSection(degraded, "memberships") && len(visible) > 1 {
		visible = visible[:1]
	}
	ids := make([]string, len(visible))
	for i, r := range visible {
		ids[i] = r.UnitID
	}
	units, err := s.prop.GetResidentialUnits(ctx, c.OrganizationID, ids)
	if err != nil {
		return nil, err
	}
	by := map[string]property.UnitRecord{}
	for _, u := range units {
		by[u.UnitID] = u
	}
	mems := []O{}
	for _, rel := range visible {
		if rec, ok := by[rel.UnitID]; ok {
			m := s.membership(rec, rel, "")
			mems = append(mems, m.set("isCurrent", len(mems) == 0))
		}
	}
	unitLine := platform.LocalizedText{}
	if len(units) > 0 {
		unitLine = displayLine(units[0])
	}
	pv := make([]O, 0, len(prefs))
	for _, p := range prefs {
		pv = append(pv, obj("preferenceKey", p.PreferenceKey, "label", p.Label).when(p.Description != nil, "description", p.Description).
			with("enabled", p.Enabled, "locked", p.Locked).when(p.LockReason != nil, "lockReason", p.LockReason).with("channels", p.Channels))
	}
	return obj("meta", s.buildMeta(c, degraded),
		"resident", obj("residentId", res.ResidentID, "displayName", res.DisplayName, "greeting", s.greeting(c.Now)),
		"pass", obj("passReference", pass.PassReference, "holderName", res.DisplayName, "unitDisplayLine", unitLine,
			"carriesAccess", false, "note", pass.Note),
		"memberships", mems, "notificationPreferences", pv, "language", res.PreferredLanguage), nil
}

func (s *Server) loadAuthorizedEvent(ctx context.Context, a *authenticated, eventID string) (*homesafety.SafetyEventDetail, error) {
	rels, err := s.res.ListAuthorizedUnits(ctx, a.ctx.ResidentID, a.ctx.Now)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(rels))
	for i, r := range rels {
		ids[i] = r.UnitID
	}
	units, err := s.prop.GetResidentialUnits(ctx, a.ctx.OrganizationID, ids)
	if err != nil {
		return nil, err
	}
	uids := make([]string, len(units))
	for i, u := range units {
		uids[i] = u.UnitID
	}
	return s.hs.GetForAudience(ctx, eventID, uids, a.ctx.ResidentID)
}

// ---- resident routes ----

func (s *Server) residentRoutes() {
	unitScreen := func(screen string, compose func(context.Context, *authenticated, *property.UnitRecord, []DegradedSection) (any, error)) routeFunc {
		return func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
			a := s.authenticate(w, r)
			if a == nil {
				return
			}
			u := s.authorizeUnit(w, r, a, queryAny(r, "unitId"))
			if u == nil {
				return
			}
			d, err := s.degradedFor(r.Context(), screen, a)
			if err == nil {
				var out any
				if out, err = compose(r.Context(), a, u, d); err == nil {
					s.writeJSON(w, 200, out)
					return
				}
			}
			s.handleReadError(w, r, err)
		}
	}
	const base = "/api/resident-mobile/v0"
	s.handle("GET", base+"/home", unitScreen("mob-02-home", s.composeHome))
	s.handle("GET", base+"/services", unitScreen("mob-03-services", s.composeServices))
	s.handle("GET", base+"/safety/overview", unitScreen("mob-08-safety-overview", s.composeSafetyOverview))

	s.handle("GET", base+"/safety/events/{eventId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		a := s.authenticate(w, r)
		if a == nil {
			return
		}
		e, err := s.loadAuthorizedEvent(r.Context(), a, r.PathValue("eventId"))
		if err != nil {
			s.handleReadError(w, r, err)
			return
		}
		if e == nil {
			s.sendProblem(w, r, problems.EventNotFound())
			return
		}
		if e.Retracted {
			s.sendProblem(w, r, problems.EventRetracted(e.SupersededBy))
			return
		}
		d, err := s.degradedFor(r.Context(), "mob-09-safety-event-detail", a)
		if err != nil {
			s.handleReadError(w, r, err)
			return
		}
		s.writeJSON(w, 200, s.composeSafetyEvent(a.ctx, e, d))
	})

	s.handle("PUT", base+"/safety/events/{eventId}/acknowledgement", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		a := s.authenticate(w, r)
		if a == nil {
			return
		}
		eventID, f1 := validateEventID(r.PathValue("eventId"))
		key, f2 := validateAcknowledgementKey(body["acknowledgementKey"])
		action, f3 := validateAction(body["action"])
		occurredAt, f4 := validateOptionalOccurredAt(body["occurredAt"])
		for _, f := range []*EdgeFailure{f1, f2, f3, f4} {
			if f != nil {
				s.log.Warn("acknowledgement input rejected at the edge", map[string]any{"correlationId": correlationOf(r), "field": f.Field, "reason": f.Kind})
				s.sendProblem(w, r, problems.BadRequest(describeEdge(f)))
				return
			}
		}
		e, err := s.loadAuthorizedEvent(r.Context(), a, eventID)
		if err != nil {
			s.handleReadError(w, r, err)
			return
		}
		if e == nil {
			s.sendProblem(w, r, problems.EventNotFound())
			return
		}
		if e.Retracted {
			s.sendProblem(w, r, problems.EventRetracted(e.SupersededBy))
			return
		}
		occ := platform.ISO(a.ctx.Now)
		if occurredAt != nil {
			occ = *occurredAt
		}
		res, err := s.hs.Acknowledge(r.Context(), homesafety.AcknowledgeInput{EventID: eventID, ResidentID: a.ctx.ResidentID,
			AcknowledgementKey: key, Action: action, OccurredAt: occ, ReceivedAt: platform.ISO(a.ctx.Now), CorrelationID: a.ctx.CorrelationID})
		if err != nil {
			s.handleReadError(w, r, err)
			return
		}
		if res.Kind == "duplicate" {
			s.sendProblem(w, r, problems.DuplicateAcknowledgement())
			return
		}
		var at any
		if res.State.AcknowledgedAt != nil {
			at = s.fmtLocalStr(*res.State.AcknowledgedAt)
		}
		s.writeJSON(w, 200, obj("meta", obj("correlationId", a.ctx.CorrelationID, "contractVersion", s.residentContract, "generatedAt", s.fmtLocal(a.ctx.Now)),
			"eventId", eventID,
			"acknowledgement", obj("required", res.State.Required, "acknowledged", res.State.Acknowledged, "acknowledgedAt", at),
			"replayed", res.Kind == "replayed",
			"confirmation", platform.LocalizedText{En: "Thank you. The management office can see that you are safe.", ZhHant: "謝謝。管理處已知悉您安全。"}))
	})

	s.handle("GET", base+"/account", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		a := s.authenticate(w, r)
		if a == nil {
			return
		}
		d, err := s.degradedFor(r.Context(), "mob-11-account", a)
		if err == nil {
			var out any
			if out, err = s.composeAccount(r.Context(), a, d); err == nil {
				s.writeJSON(w, 200, out)
				return
			}
		}
		s.handleReadError(w, r, err)
	})
}
