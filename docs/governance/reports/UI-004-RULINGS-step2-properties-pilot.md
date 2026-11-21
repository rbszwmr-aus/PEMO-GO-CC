# UI-004 — Master Brain ruling on the Properties pilot (filed)

**Author:** Master Brain · **Date:** 2026-08-27 · **Rules on:** `rewrite/UI/Property management UI design v1/` (brief + README + `PEMO Properties Pilot.dc.html`)
**Verdict:** **ACCEPTED with four rulings.** The shared patterns are **locked** and the other six read-surface screens are **released** to author against them, subject to the corrections below.

## What the pilot got right, and is now the locked pattern

1. **Per-region states, not per-screen.** Tree, facts grid, household and external-references each load, empty and fail **independently**; a broken detail fetch never blanks the tree. This is sharper than UI-004 asked for and it is the pattern the other six screens copy. **Locked.**
2. **Nothing is client-tallied.** Every count, percentage and mapping indicator is a server-returned field. **Locked.**
3. **Server-side search, with the right reason.** A client-side filter over a fully-fetched tree would leak out-of-scope nodes into the DOM even when hidden — the audience boundary applied at the DOM, not merely at the eye. **Locked, and promoted:** *out-of-scope data must be absent from the payload, not filtered in the client, and "hidden in the DOM" is not absent.*
4. **No-permission handled as a filter, not a redaction.** An out-of-scope unit never appears in the tree; a stale deep link gets a named reason, not a blank or a generic 404. **Locked.**
5. **Stale never renders as current.** A degraded mirror carries icon + "Last confirmed …". **Locked.**
6. **The screen advertises its own open contract question.** The `CONTRACT PROPOSED` tag stays attached until `CFR-3` resolves, so the pilot cannot look finished while it is not. **Locked as a general practice for this line.**
7. **Open questions recorded, not resolved by drawing** (the two items for Master Brain). Correct discipline.

## Rulings

### R1 — `CFR-1`: the tree meta is **discrete derived values**, not a pre-composed string. (Corrects the pilot.)

The pilot proposes `node.meta` as one opaque server-composed string (e.g. `"42 units · 3 unmapped"`), and open item 1 asks which way to go. **Ruled: the server sends the derived *values* (`unitCount`, `unmappedCount`, …); the client composes the display string.**

The twist rule cuts **both** ways. *Derivation* — counting descendants, tallying mapping state — is the server's, and the pilot is right that the client must not compute it. But *composition of a display string* is **presentation**, and pushing it server-side breaks the other half: a pre-composed string cannot be re-ordered for Traditional Chinese, cannot reflow or truncate per breakpoint, and forces i18n into the API. It would also violate the rewrite's own rule against **concatenating translated fragments** — a server building `"42 units · 3 unmapped"` is doing exactly that.

**So: server derives the numbers, client renders the sentence.** This keeps the safety-relevant computation server-side and the language-relevant assembly client-side, which is the boundary as written.

### R2 — `CFR-3`: a mirrored status is **not** severity. Give it its own vocabulary.

The pilot proposes `externalRef.mirroredStatus` as *"one of the seven severity levels"*. **Ruled: no.** The seven-level scale is a **safety** statement standing on an approved, effective-dated classification policy with recorded provenance (`ADR-006`). A CMMS mirror's freshness has no such policy behind it, and borrowing the scale would (a) leave `Advisory` / `Warning` / `Critical` unreachable or, worse, invite someone to reach for them, and (b) dilute a vocabulary whose whole value is that it means one thing.

**A mirror carries its own small vocabulary — current / stale / unavailable — plus `lastConfirmedAt`.** It **does** inherit the *rendering rule* (icon + text label, never colour alone) and the *stale-is-never-current* rule. It does not inherit the scale. Rationale of general application: **never borrow the safety vocabulary for a non-safety state; a scale that means several things means none.**

### R3 — `Satisfies` is mis-cited. Fix the traceability.

The pilot cites `DOC-002` as what the screen satisfies. `DOC-002` is the **reuse audit** — it says what code carries, not what the product must do. Properties satisfies the **product decomposition**: `PRP-01` property hierarchy, `PRP-02` unit profile, `PRP-03` occupancy and relationship status, resting on `ADR-002` (hierarchy) and `ADR-003` (Location taxonomy). Correct it and use the feature IDs on the remaining six screens — traceability is the point of the field.

### R4 — Two required states are missing; one privacy question is unaddressed.

- **`session-expired` and `offline` are absent.** UI-004 requires both. `offline` matters here specifically because the external-references panel already reasons about degraded mirrors — the two must not be conflated: *the mirror is stale* and *this browser has no connection* are different statements to a user, the same distinction as `Offline` vs `Status unknown`. Add both.
- **A minor's full name renders on a staff screen** (the reference screenshot shows an `under 18` household member by full name). Not a blocker and possibly correct, but it is a deliberate privacy choice and must be **stated with its reasoning** in the brief, not arrived at by default.

## Accepted as-is

The two recorded divergences (policy footers as quiet tinted rows rather than banner components, because banner styling is reserved for state/severity messaging and these are policy statements, not alerts; and the tree meta having no design-system vocabulary yet) are **accepted with their reasoning** — R1 supersedes the second one's proposed resolution.

`CFR-2`, `CFR-4`, `CFR-5`, `CFR-6` are **accepted as the contract asks**. `CFR-4` in particular is right for the stated reason: `canRevoke` must arrive as a **pre-authorized boolean**, never a raw expiry the client compares to "now" — that comparison is an authorization decision wearing a formatting disguise.

## Release

The other six read-surface screens (management-web: Home Safety, Overview, Cases, Notices; resident-portal: Explore, Facility detail) are **released to author** against the locked patterns, carrying R1–R4. The `CONTRACT FIELD REQUEST` list continues to accumulate across screens and is delivered once, whole, at the end of Step 2 — it is the deliberate single input to any contract change.
