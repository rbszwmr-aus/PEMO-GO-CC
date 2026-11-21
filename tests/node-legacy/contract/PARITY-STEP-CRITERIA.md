# Acceptance criteria carried into the parity step — GEN-018-ST

Written during B6, by the session that established why, rather than left in a
report. A finding that must be honoured by a future step does not survive in a
report.

## 1. The management boundary scanner carries identifier redaction

**Criterion.** When the management surface's boundary scan is built, it applies
the same identifier redaction the resident scanner applies, and that is proven by
the same red condition: remove the redaction, confirm the assertion fails,
restore it.

**Why, measured rather than argued.** `hk-mobile-number` is present in
`packages/api-contracts/management-web/forbidden-terms.json` at exactly the rate
it has on the resident surface — **1.483%** against a canonical UUID, measured
over 200,000 samples. The management surface mints `meta.correlationId` for every
response exactly as the resident surface does.

So a management scanner without redaction inherits `G4` verbatim: a suite that
reddens at random, at a rate high enough to recur every few weeks and low enough
that a handful of green re-runs looks like proof.

**This is pre-registered, not discovered.** `G4` cost a full investigation to
close on the resident surface — enumeration of four patterns against 20,000
UUIDs, 2,000 in-process scans, 45 targeted runs to reproduce twice. The second
instance should cost one line and a test.

**The redaction, not a skip.** Remove identifiers from the string and scan the
remainder. Skipping any string that contains an identifier turns the exclusion
into a hiding place: a genuine leak sharing a field with a correlation id would
pass. `tests/contract/resident-boundary-scan.test.ts` has the case —
`ref <uuid> call 91234567` must still be caught.

## 2. Every value pattern gets its false-positive rate computed before it ships

Standing practice from `G4`. Compute each pattern against the identifier shapes
the system actually mints — UUIDs, correlation ids, idempotency keys, prefixed
ids, references, RFC-3339 timestamps. It is arithmetic and takes minutes.

Current rates, both denylists × twelve minted shapes, 200,000 samples each: every
pair is 0.000% except `hk-mobile-number` × bare UUID at **1.483%**, on both
surfaces.

Note the accident worth knowing: `ack_<uuid>` and `qtn_<uuid>` are immune because
`_` is a word character, so `\b` cannot match before the digit run. Nobody chose
that, and a naming decision could silently remove it.

## 3. Mutations must target what the assertion claims to measure

Carried in from `UI-019-ST`, and demonstrated in `B6` before the ink dried: the
needle `readDevOverrides = (` was in the build-exclusion list and was wrong. That
symbol exists in **both** builds by design — the production variant keeps it so
the call site stays byte-identical — so its presence measured "a function of that
name exists", not "the seam shipped".

When proving a parity assertion, check the mutation changes the thing the
assertion is about, not the code around it.

---

## Discharged, and what discharging them produced

**Criterion 1 — discharged.** `tests/contract/management-boundary-scan.test.ts`.
The scanner is surface-aware; the redaction is shared between the two surfaces
because *"prose patterns do not apply to machine-minted identifiers"* is a
property of identifiers, not of an audience. The red condition is proven on the
management surface directly rather than inherited on trust from the resident one,
and the 1.483% figure is now an executable measurement inside the test — if the
rate ever changes, the test fails and somebody re-reads the reasoning.

The denylists are asserted to be genuinely different lists, in the direction that
matters: `deviceid` is forbidden to a resident and **permitted** to estate staff,
because dispatching somebody to a fault requires naming the faulty thing. The
management boundary does not relax the resident one, it inverts parts of it.

**Criterion 2 — carried.** The management denylist's patterns are measured in the
test, not in a report.

## 4. F-parity-1 — three fixtures do not name their own subject

Found by the parity harness on its first run, before any endpoint served a
request.

`mob-s1-safety/delivery.json`, `source.json` and `source-unmapped.json` are 200
responses to `/safety/events/{eventId}/…` and none carries the `eventId` it
belongs to. Their sibling `detail.json` — the parent resource, same event — does.

**Why this is a defect and not a shape.** A sub-resource fixture that does not
name its parent is green for *whatever* event the test picks. The bytes match;
the claim that they are the delivery record **of that event** is asserted
nowhere. That is the fourth instance of one shape in this PID: a value and its
stated basis, `window.returned` against its event array, identifiers across
corpora, and now this — **two assertions with nothing comparing them.**

Distinguish it from the legitimate case: a Problem body describes a request that
was *refused*, and RFC 9457 gives it nowhere to name the identifier that was
refused. No fixture change could fix that one. This one is fixed by adding the
identifier, which is contract-track work.

**Meanwhile:** `tests/contract/parity-harness.test.ts` pins the set to exactly
these three. A fourth arriving is a failure, not one more line in a list.
