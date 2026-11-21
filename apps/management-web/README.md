# PEMO Management Web

Five staff surfaces — Home Safety, Overview, Properties, Cases, Notices — rendered from the
committed fixture corpus by default. A live client exists for the scope tree, the property tree
and, since `UI-051`, the notices reads and the notices acts; it is switched on by `?source=live`
and off otherwise (see `src/data/live-config.ts`). Notices is the one surface with a WRITE flow:
compose and the seven transitions, each rendered only when the server's `permittedActions` lists
its operationId (`GEN-047`, contract `2.1.0`).

Built under `UI-019-ST`. Contract: `packages/api-contracts/management-web`, which is read-only here.

## Environment requirements

These are requirements, not observations. A host missing either produces a suite that is **green
and meaningless** rather than one that fails.

### 1. Node 20+ and pnpm

Installed from the workspace root: `pnpm install`.

### 2. A Traditional Chinese font — REQUIRED

```bash
sudo apt install -y fonts-noto-cjk      # Debian/Ubuntu
```

**Why this is declared rather than assumed.** This surface renders Traditional Chinese in dense
table cells, where truncation and line-breaking behave differently from Latin text. On a host with
no CJK font every Chinese character renders as tofu — an empty box — and **tofu has a perfectly
reasonable advance width**, so a width-based "the Chinese fits its cell" assertion passes. The
absence of a font looks exactly like success.

That is `UI-019-ST` finding `F3`, and it sits in a stack where every layer looks the same from
above:

```text
no test  ->  no assertion  ->  no layout engine  ->  no font  ->  no glyph
```

Choosing a real browser over jsdom buys one layer of that stack. It does not buy the rest.

**Check any host before trusting its typography results:**

```bash
pnpm --filter @pemo/management-web run check:fonts
```

It derives every CJK codepoint the corpus and the client copy can render, measures each against
`U+E000` — a Private Use Area codepoint no font provides, so its width *is* the width of "missing"
— and fails if any character matches. Measured on the development host `amd128`:

| | CJK codepoints | Rendered as tofu | Verdict |
|---|---:|---:|---|
| Before `fonts-noto-cjk` | 470 | **470** | not capable |
| After | 470 | **0** | capable |

The same check runs first in the Playwright suite and blocks every other browser project, so a CI
host without the font stops rather than measuring boxes.

### 3. A Playwright browser

```bash
pnpm --filter @pemo/management-web exec playwright install chromium
```

Check `~/.cache/ms-playwright` first — if the revision Playwright wants is already there, nothing
needs downloading.

## Commands

| Command | What it does |
|---|---|
| `pnpm run generate` | Regenerates design tokens from `severity.json`, the Wing Fu Garden property tree from the seed-15 basis, and the corpus module from the fixtures. Committed output; a stale copy fails the suite. Do not hand-edit `mob-s3-properties/tree.json`. |
| `pnpm run digest` | Re-records `corpus-digest.json`. Run deliberately, after reading what changed in the corpus. |
| `pnpm run check:fonts` | The host-capability check above. |
| `pnpm run typecheck` | `tsc --noEmit`. |
| `pnpm run test:node` | Guards, tokens, boundary scan, dependency policy. |
| `pnpm run test:browser` | State matrix and layout, in Chromium. |
| `pnpm run test` | Both suites. |
| `pnpm run build` | Generate, then Vite production build. |
| `pnpm run dev` | Generate, then Vite dev server. |

## How to reach a state

Every state is reachable by URL, which is what makes the state matrix cheap to test: a state is
**constructed, never driven to** by clicking.

```text
/?screen=s1&state=default&lang=zh-Hant
/?screen=s5compose&state=blank&node=building:blk_wfg_a     # the compose form, entered at a node
/?screen=s5act&state=withdraw&notice=ntc_0814_water        # a transition's confirm step
/?screen=s5act&state=stale-version                          # a recorded refusal
```

The staff shell has two left rails. The main nav chevron sits on the brand/title row
(ParkCore pattern: expanded it shares the product title line; collapsed it sits under
the mark) and collapses the menu to icons-only. The properties tree still has a top
chevron and collapses to a thin strip. Open/closed persists
on the URL (`nav=collapsed`, `scopeRail=collapsed`; absent means open). The properties rail
mounts only on place-scoped screens (Properties, Overview, Households, Residents, Visitors,
Help desk, Notices, Home Safety, Cases, Facility booking, and the Car Park
ParkCore connector). On settings / other Coming
Soon stubs it is absent and the canvas takes the column; `at=` is kept so the tree returns
with the prior pick. Clicking a tree node writes `at=kind:id` and filters screens that already
carry a location (Overview keeps grant-level figures and states that). The tree lists Wing Fu
Garden Blocks A, B, C in `sequence` order; expanding a block shows residential floors (Hong
Kong omit-rule) and expanding a floor shows flats. Magnitudes are the seed-15 fixture world
(812 residential), not Charming Garden public stats. ⌘K / search jump is out of scope.

`src/data/states.ts` is the registry both the UI and the tests read. It carries four kinds, and the
last two are the point:

- `fixture` — a committed fixture renders it
- `problem` — a committed `Problem` fixture renders it
- `client-only` — no server response exists; the corpus manifest declares it with a reason
- `no-fixture` — **the contract describes it and the corpus has no example.** Rendered as an
  explicit absence. Nothing is invented to fill it.

## Rules this app is built to

- **Fixtures only.** No invented data. A screen needing data no fixture provides is a contract
  finding, and is worth more reported than worked around.
- **A control renders iff the server permits it.** Since `2.1.0` every notice and every scope node
  carries `permittedActions`, the server's own list of act operationIds for this caller now. The
  client renders those and reasons about nothing — not a role, not a lifecycle state. The one
  file that draws an act control is `src/screens/NoticeActions.tsx`; a guard asserts that, and the
  state matrix checks every rendered state against the fixture's list. Writes the server has not
  listed for the caller are ABSENT, not disabled (`GEN-047` A4). The remaining deferred write
  (revoking a resident-granted safety permission, S3) still renders as a named absence.
- **Design tokens are never transcribed.** Severity comes from `severity.json`; the rest comes from
  `tokens/palette.json`, which is data and is parity-checked in both directions against
  `apps/resident-mobile/lib/theme/pemo_colors.dart`. No hex literal appears in hand-written source.
- **No runtime analytics, crash reporting or attribution SDK.** The runtime shipped to a browser is
  `react`, `react-dom` and `scheduler` — three packages, and that is the complete list.
- **The name is `2IoThub`.** The design export's `IoT2Hub` is retired.
- **Seven severity levels.** The export defines six and has no `offline`.

## Strata invoice PDF + scheduled email (fixture)

Charges carry `scheduledSendAt` (ISO) and `invoiceSentAt`. The job
`processDueInvoiceSends` (also the staff **Run due invoice sends** control) renders
the generic PDF in `src/finance/invoice-template.ts`, writes an **Email outbox**
row, and stamps `invoiceSentAt`. Swap that one template file when the layout is
designed. The schedule gate uses the fixture clock `2026-09-19T12:00:00+08:00`,
not the browser wall clock. `:3200` is not on this path — finance stays a page
fixture under the v0 freeze.

**To** is `household.contactEmail` (fixture field; DB `resident.household.contact_email`
in migration 0142). **From / SMTP** come from Administration → Email when saved
in this session, then `SMTP_*` env.

**SMTP is off in the SPA.** Outbox-only is the product path. Gmail MCP is never
required. Live secrets should move to server env — do not keep the SMTP
password in the browser. To try a real send later, run a Node job that imports
`processDueInvoiceSends` and set:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=…
SMTP_PASS=…
SMTP_FROM=invoices@estate.example
```

(`SMTP_URL=smtp://user:pass@host:port` is an alternative.)
`src/finance/invoice-mail.ts` is the seam. Administration → Email
(`?screen=adminEmail`) is the fixture form (Save + Send test email).

