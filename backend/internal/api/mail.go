package api

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/smtp"
	"net/textproto"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"pemo/internal/access"
	"pemo/internal/platform"
	"pemo/internal/strata"
)

// ---- communications port ----

// ErrCommunicationsUnavailable: no adapter is configured (not a send).
var ErrCommunicationsUnavailable = errors.New("communications are unavailable")

// MailDelivery is a transport outcome.
type MailDelivery struct{ Status, Transport, Detail string }

// CommunicationsPort is the outbox seam (strata-backed in the product).
type CommunicationsPort interface {
	ReserveMany(ctx context.Context, rows []strata.ReserveRow) ([]strata.OutboxRecord, error)
	ClaimPending(ctx context.Context, id string) (*strata.OutboxRecord, error)
	RequeueFailed(ctx context.Context, id string) error
	Get(ctx context.Context, id string) (*strata.OutboxRecord, error)
	MarkResult(ctx context.Context, id string, d MailDelivery) error
	ListForSubject(ctx context.Context, org, kind, subject string) ([]strata.OutboxRecord, error)
	NextGeneration(ctx context.Context, org, kind string, subject *string, version int64, to string) (int64, error)
}

type strataComms struct{ s *strata.Strata }

func newStrataCommunicationsAdapter(s *strata.Strata) CommunicationsPort { return &strataComms{s} }

func (c *strataComms) ReserveMany(ctx context.Context, rows []strata.ReserveRow) ([]strata.OutboxRecord, error) {
	return c.s.ReserveMany(ctx, rows)
}
func (c *strataComms) ClaimPending(ctx context.Context, id string) (*strata.OutboxRecord, error) {
	return c.s.ClaimPending(ctx, id)
}
func (c *strataComms) RequeueFailed(ctx context.Context, id string) error {
	return c.s.RequeueFailed(ctx, id)
}
func (c *strataComms) Get(ctx context.Context, id string) (*strata.OutboxRecord, error) {
	return c.s.Get(ctx, id)
}
func (c *strataComms) MarkResult(ctx context.Context, id string, d MailDelivery) error {
	return c.s.MarkResult(ctx, id, d.Status, d.Transport, d.Detail)
}
func (c *strataComms) ListForSubject(ctx context.Context, org, kind, subject string) ([]strata.OutboxRecord, error) {
	return c.s.ListForSubject(ctx, org, kind, subject)
}
func (c *strataComms) NextGeneration(ctx context.Context, org, kind string, subject *string, v int64, to string) (int64, error) {
	return c.s.NextGeneration(ctx, org, kind, subject, v, to)
}

// ---- mailer (net/smtp; replaces nodemailer and its advisories) ----

func env(name string) string { return strings.TrimSpace(os.Getenv(name)) }

func smtpConfigured() bool { return env("SMTP_HOST") != "" || env("SMTP_URL") != "" }

func smtpFromAddress() string {
	if v := env("SMTP_FROM"); v != "" {
		return v
	}
	return "invoices@wingfu.example"
}

const logDetail = "SMTP_HOST and SMTP_URL are unset. The message was recorded on the server and was not handed to an SMTP server."

func redact(msg string) string {
	if p := env("SMTP_PASS"); p != "" {
		msg = strings.ReplaceAll(msg, p, "[redacted]")
	}
	if u := env("SMTP_URL"); u != "" {
		msg = strings.ReplaceAll(msg, u, "smtp://[redacted]")
		if parsed, err := url.Parse(u); err == nil {
			if pw, ok := parsed.User.Password(); ok && pw != "" {
				msg = strings.ReplaceAll(msg, pw, "[redacted]")
			}
		}
	}
	return msg
}

type deliverFn func(to, from, subject, text string) MailDelivery

// deliverOverride lets tests stub the transport.
var deliverOverride deliverFn

func deliverMail(to, from, subject, text string) MailDelivery {
	if deliverOverride != nil {
		return deliverOverride(to, from, subject, text)
	}
	if !smtpConfigured() {
		return MailDelivery{"log-only", "log", logDetail}
	}
	host, port, user, pass := env("SMTP_HOST"), 587, env("SMTP_USER"), env("SMTP_PASS")
	if p, err := strconv.Atoi(env("SMTP_PORT")); err == nil {
		port = p
	}
	implicitTLS := port == 465
	if u := env("SMTP_URL"); u != "" {
		parsed, err := url.Parse(u)
		if err != nil {
			return MailDelivery{"failed", "smtp", "SMTP did not accept the message: " + redact(err.Error())}
		}
		host = parsed.Hostname()
		implicitTLS = parsed.Scheme == "smtps"
		port = 587
		if implicitTLS {
			port = 465
		}
		if p, err := strconv.Atoi(parsed.Port()); err == nil {
			port = p
		}
		if parsed.User != nil {
			user = parsed.User.Username()
			pass, _ = parsed.User.Password()
		}
	}
	resp, err := smtpSend(host, port, implicitTLS, user, pass, from, to, subject, text)
	if err != nil {
		outcome := classifyTransportError(err)
		if outcome == "unknown" {
			return MailDelivery{"unknown", "smtp", "SMTP acknowledgement was lost or uncertain: " + redact(err.Error())}
		}
		return MailDelivery{"failed", "smtp", "SMTP did not accept the message: " + redact(err.Error())}
	}
	return MailDelivery{"accepted", "smtp", "SMTP accepted the message (" + resp + "). This is not a delivery or read receipt."}
}

// errBeforeData marks failures before the message was handed over (safe to call failed).
type errBeforeData struct{ err error }

func (e *errBeforeData) Error() string { return e.err.Error() }
func (e *errBeforeData) Unwrap() error { return e.err }

func smtpSend(host string, port int, implicitTLS bool, user, pass, from, to, subject, text string) (string, error) {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	dialer := &net.Dialer{Timeout: 8 * time.Second}
	var conn net.Conn
	var err error
	if implicitTLS {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{ServerName: host})
	} else {
		conn, err = dialer.Dial("tcp", addr)
	}
	if err != nil {
		return "", &errBeforeData{err}
	}
	_ = conn.SetDeadline(time.Now().Add(30 * time.Second))
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		conn.Close()
		return "", &errBeforeData{err}
	}
	defer c.Close()
	if !implicitTLS {
		if ok, _ := c.Extension("STARTTLS"); ok {
			if err := c.StartTLS(&tls.Config{ServerName: host}); err != nil {
				return "", &errBeforeData{err}
			}
		}
	}
	if user != "" {
		if err := c.Auth(smtp.PlainAuth("", user, pass, host)); err != nil {
			return "", &errBeforeData{err}
		}
	}
	if err := c.Mail(from); err != nil {
		return "", &errBeforeData{err}
	}
	if err := c.Rcpt(to); err != nil {
		return "", &errBeforeData{err}
	}
	wc, err := c.Data()
	if err != nil {
		return "", &errBeforeData{err}
	}
	msg := "From: " + headerValue(from) + "\r\nTo: " + headerValue(to) + "\r\nSubject: " + mimeHeader(subject) +
		"\r\nDate: " + time.Now().Format(time.RFC1123Z) + "\r\nMessage-ID: <" + platform.NewUUID() + "@" + messageIDHost(from) + ">" +
		"\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" +
		dotSafeBody(text)
	if _, err := wc.Write([]byte(msg)); err != nil {
		return "", err
	}
	if err := wc.Close(); err != nil {
		return "", err // after DATA: the server may or may not have accepted
	}
	_ = c.Quit()
	return "250", nil
}

// headerValue removes every control character (CR and LF above all) from a
// header value, so text a staff member typed can never start a new header.
func headerValue(s string) string {
	return strings.Map(func(r rune) rune {
		if r < 0x20 || r == 0x7f {
			return ' '
		}
		return r
	}, s)
}

// mimeHeader renders a Subject: control characters become spaces first (no
// header injection through a notice title), then non-ASCII text is RFC 2047
// encoded.
func mimeHeader(s string) string {
	s = headerValue(s)
	for _, r := range s {
		if r > 127 {
			return "=?UTF-8?B?" + b64(s) + "?="
		}
	}
	return s
}

func messageIDHost(from string) string {
	if i := strings.LastIndex(from, "@"); i >= 0 && i < len(from)-1 {
		return strings.Trim(headerValue(from[i+1:]), "<> ")
	}
	return "pemo.local"
}

// dotSafeBody normalises line endings to CRLF. (net/smtp's DATA writer does
// the dot-stuffing.)
func dotSafeBody(text string) string {
	text = strings.ReplaceAll(text, "\r\n", "\n")
	return strings.ReplaceAll(text, "\n", "\r\n")
}

var smtpCodeRe = regexp.MustCompile(`^(\d{3})\b`)

// classifyTransportError: a refusal before the message was handed over is
// "failed"; anything after DATA is "unknown" and is never re-sent.
func classifyTransportError(err error) string {
	var tp *textproto.Error
	if errors.As(err, &tp) && tp.Code >= 400 {
		return "failed"
	}
	if m := smtpCodeRe.FindStringSubmatch(strings.TrimSpace(err.Error())); m != nil {
		if n, _ := strconv.Atoi(m[1]); n >= 400 {
			return "failed"
		}
	}
	// Anything that failed before the message body was handed over means the
	// server never took the message: safe to call failed (and to retry).
	var before *errBeforeData
	if errors.As(err, &before) {
		return "failed"
	}
	return "unknown"
}

// ---- dispatch ----

func (s *Server) dispatchClaimed(reqCtx context.Context, reserved strata.OutboxRecord, text string, afterClaim func(strata.OutboxRecord) error) (strata.OutboxRecord, bool, error) {
	// Once a row is claimed the send and its recorded outcome must finish even if
	// the caller goes away (a closed browser tab, a shutdown signal): a cancelled
	// request context would leave a delivered message stuck in "sending".
	ctx, cancel := context.WithTimeout(context.WithoutCancel(reqCtx), 2*time.Minute)
	defer cancel()
	if strata.IsTerminalDelivery(reserved.Status) || reserved.Status == "sending" {
		return reserved, true, nil
	}
	if reserved.Status == "failed" {
		if err := s.comms.RequeueFailed(ctx, reserved.OutboxID); err != nil {
			return reserved, false, err
		}
	}
	claimed, err := s.comms.ClaimPending(ctx, reserved.OutboxID)
	if err != nil {
		return reserved, false, err
	}
	if claimed == nil {
		cur, err := s.comms.Get(ctx, reserved.OutboxID)
		if err != nil {
			return reserved, true, err
		}
		if cur == nil {
			return reserved, true, nil
		}
		return *cur, true, nil
	}
	if afterClaim != nil {
		if err := afterClaim(*claimed); err != nil {
			return *claimed, false, err
		}
	}
	d := deliverMail(claimed.To, claimed.From, claimed.Subject, text)
	if err := s.comms.MarkResult(ctx, claimed.OutboxID, d); err != nil {
		return *claimed, false, err
	}
	out := *claimed
	out.Status, out.Transport, out.Detail = d.Status, d.Transport, d.Detail
	return out, false, nil
}

type mailInput struct {
	kind, to, subject, text string
	subjectID               *string
	subjectVersion          int64
	generation              int64
	scopeKind, scopeID      *string
}

func (s *Server) shapeRow(sc *StaffContext, r strata.OutboxRecord) O {
	return obj("meta", s.managementMeta(sc), "outboxId", r.OutboxID, "kind", r.Kind, "subjectId", nilStr(r.SubjectID), "to", r.To,
		"from", r.From, "subject", r.Subject, "status", strata.PresentationStatus(r.Status, r.ClaimedAt, time.Now()),
		"transport", r.Transport, "detail", r.Detail, "recordedAt", s.fmtLocal(r.RecordedAt))
}

func (s *Server) recordAndShapeMany(ctx context.Context, sc *StaffContext, inputs []mailInput) ([]O, error) {
	from := smtpFromAddress()
	rows := make([]strata.ReserveRow, 0, len(inputs))
	for _, in := range inputs {
		gen := in.generation
		if gen == 0 {
			gen = 1
		}
		rows = append(rows, strata.ReserveRow{SendKey: strata.SendKey{OrganizationID: sc.OrganizationID, Kind: in.kind, SubjectID: in.subjectID,
			SubjectVersion: in.subjectVersion, To: in.to, Generation: gen}, OutboxID: "obx_" + platform.NewUUID(), From: from,
			Subject: in.subject, BodyText: in.text, RecordedBy: sc.PrincipalID, RecipientScopeNodeKind: in.scopeKind, RecipientScopeNodeID: in.scopeID})
	}
	// The batch finishes even if the client disconnects (see dispatchClaimed).
	ctx = context.WithoutCancel(ctx)
	reserved, err := s.comms.ReserveMany(ctx, rows)
	if err != nil {
		return nil, err
	}
	out := []O{}
	claimed := 0
	limit := s.cfg.EmailBatchSize
	for _, row := range reserved {
		if strata.IsTerminalDelivery(row.Status) || row.Status == "sending" || claimed >= limit {
			out = append(out, s.shapeRow(sc, row))
			continue
		}
		text := row.BodyText
		if text == "" {
			for _, in := range inputs {
				if strings.EqualFold(strings.TrimSpace(in.to), strings.TrimSpace(row.To)) {
					text = in.text
					break
				}
			}
		}
		rec, skipped, err := s.dispatchClaimed(ctx, row, text, nil)
		if err != nil {
			return nil, err
		}
		if !skipped {
			claimed++
		}
		out = append(out, s.shapeRow(sc, rec))
	}
	return out, nil
}

// ---- coverage ----

var emailRe = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func isEmailAddress(v string) bool { return emailRe.MatchString(v) }

func hasEstateStaffGrant(sc *StaffContext) bool {
	return len(grantsOfRole(sc.Scope, "estate_staff")) > 0
}

func hasEstateWideCoverage(sc *StaffContext) bool {
	for _, g := range grantsOfRole(sc.Scope, "estate_staff") {
		if g.Node.Kind == "estate" || g.Node.Kind == "organization" || g.Node.Kind == "portfolio" {
			return true
		}
	}
	return false
}

func (s *Server) estateStaffCovering(ctx context.Context, sc *StaffContext, keys []string) (bool, error) {
	if len(keys) == 0 {
		return false, nil
	}
	scope, err := access.NewRoleScope(ctx, "estate_staff", grantsOfRole(sc.Scope, "estate_staff"), s.expandToNodeKeys(sc.OrganizationID))
	if err != nil {
		return false, err
	}
	return len(scope.Uncovered(keys)) == 0, nil
}

func (s *Server) maySeeRecipientScope(ctx context.Context, sc *StaffContext, kind, id *string) (bool, error) {
	if kind != nil && id != nil && *kind != "" && *id != "" {
		return s.estateStaffCovering(ctx, sc, []string{*kind + ":" + *id})
	}
	return hasEstateWideCoverage(sc), nil
}

func (s *Server) allNodeKeys(ctx context.Context, sc *StaffContext) ([]string, error) {
	e, err := s.prop.Expand(ctx, sc.OrganizationID, scopeGrantNodes(sc))
	if err != nil {
		return nil, err
	}
	return expandedNodeKeys(e), nil
}

type noticeRecipient struct{ email, householdID, unitID string }

func (s *Server) noticeEmailRecipients(ctx context.Context, sc *StaffContext, noticeID string, onlyCovered bool) ([]noticeRecipient, bool, error) {
	keys, err := s.allNodeKeys(ctx, sc)
	if err != nil {
		return nil, false, err
	}
	d, err := s.notices.Detail(ctx, sc.OrganizationID, noticeID, keys)
	if err != nil || d == nil {
		return nil, false, err
	}
	occ, err := s.noticeAudience.Resolve(ctx, noticesRule(sc.OrganizationID, d.Targets), sc.Now)
	if err != nil {
		return nil, false, err
	}
	var households []string
	seenH := map[string]bool{}
	for _, o := range occ {
		if o.HouseholdID == nil || seenH[*o.HouseholdID] {
			continue
		}
		if onlyCovered {
			ok, err := s.estateStaffCovering(ctx, sc, []string{"unit:" + o.UnitID})
			if err != nil {
				return nil, false, err
			}
			if !ok {
				continue
			}
		}
		seenH[*o.HouseholdID] = true
		households = append(households, *o.HouseholdID)
	}
	contacts, err := s.res.HouseholdContactsByIDs(ctx, sc.OrganizationID, households)
	if err != nil {
		return nil, false, err
	}
	out := []noticeRecipient{}
	seen := map[string]bool{}
	for _, c := range contacts {
		if c.ContactEmail == nil {
			continue
		}
		e := strings.TrimSpace(*c.ContactEmail)
		if e == "" || seen[strings.ToLower(e)] {
			continue
		}
		if onlyCovered {
			ok, err := s.estateStaffCovering(ctx, sc, []string{"unit:" + c.UnitID})
			if err != nil {
				return nil, false, err
			}
			if !ok {
				continue
			}
		}
		seen[strings.ToLower(e)] = true
		out = append(out, noticeRecipient{e, c.HouseholdID, c.UnitID})
	}
	return out, true, nil
}

// ---- routes ----

func (s *Server) mailRoutes() {
	s.handle("POST", mgmt+"/strata/charges/{chargeId}/invoice-email", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		out, kind, err := s.sendChargeInvoice(r.Context(), sc, r.PathValue("chargeId"))
		s.mailOutcome(w, r, out, kind, err)
	})
	s.handle("POST", mgmt+"/admin/email/test", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		if len(grantsOfRole(sc.Scope, "grant_administrator")) == 0 {
			s.sendStaffProblem(w, r, staffProblems.AdministrationRequired())
			return
		}
		to, ok := str(body, "to")
		if !ok || !isEmailAddress(to) {
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("A recipient email address is required. SMTP settings stay on the server.", "必須提供收件電郵。SMTP 設定留在伺服器。")))
			return
		}
		res, err := s.recordAndShapeMany(r.Context(), sc, []mailInput{{kind: "admin_test", to: to, subject: "PEMO admin email test",
			text: "This is a test message from PEMO management. SMTP settings are the server environment, not the browser form."}})
		if err != nil {
			s.handleManagementError(w, r, err)
			return
		}
		s.writeJSON(w, 200, res[0])
	})
	s.handle("GET", mgmt+"/notices/{noticeId}/delivery", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		out, kind, err := s.composeNoticeDelivery(r.Context(), sc, r.PathValue("noticeId"))
		s.mailOutcome(w, r, out, kind, err)
	})
	s.handle("POST", mgmt+"/notices/{noticeId}/email/resend", func(w http.ResponseWriter, r *http.Request, body map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		oid, ok := str(body, "outboxId")
		if !ok || strings.TrimSpace(oid) == "" {
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("An outboxId is required to resend.", "重發需要 outboxId。")))
			return
		}
		out, kind, err := s.resendOutboxEmail(r.Context(), sc, r.PathValue("noticeId"), oid)
		if err == nil && kind == "not-resendable" {
			s.sendStaffProblem(w, r, staffProblems.BadRequest(lz("Only unknown or failed outbox rows can be manually resent.", "只有 unknown 或 failed 的發件箱列可被人手重發。")))
			return
		}
		s.mailOutcome(w, r, out, kind, err)
	})
	s.handle("POST", mgmt+"/notices/{noticeId}/email", func(w http.ResponseWriter, r *http.Request, _ map[string]any) {
		sc := s.authenticateStaff(w, r)
		if sc == nil {
			return
		}
		out, kind, err := s.sendNoticeEmail(r.Context(), sc, r.PathValue("noticeId"))
		if err == nil && kind == "no-recipient" {
			s.sendStaffProblem(w, r, staffProblems.NoticeEmailNoRecipient())
			return
		}
		s.mailOutcome(w, r, out, kind, err)
	})
}

func (s *Server) mailOutcome(w http.ResponseWriter, r *http.Request, out any, kind string, err error) {
	if err != nil {
		s.handleManagementError(w, r, err)
		return
	}
	switch kind {
	case "missing":
		if strings.Contains(r.URL.Path, "/strata/charges/") {
			s.sendStaffProblem(w, r, staffProblems.ChargeNotFound())
		} else {
			s.sendStaffProblem(w, r, staffProblems.NoticeNotFound())
		}
	case "forbidden":
		s.sendStaffProblem(w, r, staffProblems.EmailSendForbidden())
	default:
		s.writeJSON(w, 200, out)
	}
}

func (s *Server) strataScope(ctx context.Context, sc *StaffContext) (strata.ScopeFilter, error) {
	e, err := s.prop.Expand(ctx, sc.OrganizationID, scopeGrantNodes(sc))
	if err != nil {
		return strata.ScopeFilter{}, err
	}
	return strata.ScopeFilter{OrganizationID: sc.OrganizationID, UnitIDs: e.UnitIDs, FloorIDs: e.FloorIDs, BuildingIDs: e.BuildingIDs, EstateIDs: e.EstateIDs}, nil
}

// invoiceHeader is the first line of an invoice email (was hard-coded to
// one estate; configurable now — review: Flexibility).
func invoiceHeader() string {
	if v := env("PEMO_INVOICE_HEADER"); v != "" {
		return v
	}
	return "Wing Fu Garden management fee invoice"
}

func scopeNodeOf(scope any) (string, string) {
	m, _ := scope.(map[string]any)
	n, _ := m["node"].(map[string]any)
	k, _ := n["kind"].(string)
	id, _ := n["id"].(string)
	return k, id
}

func (s *Server) sendChargeInvoice(ctx context.Context, sc *StaffContext, chargeID string) (any, string, error) {
	if !hasEstateStaffGrant(sc) {
		return nil, "forbidden", nil
	}
	f, err := s.strataScope(ctx, sc)
	if err != nil {
		return nil, "", err
	}
	c, err := s.strata.GetCharge(ctx, f, chargeID)
	if err != nil {
		return nil, "", err
	}
	if c == nil {
		return nil, "missing", nil
	}
	kind, id := scopeNodeOf(c.Scope)
	ok, err := s.estateStaffCovering(ctx, sc, []string{kind + ":" + id})
	if err != nil {
		return nil, "", err
	}
	if !ok {
		return nil, "forbidden", nil
	}
	contacts, err := s.res.HouseholdContactsByIDs(ctx, sc.OrganizationID, []string{c.HouseholdID})
	if err != nil {
		return nil, "", err
	}
	to := c.ContactEmail
	if len(contacts) > 0 && contacts[0].ContactEmail != nil && strings.TrimSpace(*contacts[0].ContactEmail) != "" {
		to = strings.TrimSpace(*contacts[0].ContactEmail)
	}
	text := strings.Join([]string{invoiceHeader(), "Invoice: " + c.InvoiceNumber,
		fmt.Sprintf("Household: %s (%s)", c.PayerName, c.HouseholdID), "Period: " + c.Period,
		fmt.Sprintf("Amount: HKD %d", c.AmountHkd), fmt.Sprintf("Outstanding: HKD %d", c.AmountHkd-c.PaidHkd), "",
		"This message was sent by the management office."}, "\n")
	cid := c.ChargeID
	res, err := s.recordAndShapeMany(ctx, sc, []mailInput{{kind: "invoice", subjectID: &cid, to: to, subject: "Invoice " + c.InvoiceNumber,
		text: text, scopeKind: &kind, scopeID: &id}})
	if err != nil {
		return nil, "", err
	}
	return res[0], "ok", nil
}

func noticeText(titleEn, bodyEn, titleZh, bodyZh string) string {
	return titleEn + "\n\n" + bodyEn + "\n\n" + titleZh + "\n\n" + bodyZh
}

func (s *Server) assertSendCoverage(ctx context.Context, sc *StaffContext, noticeID string) (string, error) {
	if !hasEstateStaffGrant(sc) {
		return "forbidden", nil
	}
	keys, err := s.allNodeKeys(ctx, sc)
	if err != nil {
		return "", err
	}
	d, err := s.notices.Detail(ctx, sc.OrganizationID, noticeID, keys)
	if err != nil {
		return "", err
	}
	if d == nil {
		return "missing", nil
	}
	addressed := []string{}
	seen := map[string]bool{}
	for _, t := range d.Targets {
		if t.NodeKind != nil && t.NodeID != nil && *t.NodeKind != "" && *t.NodeID != "" {
			k := *t.NodeKind + ":" + *t.NodeID
			if !seen[k] {
				seen[k] = true
				addressed = append(addressed, k)
			}
		}
		if t.LocationID != nil && *t.LocationID != "" {
			ns, err := s.prop.ResolveServingScopeNodes(ctx, sc.OrganizationID, *t.LocationID)
			if err != nil {
				return "", err
			}
			for _, k := range ns {
				if !seen[k] {
					seen[k] = true
					addressed = append(addressed, k)
				}
			}
		}
	}
	ok, err := s.estateStaffCovering(ctx, sc, addressed)
	if err != nil {
		return "", err
	}
	if !ok {
		return "forbidden", nil
	}
	return "ok", nil
}

func (s *Server) sendNoticeEmail(ctx context.Context, sc *StaffContext, noticeID string) (any, string, error) {
	cov, err := s.assertSendCoverage(ctx, sc, noticeID)
	if err != nil || cov != "ok" {
		return nil, cov, err
	}
	recips, found, err := s.noticeEmailRecipients(ctx, sc, noticeID, false)
	if err != nil {
		return nil, "", err
	}
	if !found {
		return nil, "missing", nil
	}
	if len(recips) == 0 {
		return nil, "no-recipient", nil
	}
	keys, _ := s.allNodeKeys(ctx, sc)
	d, err := s.notices.Detail(ctx, sc.OrganizationID, noticeID, keys)
	if err != nil || d == nil {
		return nil, "missing", err
	}
	text := noticeText(d.TitleEn, d.BodyEn, d.TitleZhHant, d.BodyZhHant)
	subject := d.TitleEn
	if subject == "" {
		subject = d.TitleZhHant
	}
	unit := "unit"
	inputs := make([]mailInput, 0, len(recips))
	nid := noticeID
	for _, rc := range recips {
		u := rc.unitID
		inputs = append(inputs, mailInput{kind: "notice", subjectID: &nid, subjectVersion: d.Version, to: rc.email, subject: subject, text: text, scopeKind: &unit, scopeID: &u})
	}
	shaped, err := s.recordAndShapeMany(ctx, sc, inputs)
	if err != nil {
		return nil, "", err
	}
	transport := "log"
	results := []O{}
	for _, o := range shaped {
		transport = o.get("transport").(string)
		results = append(results, o[1:])
	}
	return obj("meta", s.managementMeta(sc), "noticeId", noticeID, "transport", transport, "results", results), "ok", nil
}

func (s *Server) resendOutboxEmail(ctx context.Context, sc *StaffContext, noticeID, outboxID string) (any, string, error) {
	if !hasEstateStaffGrant(sc) {
		return nil, "forbidden", nil
	}
	keys, err := s.allNodeKeys(ctx, sc)
	if err != nil {
		return nil, "", err
	}
	d, err := s.notices.Detail(ctx, sc.OrganizationID, noticeID, keys)
	if err != nil {
		return nil, "", err
	}
	if d == nil {
		return nil, "missing", nil
	}
	row, err := s.comms.Get(ctx, outboxID)
	if err != nil {
		return nil, "", err
	}
	if row == nil || row.Kind != "notice" || row.SubjectID == nil || *row.SubjectID != noticeID {
		return nil, "missing", nil
	}
	ok, err := s.maySeeRecipientScope(ctx, sc, row.RecipientScopeNodeKind, row.RecipientScopeNodeID)
	if err != nil {
		return nil, "", err
	}
	if !ok {
		return nil, "forbidden", nil
	}
	if row.Status != "unknown" && row.Status != "failed" {
		return nil, "not-resendable", nil
	}
	text := noticeText(d.TitleEn, d.BodyEn, d.TitleZhHant, d.BodyZhHant)
	nid := noticeID
	gen, err := s.comms.NextGeneration(ctx, sc.OrganizationID, "notice", &nid, d.Version, row.To)
	if err != nil {
		return nil, "", err
	}
	subject := d.TitleEn
	if subject == "" {
		subject = d.TitleZhHant
	}
	reserved, err := s.comms.ReserveMany(ctx, []strata.ReserveRow{{SendKey: strata.SendKey{OrganizationID: sc.OrganizationID, Kind: "notice",
		SubjectID: &nid, SubjectVersion: d.Version, To: row.To, Generation: gen}, OutboxID: "obx_" + platform.NewUUID(), From: smtpFromAddress(),
		Subject: subject, BodyText: text, RecordedBy: sc.PrincipalID, RecipientScopeNodeKind: row.RecipientScopeNodeKind,
		RecipientScopeNodeID: row.RecipientScopeNodeID, Key: "resend:" + row.OutboxID}})
	if err != nil {
		return nil, "", err
	}
	if len(reserved) == 0 {
		return nil, "missing", nil
	}
	gs := grantsOfRole(sc.Scope, "estate_staff")
	groupID, nodeKind, nodeID := "grp_unknown", "estate", "unknown"
	if len(gs) > 0 {
		groupID, nodeKind, nodeID = gs[0].GroupID, gs[0].Node.Kind, gs[0].Node.ID
	}
	status := row.Status
	rec, _, err := s.dispatchClaimed(ctx, reserved[0], text, func(strata.OutboxRecord) error {
		_, err := platform.AuditedWrite(ctx, s.accessDB, s.witnessAudit(sc, groupID, "estate_staff", nodeKind, nodeID, "resend_notice_email",
			"email_outbox", outboxID, &status, sc.Now), func(platform.DB) (bool, error) { return true, nil },
			platform.AuditOptions[bool]{Committed: func(b bool) bool { return b }})
		return err
	})
	if err != nil {
		return nil, "", err
	}
	return s.shapeRow(sc, rec), "ok", nil
}

func (s *Server) composeNoticeDelivery(ctx context.Context, sc *StaffContext, noticeID string) (any, string, error) {
	if !hasEstateStaffGrant(sc) {
		return nil, "forbidden", nil
	}
	keys, err := s.allNodeKeys(ctx, sc)
	if err != nil {
		return nil, "", err
	}
	d, err := s.notices.Detail(ctx, sc.OrganizationID, noticeID, keys)
	if err != nil {
		return nil, "", err
	}
	if d == nil {
		return nil, "missing", nil
	}
	recips, found, err := s.noticeEmailRecipients(ctx, sc, noticeID, true)
	if err != nil {
		return nil, "", err
	}
	if !found {
		return nil, "missing", nil
	}
	sends, err := s.comms.ListForSubject(ctx, sc.OrganizationID, "notice", noticeID)
	if err != nil {
		return nil, "", err
	}
	visible := []O{}
	for _, row := range sends {
		ok, err := s.maySeeRecipientScope(ctx, sc, row.RecipientScopeNodeKind, row.RecipientScopeNodeID)
		if err != nil {
			return nil, "", err
		}
		if ok {
			visible = append(visible, obj("outboxId", row.OutboxID, "to", row.To, "subject", row.Subject,
				"status", strata.PresentationStatus(row.Status, row.ClaimedAt, time.Now()), "transport", row.Transport,
				"detail", row.Detail, "recordedAt", s.fmtLocal(row.RecordedAt)))
		}
	}
	rs := make([]O, 0, len(recips))
	for _, rc := range recips {
		rs = append(rs, obj("to", rc.email, "unitId", rc.unitID))
	}
	return obj("meta", s.managementMeta(sc), "noticeId", noticeID, "schedule", nil,
		"email", obj("recipientCount", len(recips), "recipients", rs, "sends", visible)), "ok", nil
}

// ---- mail worker (review C2/G3) ----
//
// Rows left "queued" (batch limit reached, or a crash between reserve and
// claim) used to wait for a person. With PEMO_MAIL_WORKER=1 a background
// loop claims and delivers them. The claim is an atomic UPDATE, so several
// API replicas can run the worker safely.

// RunMailWorker drains queued email rows until ctx ends.
func (s *Server) RunMailWorker(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			rows, err := s.strataDB.Query(ctx, `SELECT outbox_id FROM email_outbox WHERE status = 'queued' ORDER BY recorded_at LIMIT $1`, s.cfg.EmailBatchSize)
			if err != nil {
				s.log.Warn("mail worker: listing queued rows failed", map[string]any{"error": err.Error()})
				continue
			}
			for _, r := range rows {
				if ctx.Err() != nil {
					return // shutting down: stop between messages, never inside one
				}
				row, err := s.comms.Get(ctx, r.Str("outbox_id"))
				if err != nil || row == nil {
					continue
				}
				if _, _, err := s.dispatchClaimed(ctx, *row, row.BodyText, nil); err != nil {
					s.log.Warn("mail worker: dispatch failed", map[string]any{"outboxId": row.OutboxID, "error": err.Error()})
				}
			}
		}
	}
}
