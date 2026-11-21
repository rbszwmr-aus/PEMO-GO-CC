# Readout — is the seeded world demo-ready? (UI / consumer side)

| | |
|---|---|
| From | `origin/main` at `799e821` (GEN-059 closed). Contract management-web 2.2.0 |
| Kind | Read-only readout. No PID, no build, no fixture or contract change. Carried as D0 of my next PID. |
| Basis | The database seed (`database/seeds/**`), the fixture corpus (`tests/fixtures/management-web/**`), and my own UI-054 live exercise against the seeded `pemo-dev-db` through the live API and `dev-token`. |
| Written | 2026-09-04 |

**Headline, up front (this is item 5, and it is the finding):** the fixture corpus my
screens are proven against and the database seed a live demo runs against are **two
different worlds that merely resemble each other.** Same story, different rows, different
ids, and nothing checks that they agree.

---

## 5 (stated first, because it frames the rest) — one world or two?

**Two worlds.** Concretely, the notices:

| | fixture corpus (what my screens render by default) | database seed (what a live demo shows) |
|---|---|---|
| ids | `ntc_0814_water`, `ntc_0810_lift`, `ntc_0820_bbq`, `ntc_state_draft…withdrawn` | `ntc_seed_lift`, `ntc_2026_0814_water`, `ntc_2026_0805_typhoon`, `ntc_long` |
| how made | hand-authored (`mob-s5-notices/*`) and recorded from HTTP (`notices/*`) | seeded rows in `60-notices-lift-interruption.sql` |
| states | all seven lifecycle states, one each | `draft_saved` and `publication_released` only |

They rhyme — both have a "14 August water interruption" and a lift notice — but they are
not the same rows. My browser suite (385 assertions) proves the screens against the
**fixtures**; a demo runs against the **seed**; **no test renders a screen against the
seed**, so nothing catches the day the two drift. My UI-054 D4 live exercise is the only
thing that has ever put a screen's client against the running server, and it did so by
**composing its own notices** — in that run each principal saw only the four notices the
exercise had just created, not the seed's notices at all.

There is a second, sharper form of the split inside the notices fixtures themselves: the
notices scenario (`scenarios/management__notices__lifecycle.sql`) seeds **one audience
resident and zero notices** — the `notices/*` fixtures are *recorded* by a script that
composes/submits/approves/publishes transiently. So even the recorded fixtures cannot be
reproduced by `bootstrap.sh --with-seed` alone; they need the recorder run.

Everything below reads against that fact.

---

## 1 — Walk the demo (what the seeded world actually shows)

Fixture mode (the guide's default) shows the rich hand-authored world; **live mode
against the seed** shows the following. A demo will run one or the other; they differ.

- **Scope sidebar (`getScope`, live).** The strongest surface. The seed has a real cast:
  an estate manager (Chan Mei-ling, whole of Wing Fu Garden), a Block-A supervisor (Lau
  Chi-wai), counter staff at the clubhouse (Ng Siu-fong), a portfolio-level principal
  (Poon Wai-lam), a **dual-role** principal who is staff *and* approver at Block A (Ng
  Ka-ho), an ended grant (Tsang Ho-yin), and a cross-org principal at Harbour View (Yeung
  Ka-wai). A viewer switching `dev-token` between these sees genuinely different scope
  trees. **This is the one part that demos itself.**
- **Property tree (`getPropertyTree`, live).** One estate, **3 blocks (A, B, C)**, floors
  under Block A (ground floor + ~5 upper), and **9 residential units total.** Plausible as
  a *small* building, not as an estate. Note the mismatch a sharp viewer will catch: the
  estate summary reads **"3 blocks · 812 units"** (`15-property-…-magnitude.sql`) while the
  tree expands to **9**. The headline claims a tower; the tree shows a corridor.
- **Notices list + detail (live).** The seed carries a **small number of notices
  (≈1–4), headlined by `ntc_seed_lift`**, in `draft` or `published` only. A viewer sees a
  short list and one or two readable notices — no seven-state spread, and (see item 2) no
  notice awaiting approval. In *fixture* mode the same screen shows the full seven states;
  a demo that flips from fixture to live loses six of them.
- **Notices write flow (live).** Fully works end to end — my D4 exercise composed,
  submitted, had the dual-role principal approve, published, corrected, withdrew, and got
  every refusal (approval-required, out-of-scope, stale-version, wrong-state,
  incomplete-translation, schedule-inverted, retargeting-forbidden) from the real server.
  **This is demo-ready — but only if the presenter creates the notices live**, because the
  seed has none in the interesting states.
- **Outstanding acknowledgements (live).** The notices scenario seeds exactly **one**
  audience resident in Block A so the list is not empty. A published seed notice's
  outstanding list therefore shows **one or a few recipients** — enough to prove the
  screen renders, not enough to look like an estate telling hundreds of households.

---

## 2 — What is missing to tell the story (nouns, not adjectives)

- **A notice in `pending_approval`** — the seed has none; the approver role (Ng Ka-ho) has
  nothing to approve. The single most important missing row, because the gated-approval
  flow is the reason the approver exists.
- **A notice `scheduled` for the future**, and one `withdrawn` — the seed has draft and
  published only; four of the seven lifecycle states have no seeded instance.
- **More than 9 units**, and **more than one building with floors** — Blocks B and C exist
  as nodes but the unit rows and residents cluster in Block A.
- **A resident occupying more than one unit** (an owner/landlord) — every seeded household
  sits in a single unit; there is no "this person appears across three flats" story.
- **A household with several members in one unit** shown as such (one unit,
  `unit_wfg_a_12_a1`, has four memberships — usable, but not surfaced in a demo path).
- **Case / ticket data** — one `open` case is seeded (`70-cases`); the Cases screen is a
  fixture-only list today, so behind it a demo has a single row, not a queue.
- **Notices with real Chinese bodies** (see item 3).
- **A notice whose audience is more than one resident** — the seed's audience resolver
  reaches the single fixture resident, so every acknowledgement list is length ~1.

---

## 3 — Bilingual: real, or English with a zh-Hant label?

**Mostly English with Chinese decoration.** Concretely:

- **Fixture notices list and lifecycle:** every `titleZhHant` is the literal string
  **`（未翻譯）`** — "(untranslated)". A demo showing the notices list in Chinese shows
  "（未翻譯）" down the whole column. Only the single **detail** fixture carries a real
  Chinese title (`8月14日計劃性停水`) and body.
- **Seed notices:** CJK appears on only ~4 lines across the whole notices seed — titles
  carry some Chinese; bodies are largely English.
- **Residents:** display names are bilingual by construction (`Ho Mei-yi 何美儀`), but
  **every seeded `preferred_language` is `en`** — no resident prefers Chinese, so no
  notification-language or content-language contrast can be shown.
- **Estate contacts:** genuinely bilingual (Chinese present on 9 lines).

So: a Hong Kong demo audience toggling to 繁體中文 sees the *chrome* translate (labels,
states, buttons — those are real, from `messages.ts`) while the **content** stays English
or shows "（未翻譯）". That is a different product from the bilingual one being built.

---

## 4 — What a demo seed should create (data, not API calls; small enough to maintain)

The shape of a convincing single estate — additive to what exists, kept deliberately small:

- **One estate, two blocks with real depth:** Block A (already there) plus Block B fleshed
  out — say **2 blocks × 3 floors × 4 units = 24 units**, not 9, and drop the "812" summary
  to match, or make it honest.
- **Residents with real Chinese:** ~8 households, **half with `preferred_language`
  `zh-Hant`**, a couple of names Chinese-only. Include **one owner across two units** and
  **one unit with three members**.
- **Six notices spanning the lifecycle, fully bilingual (title AND body in both
  languages):** one `draft`, one `pending_approval` (a `planned_interruption`, so the
  approver has work), one `scheduled`, two `live` (one `planned_interruption` with
  mandatory-ack, one `event_community`), one `withdrawn`. Each targeting a real node so the
  audience resolves to **several** residents, not one.
- **One published notice with an acknowledgement list of ~10 recipients**, a few
  acknowledged and most not — so the outstanding screen looks like work.
- **Three cases** in different states behind the Cases screen.

That is roughly **2 blocks, ~24 units, ~8 households, 6 notices, 3 cases** — one screenful
each, maintainable by hand, and enough that every screen shows a plausible estate rather
than a corridor.

---

## The one thing to fix first

Make the **seed and the fixture corpus the same world**, or make one derive from the
other and assert it. Today the screens are green against fixtures that do not exist in the
database, and the database holds notices no screen is ever tested against. Until they are
one world — or a test renders a screen against the seed — "the suite is green" and "the
demo works" are two separate claims, and only the first is checked.

*End of readout. No file outside this one. HARD STOP.*
