package api

import (
	"context"
	"encoding/base64"
	"net/http"
	"sort"
	"sync"
	"time"

	"pemo/internal/notices"
	"pemo/internal/platform"
	"pemo/internal/strata"
)

func b64(s string) string { return base64.StdEncoding.EncodeToString([]byte(s)) }

func noticesRule(org string, targets []notices.Target) notices.AudienceRule {
	return notices.AudienceRule{OrganizationID: org, Targets: targets}
}

// routes registers every route on a fresh mux.
func (s *Server) routes() {
	s.mux = http.NewServeMux()
	s.handle("GET", "/health", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		stats := platform.PoolStats()
		sort.Slice(stats, func(i, j int) bool { return stats[i].Name < stats[j].Name })
		s.writeJSON(w, 200, obj("status", "ok", "service", s.cfg.ServiceName, "pools", stats))
	})
	s.handle("GET", "/ready", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		pools := s.pools()
		deps := make([]platform.DependencyStatus, len(pools))
		var wg sync.WaitGroup
		for i, p := range pools {
			wg.Add(1)
			go func(i int, p namedPool) {
				defer wg.Done()
				deps[i] = platform.CheckDatabase(ctx, p.db, p.name)
				if !deps[i].OK {
					// Driver messages can carry host names; log them, show a generic detail.
					s.log.Warn("readiness check failed", map[string]any{"pool": p.name, "error": deps[i].Detail})
					deps[i].Detail = "database unavailable"
				}
			}(i, p)
		}
		wg.Wait()
		ready := true
		for _, d := range deps {
			ready = ready && d.OK
		}
		status := 200
		if !ready {
			status = 503
		}
		s.writeJSON(w, status, obj("ready", ready, "dependencies", deps))
	})
	s.residentRoutes()
	s.staffRoutes()
	if s.cfg.EnableDemoRoutes {
		s.registerDemoRoutes()
	}
}

// ---- strata ----

func (s *Server) chargeJSON(c strata.ChargeRecord) O {
	var recorded any
	if c.InvoiceEmail.RecordedAt != nil {
		recorded = s.fmtLocal(*c.InvoiceEmail.RecordedAt)
	}
	return obj("chargeId", c.ChargeID, "householdId", c.HouseholdID, "residentId", c.ResidentID, "payerName", c.PayerName,
		"unitSummary", c.UnitSummary, "scope", c.Scope, "period", c.Period, "kind", c.Kind, "issuedOn", c.IssuedOn,
		"dueOn", c.DueOn, "amountHkd", c.AmountHkd, "paidHkd", c.PaidHkd, "status", c.Status, "tone", c.Tone,
		"staffNotes", c.StaffNotes, "invoiceNumber", c.InvoiceNumber, "scheduledSendAt", s.fmtLocal(c.ScheduledSendAt),
		"contactEmail", c.ContactEmail, "lineItems", c.LineItems,
		"invoiceEmail", obj("status", c.InvoiceEmail.Status, "recordedAt", recorded, "transport", c.InvoiceEmail.Transport, "detail", c.InvoiceEmail.Detail))
}

func paymentJSON(p strata.PaymentRecord) O {
	return obj("paymentId", p.PaymentID, "householdId", p.HouseholdID, "residentId", p.ResidentID, "payerName", p.PayerName,
		"unitSummary", p.UnitSummary, "scope", p.Scope, "paidOn", p.PaidOn, "method", p.Method, "amountHkd", p.AmountHkd,
		"reference", p.Reference, "staffNotes", p.StaffNotes, "allocations", p.Allocations)
}

func (s *Server) strataRoutes() {
	s.handle("GET", mgmt+"/strata/charges", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		f, err := s.strataScope(r.Context(), sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		cs, err := s.strata.ListCharges(r.Context(), f)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		out := make([]O, len(cs))
		for i, c := range cs {
			out[i] = s.chargeJSON(c)
		}
		s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "charges", out))
	})
	s.handle("GET", mgmt+"/strata/charges/{chargeId}", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		id := r.PathValue("chargeId")
		if id == "" || len([]rune(id)) > 120 {
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("The charge identifier is missing or malformed.", "帳單識別碼缺少或格式不正確。")))
			return
		}
		ctx := r.Context()
		f, err := s.strataScope(ctx, sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		c, err := s.strata.GetCharge(ctx, f, id)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		if c == nil {
			s.sendStaffProblem(w, r, staffProblems.ChargeNotFound())
			return
		}
		receipts, err := s.strata.ReceiptsFor(ctx, id)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		sends, err := s.comms.ListForSubject(ctx, sc.OrganizationID, "invoice", id)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		visible := []O{}
		for _, row := range sends {
			ok, err := s.maySeeRecipientScope(ctx, sc, row.RecipientScopeNodeKind, row.RecipientScopeNodeID)
			if err != nil {
				s.handleManagementError(w, r, err)
				return
			}
			if ok {
				visible = append(visible, obj("outboxId", row.OutboxID, "to", row.To, "subject", row.Subject,
					"status", strata.PresentationStatus(row.Status, row.ClaimedAt, time.Now()), "transport", row.Transport,
					"detail", row.Detail, "recordedAt", s.fmtLocal(row.RecordedAt)))
			}
		}
		if receipts == nil {
			receipts = []strata.ReceiptRecord{}
		}
		s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "charge", s.chargeJSON(*c), "receipts", receipts, "invoiceSends", visible))
	})
	s.handle("GET", mgmt+"/strata/payments", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		f, err := s.strataScope(r.Context(), sc)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		ps, err := s.strata.ListPayments(r.Context(), f)
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		out := make([]O, len(ps))
		for i, p := range ps {
			out[i] = paymentJSON(p)
		}
		s.writeJSON(w, 200, obj("meta", s.managementMeta(sc), "payments", out))
	})
}
