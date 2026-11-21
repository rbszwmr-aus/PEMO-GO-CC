# ADR-001 — Resident mobile contract, client framework and severity tokens

**Status:** `Accepted` — decided by the Product Owner on 2026-08-13.
**Date:** 2026-08-13
**Author:** CC Architecture Session, under `API-005-ST`
**Decision owner:** Product Owner (user)
**Target location:** `docs/adr/ADR-001-resident-mobile-contract-and-severity-tokens.md`
**Committing session:** `PEMO Contract` — authored and committed under `API-005-ST`; `Target location` and this field backfilled by `API-016-ST`.
**Related:** `ADR-002` (tenancy root), `ADR-003` (location taxonomy), `ADR-004` (package manager).
**Artifacts:** `packages/api-contracts/resident-mobile/`, `tests/fixtures/resident-mobile/`.

This ADR records four decisions and eight open questions. The open questions are the more important half: this contract is a hard gate for two concurrent sessions, and an unrecorded assumption becomes two divergent implementations.

---

## 1. The resident mobile client is Flutter

**Decision.** The resident mobile application is built in Flutter. The Claude Design export is a **visual specification only**: layout, hierarchy, copy, state coverage and interaction intent. Its React/JSX is never translated, vendored or committed.

### Provenance, stated accurately

This matters because three sources look like they lock Flutter and none of them does.

| Source | What it actually is |
|---|---|
| `GEN-001-ST`, the twelve committed architecture documents | **Names no mobile framework anywhere.** Verified by search across all twelve: no occurrence of Flutter, React, Dart, iOS or Android. Three of them list `framework` as `Unresolved`. |
| Handoff document `02` | Lists "Resident Mobile App: Flutter" under Components — but the section is headed **"Candidate architecture baseline"** and states "this is not evidence of implementation". A candidate is not a lock. |
| `PEMO_UI_Design_System_v1.1` §13 | Provides a Flutter theme baseline and scopes itself to "Flutter resident mobile" — but §13 remains **Proposed**. Only §3 and §3.1 of that document are Accepted. |
| `RETIRED-DOC-002` §2 | Lists Flutter under "Locked technology and implementation constraints" — but it is retired, and retired PIDs stay retired as instructions. Corroborates long-standing intent; locks nothing. |

**What actually locks it is a user decision taken on 2026-08-13**, in which the Product Owner was shown the conflict between the Flutter candidate and the React/JSX design export and chose to keep Flutter with the design as visual specification only.

This ADR is what converts that from a candidate into a recorded decision. Before it existed, the honest description was "user-confirmed but not formally recorded".

**No contradiction was found.** The committed baseline is framework-neutral, so recording Flutter resolves an absence rather than overriding anything.

### Consequence

`UI-007-ST` builds to the design system's tokens, not to the export's. See decision 4 and open question C.

---

## 2. Seven canonical severity levels

**Decision.** The canonical safety severity enumeration is the design system's seven levels, with its hex values:

`normal` · `information` · `advisory` · `warning` · `critical` · `offline` · `unknown`

Normative artifacts: `packages/api-contracts/resident-mobile/severity.json` (machine-readable) and `severity.md` (explanatory). The OpenAPI `Severity` enum is checked against `severity.json` by `tests/fixtures/validate.mjs`, so the two cannot drift.

### Rejected alternative — the prototype's six-token `T` object

The design export defines its severity palette inline:

```js
const T = {
  critical:{fg:'#C0271F',bg:'#FDECEA',bd:'#F0BCB6',glyph:'▲',label:'Critical'},
  warning: {fg:'#A85408',bg:'#FFF0E0',bd:'#F3CDA6',glyph:'◆',label:'Warning'},
  advisory:{fg:'#8A5A00',bg:'#FFF9EC',bd:'#F2E3C0',glyph:'●',label:'Advisory'},
  info:    {fg:'#0B6E78',bg:'#E6F6F7',bd:'#B6E1E4',glyph:'■',label:'Information'},
  normal:  {fg:'#1E6B4F',bg:'#E9F4EE',bd:'#BFDECD',glyph:'✓',label:'Normal'},
  unknown: {fg:'#55606E',bg:'#EEF0F4',bd:'#D6DAE4',glyph:'?',label:'Unknown'},
};
```

**Six keys. There is no `offline` key.** Three levels differ in hue rather than shade — Information is teal where the design system is blue, Advisory is amber where the design system is blue-violet, Unknown is grey where the design system is violet. Normal, Warning and Critical differ only in shade.

Rejected because design system §19 states that product screens must not introduce local one-off severity colours, which makes the inline `T` object the deviation by definition. §19 is not itself in the Accepted subset, but §3 and §3.1 are, and the seven-level set is theirs.

### The prototype collapses three conditions into one token

Recorded because it changed the contract, not only the palette. The export's `unknown` token carries three unrelated things:

1. **A sensor that has stopped reporting** — the design system's `offline` case.
2. **The phone having no network** — client connectivity, not a safety classification at all.
3. **Genuine indeterminacy** — the design system's actual `unknown`.

The export is not wrong to render all three greyish; none of them may be green, and it refuses green in all three. Its copy for case 1 is better than either source document: *"This does not mean there is a problem, and it does not mean your home is safe — we simply cannot see its state."*

But the collapse had to be undone in the contract, and undoing it produced the two rules below.

---

## 3. Two conditions that are not severities

**Decision.** Neither client connectivity nor monitoring coverage may take a severity value.

### 3a. Client connectivity is never a severity

**The decisive argument is that the server cannot know it.** Severity is a server-side classification of a safety condition, and the server has no knowledge of the client's network state. A phone-offline severity would be unemittable in principle. In practice it would be worse than absent: it would show a resident a severity unrelated to their actual safety while genuinely stale critical data sat underneath it.

Therefore `offline` in this enumeration means **the monitored service or sensor is not reporting** — a statement about the monitored thing, never about the client device.

Client connectivity belongs to `UI-007-ST` as **data-age presentation**: render the last successfully retrieved payload, state its age from `safety.freshness` and `meta.generatedAt`, and warn explicitly that it must not be relied on. Every safety projection carries `observedAt`, `receivedAt` and `freshness` precisely so this is possible without a severity value.

Enforced mechanically: `forbidden-terms.json` carries a `clientConnectivity` term group, and the validator scans every fixture against it.

### 3b. Monitoring coverage is never a severity

A unit with no installed safety service has no safety condition to classify. It is not `normal`. Nothing is failing to report, so it is not `offline`. Nothing is indeterminate, so it is not `unknown`. Forcing it into the enumeration makes one of those three wrong.

It is carried by a separate required field, `monitoringCoverage: full | partial | none`.

**Pairing rule, explicitly decided rather than inherited.** When `monitoringCoverage` is `none`, `severity` is `information`. `information` is correct because the statement being made — this flat has no PEMO-connected sensors — is factual and non-urgent, and the screen must never imply the flat is monitored. But **severity alone cannot render this state**, and a client reading only `severity` will get it wrong. Both fields must be read.

The export mapped this condition to its `info` token and reached the same place. The mapping is adopted on its merits; the reasoning above is the record of why, so that a future reader finds a decision rather than an inheritance. The validator enforces the pairing.

---

## 4. Typography

**Decision, by the Product Owner on 2026-08-13.**

- **Inter stands** as the Latin face, per design system §4.1.
- **A monospace role is added**, narrowly scoped to code-like identifiers — case references such as `CS-24115`, resident pass references and similar. Never body copy. Never safety instructions.

### Recorded deviation

The design export uses **Libre Franklin** throughout: 95 of its 104 font declarations, with **zero `Inter` declarations anywhere in the bundle**. The remainder are Noto Sans TC (5) and IBM Plex Mono (4).

**The export is therefore a known deviation to be corrected in design, not followed in code.** `UI-007-ST` builds to Inter.

On the monospace role, the export's four uses split evenly: `ESTATE PHOTOGRAPH` and `QR CODE` are canvas chrome, while `CS-24115` and `RESIDENT PASS` are genuine product content. Two of four being real content is what made this a design question rather than canvas noise.

Typography is not a contract surface — no OpenAPI field or fixture depends on it — so this decision constrains `UI-007-ST` and the design system, not the contract.

---

## 5. Contract-shaping decisions taken while authoring

Smaller than the above, recorded because two concurrent sessions will otherwise infer them differently.

### 5a. Event envelope mapped onto HTTP

`docs/architecture/integration-contract-rules.md` specifies an envelope — `messageId`, `contractName`, `contractVersion`, `occurredAt`, `receivedAt`, `source`, `correlationId`, `causationId`, `scope`, `payload` — for **messages and events**. `API-005-ST` §2.1 requires correlation identifiers on **HTTP responses** per the same rules.

Wrapping a full event envelope around every REST response would be a poor fit: `causationId` and `source` have no meaning for a client-initiated read.

**Decision.** The HTTP projection of the envelope is a `meta` object carrying `correlationId`, `contractVersion` and `generatedAt`, plus explicit `observedAt` and `receivedAt` on every safety projection. Occurrence time and receipt time are always distinct fields and a consumer must never substitute one for the other, which is the envelope rule that actually matters here.

### 5b. Three service dispositions, not two

The export distinguishes services tagged `Not live` from `My billing`, tagged `External`. A single not-live boolean would lose that difference. `availability` is therefore `available | coming_soon | external`: `coming_soon` will be switched on for this estate once its integration is live; `external` is permanently owned by another system of record.

### 5c. Existence disclosure through status codes

A resident requesting another resident's safety event receives `404`, not `403`, because confirming existence would disclose a safety event in another household. Unit-level authorization failures use `403`, where the resident's own lack of access is safe to state. Specified per operation in the contract rather than left to implementation.

### 5d. Both languages always returned

Resident-visible copy always carries `en` and `zh-Hant`, regardless of `Accept-Language`. The client can switch language without a refetch, and a missing translation is visible rather than silently substituted. `displayLine` and greetings are composed server-side because component order differs between the two languages and design system §16 forbids concatenating translated fragments.

---

## Open questions — recorded, not answered

**A. Which side classifies, and which side maps?** The most consequential.

`2IoThub` is the company's own Go API gateway for IT/OT protocols. It adapts to the contract PEMO defines, so it can carry any field PEMO asks for. **But it cannot create information that does not exist upstream.** If this contract declares `severity: critical`, something must actually have classified it. If it declares an affected Unit, something must have mapped a panel zone or device to that Unit.

**Which side performs the mapping — device-or-zone → PEMO property location — and which side performs the classification — raw signal → resident-readable severity — is undecided.** `API-005-ST` has not assumed either answer.

This ADR fixes the severity *vocabulary*. It does not fix *who assigns a value from it*. Those are separable, and freezing the vocabulary first is what allows `GEN-006-ST` and `UI-007-ST` to proceed while this stays open. It deserves its own ADR before `GEN-006-ST` implements ingestion.

**B. The `2IoThub` inbound event contract itself.** Deferred to a later API PID. Deferred as ordinary future work, not because it is undiscoverable — the earlier instruction never to infer a `2IoThub` payload was withdrawn on 2026-08-13.

**C. Which brand palette wins.** The design export and the design system share **no** brand or neutral colour. Ten of ten checked design system tokens — `#007A78`, `#123B4A`, `#005F5D`, `#D9F1EF`, `#2F7D5B`, `#172126`, `#607078`, `#C9D1D5`, `#E1E6E8`, `#F7F9F9` — appear **zero times** in the export, which instead uses a violet/indigo accent (`#5B4BC4`, `#42349B`) over a cool grey ramp.

The two sources agree on structure, copy, hierarchy and state coverage, and disagree on almost all colour. Severity tokens are settled by decision 2; the **brand** palette is not. No contract impact, but `UI-007-ST` needs an answer before it builds a theme. Belongs to the design system.

**D. Design system approval scope.** §3 and §3.1 are Accepted as of 2026-08-13. Everything else — typography scale, spacing, motion, accessibility, component rules, the Flutter theme baseline in §13 — remains **Proposed**. `UI-007-ST` will consume §13, which is Proposed. That is a known, deliberate state, not an oversight.

**E. Six unexported screens.** `MOB-01`, `MOB-04`, `MOB-05`, `MOB-06`, `MOB-07` and `MOB-10` are specified in `RETIRED-DOC-002` §7 but were not visually exported. Recorded as a gap; not invented here.

Sharpest instance: the resident navigation is a five-tab bar including **Inbox**, and the export renders that tab — but `MOB-06 Inbox` has no designed destination. `UI-007-ST` builds it as an explicit not-yet-designed placeholder, not a guess.

**F. Stale statements left standing in the committed baseline.** Two documents contradict the 2026-08-13 `2IoThub` correction and will be read as authoritative by `GEN-006-ST`:

- `docs/architecture/2iothub-boundary.md` — "Candidate event names … are names only, **not approved payloads**".
- Handoff `04` rule 7 — "**Agents cannot infer `2IoThub` payloads.**" Directly withdrawn.

Both need a documentation-correction PID. `API-005-ST` may not modify the twelve committed architecture documents, so the divergence is raised rather than edited.

One nuance worth keeping separate: `2iothub-boundary.md` marks **severity** `Unresolved` on the *inbound* boundary. This ADR fixes the **resident-facing** severity projection. Adjacent surfaces, not the same one, and this ADR does not resolve the inbound vocabulary.

**G. `repository-and-dependency-rules.md` still lists the package manager as `Unresolved`** after `ADR-004` resolved it. Same constraint, same route.

**H. Organization scope in the envelope.** `ADR-002` asked this PID to confirm rather than assume that it is unaffected. **Confirmed for response payloads:** no screen exposes Organization or Portfolio, and none needs to. **Not unaffected for authorization:** the committed envelope's `scope` field is "property scope plus tenant context", and tenant context now has a required root. The contract's security description therefore states that resident-to-unit scope is rooted at the Organization tenancy root and that Estate is not the root, so `GEN-006-ST` can write cross-organization isolation tests without contradicting it. No organization identifier is ever serialized to a resident.

---

## Claim boundary

The artifacts recorded here are a schema, a token set, a denylist, a corpus of synthetic JSON and a script that checks they agree with each other. `tests/fixtures/validate.mjs` passing proves **internal consistency and nothing else**.

No endpoint exists. No database exists. No Flutter code exists. No `2IoThub` event has been received. A contract with fixtures is not proof of a working backend or a working app.

What it does do is stop two concurrent sessions building two different products. That is the whole value, and it is enough to justify doing it first.
