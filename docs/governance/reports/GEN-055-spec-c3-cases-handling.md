# C3 — Cases handling: vocabularies, ownership, conversation, transitions, human close, reopen, satisfaction

Track: Main CC. PID id: the register's next GEN-NNN (expected GEN-055) via the two-file allocation commit. Pin: main head at start (a94b7b0 or later). Cites ADR-020 (D2–D8, D10, OQ1–OQ4), ADR-020 corollary (resident authority = occupancy + serving_scope), ADR-013, ADR-014 + amendment, ADR-015, ADR-017/018 (RoleScope), ADR-019 D8 (attachment_ref), GEN-038 (C1 schema), GEN-044 (C2 acts), GEN-047 (canPerform, target-typed), GEN-049 (loser refused by constraint), GEN-052/053 (Problem-type parity; CHECK-precheck). Acts only — no routes, no read surface (those are the next PID, which plans the MOB-02 resident-mobile MAJOR). No contract delta unless a Problem type must be declared — say so.

## D0 Disjoint vocabularies FIRST (ruled at GEN-044 close)
Ticket lifecycle, Case lifecycle, and each's closure/disposition reasons are three (per module, six) disjoint vocabularies with type-level tests that a literal of one cannot be passed where another is expected (the D6 pattern from GEN-047). Enumerate them in the report before any act is written. Ticket lifecycle (computed from the chain): `open → triaged → in_progress → awaiting_resident → resolved → closed` with `reopened` as a new open assertion; Case lifecycle: `open → assigned → in_progress → awaiting_external → pending_verification → resolved → closed`, reopen likewise. Adjust names to what GEN-038 already computes; do not rename what exists without saying why.

## D1 The acts (all staff acts `RoleScope<'estate_staff'>` covering the ticket's/case's node; all register with `canPerform` as targets `{kind:'ticket'}` / `{kind:'case'}`; every act appends, none updates)
helpdesk
- `postTicketMessage` — staff (covering) or the ticket's reporter (resident, as themselves); `visibility ∈ {resident_visible, internal}` set at write, immutable; resident-authored messages are always resident_visible; anonymous tickets (reporter NULL) accept no resident message and no resident_visible reply (one-way feedback, GEN-044 D3). Attachments by `attachment_ref` id.
- `setTicketStatus` — staff; transitions per D0; `awaiting_resident` and back; `resolved` requires a resident_visible closing message in the same transaction or a stated reason code; `closed` from resolved only.
- `reopenTicket` — staff, or the reporter within the org's reopen window (policy row, fail-closed: no row ⇒ residents cannot reopen); new open assertion carrying `reopen_reason`.
- `recordSatisfaction` — the reporter only, after `closed`, once per closure (append-only per-ticket fact; a second submission for the same closure is refused; a new closure opens a new slot).
service_case
- `assignCase` — staff covering; owner = a staff principal whose own grant covers the case's node (refuse otherwise — an owner who cannot see the case is a lie); reassignment is a new assertion.
- `addCaseNote` — staff; always internal (no visibility field exists; the denylist guard also refuses a `visibility` column or field on case_note).
- `setCaseStatus` — staff; transitions per D0; `awaiting_external` requires a `case_external_link` fact (external system id + reference; the transport is not here); `pending_verification` may be entered by staff or by an external-completion act (`recordExternalCompletion`, staff-recorded in this cut since the Hub transport does not exist) — and NEVER moves further by itself.
- `closeCase` — HUMAN ONLY: a staff act with a `closure_reason` code; refused from any state but `pending_verification` or `resolved`; refused if the caller is the external-completion recorder of the same completion? — NO: keep simple, but the act records that closing and completion were distinct assertions with distinct actors where they were; report the pattern.
- `reopenCase` — staff; new open assertion with reason.
composition (wiring layer, public interfaces only)
- `resolveTicketFromCase` — when a Case closes, staff may in one transaction close the case and set each linked ticket (helpdesk's public interface lists them via `primary_case_ref`) to `resolved` with one resident_visible message; tickets are NOT auto-closed — the resident's or staff's `closed` follows per ticket.

## D2 Forbidden terms
The `forbidden-terms` denylist (ADR-011 D5 mechanism, GEN-038) runs over every new column, field, and Problem this PID adds; `monetary_type` scan included. Bite: add a `labour_hours` field → red.

## D3 Floors, audit, stances, keys
Staff acts: audit_event with witness (ADR-014); resident acts (postTicketMessage as reporter, reopenTicket as reporter, recordSatisfaction): no audit row — the assertion is the record (ADR-014 amendment). Stances: `postTicketMessage` client-key; status/assign/close/reopen derived-key on `(id, from_version)` with stale-state refusal via the existing UNIQUE(version) constraint (GEN-049 pattern — no advisory lock); `recordSatisfaction` derived-key on `(ticket_id, closure_version)`. reason_code required on `closeCase`, `reopenCase`, `reopenTicket`; declared none-required elsewhere, explicitly.

## D4 Problems and parity
Every refusal a declared Problem type with a recorded fixture (GEN-052 rule: declared ⇒ fixtured or in problem-debt.json by ruling — this PID adds no debt). New Problem types are additive contract changes on the internal act contract only; say which.

## Out of scope (named)
Routes and read surface (next PID: cases routes + read projections + MOB-02 MAJOR plan + OQ3 household visibility ruling + OQ1 restricted cases with read enforcement); 2IoThub transport; SLA engine and overdue escalation (`escalated` assertion kind exists; nothing fires it); teams; CAS-06; attachment upload (object store).

## Acceptance — all green from a truly-from-nothing rebuild (GEN-048 R2); every guard bites via the four-condition runner; adapter bites where plumbing exists
1. D0 vocabularies disjoint: type test reds when a Ticket status literal is passed to setCaseStatus (and each other pair).
2. Visibility immutable: no act can change a message's visibility; mutation that adds an UPDATE path → red; resident-authored message forced internal → red.
3. Anonymous ticket: resident message and resident_visible reply refused; staff internal note allowed.
4. pending_verification never self-advances: recordExternalCompletion then no closeCase → state stays pending_verification across every other act; mutation that closes on completion → red.
5. closeCase human-only and from the right states; reason_code required; derived-key repeat returns original; stale version refused by constraint (two-connection forced test, GEN-049 shape).
6. assignCase refuses an owner whose grant does not cover the node; mutation dropping the owner-cover check → red.
7. resolveTicketFromCase atomic: force the ticket step to fail → no case closure survives; split into two transactions → orphan → red.
8. recordSatisfaction once per closure; reporter only; after reopen + second closure a new slot.
9. Denylist bites (D2). 10. Problem-type parity green with zero new debt. 11. Floors: block-A staff on a block-B case → refused; mutation floor any-node → red. 12. Boundaries (no cross-module table access in the composition) / validator / stamp PASS.

Report: the D0 vocabulary table, act table with stance + key + floor + audit, Problem types added, fixture count, matrix of canPerform for ticket and case targets against real invocation (states × callers incl. reporter and anonymous). Standard merge, [GEN-NNN] tag, Rule 7 close, HARD STOP for the close ruling.
