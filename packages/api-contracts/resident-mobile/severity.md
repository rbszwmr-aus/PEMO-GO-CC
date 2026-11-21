# PEMO Canonical Safety Severity Tokens

**Contract version:** `0.2.0`
**Owning PID:** `API-005-ST`
**Machine-readable form:** [`severity.json`](./severity.json) — the normative artifact. This document explains it; where they disagree, `severity.json` wins and the disagreement is a defect to report.
**Source:** `PEMO_UI_Design_System_v2.0` §3, §3.1, §3.2 and §11. Colour values revised by `UI-010-ST` on 2026-08-13; see *Why the values changed* below.
**Consumers:** `GEN-006-ST` (serves these values), `UI-007-ST` (renders them). Neither may modify this file; contract changes go back to `API-005-ST` as a new version and both re-pin together.

## Status of the source

Design system §3 (semantic and safety colours) and §3.1 (safety rules) are **Accepted** as of 2026-08-13. The rest of `PEMO_UI_Design_System_v2.0` remains **Proposed**. This document depends only on the Accepted sections plus the §3.2 label table and the §11 icon table, which are descriptive of §3 rather than independent decisions.

## The seven levels

Seven levels. Not six. The design export's inline `T` object defines six and is a known deviation, recorded as the rejected alternative in [`ADR-001`](../../../docs/adr/ADR-001-resident-mobile-contract-and-severity-tokens.md).

| Value | English | 繁體中文 | Strong | Surface | Border | Icon concept |
|---|---|---|---|---|---|---|
| `normal` | Normal | 正常 | `#377C60` | `#EBFEF5` | `#679A83` | Check circle |
| `information` | Information | 資訊 | `#20727C` | `#CDF3F8` | `#509098` | Information |
| `advisory` | Advisory | 提示 | `#754C02` | `#F2CB9D` | `#976C30` | Notifications active |
| `warning` | Warning | 警告 | `#7B3800` | `#F0B995` | `#9C5B2A` | Warning triangle |
| `critical` | Critical | 緊急 | `#85110F` | `#E8A99B` | `#9D493B` | Emergency / error octagon |
| `offline` | Offline | 離線 | `#5C616D` | `#DCDEE8` | `#797D8B` | Cloud off |
| `unknown` | Status unknown | 狀態不明 | `#3B364E` | `#ADA9BC` | `#5A556D` | Help outline |

No free-text severity. No value outside this enumeration. No locally defined severity colour — design system §19 forbids product screens introducing one-off severity colours, and that rule is what makes this set canonical rather than merely recommended.

## Why the values changed

The levels did not change. The colours did.

The Product Owner ruled on 2026-08-13 that the **design export is the visual authority** — brand violet and slate neutrals, Libre Franklin — superseding the design system's teal and Inter. That ruling settles the visual question only. It does not reduce severity from seven levels to the export's six, and it did not: `offline` and `unknown` remain distinct, because "the service is not reporting" and "we cannot determine the condition" are different statements to a resident.

Hue is taken from the export. **Lightness is not**, and that is a deliberate correction rather than a deviation.

Measured across both exports, every severity `strong` in the export sits on a single lightness plane — `critical` L\* 42.4, `warning` L\* 45.2, `advisory` L\* 42.3, `information` L\* 42.1, `normal` L\* 40.2 — differentiated by hue and chroma alone. Desaturated, the five-level ladder collapses: the worst surface pair differed by **0.20 L\***, and the `advisory` and `information` strongs by **0.21 L\***. A resident with red-green or red-violet colour vision deficiency, on a sun-washed screen, or reading a greyscale rendering, saw five identical pale chips.

Each level now holds its own lightness band across L\* 70–98. The worst-separated pair of all twenty-one is now **4.51 L\***, against 0.20 before.

## Measured contrast — WCAG 2.2 AA

Fresh measurement, not a re-check: a new palette invalidates prior conformance. Text needs 4.5:1 (§1.4.3), non-text boundaries 3:1 (§1.4.11).

| Level | strong on surface | border on surface | Verdict |
|---|---:|---:|---|
| `normal` | 4.75:1 | 3.07:1 | PASS |
| `information` | 4.73:1 | 3.07:1 | PASS |
| `advisory` | 4.95:1 | 3.07:1 | PASS |
| `warning` | 5.02:1 | 3.06:1 | PASS |
| `critical` | 5.08:1 | 3.07:1 | PASS |
| `offline` | 4.62:1 | 3.06:1 | PASS |
| `unknown` | 5.03:1 | 3.11:1 | PASS |

**`offline` vs `unknown`** — the pair that must be distinguishable at a glance: ΔL\* **18.48**, ΔE2000 **13.98**, and **12.90** after desaturation. Rendered as badges and converted to greyscale they measure 57 levels apart on a 0–255 scale. `offline` is the pale slate chip, `unknown` the dark one; the difference survives with no colour at all.

**`normal` vs `offline`** — §3.1 requires that offline data never reads as normal: ΔL\* **9.51**, 26 greyscale levels as rendered.

**`critical` vs brand violet.** A 3:1 floor was proposed and withdrawn as unsatisfiable — no red holding 4.5:1 on white exceeds 2.22:1 against `#5B4BC4`. It also tested a pairing that does not occur: as compositions a critical badge is a pale chip and a brand button a dark block, 5.65:1 apart. The re-banding improves the token-level figure from 1.09:1 to **1.56:1** (ΔE2000 40.70) as a side effect of giving `critical` its own lightness band.

> **One consequence for implementers.** Where critical strong and brand strong meet as text on the same light surface, use `#5B4BC4` for the brand, **not** `#42349B`. Against the re-banded `critical` `#85110F`, the deeper brand token measures 1.05:1 (ΔL\* 1.46) while `#5B4BC4` measures 1.56:1 (ΔL\* 12.08). The deep token was the better choice against the old critical and is the worse choice against this one. In this narrow case the §3.1 icon-and-label requirement is the primary means of distinction, not a backstop — the palette cannot solve it.

## When each level may be shown

| Value | May be shown when | Must not be shown when |
|---|---|---|
| `normal` | Data is current, **and** valid, **and** explicitly classified normal. All three. | Data is offline, stale, invalid, missing or unclassified. Absence of a reported problem is not a normal classification. |
| `information` | A factual, non-urgent statement is being made. | The condition requires timely attention. |
| `advisory` | The resident may benefit from noticing this; no action required of them. | Action is required of the resident. |
| `warning` | A safety-relevant condition needs resident action but is not immediately life-threatening. | The condition is immediately life-threatening. |
| `critical` | A genuinely critical safety condition, so classified by the classifying authority. | The condition is not genuinely critical. |
| `offline` | A service or sensor expected to report has not reported within its freshness window. | The **client** has no network connection. See below. |
| `unknown` | A condition exists that PEMO should be able to classify and cannot. | No monitored service exists at all. See below. |

## Two conditions that are not severities

This section is the substantive contract rule in this document. Both conditions were found collapsed into a severity token in the design export, and both must stay out of the enumeration.

### 1. Client connectivity is never a severity

The design export renders "your phone has no connection" with its `unknown` token. That is a data-age statement, not a safety classification, and its own copy says so: *"Your phone has no connection, so this screen is showing information from 08:30 this morning."*

**The decisive argument is that the server cannot know it.** Severity is a server-side classification of a safety condition. The server has no knowledge of the client's network state, so a phone-offline severity value would be unemittable in principle. In practice it would be worse than useless: it would show a resident a severity unrelated to their actual safety, while genuinely stale critical data sat underneath it.

Therefore:

- `offline` in this enumeration means **the monitored service or sensor is not reporting**. It is a statement about the monitored thing, never about the client device.
- Client connectivity belongs to `UI-007-ST` as **data-age presentation**: render the last successfully retrieved payload, state its age from the `observedAt` and `freshness` fields every safety projection carries, and warn explicitly that it must not be relied on.
- A client-connectivity term is in [`forbidden-terms.json`](./forbidden-terms.json) so a phone-offline value cannot enter a fixture unnoticed. This is enforced mechanically, not by convention.

### 2. Monitoring coverage is never a severity

A unit with no installed safety service has no safety condition to classify. It is not `normal`. Nothing is failing to report, so it is not `offline`. Nothing is indeterminate, so it is not `unknown`. Forcing this condition into the severity enumeration makes one of those three wrong.

It is carried instead by a separate required field:

```
monitoringCoverage: full | partial | none
```

**Pairing rule.** When `monitoringCoverage` is `none`, `severity` is `information`, and the client must render the explicit not-monitored copy. `information` is correct because the statement being made — this flat has no PEMO-connected sensors — is factual and non-urgent. But **severity alone is insufficient to render this state**, and a client that reads only `severity` will get it wrong. Read both fields.

The design export mapped this condition to its `info` token. That mapping is adopted here **on its merits, not inherited**; the reasoning is recorded in `ADR-001`.

## Consumer obligations

Carried forward from design system §3.1, verbatim where quoted, and binding on both downstream PIDs:

- Show `Normal` only when data is current, valid and explicitly classified as normal.
- Offline, stale, invalid or missing data must never appear green.
- Use critical red only for critical safety or destructive confirmation.
- A critical event must show icon, label, event time, affected location and action instruction.
- Resident UI must show a plain-language event projection, not a raw `2IoThub` payload.
- Fire and life-safety messages must state that PEMO notification supplements rather than replaces statutory alarms and procedures.
- Corrections, updates and all-clear messages must remain linked to the original event.

And two obligations this contract adds:

- **Never encode severity by colour alone.** Every rendering carries icon, visible text label and plain-language meaning. Design system §15 and §8.2.
- **Clients must not derive, infer, recompute or override a severity value.** Severity is assigned server-side and rendered client-side. A client that computes its own severity from underlying fields has forked the classification rules.

## Acknowledgement is not alarm acknowledgement

The one write path in the resident-mobile contract is resident acknowledgement. It records that **a resident has seen a notification**. It is a PEMO communication record.

It is **not** an alarm acknowledgement. Alarm detection, acknowledgement, suppression, clearing, reclassification, lifecycle and technical escalation belong to `2IoThub`, and PEMO must never perform any of them. This holds regardless of the shape of the contract between the two systems: the boundary is about responsibility, not payload.

The two share a word and nothing else. They are named separately here because a downstream reader conflating them would be a realistic and serious error.

## Open question, recorded not answered

**Which side classifies?** This document fixes the severity *vocabulary* — seven values, their labels, colours and display rules. It does **not** fix who assigns a value from that vocabulary.

`2IoThub` is a Go API gateway that adapts to the contract PEMO defines, so it can carry any field PEMO asks for. But it cannot create information that does not exist upstream. If this contract declares `severity: critical`, something must actually have classified it; if it declares an affected Unit, something must have mapped a panel zone or device to that Unit.

**Which side performs the mapping (device-or-zone → PEMO property location) and which side performs the classification (raw signal → resident-readable severity) is undecided.** `API-005-ST` does not settle it and has not assumed either answer. It deserves its own ADR; see `ADR-001` §Open questions.

Freezing the vocabulary without settling the classifier is deliberate and is what lets `GEN-006-ST` and `UI-007-ST` proceed concurrently while the boundary question stays open.
