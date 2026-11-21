# UI-004 — Step 1: screen list, state matrix, design-system pin, first contract field requests

**PID:** `UI-004` · **Step:** 1 of 2 · **From:** UI / Claude Design session · **To:** Master Brain
**Date:** 2026-08-27 · **Status:** HARD STOP — awaiting confirmation before any artboard is authored

This report is the entire Step 1 deliverable. Nothing in `rewrite/UI/` has been touched yet.

---

## 0. A discrepancy to flag before anything else

`governance/pids/UI-004.md`'s own header line asks for "the state matrix (screen × {loading, empty, partial, error})" — four states — and its **Done when** bullet repeats the same four: *"Every screen has an artboard for every state, discriminated: loading, empty, partial, and error."*

The session brief I was given to execute this PID asks for a wider set: loading, empty, partial, error, offline, stale, no-permission, session-expired, plus long-EN/長中文 content — eight states, which is exactly `PEMO_UI_Design_System_v2.0` §18's baseline list, not the PID's own four. Home Safety additionally carries ten more screen-specific states from the same §18.

I have built the matrix in §3 against the **wider** eight-state set (plus Home Safety's ten), because it is stricter and because §18 is the source the PID itself is presumably drawing on. But the PID document as written would pass review with a four-state deck. **If the wider set is intentional, the PID header and Done-when line should be corrected to say so explicitly** — right now a future reader of `UI-004.md` alone would sign off on a narrower deck than the one I'm about to build, and the file that's supposed to be the authority disagrees with the brief that's supposed to derive from it. If the four-state reading was actually intended and the brief over-reached, tell me now and I'll cut scope before Step 2, not after.

---

## 1. Screen list

Routes below are **proposed, not settled** — no route appears in any first-build source I could find for any of these seven screens (confirmed by direct read of `UI-019-ST`, `UI-022-ST`, `UI-024-ST`, `UI-028-ST`, `UI-031-ST`). They follow the nav labels in design-system §7.1/§7.2 and the resident-portal precedent that the portal opens directly on Explore — `UI-028-ST` explicitly removed a home/dashboard landing screen and recorded that no home screen should be reinstated. I'm treating that as binding precedent for resident-portal's shape, not reopening it.

| # | Screen | Surface | Proposed route | Audience | Satisfies |
|---|---|---|---|---|---|
| 1 | **Home Safety** | management-web | `/home-safety` | Staff with safety visibility at their scoped node(s) | Which units/locations are in a non-normal safety state right now, and why |
| 2 | **Overview** | management-web | `/overview` | Staff at their scoped node, landing page | A single at-a-glance status of the estate(s) in scope — the dashboard staff see first |
| 3 | **Properties** | management-web | `/properties` | Staff browsing the property hierarchy at their scope | What the property tree looks like — org → estate → building → floor → unit, and the Locations attached to it |
| 4 | **Cases** | management-web | `/cases` | Staff with case visibility at their scope | What cases exist, their state, and who's responsible — a queue, not a single case's detail |
| 5 | **Notices** | management-web | `/notices` | Staff at their scope; **read-only build** — composer/publish is out of scope for this PID | What notices exist, their audience and status — reading, not authoring |
| 6 | **Explore** | resident-portal | `/explore` | Authenticated resident, scoped to their household's serving locations | What bookable facilities exist, filtered/searched, with per-facility eligibility |
| 7 | **Facility detail** | resident-portal | `/explore/facilities/:facilityId` | Same resident | Everything about one facility — rates, rules, equipment, availability — before booking |

**Audience is deliberately unnamed by role.** `ADR-010`'s role list is open, and `UI-004` states these screens are picked precisely because they aren't blocked on that decision. I've written audience as "staff with visibility at their scope" rather than naming a role, and the artboards in Step 2 will do the same — a control gated on a specific named role would be inventing the authority spine this PID is explicitly not deciding.

---

## 2. Design-system version pinned

**`PEMO_UI_Design_System_v2.0`**, produced under `UI-010-ST`, dated 2026-08-13 — per `UI-004`'s own pin clause ("the first build's `PEMO_UI_Design_System_v2.0` until `architecture/design-system-v2.md` lands in the rewrite"). I checked: **`rewrite/architecture/` is currently empty** — nothing has landed — so the fallback applies as written and there's no ambiguity to resolve here.

**This is a partial pin, and it matters which part.** The document is explicitly *not* approved as a whole:

| Scope | Status |
|---|---|
| §3 Semantic and Safety Colours (the seven-level severity table) | **Accepted** |
| §3.1 Safety rules | **Accepted** |
| §4 Typography — the Libre Franklin/Noto Sans TC face decision and §4.3 monospace role only | **Accepted** |
| Everything else — §1, §2, rest of §4, §5–§20 | **Proposed baseline**, not yet reviewed |

The consequence for this PID specifically: **§18, "State Coverage," is Proposed, not Accepted** — the very state list I'm building the matrix against in §3 below has no Product Owner sign-off. So does §7 (navigation, which supplies the route/nav labels in §1 above) and §9 (management-web visual rules, which the artboards will render against in Step 2). I'm using them anyway, per the PID's own instruction to design against v2.0, but flagging per Global Rule 8 ("disclose all gaps or none") that "pinned to the design system" does not mean "pinned to an approved document" for most of what I'll actually be drawing from.

Severity is the one place this is *not* a live risk: §3/§3.1 are Accepted, and `API-005-ST` already froze the same seven-level enumeration into `severity.json` at contract `0.2.0`. Every severity token in Step 2 renders from that Accepted source, not from a Proposed section.

---

## 3. State matrix

Eight cross-cutting states (per §0's wider reading) plus bilingual-content coverage, against all seven screens. `●` = required and designed in Step 2. `○` = required but degenerate/thin (explained in the note). `—` = not applicable, with reason.

| Screen | Loading | Empty | Partial | Error | Offline | Stale | No permission | Session expired |
|---|---|---|---|---|---|---|---|---|
| Home Safety | ● | ● | ● | ● | ● | ● | ● | ● |
| Overview | ● | ● | ● | ● | ● | ● | ● | ● |
| Properties | ● | ● | ● | ● | ●¹ | ● | ● | ● |
| Cases | ● | ● | ● | ● | ●² | ● | ● | ● |
| Notices | ● | ● | ● | ● | —³ | ● | ● | ● |
| Explore | ● | ●⁴ | ○⁵ | ● | —⁶ | ○⁷ | ●⁸ | ● |
| Facility detail | ● | —⁹ | ● | ● | —⁶ | ○⁷ | ●⁸ | ● |

Notes:

1. **Properties / Offline** — a `building_service` Location (lift, escalator) carries the same staleness/offline rule as Home Safety per `ADR-003` Q4: *"an availability state with no recent update renders as unknown, never as in-service."* Properties must not show a lift as "in service" just because nothing has arrived recently.
2. **Cases / Offline** — a case with an external-system reference (`2IoThub`, CMMS, ERP per `s3.systemName`'s enum) needs to render that the *source system* is unreachable, distinct from the case record itself being fine. This overlaps with "external integration unavailable" below.
3. **Notices / Offline** — no external-system dependency identified for a read-only notices list; nothing to be offline *from*. Revisit if Step 2 surfaces one.
4. **Explore / Empty** — must be the specific fixture shape the first build proved was load-bearing: `results: [], total: 0` **with non-zero category facet counts**, because an empty results grid is not the same fact as an empty estate. See §5, R2.
5. **Explore / Partial** — thin: a facet/category count arriving without its matching row data (or vice versa) is the concrete partial case; I don't have a stronger source for this screen's partial shape and will design the generic case unless told otherwise.
6. **Explore, Facility detail / Offline** — no server-side integration in the read path for either screen that I can find evidence of; "offline" here would mean the resident's own connectivity, which per design-system §10.3 is *not* a severity/offline token at all — it's client-side data-age presentation. I've excluded a fabricated "offline" state rather than invent server behaviour to justify one.
7. **Explore, Facility detail / Stale** — thin: no explicit staleness field found for booking/availability data in the first-build sources I read (`API-027-ST`'s field-level resolution isn't in this folder). I'll design a generic "last updated" treatment unless a contract field request below gets me something sharper.
8. **Explore, Facility detail / No permission** — this is *not* "no role" in the management-web sense; it's household/eligibility scope — a resident outside a facility's `serving_scope`. Distinct from Facility detail's own `eligible: false` (which is a **present-with-reason** state on an otherwise-visible facility, not an absence — see §5, R1). I'll design both, and the artboards will make the distinction explicit rather than merging them.
9. **Facility detail / Empty** — doesn't apply the way it does to a list; a facility either exists (with all its states below) or the route 404s, which I'm treating as a shape of Error, not a separate Empty state.

**Bilingual EN / 繁體中文, long content:** applies to all seven screens, not listed as a matrix column because it isn't a discrete state — it's a rendering property every state above must be checked against (a Warning chip, an error message, a case title must all survive long Traditional Chinese without truncation or fragment-concatenation). Verified per-screen in Step 2, not drawn as an eighth column here.

**Duplicate-submission prevention** (design-system §18's ninth baseline item): **N/A for all seven screens** — every one of these is a read screen; there is no submission to duplicate. Recorded here rather than silently dropped, per Global Rule 8.

### 3.1 Home Safety — ten additional required states (§18)

Design-system §18 lists ten Home-Safety-specific states beyond the baseline eight. I'm carrying all ten into Step 2, but flagging two as an open question rather than assuming they apply as written:

- Unknown/unmapped unit — ●, direct precedent: `mapping.state === 'unmapped'` is already a real field in the first-build `S1HomeSafety.tsx`.
- Event update versus duplicate event — ●
- Late event — ●
- Corrected/retracted source event — ●
- No installed sensors — ● (this is `monitoringCoverage: none`, which per §3.1 is its own field, not a severity value — renders as `Information` with explicit not-monitored copy, never blank)
- Sensor/service offline — ● (the `Offline` severity token specifically, distinct from `Status unknown`)
- Management update pending — ●
- All clear — ●
- **Resident not authorized — open question.** This reads as a resident-portal/resident-mobile concept (a resident viewing a home they're not authorized on). Does a *staff* Home Safety screen need this state at all, or would staff simply not see an unauthorized resident's data server-side (i.e., it's a "no permission" case already covered, not a distinct state)? I'd rather ask than draw a state that doesn't apply to this audience.
- **Caregiver permission expired — same open question.** "Caregiver" is a resident-mobile relationship (someone else's access to a resident's safety data). I don't see how this surfaces on a staff-facing management-web screen unless staff need to see *that a caregiver's access lapsed* as a fact about the case/unit. If that's the intent, say so and I'll design it that way rather than guessing at the shape.

---

## 4. Twist-boundary precedents I'm designing against (not new findings — carried forward)

Per `UI-004`'s hard constraint, these are the specific places the first build already proved a computation must be server-side, and I'll hold the same line rather than relitigate it:

- **Properties** — `s3.systemName` (the `twoiothub | cmms | erp` lookup) must be a genuine value-map entry with a fallback that *fails* the completeness check, never a `label` default. If the contract adds a fourth external system, the design must have somewhere for "unrecognised system" to render honestly rather than silently.
- **Home Safety** — copy that claims absence ("no unassigned rows") must be gated on the same field everywhere it appears, and the gate asserted. The first build shipped this exact bug twice on this exact screen (`UI-022-ST`) — one gated correctly, one not. I'll design one shared component/copy source for this claim rather than two independent strings.
- **Explore** — facet/category counts are server-computed and world-scoped; the design must render whatever count the server sent, never a client-side recount from the rows in the response. The proof fixture is `results: [], total: 0` with non-zero category counts, and the design must handle that combination without treating it as a contradiction to smooth over.
- **Explore** — eligibility is **present-with-reason**, not filtered out. A facility a resident can't book still appears, with a machine-readable ineligibility reason. This is a direct instance of this PID's own Rule 2 ("present, unavailable, with the reason"), already proven necessary by the first build's `fac_wfg_gym / eligible:false / membership-required` fixture.
- **Facility detail** — `null` vs `0` on a policy field (e.g. booking quota) are opposite statements and must render differently; a closed facility renders its state and reason, never an empty/fully-booked grid; `SlotState: unavailable` deliberately collapses "booked by another" and "held" and must render as one thing, not distinguished by hover/tooltip/aria-label. All three were tracked incidents in the first build (see `UI-031-ST`), not speculative rules.

---

## 5. First CONTRACT FIELD REQUEST list

Format: screen → field → why. Two categories: **(confirmed)** = a field the first build already established and I'm designing around; **(request)** = something I need that I could not confirm exists, or a screen with no first-build precedent at all.

| Screen | Field | Why |
|---|---|---|
| Home Safety | `mapping.state` (`unmapped \| partial \| resolved`) | **(confirmed)** Drives the unassigned-row copy; must gate both instances of the claim on this field. |
| Home Safety | severity per unit/location, from the seven-level `severity.json` enum, plus `monitoringCoverage` as its own field | **(confirmed)** Structural — never collapse into severity per `ADR-001`. |
| Home Safety | an observation timestamp / freshness field per monitored unit | **(request)** Needed to render "Offline" and "Stale" distinctly from "Normal" per §3.1 — I couldn't confirm the exact field name in any first-build source; I need one to design the offline/stale states honestly rather than inventing a field name. |
| **Overview** | *(no field list)* | **(request, structural)** — I found **zero** first-build design intent for this screen in any of `UI-019/022/024/028/031-ST`. It's named as one of the five in-scope management-web screens in `UI-004` but has no route, layout, or field precedent I could locate. Before I draw a dashboard's worth of aggregate stats and cross-links, I need either a pointer to a source I haven't found, or explicit permission to derive a minimal Overview from Home Safety/Properties/Cases/Notices summaries and flag the whole thing as provisional in Step 2. |
| Properties | `s3.systemName` (`twoiothub \| cmms \| erp`) as a genuine classified value-map field, not a `label` | **(confirmed)** See §4. |
| Properties | property-hierarchy fields per `ADR-002` (`org → [portfolio] → estate → [phase] → building → floor → unit`) and Location fields per `ADR-003` (`physical_parent`, `serving_scope`, `class`, `unit_class`) | **(confirmed)** Accepted ADRs; I'll render exactly this shape, not the export's flattened single-estate view. |
| **Cases** | *(no field list)* | **(request, structural)** — same finding as Overview: no first-build source names a route, field, or state specific to a management-web Cases *queue* screen. (There is a `mob-s4-cases` fixture, but that's the **resident-mobile** app's Cases screen — a different surface — and I'm not treating it as precedent for this one.) I need either a source pointer or permission to derive a minimal case-queue field set (case reference, status, subject/type, assignee, scope/node, last-updated) and flag it provisional. |
| Notices | notice status enum, audience/scope, timestamps, correction/update linkage | **(request)** Not itemized in any source I read; the composer/write path is explicitly deferred, but even a read-only list needs a status vocabulary to render. |
| Notices | a representable "stuck workflow" shape — an approval pending with no eligible approver | **(confirmed as a required fixture, not a field)** — the first build recorded this exact fixture as deliberate evidence for the open role decision (`supervisor-approval` pending, no role can approve it) and warned against smoothing it over. I'll design Notices so that state renders honestly rather than silently, per that precedent. |
| Explore | filter axes (category, location parent, duration type, equipment, capacity, date/time window), match-mode toggle, per-facility `eligible` + reason, `FacilityState`, per-slot `SlotState`, facet/category counts | **(confirmed)** Established by `UI-028-ST`/`UI-031-ST`. |
| Explore | `FacetCount.basis` vs `scope` | **(confirmed, live gap)** — contract prose on `basis` is documented as literally false on the empty-results fixture; ruling was render from `scope`, never `basis`. I'll follow the ruling and won't reference `basis` for display anywhere in Step 2. |
| Facility detail | overview, rates (nullable policy fields), rules, equipment, location, FAQ; `expectedReturn` as nullable, never invented | **(confirmed)** Established by `API-027-ST`/`UI-031-ST`; the null-vs-zero and no-invented-dates rules are load-bearing and covered in §4. |
| Explore, Facility detail | a staleness/last-updated field for availability data | **(request)** — see matrix note 7; I don't have a confirmed field for this and will design a generic treatment unless one exists. |

---

## 6. What I did **not** find, and am not assuming

- No route path exists anywhere I could locate, for any of the seven screens. All seven in §1 are proposals.
- No design intent at all for **Overview** or **Cases** (management-web) beyond their names appearing in the five-screen list. These are the two riskiest screens in this batch precisely because there's nothing to diverge from or confirm against — everything in Step 2 for these two would be closer to origination than translation, which is a bigger decision than this PID's framing ("translate already-designed intent") suggests it should be.
- No staleness/last-updated field name confirmed for Home Safety, Explore, or Facility detail — I have the *rule* (never render offline/stale/missing data as normal) but not the *field* it reads from in every case.

---

## Requested from Master Brain before Step 2

1. Confirm which state-list governs: the PID header's four states, or the wider eight-plus-Home-Safety-ten set I've matrixed in §3 (see §0).
2. Rule on the two open Home Safety states — do "Resident not authorized" / "Caregiver permission expired" apply to the staff-facing management-web screen, or are they resident-app states I should drop from this deck (§3.1)?
3. For **Overview** and **Cases** — point me at a source I haven't found, or authorize me to derive a minimal provisional field set and mark it clearly as such in Step 2 (§5).
4. Confirm the design-system partial-acceptance boundary (§2) is understood and accepted as the basis for Step 2 — i.e., that I'm authorized to design against Proposed sections (§7, §9, §18) with their status disclosed, not withheld pending full approval.

**HARD STOP.** No artboard will be authored until this is confirmed.
