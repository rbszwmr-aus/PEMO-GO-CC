# Readout — the 21-Aug design mockup vs what is built

| | |
|---|---|
| From | `origin/main` at `799e821`. Contract management-web 2.2.0 |
| Kind | Read-only readout. No build, no PID, no branch. Carryable as D0 of my next PID. |
| Sources I read | The **canvas source** `PEMO Management Web.dc.html` (214 KB — legible; I did **not** open the 6.5 MB standalone), the `PEMO Administration Screen Specification.md`, the `PEMO Navigation Addendum — Patrol Entry.md`, `PEMO_UI_Design_System_v2.0.md`, and the built app (`apps/management-web/**`) + its `DIVERGENCES.md` register. |
| Written | 2026-09-05 |

---

## 1. Which is authoritative? — the mockup, on visuals; and the design system is DERIVED from it

**Answered from the artifacts, not memory.** They are **not** two independent artifacts. `PEMO_UI_Design_System_v2.0.md`'s own change log (2026-08-13) states it verbatim:

> **"The design export is the design authority."** The Product Owner ruled … that `PEMO Mobile UI (standalone).html` and `PEMO Management Web (standalone).html` are the artefacts that were seen, reviewed and accepted, and that **where the design system and the export disagree on visual matters, the export wins.** v1/v1.1 … had **zero** token overlap with the export. This version adopts the export's language.

And the tokens are shared, verbatim — I confirmed the mockup's own values:

| token | mockup (`.dc.html`) | app (`palette.g.css` / `severity`) |
|---|---|---|
| brand primary | `#5B4BC4` (87×), deep `#42349B` | `#5B4BC4`, `#42349B` |
| brand accent | `#F59A08` | `#F59A08` |
| page-title accent | `#E17401` (25×) | (design-system §169 role) |
| neutrals | `#6E7480`, `#5B6172` | same |
| Latin face | Libre Franklin (503×) | Libre Franklin |

**So the ruling is: the mockup wins on VISUAL matters, and a visual difference is drift — with three documented exceptions where the design system deliberately corrects the export** and the code follows the correction, not the picture: seven severity levels not the export's six (§3), `neutral.500` contrast on the page ground (§15.2), and Libre Franklin over the export's face (§4). **The design system explicitly does NOT reverse structural or safety decisions** ("It does not reverse structural decisions taken on safety grounds"), so a *structural* divergence may be a deliberate ADR decision rather than drift — those are the PO's to keep or overturn, not automatic wins for the mockup.

One consequence worth stating plainly: **because the tokens are shared, the "quite different" look the PO reports is almost entirely STRUCTURAL and MISSING, not VISUAL.** The palette, type and accent already match. What differs is the shell's shape and the surfaces that do not exist.

The UI track has been maintaining exactly this comparison as `apps/management-web/DIVERGENCES.md` (the `B`-series + structural `S`-series). This readout re-casts that register into the V/S/M cost frame and adds the surfaces the mockup shows that the product has no screen for.

---

## 2. Screen by screen — V / S / M with costs

Cost terms: **components touched · assertions expected to move · contract needed?**

### Shell / navigation (every screen)

| # | Item | Class | Cost |
|---|---|---|---|
| B1 | Mockup nav is **five labelled groups** (`OPERATE`, `SAFETY AND SECURITY`, `BUILDING SYSTEMS`, `AMENITIES`, `COMMUNICATE`); product is a **flat 5-item list** | **S** | `Shell.tsx` nav region + `NAV` model; the state-matrix nav assertions and "flat nav" test move; no contract. The Navigation Addendum §2.1 records the design system §7.1 itself says *flat ten-item* — so here the **mockup and the design system disagree**, and per the export-wins rule the mockup's grouped nav is authoritative. |
| B2 | Nav **badges** (Cases 14, Home Safety 3, Help desk 5, Visitor 6, Smart IoT 2, Clubhouse 9) | **S + M** | Structural in the shell, but most badges count data from **surfaces that don't exist** (§ below) and Home Safety's `3` has **no contract source** (S4). A badge needs a count endpoint per surface — contract work, Main CC. The Nav Addendum §3.3 also flags these badges encode **by colour alone** — see §3, they must not be reproduced as drawn. |
| B4 | Product mark: mockup two lines `PEMO`/`MANAGEMENT`, product one line | **V** | one component, one string; no assertions of substance. |
| B5 | Scope selector: mockup shows `SCOPE` label + estate name bilingual + `3 blocks · 812 units ▾` summary; product is a plain combo box | **V** | `Shell.tsx` scope block; `ScopeTreeNode.summary` **already in the contract**, simply not rendered. Cosmetic; no contract. |
| B3, B6 | Sidebar-collapse `‹`; breadcrumb band | **S (minor)** | new chrome components; breadcrumb derivable client-side, no data; collapse state was never designed even in the mockup. |
| B7 | User identity block: avatar `CM`, `Chan Mei-ling`, role `Estate manager`, `▾` | **S + M** | The **role label has no contract source** (S2; `ADR-007` A4 — the contract has no current-user/role read). The name/avatar need a "who am I" read that does not exist. Contract work, Main CC. Deliberately absent today. |
| B8 | Integration chips (`IoT2Hub`, `CMMS`) in the header on **every** screen | **S + M** | `integrationHealth` is **only** in `OverviewResponse` (S1); showing it everywhere means caching Overview's response onto screens that never requested it, or a feed-health read. Contract work. Product renders it on S2 only. |

### Overview (S2)

| Item | Class | Cost |
|---|---|---|
| Role/identity header (as B7) | S/M | as above. |
| B11 — "figures refresh every 60 seconds" cadence + refresh affordance | **S** | a refresh control + stale marker; no contract, but a freshness model the product deliberately omits. |
| `IoT2Hub` spelling (mockup, 27×) | **V** | the mockup uses the **retired** spelling; product renders `2IoThub` (ruled, `ADR-007` D7). Mockup is stale; product correct — the picture updates, not the code. |
| Integration chips per-screen (B8) | S/M | as above. |

### Home Safety (S1)

| Item | Class | Cost |
|---|---|---|
| B9 — five-filter row (`All events`/`Needs action`/`In-unit`/`Building`/`Unmapped`) | **S** | a filter region; **no fixture exercises a filtered result** — client-side filtering is the same boundary problem the notices list already states. Fixtures/Main CC before it can be proven. |
| B10 — event detail as **three tabs** (`Resident view`/`Delivery & timeline`/`Source & mapping`); product uses three URL states | **S** | same three projections, different navigation model; `S1HomeSafety` detail region; the state-matrix discriminators for s1 detail/delivery/source move; no contract. |
| B14 — search box | **S** | absent; no fixture provides a search result; same boundary issue as B9. |
| B16 — `SafetyEventRow.source` chip | **V/M** | contract field exists, rendered nowhere; copy was deleted as dead. Cheap to add if wanted. |

### Properties (S3)

Closest match to the mockup already. The tree is the node picker; the compose entry (UI-054) is a product-era addition the 21-Aug mockup does not show. **S3 third language (`简` / zh-Hans)** is the S3 structural finding — a product decision (`ADR-007` A6 open), not drawn as a live language. **V/S**: minor.

### Cases (S4)

Product is a **list only**; the mockup implies a fuller cases surface with the `14` badge and (per the mockup nav) a **Help desk** sibling. **M** for anything beyond the list — no case-detail operation in the contract; Main CC first.

### Notices (S5) — see §3, this is where the temporal drift concentrates

The mockup draws a notice composer and action buttons as **fixed UI**; the product renders them from `permittedActions`. Detailed in §3.

### Severity rendering (all)

B13 — the mockup names real icons (`check-circle`, `warning-triangle`, `emergency-octagon`, …); the product uses **text glyphs** (`✓ i ! ▲ ◆ ⊘ ?`) to avoid an icon dependency for seven shapes. **V** — one component (`SeverityChip`), the icon set; labels and the strong/surface/border token sets are already correct, so assertions largely survive. Adopting the real icons is a pure-visual swap.

### Surfaces the mockup shows that the product has NO screen for — **M (scope, not styling)**

From the mockup nav groups, the Administration spec, and the Patrol addendum:

| Surface | Class | Cost |
|---|---|---|
| **Visitor management** (`Visitors`, badge 6) | **M** | whole surface; no contract. Main CC first. |
| **Access control** | **M** | whole surface; no contract. |
| **Smart IoT** (badge 2) | **M** | whole surface; no contract. |
| **Bookings** (prominent in the canvas, ~20 refs) / **Clubhouse** (badge 9) / **Help desk** (badge 5) | **M** | amenities/helpdesk surfaces; no management-web contract for them today. |
| **Administration** — the 5 grant-admin screens (scope-tree navigator, functions-within-a-node, groups & membership, effective rights, audit log) | **M** | the entire grant-admin surface. This is exactly my earlier grant-admin readout's subject: the reads it needs (`revokeGrant`/`removeMembership` take ids no GET returns; grants-by-node; membership view; effective-administrators-per-node) are a **Main CC backend PID queued behind the contract**. Nothing to build UI-side until that contract exists. |
| **Patrol** (Navigation Addendum) | **M** | a planning surface + task states; no contract. |

---

## 3. Where the mockup predates the product — the picture is stale, the code is not

The mockup is **21 August**. The product moved after it, and in several places the mockup draws what the product must **no longer** do (or does not yet do). Per the PO's rule: we follow the rule, not the picture, and the picture gets updated.

1. **The affordance rule (`permittedActions`) — the biggest one.** The mockup draws notice action controls as **fixed buttons**: I counted `publish` (31), `schedule` (14), `approve` (13), `reject` (6), `withdraw` (3), `decline` (3), plus `send for approval`, `save draft`. Under the current rule a control exists **iff the server lists the act** in `permittedActions`. So every one of those buttons in the mockup is drawn unconditionally where the product renders it only when permitted. A mockup screen showing Approve + Publish + Withdraw all at once on one notice is a state the product will **never** render — the server lists at most the acts legal from that state for that caller. **The mockup must be re-drawn to show the affordance rule; the code is correct.**

2. **`schedule` is not a verb — the mockup draws a button that must not exist.** 14 `schedule` references. There is no `scheduleNotice` act; "scheduled" is the lifecycle state reached by a **future `publishAt`** set on compose/revise. The mockup's Schedule control has no counterpart in the product and should not gain one. (Same for **`reject`** — the contract's act is `declineNotice`; the mockup's "reject" label is the old word.)

3. **The seven-state lifecycle vocabulary.** The mockup mixes new and old labels: it uses `live`, `scheduled`, `expired`, `withdrawn`, `draft` (current) **but also `awaiting approval` (5×) and `published` (9×)** — the pre-`ADR-019`/`GEN-043` spellings. The contract's computed `lifecycleState` is `draft · pending_approval · approved · scheduled · live · expired · withdrawn`, and the product renders those labels ("Pending approval", "Live"). **V** on the labels, but the contract vocabulary is authoritative (the enums are deliberately disjoint), so the mockup's "awaiting approval"/"published" get updated, not the product's copy.

4. **The Overview identity/role and integration story** (the S1/S2 structural findings, and my Overview readout): the mockup's `Estate manager` role label and its every-screen `IoT2Hub`/`CMMS` chips assume reads the contract does not carry. The product's absence is deliberate, not drift.

5. **Nav badges encode by colour alone.** The Navigation Addendum §3.3 records that the mockup's red `Home Safety 3` / amber `Smart IoT 2` badges distinguish meaning **by colour only**, which the design system §3.1 forbids and whose contrast against the brand-violet ground the palette cannot meet. If badges are adopted, they must carry icon/label too — the product must **not** reproduce the mockup's colour-only badges as drawn.

---

## Summary for the choice on the table

- **Authority:** the mockup wins on visuals (design system derived from it, tokens shared), except the three documented corrections; structural/safety divergences are the PO's to rule, not automatic.
- **Visual (cheap):** two-line mark, scope-summary line, real severity icons, `IoT2Hub`→`2IoThub` (already correct), notice-state labels. Tokens already match — little visual drift exists.
- **Structural (rebuilds regions, moves assertions):** grouped nav, badges, breadcrumb, sidebar collapse, S1 filter row, S1 detail-as-tabs, refresh cadence. Mostly `Shell.tsx` + one screen each; assertions move but no contract.
- **Missing (scope, Main CC first):** Visitor management, Access control, Smart IoT, Bookings/Clubhouse/Help desk, the 5 Administration screens, Patrol; plus the per-screen role/identity and integration-health reads the shell chrome assumes.
- **Temporal:** the mockup predates the affordance rule and the seven-state lifecycle; it draws buttons (Schedule, and unconditional Approve/Publish/Withdraw) the product must not render. Update the picture, not the code.

I have started aligning nothing. **HARD STOP.**
