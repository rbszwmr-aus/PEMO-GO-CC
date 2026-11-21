package platform

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
)

// AuditRecord is what one successful act records, in the SAME transaction.
type AuditRecord struct {
	Source        string // provisioning | principal | integration
	PrincipalID   *string
	GroupID       *string
	Role          *string
	NodeKind      string
	NodeID        string
	Action        string
	TargetKind    string
	TargetID      string
	OccurredAt    time.Time
	CorrelationID string
	ReasonCode    *string
	AuditID       string
}

// ErrNestedAuditedWrite: auditedWrite owns its transaction.
var ErrNestedAuditedWrite = errors.New("auditedWrite owns its transaction and was handed a handle already inside one. " +
	"A transaction-scoped handle shares the caller's connection without savepoints, so committing here would " +
	"commit the caller's work too. Call AuditedWrite on the pool-backed module handle.")

const insertAuditEvent = `SELECT access.append_audit_event($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`
const insertIdempotency = `SELECT platform.record_idempotency($1, $2, $3, $4, $5, $6, $7)`
const selectIdempotency = `SELECT act_kind, act_id, audit_id, first_seen_at, request_fingerprint
    FROM platform.lookup_idempotency($1, $2, $3)`

// AuditOptions decides whether an act's result committed, and which reason
// vocabulary the action is checked against.
type AuditOptions[T any] struct {
	Committed func(result T) bool
	Reasons   ReasonCodeRegistry
}

// NewUUID returns a random RFC 4122 v4 UUID string.
func NewUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

type refused[T any] struct{ result T }

func (refused[T]) Error() string {
	return "the act refused; rolling back so it is neither audited nor keyed"
}

func appendAudit(ctx context.Context, tx DB, a AuditRecord, auditID string) error {
	return tx.Exec(ctx, insertAuditEvent, auditID, a.Source, a.PrincipalID, a.GroupID, a.Role,
		a.NodeKind, a.NodeID, a.Action, a.TargetKind, a.TargetID, a.OccurredAt, a.CorrelationID, a.ReasonCode)
}

// AuditedWrite runs act and its audit row in one transaction. A refusal
// (Committed false) rolls everything back and writes zero audit rows.
func AuditedWrite[T any](ctx context.Context, db DB, audit AuditRecord, act func(tx DB) (T, error), opts AuditOptions[T]) (T, error) {
	var zero T
	if db.InTx() {
		return zero, ErrNestedAuditedWrite
	}
	if opts.Reasons != nil {
		if err := AssertReasonCode(opts.Reasons, audit.Action, audit.ReasonCode); err != nil {
			return zero, err
		}
	}
	auditID := audit.AuditID
	if auditID == "" {
		auditID = "aud_" + NewUUID()
	}
	var out T
	err := db.Tx(ctx, func(tx DB) error {
		res, err := act(tx)
		if err != nil {
			return err
		}
		if !opts.Committed(res) {
			return refused[T]{res}
		}
		if err := appendAudit(ctx, tx, audit, auditID); err != nil {
			return err
		}
		out = res
		return nil
	})
	var r refused[T]
	if errors.As(err, &r) {
		return r.result, nil
	}
	return out, err
}

// IdempotencyKey identifies one keyed request (ADR-015).
type IdempotencyKey struct {
	PrincipalID        *string
	Operation          string
	Key                string
	ActKind            string
	ActID              string
	RequestFingerprint string
}

// IdempotentResult is performed (with result) or replayed (with the stored act).
type IdempotentResult[T any] struct {
	Kind        string // performed | replayed
	Result      T
	AuditID     string
	ActKind     string
	ActID       string
	FirstSeenAt string
}

// IdempotencyConflictError: the same key offered for a DIFFERENT act.
type IdempotencyConflictError struct {
	Operation, Key, StoredAct, AttemptedAct string
}

func (e *IdempotencyConflictError) Error() string {
	return fmt.Sprintf("idempotency key %q for operation %q was first used for act %s and is now offered for %s. "+
		"ADR-015 D5: the same key with a DIFFERENT act is refused.", e.Key, e.Operation, e.StoredAct, e.AttemptedAct)
}

// IdempotentAuditedWrite is AuditedWrite plus ADR-015 keying: a replay returns
// the stored act, a different act under the same key is a conflict.
func IdempotentAuditedWrite[T any](ctx context.Context, db DB, audit AuditRecord, key IdempotencyKey,
	act func(tx DB) (T, error), opts AuditOptions[T]) (IdempotentResult[T], error) {
	var zero IdempotentResult[T]
	if db.InTx() {
		return zero, ErrNestedAuditedWrite
	}
	if opts.Reasons != nil {
		if err := AssertReasonCode(opts.Reasons, audit.Action, audit.ReasonCode); err != nil {
			return zero, err
		}
	}
	auditID := audit.AuditID
	if auditID == "" {
		auditID = "aud_" + NewUUID()
	}
	var out IdempotentResult[T]
	err := db.Tx(ctx, func(tx DB) error {
		seen, err := tx.QueryOne(ctx, selectIdempotency, key.PrincipalID, key.Operation, key.Key)
		if err != nil {
			return err
		}
		if seen != nil {
			if seen.Str("request_fingerprint") != key.RequestFingerprint {
				return &IdempotencyConflictError{key.Operation, key.Key,
					fmt.Sprintf("%s:%s fingerprint %s", seen.Str("act_kind"), seen.Str("act_id"), seen.Str("request_fingerprint")),
					fmt.Sprintf("%s:%s fingerprint %s", key.ActKind, key.ActID, key.RequestFingerprint)}
			}
			if seen.Str("act_kind") != key.ActKind || seen.Str("act_id") != key.ActID {
				return fmt.Errorf("idempotency: the stored act %s:%s and the offered %s:%s differ while their request fingerprints AGREE",
					seen.Str("act_kind"), seen.Str("act_id"), key.ActKind, key.ActID)
			}
			out = IdempotentResult[T]{Kind: "replayed", ActKind: seen.Str("act_kind"), ActID: seen.Str("act_id"),
				AuditID: seen.Str("audit_id"), FirstSeenAt: ISO(seen.Time("first_seen_at"))}
			return nil
		}
		res, err := act(tx)
		if err != nil {
			return err
		}
		if !opts.Committed(res) {
			return refused[T]{res}
		}
		if err := appendAudit(ctx, tx, audit, auditID); err != nil {
			return err
		}
		if err := tx.Exec(ctx, insertIdempotency, key.PrincipalID, key.Operation, key.Key,
			key.ActKind, key.ActID, auditID, key.RequestFingerprint); err != nil {
			return err
		}
		out = IdempotentResult[T]{Kind: "performed", Result: res, AuditID: auditID}
		return nil
	})
	var r refused[T]
	if errors.As(err, &r) {
		return IdempotentResult[T]{Kind: "performed", Result: r.result, AuditID: auditID}, nil
	}
	return out, err
}

// ---- derived identity ----

func digest(parts ...string) string {
	h := sha256.Sum256([]byte(strings.Join(parts, "\u001f")))
	return hex.EncodeToString(h[:])
}

// DeriveActID makes the act id a pure function of (operation, key).
func DeriveActID(prefix, operation, key string) string {
	return prefix + "_" + digest(operation, key)[:32]
}

// DeriveRequestFingerprint fingerprints the request's meaningful fields.
func DeriveRequestFingerprint(parts ...string) string { return "rfp_" + digest(parts...) }

// ---- reason codes (ADR-014) ----

// ReasonCodeDeclaration is one action's reason vocabulary.
type ReasonCodeDeclaration struct {
	Codes    []string
	Required bool
}

// ReasonCodeRegistry maps action -> declaration.
type ReasonCodeRegistry map[string]ReasonCodeDeclaration

// ReasonCodeError is a programming error: a code the contract doesn't declare.
type ReasonCodeError struct{ Msg string }

func (e *ReasonCodeError) Error() string { return e.Msg }

// AssertReasonCode enforces the declared vocabulary for action.
func AssertReasonCode(reg ReasonCodeRegistry, action string, code *string) error {
	decl, declared := reg[action]
	if code != nil && strings.TrimSpace(*code) == "" {
		return &ReasonCodeError{fmt.Sprintf("reason_code for action %q is an empty string", action)}
	}
	if !declared {
		if code != nil {
			return &ReasonCodeError{fmt.Sprintf("action %q declares no reason vocabulary, so it cannot record reason_code %q", action, *code)}
		}
		return nil
	}
	if code == nil {
		if decl.Required {
			return &ReasonCodeError{fmt.Sprintf("action %q requires a reason_code and none was supplied; permitted codes: %s", action, strings.Join(decl.Codes, ", "))}
		}
		return nil
	}
	if !slices.Contains(decl.Codes, *code) {
		return &ReasonCodeError{fmt.Sprintf("reason_code %q is not declared for action %q. Permitted: %s", *code, action, strings.Join(decl.Codes, ", "))}
	}
	return nil
}

// AppendAuditInTx records the audit row on the CALLER's open transaction, so
// the act and its audit row commit or roll back together. Every module login
// may execute access.append_audit_event (010-grants). The Node build wrote
// several of these rows through a second pool, in a separate transaction —
// the exact false-record risk ADR GEN-009 warns about; the Go build does not.
func AppendAuditInTx(ctx context.Context, tx DB, a AuditRecord, reasons ReasonCodeRegistry) error {
	if !tx.InTx() {
		return errors.New("AppendAuditInTx needs an open transaction")
	}
	if reasons != nil {
		if err := AssertReasonCode(reasons, a.Action, a.ReasonCode); err != nil {
			return err
		}
	}
	id := a.AuditID
	if id == "" {
		id = "aud_" + NewUUID()
	}
	return appendAudit(ctx, tx, a, id)
}
