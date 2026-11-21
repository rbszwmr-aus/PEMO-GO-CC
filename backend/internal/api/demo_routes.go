package api

import (
	"context"
	"net/http"
	"regexp"
	"strings"
	"time"

	"pemo/internal/access"
	"pemo/internal/demo"
	"pemo/internal/platform"
)

// demoState holds the in-memory demo stores. They are reachable only when
// PEMO_ENABLE_DEMO_ROUTES=1 (the Node build registered the ticket routes,
// including unauthenticated resident-portal ones, unconditionally).
type demoState struct {
	tickets  *demo.TicketStore
	invoices *demo.InvoiceStore
	notices  *demo.NoticeStore
	visitors *demo.VisitorStore
	qr       *demo.QRPassStore
}

func newDemoState() *demoState {
	d := &demoState{demo.NewTicketStore(demo.SeedTickets()), demo.NewInvoiceStore(), demo.NewNoticeStore(), demo.NewVisitorStore(), demo.NewQRPassStore(nil)}
	for _, v := range demo.SeedVisitors() {
		if cur := d.visitors.Get(v.VisitorID); cur != nil {
			d.qr.EnsureVisitorPass(*cur, true)
		}
	}
	return d
}

const demoResidentHeader = "x-pemo-demo-resident"

func wantsDemo(r *http.Request) bool {
	v := r.URL.Query().Get("demo")
	return v == "1" || v == "true"
}

func demoResident(r *http.Request) string {
	if v := strings.TrimSpace(r.Header.Get(demoResidentHeader)); v != "" {
		return v
	}
	return demo.FixtureResidentID
}

var bearerRe = regexp.MustCompile(`(?i)^Bearer\s+(\S+)`)

func hasBearer(r *http.Request) bool {
	return bearerRe.MatchString(strings.TrimSpace(r.Header.Get("authorization")))
}

func (s *Server) demoMeta(sc *StaffContext) O {
	m := s.managementMeta(sc)
	return obj("correlationId", m.CorrelationID, "contractVersion", m.ContractVersion, "generatedAt", m.GeneratedAt, "demo", true)
}

func (s *Server) tryDemoHelpdeskQueue(r *http.Request, sc *StaffContext) (any, bool) {
	if s.demo == nil || !s.cfg.EnableDemoRoutes || !wantsDemo(r) {
		return nil, false
	}
	rows := []demo.QueueRow{}
	waiting := 0
	for _, t := range s.demo.tickets.ListAll() {
		row := demo.ToQueueRow(t, sc.Now)
		if row.State == "waiting" || row.State == "overdue" {
			waiting++
		}
		rows = append(rows, row)
	}
	tone := "normal"
	if waiting > 0 {
		tone = "warning"
	}
	return obj("meta", s.demoMeta(sc), "stats", []O{
		obj("id", "waiting", "label", lz("WAITING", "等候中"), "value", itoa(int64(waiting)), "note", lz("demo store", "示範資料"), "tone", tone),
		obj("id", "answered", "label", lz("IN DEMO STORE", "示範庫內"), "value", itoa(int64(len(rows))), "note", lz("in-memory only", "僅記憶體"), "tone", "info"),
	}, "rows", rows), true
}

// tryDemoHelpdeskContact: handled=false means "not a demo request".
func (s *Server) tryDemoHelpdeskContact(r *http.Request, sc *StaffContext, id string) (any, bool, bool) {
	if s.demo == nil || !s.cfg.EnableDemoRoutes || !wantsDemo(r) {
		return nil, false, false
	}
	t := s.demo.tickets.Get(id)
	if t == nil {
		return nil, true, false
	}
	return obj("meta", s.demoMeta(sc), "contact", demo.ToContactDetail(*t, sc.Now), "ticket", t), true, true
}

func (s *Server) portalMeta(r *http.Request, tag string, extra ...any) O {
	cid := r.Header.Get("x-correlation-id")
	if cid == "" {
		cid = tag
	}
	return obj("correlationId", cid, "demo", true, "generatedAt", s.fmtLocal(time.Now())).with(extra...)
}

func (s *Server) plainProblem(w http.ResponseWriter, status int, kind, title, detail string) {
	s.writeJSON(w, status, obj("type", "https://pemo.local/problems/"+kind, "title", title, "status", status, "detail", detail))
}

func trimmed(body map[string]any, k string) (string, bool) {
	v, ok := body[k].(string)
	return v, ok && strings.TrimSpace(v) != ""
}

func optString(body map[string]any, k string) *string {
	if v, ok := body[k].(string); ok {
		return &v
	}
	return nil
}

// registerDemoRoutes mounts every demo route (tickets, invoices, notices and
// visitors, QR passes) on the server's mux.
func (s *Server) registerDemoRoutes() {
	d := s.demo
	// ---- tickets: resident portal ----
	const portal = "/api/resident-portal/v0/tickets"
	s.handle("GET", portal, func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		rep := demoResident(r)
		out := []demo.PortalSummary{}
		for _, t := range d.tickets.ListForReporter(rep) {
			out = append(out, demo.ToPortalSummary(t))
		}
		s.writeJSON(w, 200, obj("meta", s.portalMeta(r, "demo-portal-list", "reporterRef", rep), "tickets", out))
	})
	s.handle("POST", portal, func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		rep := demoResident(r)
		subject, ok := trimmed(body, "subject")
		if !ok {
			s.plainProblem(w, 400, "bad-request", "Bad Request", "subject is required")
			return
		}
		in := demo.CreateTicketInput{Subject: subject, ReporterRef: rep, CreatedByResidentID: rep, CreatedByName: rep, Category: "general"}
		if rep == demo.FixtureResidentID {
			in.CreatedByName = demo.FixtureResidentName
		}
		if v, ok := body["body"].(string); ok {
			in.Body = v
		}
		if v, ok := body["category"].(string); ok {
			in.Category = v
		}
		if v, ok := body["unitLabel"].(string); ok {
			in.UnitLabel = v
		}
		t := d.tickets.Create(in)
		s.writeJSON(w, 201, obj("meta", s.portalMeta(r, "demo-portal-create"), "ticket", demo.ToPortalDetail(t), "fullTicket", t))
	})
	s.handle("GET", portal+"/{ticketId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		rep := demoResident(r)
		t := d.tickets.Get(r.PathValue("ticketId"))
		if t == nil || (t.ReporterRef != rep && t.CreatedByResidentID != rep) {
			s.plainProblem(w, 404, "not-found", "Not Found", "Ticket not found")
			return
		}
		s.writeJSON(w, 200, obj("meta", s.portalMeta(r, "demo-portal-detail"), "ticket", demo.ToPortalDetail(*t)))
	})
	// ---- tickets: staff ----
	notFound := func(w http.ResponseWriter, r *http.Request) {
		s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("Contact not found in the demo store.", "示範庫中找不到此聯絡。")))
	}
	staffReply := func(w http.ResponseWriter, sc *StaffContext, t *demo.Ticket) {
		s.writeJSON(w, 200, obj("meta", s.demoMeta(sc), "contact", demo.ToContactDetail(*t, sc.Now), "ticket", t))
	}
	s.handle("POST", mgmt+"/helpdesk/contacts/{contactId}/assign", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.demoStaff(w, r)
		if sc == nil {
			return
		}
		id, ok1 := trimmed(body, "adminId")
		label, ok2 := trimmed(body, "adminLabel")
		if !ok1 || !ok2 {
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("adminId and adminLabel are required.", "必須提供 adminId 與 adminLabel。")))
			return
		}
		t := d.tickets.Assign(r.PathValue("contactId"), strings.TrimSpace(id), strings.TrimSpace(label))
		if t == nil {
			notFound(w, r)
			return
		}
		staffReply(w, sc, t)
	})
	s.handle("POST", mgmt+"/helpdesk/contacts/{contactId}/status", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.demoStaff(w, r)
		if sc == nil {
			return
		}
		st, ok := body["status"].(string)
		if !ok || !demo.IsTicketStatus(st) {
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("status must be a TicketStatus value.", "status 必須為 TicketStatus 值。")))
			return
		}
		t := d.tickets.SetStatus(r.PathValue("contactId"), st, "")
		if t == nil {
			notFound(w, r)
			return
		}
		staffReply(w, sc, t)
	})
	s.handle("GET", mgmt+"/helpdesk/portal-tickets", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.demoStaff(w, r)
		if sc == nil {
			return
		}
		s.writeJSON(w, 200, obj("meta", s.demoMeta(sc), "tickets", d.tickets.ListAll()))
	})
	s.handle("GET", mgmt+"/helpdesk/portal-tickets/{ticketId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.demoStaff(w, r)
		if sc == nil {
			return
		}
		t := d.tickets.Get(r.PathValue("ticketId"))
		if t == nil {
			notFound(w, r)
			return
		}
		s.writeJSON(w, 200, t)
	})
	s.registerNoticesVisitorsDemo()
	s.registerInvoicesDemo()
	s.registerQRPassDemo()
}

// demoStaff authenticates staff: the real staff check on the API server,
// any bearer on the standalone demo server.
func (s *Server) demoStaff(w http.ResponseWriter, r *http.Request) *StaffContext {
	if !s.demoOnly {
		return s.authenticateStaff(w, r)
	}
	if !hasBearer(r) {
		s.sendStaffProblem(w, r, staffProblems.InvalidCredential())
		return nil
	}
	now := time.Now()
	return &StaffContext{PrincipalID: "prin_demo_staff", OrganizationID: "org_demo_tickets", CorrelationID: correlationOf(r), Now: now,
		Scope: &access.ResolvedScope{PrincipalID: "prin_demo_staff", OrganizationID: "org_demo_tickets", AsAt: platform.ISO(now), Grants: []access.ScopeGrant{}}}
}

func (s *Server) registerNoticesVisitorsDemo() {
	d := s.demo
	const notices, visitors = "/api/resident-portal/v0/notices", "/api/resident-portal/v0/visitors"
	type visitorWithPass struct {
		demo.Visitor
		Pass *demo.PassView `json:"pass"`
	}
	withPass := func(v demo.Visitor) visitorWithPass { return visitorWithPass{v, d.qr.ViewVisitorPass(v)} }
	s.handle("GET", notices, func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		s.writeJSON(w, 200, obj("meta", s.portalMeta(r, "demo-notices-list", "reporterRef", demoResident(r)), "notices", d.notices.ListAll()))
	})
	s.handle("GET", notices+"/{noticeId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		n := d.notices.Get(r.PathValue("noticeId"))
		if n == nil {
			s.plainProblem(w, 404, "not-found", "Not Found", "Notice not found")
			return
		}
		s.writeJSON(w, 200, obj("meta", s.portalMeta(r, "demo-notices-detail"), "notice", n))
	})
	s.handle("GET", visitors, func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		rep := demoResident(r)
		out := []visitorWithPass{}
		for _, v := range d.visitors.ListForResident(rep) {
			out = append(out, withPass(v))
		}
		s.writeJSON(w, 200, obj("meta", s.portalMeta(r, "demo-visitors-list", "reporterRef", rep), "visitors", out))
	})
	s.handle("POST", visitors, func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		rep := demoResident(r)
		name, ok := trimmed(body, "name")
		if !ok {
			s.plainProblem(w, 400, "bad-request", "Bad Request", "name is required")
			return
		}
		from, ok := trimmed(body, "expectedFrom")
		if !ok {
			s.plainProblem(w, 400, "bad-request", "Bad Request", "expectedFrom is required")
			return
		}
		to, ok := trimmed(body, "expectedTo")
		if !ok {
			s.plainProblem(w, 400, "bad-request", "Bad Request", "expectedTo is required")
			return
		}
		v := d.visitors.Create(demo.CreateVisitorInput{Name: name, ExpectedFrom: from, ExpectedTo: to, ResidentRef: rep,
			Purpose: optString(body, "purpose"), HostUnitID: optString(body, "hostUnitId"), IDStub: optString(body, "idStub")})
		d.qr.EnsureVisitorPass(v, false)
		s.writeJSON(w, 201, obj("meta", s.portalMeta(r, "demo-visitors-create"), "visitor", withPass(v)))
	})
	s.handle("GET", visitors+"/{visitorId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		v := d.visitors.Get(r.PathValue("visitorId"))
		if v == nil || v.ResidentRef != demoResident(r) {
			s.plainProblem(w, 404, "not-found", "Not Found", "Visitor not found")
			return
		}
		s.writeJSON(w, 200, obj("meta", s.portalMeta(r, "demo-visitors-detail"), "visitor", withPass(*v)))
	})
	checkOut := func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		id := r.PathValue("visitorId")
		v := d.visitors.Get(id)
		if v == nil || v.ResidentRef != demoResident(r) {
			s.plainProblem(w, 404, "not-found", "Not Found", "Visitor not found")
			return
		}
		u := d.visitors.CheckOut(id)
		if u == nil {
			s.plainProblem(w, 400, "bad-request", "Bad Request", "Unable to check out visitor")
			return
		}
		s.writeJSON(w, 200, obj("meta", s.portalMeta(r, "demo-visitors-checkout"), "visitor", withPass(*u)))
	}
	s.handle("POST", visitors+"/{visitorId}/check-out", checkOut)
	s.handle("PATCH", visitors+"/{visitorId}/check-out", checkOut)
}

func (s *Server) registerInvoicesDemo() {
	d := s.demo
	const base = "/api/resident-portal/v0/invoices"
	sendP := func(w http.ResponseWriter, r *http.Request, p *platform.Problem, tag string) {
		cid := r.Header.Get("x-correlation-id")
		if cid == "" {
			cid = tag
		}
		w.Header().Set("content-type", "application/problem+json; charset=utf-8")
		w.WriteHeader(p.Status)
		b, _ := marshalNoEscape(orderedProblem(p.Body(cid)))
		_, _ = w.Write(b)
	}
	guard := func(w http.ResponseWriter, r *http.Request, tag string) (string, *string, bool) {
		if !hasBearer(r) {
			sendP(w, r, problems.InvalidCredential(), tag)
			return "", nil, false
		}
		rep := demoResident(r)
		return rep, d.invoices.HouseholdForResident(rep), true
	}
	s.handle("GET", base+"/summary", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		rep, h, ok := guard(w, r, "demo-invoices-summary")
		if !ok {
			return
		}
		s.writeJSON(w, 200, obj("meta", s.portalMeta(r, "demo-invoices-summary", "reporterRef", rep), "summary", d.invoices.SummaryForHousehold(h)))
	})
	s.handle("GET", base, func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		const tag = "demo-invoices-list"
		rep, h, ok := guard(w, r, tag)
		if !ok {
			return
		}
		status := ""
		if q := r.URL.Query(); q.Has("status") {
			status = strings.ToUpper(strings.TrimSpace(q.Get("status")))
			if !demo.IsInvoiceStatus(status) {
				sendP(w, r, problems.BadRequest("status must be one of UNPAID, PARTIAL, PAID, OVERDUE"), tag)
				return
			}
		}
		meta := s.portalMeta(r, tag, "reporterRef", rep, "householdId", h).when(status != "", "status", status)
		invoices := []demo.InvoiceRow{}
		if h != nil {
			invoices = d.invoices.ListForHousehold(*h, status)
		}
		s.writeJSON(w, 200, obj("meta", meta, "invoices", invoices))
	})
	s.handle("GET", base+"/{invoiceId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		const tag = "demo-invoices-detail"
		rep, h, ok := guard(w, r, tag)
		if !ok {
			return
		}
		var inv *demo.InvoiceDetail
		if h != nil {
			inv = d.invoices.GetForHousehold(*h, r.PathValue("invoiceId"))
		}
		if inv == nil {
			sendP(w, r, &platform.Problem{Type: "https://pemo.local/problems/not-found", Title: "Not Found", Status: 404, Detail: "Invoice not found",
				ResidentMessage: lt("This invoice could not be found.", "找不到此帳單。"), Retryable: bp(false)}, tag)
			return
		}
		s.writeJSON(w, 200, obj("meta", s.portalMeta(r, tag, "reporterRef", rep), "invoice", inv))
	})
}

const qrBase, qrDemoBase = "/api/qr-pass/v0", "/api/demo/qr-pass/v0"

func (s *Server) qrProblem(w http.ResponseWriter, r *http.Request, p *demo.Problem, extra ...any) {
	w.Header().Set("content-type", "application/problem+json; charset=utf-8")
	w.WriteHeader(p.Status)
	b, _ := marshalNoEscape(obj("type", "https://pemo.example/problems/qr-pass/"+p.Suffix, "title", p.Title, "status", p.Status,
		"detail", p.Detail, "instance", r.URL.Path).with(extra...))
	_, _ = w.Write(b)
}

func (s *Server) registerQRPassDemo() {
	store := s.demo.qr
	unauthorized := func(detail string) *demo.Problem {
		return &demo.Problem{Suffix: "unauthorized", Status: 401, Title: "Unauthorized", Detail: detail}
	}
	module := func(w http.ResponseWriter, r *http.Request) bool {
		if !hasBearer(r) {
			s.qrProblem(w, r, unauthorized("Missing or invalid module credential (demo: Authorization: Bearer <token>)"))
			return false
		}
		return true
	}
	reader := func(w http.ResponseWriter, r *http.Request) bool {
		if !hasBearer(r) {
			s.qrProblem(w, r, unauthorized("Missing or invalid reader credential (demo: Authorization: Bearer demo)"))
			return false
		}
		return true
	}
	objectBody := func(body map[string]any) map[string]any {
		if _, nonObj := body["__nonObject"]; nonObj {
			return map[string]any{}
		}
		return body
	}
	s.handle("POST", qrBase+"/passes", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		if !module(w, r) {
			return
		}
		resp, _, p := store.Issue(demo.IssueInput(objectBody(body)), demo.DemoModule, strings.TrimSpace(r.Header.Get("idempotency-key")), false)
		if p != nil {
			s.qrProblem(w, r, p)
			return
		}
		s.writeJSON(w, 201, resp)
	})
	s.handle("GET", qrBase+"/passes/{passId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		if !module(w, r) {
			return
		}
		v, p := store.Get(r.PathValue("passId"), demo.DemoModule)
		if p != nil {
			s.qrProblem(w, r, p)
			return
		}
		s.writeJSON(w, 200, v)
	})
	s.handle("POST", qrBase+"/passes/{passId}/revoke", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		if !module(w, r) {
			return
		}
		v, p := store.Revoke(r.PathValue("passId"), objectBody(body)["reason"], demo.DemoModule)
		if p != nil {
			s.qrProblem(w, r, p)
			return
		}
		s.writeJSON(w, 200, v)
	})
	scanReply := func(w http.ResponseWriter, r *http.Request, out *demo.ScanOutcome, passID string) {
		if res := out.Scan.Result; res == "REJECTED_USE_LIMIT" || res == "REJECTED_REPLAY" {
			s.qrProblem(w, r, &demo.Problem{Suffix: "use-limit-reached", Status: 409, Title: "Use limit reached", Detail: "pass " + passID + " has no uses left"}, "scan", out.Scan)
			return
		}
		s.writeJSON(w, 200, out)
	}
	s.handle("POST", qrBase+"/passes/{passId}/uses", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		if !reader(w, r) {
			return
		}
		b := objectBody(body)
		id := r.PathValue("passId")
		out, p := store.Scan(demo.ScanInput{Payload: b["payload"], PassID: &id, DeviceID: b["device_id"], LocationRef: b["location_ref"], ModuleDecisionRef: b["module_decision_ref"]})
		if p != nil {
			s.qrProblem(w, r, p)
			return
		}
		scanReply(w, r, out, id)
	})
	s.handle("GET", qrBase+"/.well-known/jwks.json", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		s.writeJSON(w, 200, store.JWKS())
	})
	s.handle("GET", qrBase+"/revocations", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		jws, _, p := store.Revocations(r.URL.Query().Get("since"))
		if p != nil {
			s.qrProblem(w, r, p)
			return
		}
		w.Header().Set("content-type", "application/jose")
		w.WriteHeader(200)
		_, _ = w.Write([]byte(jws))
	})
	s.handle("GET", qrBase+"/scans", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		if !module(w, r) {
			return
		}
		q := r.URL.Query()
		s.writeJSON(w, 200, store.Scans(demo.ScanQuery{Module: demo.DemoModule, PassID: q.Get("pass_id"), Result: q.Get("result"),
			From: q.Get("from"), To: q.Get("to"), DeviceID: q.Get("device_id")}))
	})
	s.handle("POST", qrDemoBase+"/verify", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		if !reader(w, r) {
			return
		}
		b := objectBody(body)
		var passID *string
		if v, ok := b["passId"].(string); ok && v != "" {
			passID = &v
		} else if v, ok := b["pass_id"].(string); ok && v != "" {
			passID = &v
		}
		if b["payload"] != nil {
			passID = nil
		}
		pick := func(a, c string) any {
			if v, ok := b[a]; ok && v != nil {
				return v
			}
			return b[c]
		}
		out, p := store.Scan(demo.ScanInput{Payload: b["payload"], PassID: passID, DeviceID: pick("device_id", "deviceId"),
			LocationRef: pick("location_ref", "locationRef"), ModuleDecisionRef: b["module_decision_ref"]})
		if p != nil {
			s.qrProblem(w, r, p)
			return
		}
		s.writeJSON(w, 200, obj("result", out.Scan.Result, "scan", out.Scan, "claims", out.Claims, "pass", out.Pass, "demo", true))
	})
	s.handle("GET", qrDemoBase+"/outbox", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		if !hasBearer(r) {
			s.qrProblem(w, r, unauthorized("Bearer required"))
			return
		}
		q := r.URL.Query()
		ev := store.Outbox(q.Get("type"), q.Get("pass_id"))
		s.writeJSON(w, 200, obj("demo", true, "transport", "in-memory-outbox", "count", len(ev), "events", ev))
	})
}

// NewDemoOnly builds the standalone demo server (no database): the demo
// routes plus the help-desk queue/contact demo reads.
func NewDemoOnly(_ context.Context, cfg *platform.Config, repoRoot string) *Server {
	cfg.EnableDemoRoutes = true
	s := &Server{cfg: cfg, log: platform.NewLogger(cfg.LogLevel, cfg.ServiceName), demoOnly: true}
	if repoRoot != "" {
		s.managementContract, _ = ReadContractVersion(repoRoot, "management-web")
	}
	s.limiter = newRateLimiter(cfg.RateLimitPerMinute)
	s.demo = newDemoState()
	s.mux = http.NewServeMux()
	ok := func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		s.writeJSON(w, 200, obj("ok", true, "demo", true))
	}
	s.handle("GET", "/health", ok)
	s.handle("GET", "/ready", ok)
	s.handle("GET", mgmt+"/helpdesk/queue", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.demoStaff(w, r)
		if sc == nil {
			return
		}
		if out, ok := s.tryDemoHelpdeskQueue(r, sc); ok {
			s.writeJSON(w, 200, out)
			return
		}
		s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("Demo server requires ?demo=1 on helpdesk queue.", "示範伺服器的 helpdesk queue 需要 ?demo=1。")))
	})
	s.handle("GET", mgmt+"/helpdesk/contacts/{contactId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.demoStaff(w, r)
		if sc == nil {
			return
		}
		id := r.PathValue("contactId")
		if id == "" || len([]rune(id)) > 120 {
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("The contact identifier is missing or malformed.", "聯絡識別碼缺少或格式不正確。")))
			return
		}
		out, handled, found := s.tryDemoHelpdeskContact(r, sc, id)
		switch {
		case handled && !found:
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("Contact not found in the demo store.", "示範庫中找不到此聯絡。")))
		case handled:
			s.writeJSON(w, 200, out)
		default:
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("Demo server requires ?demo=1 on helpdesk contact.", "示範伺服器的 helpdesk contact 需要 ?demo=1。")))
		}
	})
	s.registerDemoRoutes()
	return s
}
