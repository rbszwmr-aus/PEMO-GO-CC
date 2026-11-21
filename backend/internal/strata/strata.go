// Package strata holds charges, payments and the email outbox (one send per
// send_key; an unknown outcome is never re-sent automatically).
package strata

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"pemo/internal/platform"
)

// LocalizedText is English + Traditional Chinese.
type LocalizedText = platform.LocalizedText

// InvoiceEmailState is the latest invoice email for a charge.
type InvoiceEmailState struct {
	Status     string     `json:"status"`
	RecordedAt *time.Time `json:"recordedAt"`
	Transport  *string    `json:"transport"`
	Detail     *string    `json:"detail"`
}

// LineItem is one charge line.
type LineItem struct {
	Description LocalizedText `json:"description"`
	AmountHkd   int64         `json:"amountHkd"`
}

// ChargeRecord is one charge with what has been paid against it.
type ChargeRecord struct {
	ChargeID        string            `json:"chargeId"`
	HouseholdID     string            `json:"householdId"`
	ResidentID      string            `json:"residentId"`
	PayerName       string            `json:"payerName"`
	UnitSummary     LocalizedText     `json:"unitSummary"`
	Scope           any               `json:"scope"`
	Period          string            `json:"period"`
	Kind            LocalizedText     `json:"kind"`
	IssuedOn        string            `json:"issuedOn"`
	DueOn           string            `json:"dueOn"`
	AmountHkd       int64             `json:"amountHkd"`
	PaidHkd         int64             `json:"paidHkd"`
	Status          string            `json:"status"`
	Tone            string            `json:"tone"`
	StaffNotes      *LocalizedText    `json:"staffNotes"`
	InvoiceNumber   string            `json:"invoiceNumber"`
	ScheduledSendAt time.Time         `json:"scheduledSendAt"`
	ContactEmail    string            `json:"contactEmail"`
	LineItems       []LineItem        `json:"lineItems"`
	InvoiceEmail    InvoiceEmailState `json:"invoiceEmail"`
}

// PaymentRecord is one payment with its allocations.
type PaymentRecord struct {
	PaymentID   string         `json:"paymentId"`
	HouseholdID string         `json:"householdId"`
	ResidentID  string         `json:"residentId"`
	PayerName   string         `json:"payerName"`
	UnitSummary LocalizedText  `json:"unitSummary"`
	Scope       any            `json:"scope"`
	PaidOn      string         `json:"paidOn"`
	Method      string         `json:"method"`
	AmountHkd   int64          `json:"amountHkd"`
	Reference   LocalizedText  `json:"reference"`
	StaffNotes  *LocalizedText `json:"staffNotes"`
	Allocations any            `json:"allocations"`
}

// ReceiptRecord is one payment allocated to a charge.
type ReceiptRecord struct {
	PaymentID string `json:"paymentId"`
	Method    string `json:"method"`
	AmountHkd int64  `json:"amountHkd"`
	PaidOn    string `json:"paidOn"`
}

// ScopeFilter is the caller's expanded scope.
type ScopeFilter struct {
	OrganizationID                            string
	UnitIDs, FloorIDs, BuildingIDs, EstateIDs []string
}

// Strata is the module facade.
type Strata struct{ DB platform.DB }

// New binds the module to its pool.
func New(db platform.DB) *Strata { return &Strata{DB: db} }

const inScope = `organization_id = $1 AND (unit_id = ANY($2::text[]) OR floor_id = ANY($3::text[])
    OR building_id = ANY($4::text[]) OR estate_id = ANY($5::text[]))`

const chargeSelect = `
  SELECT c.charge_id, c.household_id, c.resident_id, c.payer_name,
         c.unit_label_en, c.unit_label_zh_hant, c.scope_json, c.period,
         c.kind_en, c.kind_zh_hant, c.issued_on::text AS issued_on, c.due_on::text AS due_on,
         c.amount_hkd, c.status, c.tone, c.staff_notes_en, c.staff_notes_zh_hant,
         c.invoice_number, c.scheduled_send_at, c.contact_email, c.line_kind_en, c.line_kind_zh_hant,
         COALESCE(paid.paid_hkd, 0)::int AS paid_hkd,
         mail.status AS mail_status, mail.transport AS mail_transport,
         mail.transport_detail AS mail_detail, mail.recorded_at AS mail_recorded_at
    FROM charge c
    LEFT JOIN (SELECT charge_id, SUM(amount_hkd)::int AS paid_hkd FROM payment_allocation GROUP BY charge_id) paid
      ON paid.charge_id = c.charge_id
    LEFT JOIN LATERAL (
      SELECT status, transport, transport_detail, recorded_at FROM email_outbox
       WHERE kind = 'invoice' AND subject_id = c.charge_id AND organization_id = c.organization_id
       ORDER BY recorded_at DESC LIMIT 1) mail ON true`

func nz(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func args(s ScopeFilter, extra ...any) []any {
	return append([]any{s.OrganizationID, nz(s.UnitIDs), nz(s.FloorIDs), nz(s.BuildingIDs), nz(s.EstateIDs)}, extra...)
}

func notes(r platform.Row, en, zh string) *LocalizedText {
	if r[en] == nil && r[zh] == nil {
		return nil
	}
	return &LocalizedText{En: r.Str(en), ZhHant: r.Str(zh)}
}

func mapCharge(r platform.Row) ChargeRecord {
	mail := InvoiceEmailState{Status: "none"}
	if r["mail_status"] != nil {
		mail = InvoiceEmailState{Status: presented(r.Str("mail_status")), RecordedAt: r.TimePtr("mail_recorded_at"),
			Transport: r.StrPtr("mail_transport"), Detail: r.StrPtr("mail_detail")}
	}
	return ChargeRecord{ChargeID: r.Str("charge_id"), HouseholdID: r.Str("household_id"), ResidentID: r.Str("resident_id"),
		PayerName: r.Str("payer_name"), UnitSummary: LocalizedText{En: r.Str("unit_label_en"), ZhHant: r.Str("unit_label_zh_hant")},
		Scope: r["scope_json"], Period: r.Str("period"), Kind: LocalizedText{En: r.Str("kind_en"), ZhHant: r.Str("kind_zh_hant")},
		IssuedOn: r.Str("issued_on"), DueOn: r.Str("due_on"), AmountHkd: r.Int("amount_hkd"), PaidHkd: r.Int("paid_hkd"),
		Status: r.Str("status"), Tone: r.Str("tone"), StaffNotes: notes(r, "staff_notes_en", "staff_notes_zh_hant"),
		InvoiceNumber: r.Str("invoice_number"), ScheduledSendAt: r.Time("scheduled_send_at"), ContactEmail: r.Str("contact_email"),
		LineItems:    []LineItem{{LocalizedText{En: r.Str("line_kind_en"), ZhHant: r.Str("line_kind_zh_hant")}, r.Int("amount_hkd")}},
		InvoiceEmail: mail}
}

// ListCharges lists charges in scope, newest period first.
func (s *Strata) ListCharges(ctx context.Context, f ScopeFilter) ([]ChargeRecord, error) {
	rows, err := s.DB.Query(ctx, chargeSelect+" WHERE c."+inScope+" ORDER BY c.period DESC, c.charge_id", args(f)...)
	if err != nil {
		return nil, err
	}
	out := make([]ChargeRecord, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapCharge(r))
	}
	return out, nil
}

// GetCharge returns one charge in scope.
func (s *Strata) GetCharge(ctx context.Context, f ScopeFilter, chargeID string) (*ChargeRecord, error) {
	r, err := s.DB.QueryOne(ctx, chargeSelect+" WHERE c.charge_id = $6 AND c."+inScope, args(f, chargeID)...)
	if err != nil || r == nil {
		return nil, err
	}
	c := mapCharge(r)
	return &c, nil
}

// ReceiptsFor lists the payments allocated to a charge.
func (s *Strata) ReceiptsFor(ctx context.Context, chargeID string) ([]ReceiptRecord, error) {
	rows, err := s.DB.Query(ctx, `SELECT p.payment_id, p.method, a.amount_hkd, p.paid_on::text AS paid_on
         FROM payment_allocation a JOIN payment p ON p.payment_id = a.payment_id
        WHERE a.charge_id = $1 ORDER BY p.paid_on, p.payment_id`, chargeID)
	if err != nil {
		return nil, err
	}
	out := make([]ReceiptRecord, 0, len(rows))
	for _, r := range rows {
		out = append(out, ReceiptRecord{r.Str("payment_id"), r.Str("method"), r.Int("amount_hkd"), r.Str("paid_on")})
	}
	return out, nil
}

// ListPayments lists payments in scope, newest first.
func (s *Strata) ListPayments(ctx context.Context, f ScopeFilter) ([]PaymentRecord, error) {
	rows, err := s.DB.Query(ctx, `SELECT p.payment_id, p.household_id, p.resident_id, p.payer_name,
              p.unit_label_en, p.unit_label_zh_hant, p.scope_json, p.paid_on::text AS paid_on, p.method, p.amount_hkd,
              p.reference_en, p.reference_zh_hant, p.staff_notes_en, p.staff_notes_zh_hant,
              COALESCE((SELECT json_agg(json_build_object('chargeId', a.charge_id, 'amountHkd', a.amount_hkd) ORDER BY a.allocation_id)
                   FROM payment_allocation a WHERE a.payment_id = p.payment_id), '[]'::json) AS allocations
         FROM payment p WHERE p.`+inScope+` ORDER BY p.paid_on DESC, p.payment_id`, args(f)...)
	if err != nil {
		return nil, err
	}
	out := make([]PaymentRecord, 0, len(rows))
	for _, r := range rows {
		alloc := r["allocations"]
		if alloc == nil {
			alloc = []any{}
		}
		out = append(out, PaymentRecord{r.Str("payment_id"), r.Str("household_id"), r.Str("resident_id"), r.Str("payer_name"),
			LocalizedText{En: r.Str("unit_label_en"), ZhHant: r.Str("unit_label_zh_hant")}, r["scope_json"], r.Str("paid_on"),
			r.Str("method"), r.Int("amount_hkd"), LocalizedText{En: r.Str("reference_en"), ZhHant: r.Str("reference_zh_hant")},
			notes(r, "staff_notes_en", "staff_notes_zh_hant"), alloc})
	}
	return out, nil
}

// ---- email outbox ----

// SendingUnknownAfter: a claim older than this has an unknown outcome.
const SendingUnknownAfter = 15 * time.Minute

var legacy = map[string]string{"pending": "queued", "logged": "log-only", "sent": "accepted"}

func presented(status string) string {
	if p, ok := legacy[status]; ok {
		return p
	}
	return status
}

// PresentationStatus maps stored status (and claim age) to what callers see.
func PresentationStatus(status string, claimedAt *time.Time, now time.Time) string {
	if status == "sending" {
		if claimedAt != nil && now.Sub(*claimedAt) >= SendingUnknownAfter {
			return "unknown"
		}
		return "sending"
	}
	return presented(status)
}

// IsTerminalDelivery: accepted, log-only and unknown are never re-sent.
func IsTerminalDelivery(status string) bool {
	p := presented(status)
	return p == "accepted" || p == "log-only" || p == "unknown"
}

// SendKey identifies one send: (org, kind, subject, version, to, generation).
type SendKey struct {
	OrganizationID, Kind string
	SubjectID            *string
	SubjectVersion       int64
	To                   string
	Generation           int64
}

// String renders the send key.
func (k SendKey) String() string {
	subj := ""
	if k.SubjectID != nil {
		subj = *k.SubjectID
	}
	return strings.Join([]string{k.OrganizationID, k.Kind, subj, strconv.FormatInt(k.SubjectVersion, 10),
		strings.ToLower(strings.TrimSpace(k.To)), strconv.FormatInt(k.Generation, 10)}, "\u001f")
}

// OutboxRecord is one email_outbox row.
type OutboxRecord struct {
	OutboxID               string     `json:"outboxId"`
	Kind                   string     `json:"kind"`
	SubjectID              *string    `json:"subjectId"`
	To                     string     `json:"to"`
	From                   string     `json:"from"`
	Subject                string     `json:"subject"`
	BodyText               string     `json:"-"`
	Status                 string     `json:"status"`
	Transport              string     `json:"transport"`
	Detail                 string     `json:"detail"`
	RecordedAt             time.Time  `json:"recordedAt"`
	ClaimedAt              *time.Time `json:"claimedAt"`
	Attempt                int64      `json:"attempt"`
	Generation             int64      `json:"generation"`
	RecipientScopeNodeKind *string    `json:"recipientScopeNodeKind"`
	RecipientScopeNodeID   *string    `json:"recipientScopeNodeId"`
}

const outboxCols = `outbox_id, kind, subject_id, to_address, from_address, subject, body_text,
              status, transport, transport_detail, recorded_at, claimed_at, attempt,
              generation, subject_version, recipient_scope_node_kind, recipient_scope_node_id`

func mapOutbox(r platform.Row) OutboxRecord {
	return OutboxRecord{r.Str("outbox_id"), r.Str("kind"), r.StrPtr("subject_id"), r.Str("to_address"), r.Str("from_address"),
		r.Str("subject"), r.Str("body_text"), presented(r.Str("status")), r.Str("transport"), r.Str("transport_detail"),
		r.Time("recorded_at"), r.TimePtr("claimed_at"), r.Int("attempt"), r.Int("generation"),
		r.StrPtr("recipient_scope_node_kind"), r.StrPtr("recipient_scope_node_id")}
}

// NewOutboxRow is a directly recorded (already-delivered) row.
type NewOutboxRow struct {
	OutboxID, OrganizationID, Kind string
	SubjectID                      *string
	To, From, Subject, BodyText    string
	Status, Transport, Detail      string
	RecordedBy                     string
}

// Record inserts a row with generation 1.
func (s *Strata) Record(ctx context.Context, row NewOutboxRow) error {
	key := SendKey{row.OrganizationID, row.Kind, row.SubjectID, 0, row.To, 1}.String()
	return s.DB.Exec(ctx, `INSERT INTO email_outbox (outbox_id, organization_id, kind, subject_id, to_address, from_address,
         subject, body_text, status, transport, transport_detail, recorded_by, subject_version, generation, send_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,1,$13)`, row.OutboxID, row.OrganizationID, row.Kind, row.SubjectID,
		row.To, row.From, row.Subject, row.BodyText, row.Status, row.Transport, row.Detail, row.RecordedBy, key)
}

// ReserveRow is one send to reserve.
type ReserveRow struct {
	SendKey
	OutboxID, From, Subject, BodyText, RecordedBy string
	RecipientScopeNodeKind, RecipientScopeNodeID  *string
	Key                                           string
}

// ReserveMany reserves each send once (ON CONFLICT on send_key) and returns
// the row that holds each key, in one transaction.
func (s *Strata) ReserveMany(ctx context.Context, rows []ReserveRow) ([]OutboxRecord, error) {
	out := []OutboxRecord{}
	if len(rows) == 0 {
		return out, nil
	}
	err := s.DB.Tx(ctx, func(tx platform.DB) error {
		for _, row := range rows {
			key := row.Key
			if key == "" {
				key = row.SendKey.String()
			}
			if err := tx.Exec(ctx, `INSERT INTO email_outbox (outbox_id, organization_id, kind, subject_id, to_address, from_address,
             subject, body_text, status, transport, transport_detail, recorded_by, subject_version, generation, send_key,
             recipient_scope_node_kind, recipient_scope_node_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued','log','queued',$9,$10,$11,$12,$13,$14)
           ON CONFLICT (send_key) WHERE send_key IS NOT NULL DO NOTHING`, row.OutboxID, row.OrganizationID, row.Kind, row.SubjectID,
				row.To, row.From, row.Subject, row.BodyText, row.RecordedBy, row.SubjectVersion, row.Generation, key,
				row.RecipientScopeNodeKind, row.RecipientScopeNodeID); err != nil {
				return err
			}
			existing, err := tx.QueryOne(ctx, `SELECT `+outboxCols+` FROM email_outbox WHERE send_key = $1`, key)
			if err != nil {
				return err
			}
			if existing == nil {
				return errors.New("email outbox reserve did not find the send key after insert")
			}
			out = append(out, mapOutbox(existing))
		}
		return nil
	})
	return out, err
}

// ClaimPending atomically moves a queued row to sending.
func (s *Strata) ClaimPending(ctx context.Context, id string) (*OutboxRecord, error) {
	r, err := s.DB.QueryOne(ctx, `UPDATE email_outbox SET status = 'sending', claimed_at = now(), attempt = attempt + 1
        WHERE outbox_id = $1 AND status = 'queued' RETURNING `+outboxCols, id)
	if err != nil || r == nil {
		return nil, err
	}
	o := mapOutbox(r)
	return &o, nil
}

// RequeueFailed returns a failed row to the queue.
func (s *Strata) RequeueFailed(ctx context.Context, id string) error {
	return s.DB.Exec(ctx, `UPDATE email_outbox SET status = 'queued' WHERE outbox_id = $1 AND status = 'failed'`, id)
}

// Get reads one row.
func (s *Strata) Get(ctx context.Context, id string) (*OutboxRecord, error) {
	r, err := s.DB.QueryOne(ctx, `SELECT `+outboxCols+` FROM email_outbox WHERE outbox_id = $1`, id)
	if err != nil || r == nil {
		return nil, err
	}
	o := mapOutbox(r)
	return &o, nil
}

var failNextMark atomic.Bool

// FailNextMarkResult injects one markResult failure (development fault seam).
func FailNextMarkResult() { failNextMark.Store(true) }

// MarkResult records the transport outcome.
func (s *Strata) MarkResult(ctx context.Context, id, status, transport, detail string) error {
	if failNextMark.CompareAndSwap(true, false) {
		return errors.New("injected markResult failure")
	}
	return s.DB.Exec(ctx, `UPDATE email_outbox SET status = $2, transport = $3, transport_detail = $4 WHERE outbox_id = $1`, id, status, transport, detail)
}

// ListForSubject lists the rows for one subject, newest first.
func (s *Strata) ListForSubject(ctx context.Context, orgID, kind, subjectID string) ([]OutboxRecord, error) {
	rows, err := s.DB.Query(ctx, `SELECT `+outboxCols+` FROM email_outbox WHERE organization_id = $1 AND kind = $2 AND subject_id = $3
        ORDER BY recorded_at DESC, outbox_id`, orgID, kind, subjectID)
	if err != nil {
		return nil, err
	}
	out := make([]OutboxRecord, 0, len(rows))
	for _, r := range rows {
		out = append(out, mapOutbox(r))
	}
	return out, nil
}

// NextGeneration is one more than the highest generation for the send.
func (s *Strata) NextGeneration(ctx context.Context, orgID, kind string, subjectID *string, subjectVersion int64, to string) (int64, error) {
	r, err := s.DB.QueryOne(ctx, `SELECT max(generation)::text AS max FROM email_outbox
        WHERE organization_id = $1 AND kind = $2 AND subject_id IS NOT DISTINCT FROM $3
          AND subject_version = $4 AND lower(to_address) = lower($5)`, orgID, kind, subjectID, subjectVersion, to)
	if err != nil {
		return 0, err
	}
	if r == nil || r["max"] == nil {
		return 1, nil
	}
	n, _ := strconv.ParseInt(r.Str("max"), 10, 64)
	return n + 1, nil
}
