# Guide: try the management web UI on your own machine

| | |
|---|---|
| Written | 2026-09-03, UI track; §2 updated under UI-054 when GEN-050's dev-token landed |
| Against | `main` at `75d92fe` (contract management-web 2.0.0) |
| Kind | Hands-on guide for the Product Owner. Report, not a PID. No code was changed. |
| Assumes | Windows, Node installed, the repository cloned |
| Status | Untracked. Carried as D0 of UI part 2 with the other readouts. |

Everything below was checked against the files on `main`. Where something cannot be
done outside a developer's worktree, section 5 says so and gives the smallest fix as a
proposal. Nothing in this guide touches a production system, and no credential appears
in it.

---

## 1. Fixture mode: the app on its own, no API, no database

"Fixture mode" means the app renders the frozen example responses kept in
`tests/fixtures/management-web/`. Nothing is fetched. This is the default, and it is
what every automated test runs against.

### 1.1 Check your Node version first

Open a terminal (PowerShell is fine) and run:

```powershell
node --version
```

You need **Node 22.6 or newer**. The repository's `package.json` says "20 or newer", but
the app's `dev` script uses a Node flag (`--experimental-strip-types`) that older Node
does not have. If you see `v20.x` or `v22.0`–`v22.5`, stop here and read section 5,
item A.

### 1.2 Install once, from the repository root

The project uses `pnpm` as its package manager. It is bundled with Node through
`corepack`. From the folder you cloned into:

```powershell
corepack enable
pnpm install
```

This installs the whole workspace. It does not need Docker, a database, or a browser
download. (The browser download is only for the automated tests, which you are not
running.)

### 1.3 Start the app

```powershell
pnpm --filter @pemo/management-web run dev
```

The first line this prints comes from a step that regenerates two committed files from
the fixtures; that is expected. Then Vite starts and prints an address, normally:

```text
  ➜  Local:   http://localhost:5173/
```

Open that address in your browser. You will see the Overview screen in English.

If the page is blank or shows a red error, the corpus guard has refused to start: it
means the fixture files and the generated copy disagree. That should not happen on a
clean checkout of `75d92fe`. If it does, it is a finding for me, not something to work
around.

### 1.4 The development toolbar

Because you started the app with `run dev`, a small toolbar appears with two dropdowns:
**screen** and **state**. Choosing from them is the same as editing the URL. This
toolbar is removed from the production build entirely (not hidden, removed), so it is
safe to lean on it here.

### 1.5 How "URL = state" works

The app has no login, no menu memory and no saved settings. **The whole state of the
page is in the address bar.** Change the address and the page changes. Bookmark an
address and you get exactly that page back. Nothing is stored in the browser.

The address has these parts, in any order, after the `?`:

| Part | Values | Default if missing |
|---|---|---|
| `screen` | `s1` Home Safety, `s2` Overview, `s3` Properties, `s4` Cases, `s5` Notices list, `s5detail` one notice, `s5ack` outstanding acknowledgements | `s2` |
| `state` | which example the screen renders (lists below) | the first one for that screen |
| `lang` | `en` or `zh-Hant` | `en` |
| `scope` | `default` or `portfolio-grant` (which "you" are, in the left sidebar) | `default` |
| `notice` | a notice id, shown in the address when you open a notice from the list | none |

Example, in full:

```text
http://localhost:5173/?screen=s5&state=lifecycle&lang=zh-Hant
```

**Locale.** Add `&lang=zh-Hant` for Traditional Chinese, `&lang=en` for English. The
header also has three language buttons: **ENG** and **繁** work; **简** (Simplified)
is visible but does nothing, on purpose, because whether Simplified Chinese is an
interface language is an open product question. Clicking it does not change the
address.

**Which notice.** The list carries a `notice=` id into the address when you click a
row. Today there is exactly one notice detail example in the fixtures, so every id
shows the same detail. That is a fixture gap, already reported (UI-045 findings).

### 1.6 The states you can reach, screen by screen

Every screen has its own examples plus six shared ones. The shared six are the same on
every screen:

| `state=` | What you see |
|---|---|
| `loading` | the loading placeholder, forever (there is nothing to load) |
| `offline` | the "could not reach the server" panel |
| `error` | an internal-error problem panel |
| `session-expired` | the session-expired problem panel |
| `invalid-credential` | the invalid-credential problem panel |
| `denied` | the insufficient-scope problem panel |

Per screen:

**Overview** (`screen=s2`): `default`, `empty-attention`, `integration-down`.

**Home Safety** (`screen=s1`): `default`, `empty`, `partial`, `detail`, `delivery`,
`source`, `source-unmapped`, `resolved`, `restricted`, `scope-not-found`, `not-found`,
`communication-coverage`, `zero-recipients`.

**Properties** (`screen=s3`): `tree`, `unit`, `unmapped-unit`, `scope-not-found`,
`not-found`.

**Cases** (`screen=s4`): `default`, `empty`, `case-detail`, `scope-not-found`.

**Notices list** (`screen=s5`):

| `state=` | What you see |
|---|---|
| `list` | three notices: one live, one draft, one expired |
| `lifecycle` | one notice in each stage: draft, pending approval, approved, scheduled, live, expired, withdrawn |
| `empty` | **not a blank list.** A panel explaining that the fixtures contain no empty list and the app will not invent one |

**One notice** (`screen=s5detail`):

| `state=` | What you see |
|---|---|
| `detail` | the live water-interruption notice, both languages, history, targets |
| `draft-preview` | a panel explaining no draft detail fixture exists |
| `empty` | a panel explaining a detail read has no "empty" |
| `not-found` | the record-not-found problem panel |

**Outstanding acknowledgements** (`screen=s5ack`): `outstanding`, `empty` (both are
explained-absence panels: the contract has the operation, the fixture corpus has no
example), `not-found`.

So the four states you asked about map like this: **loading** is `state=loading`,
**empty** is the screen's `empty` (a real empty list on s1 and s4; an explained absence
on s5), **error** is `state=error` or any of the problem states, and **ready** is any
fixture state such as `default`, `tree`, `list` or `detail`.

---

## 2. Live mode: the app talking to a real local API

### 2.1 Is it genuinely runnable by hand today?

**Yes, since GEN-050 landed** (2026-09-03). The API, the database and the seeded
world come up locally with the commands below, and one command prints a staff token
for any seeded principal:

```powershell
pnpm -C apps/api dev-token stf_wfg_manager
```

It refuses to run unless your `.env` says `PEMO_ENV=development`, and it refuses an
id that is not a seeded principal, without suggesting one. Put the printed string in
the address as `token=` (section 2.3).

What live mode covers on `main` today: the scope sidebar, the property tree, and the
whole notices surface — list, detail, outstanding acknowledgements, and the write
flow (compose and the seven transitions, each rendered only when the server lists it
for you). Cases, overview and home safety keep rendering fixtures with the live
switch on. That is by design at this point on `main`.

### 2.2 What must be up

Three things, in this order:

1. **Docker Desktop**, for the local Postgres container.
2. **A bash shell with `psql`** for the database bootstrap script. On Windows the
   practical options are Git Bash plus the PostgreSQL client tools, or WSL. See
   section 5, item C.
3. **The API**, started from the repository.

Everything is bound to `127.0.0.1` (your own machine only). The database container
publishes on port `55433` so it cannot collide with any other Postgres. The API listens
on port `8080`.

### 2.3 Commands

**Once: create your local environment file.**

```powershell
copy database\dev\.env.example database\dev\.env
```

Open `database\dev\.env` in a text editor and replace every value that says
`replace-with-...` with any word you like. These are local-only passwords for a
container on your own machine. The file is git-ignored; never paste it anywhere. Leave
`PEMO_ENV=development` exactly as it is: the API **refuses to start** with any other
value, because it contains a development-only login stub.

**Start the database.**

```powershell
docker compose -f database/dev/docker-compose.yml up -d
```

**Create roles, run migrations, apply grants, and seed the world** (from Git Bash or
WSL, not PowerShell):

```bash
database/bootstrap.sh --with-seed
```

This is the project's single entrypoint for the database. Do not run `migrate` or
`seed` on their own; the bootstrap script runs them in the right order with the right
role.

**Start the API** (back in PowerShell is fine):

```powershell
pnpm --filter @pemo/api run dev
```

It compiles, then prints `pemo api listening`. Check it in a browser:

```text
http://127.0.0.1:8080/health
http://127.0.0.1:8080/ready
```

`health` says the process is up. `ready` says it can reach the database. You want
both.

**Start the UI pointed at the API.** In a second terminal:

```powershell
$env:PEMO_LIVE_BASE_URL = "http://127.0.0.1:8080"
pnpm --filter @pemo/management-web run dev
```

Setting that variable makes the dev server forward the two live reads to the API, so
the browser address stays `localhost:5173`. Then open:

```text
http://localhost:5173/?screen=s3&state=tree&source=live
```

`source=live` is the switch. With no `token=` in the address you will see the real
invalid-credential problem panel from the server. That is correct behaviour: the app
sends the request without a credential rather than inventing an empty tree.

### 2.4 The development login stub, plainly

- It is **local only**. The API throws on start unless `PEMO_ENV=development`.
- A token is a signed string carrying a principal id and the literal marker `pemo-dev`,
  which no real identity provider would ever produce.
- It expires one hour after it was minted (`PEMO_DEV_TOKEN_TTL_SECONDS` in your `.env`).
- It selects **who you are** by putting the token in the address:
  `...&source=live&token=<the token>`.
- There is no production database anywhere in this setup and no credential anywhere in
  this guide. The identity provider for the real product is still an open decision.

### 2.5 Who you can be — what you can do

These are the staff principals the seed creates. All but one belong to the
demonstration organisation Wing Fu Holdings, whose estate is Wing Fu Garden.

| Principal id | Name | Grant | What the scope sidebar and property tree show |
|---|---|---|---|
| `stf_wfg_manager` | Chan Mei-ling | estate staff at the **whole estate** | **Covering staff.** All of Wing Fu Garden, every block, floor and unit |
| `stf_wfg_block_a` | Lau Chi-wai | estate staff at **Block A** | **Non-covering staff.** Block A only. Block C's plant room must not appear |
| `stf_wfg_dual_role` | Ng Ka-ho | estate staff **and approver** at Block A, through two groups | **Approver.** Same reach as Block A; his second role is what a notices write flow will check |
| `stf_wfg_counter` | Ng Siu-fong | estate staff at the **clubhouse counter** (a location, not a block) | One place with no floors or units under it |
| `stf_wfg_portfolio` | Poon Wai-lam | estate staff at the **portfolio** level | The estates in that portfolio, and not Tsz Wan Court, which is in the same organisation but no portfolio |
| `stf_wfg_former` | Tsang Ho-yin | a grant that **ended** on 1 June 2026 | Nothing today |
| `stf_hbv_manager` | Yeung Ka-wai | estate staff at Harbour View, **another organisation** | Nothing in Wing Fu Garden |

The pair worth comparing first is `stf_wfg_manager` against `stf_wfg_block_a`: same
screen, same address apart from the token, visibly different tree.

---

## 3. What there is to see on `main` today, and what there is not

**There:**

- **The shell.** Left navigation with five entries (Overview, Home Safety, Properties,
  Cases, Notices), the scope sidebar showing "your" grants, the ENG / 繁 / 简 buttons,
  and the development toolbar in dev mode only.
- **Scope and property tree, live-capable.** `GET /scope` and
  `GET /properties/tree` are the two operations wired to the real API. Expand and
  collapse work; the tree respects the caller's grants.
- **Notices list and notice detail** (UI-045). Filter by lifecycle stage and by notice
  type. Open a notice. In the detail, both languages are always shown and a toggle
  chooses which leads; the history chain and the targeting are visible. Keyboard: J and
  K move down and up the list, Enter opens.
- **Overview, Home Safety, Cases**: earlier read screens, fixtures only, unchanged by
  UI-045.

**Not there, and not a defect:**

- **Notices write flow.** No create, submit, approve, schedule, publish, withdraw,
  edit or duplicate control exists. The detail screen lists those eight acts by name
  under the heading "No action can be offered here yet" and draws no button. They arrive with contract 2.1.0
  and UI part 2.
- **Outstanding acknowledgements** shows an explained absence: the contract has the
  operation and the fixture corpus has no example of it.
- **Grant administration.** Nothing on screen. Its contract is queued behind GEN-047.
- **Cases** is a list only. No case detail.
- **The resident app** is a separate application (`apps/resident-mobile`) and is not
  part of this guide.

---

## 4. A ten-minute click path

Fixture mode, from section 1.3. Copy each address into the browser.

**1. Overview, then swap the scope.**

```text
http://localhost:5173/?screen=s2&state=default
http://localhost:5173/?screen=s2&state=default&scope=portfolio-grant
```

Expect the Overview panels, and in the left sidebar the caller's grants. The second
address changes only the sidebar: the caller now holds a portfolio-level grant. Note the
sidebar heading says "Your scope grants" today; the grant-admin ruling R4(a) will
relabel it.

**2. Properties tree, expand and collapse.**

```text
http://localhost:5173/?screen=s3&state=tree
```

Expect the estate at the top, blocks under it, floors and units beneath. Click the
disclosure controls. Then try `state=unmapped-unit`: a unit the tree knows but cannot
place. There is no fixture for it, so you get an explained-absence panel, not an error.

**3. Notices: every lifecycle stage, then one notice in detail.**

```text
http://localhost:5173/?screen=s5&state=lifecycle
```

Expect seven rows, one per stage from draft to withdrawn, newest publish date first,
drafts last. Use the **State** filter to narrow to one stage. Click the live row, or
press J until it is highlighted and press Enter. The address becomes:

```text
http://localhost:5173/?screen=s5detail&state=detail&notice=ntc_state_live
```

Expect the water-interruption notice with English and Chinese both on the page. Press
the language toggle inside the panel: the other language moves to the front. Below,
the history chain and the targeting. At the bottom, "No action can be offered here yet", naming the
eight write acts that do not exist yet. **No button anywhere on this screen does
anything to the notice.** That is the whole point of part 1.

**4. The locale switch.**

Press **繁** in the header, or add `&lang=zh-Hant` to any address. Expect every label,
heading, filter option and explained-absence panel in Traditional Chinese, with dates
in the Hong Kong format. Press **简**: nothing happens and the address does not change.
Press **ENG** to return.

**5. One deliberate error, and one honest gap.**

```text
http://localhost:5173/?screen=s5&state=session-expired
http://localhost:5173/?screen=s5ack&state=outstanding
```

The first shows the session-expired problem panel exactly as the server defines it.
The second is not an error: it is the outstanding-acknowledgements screen telling you,
in both languages, that the frozen fixture corpus has no example to render and that
inventing recipients would fabricate who was told what.

If there is a sixth minute: `state=offline` on any screen, and `state=loading` to see
the placeholder that a slow server would show.

---

## 5. Things that cannot be done outside a developer's worktree, with proposals

None of these are applied. Each is the smallest change I would make.

**A. Node version.** The app's `dev` script needs Node 22.6 or newer, while the
repository declares `"node": ">=20"`. A PO with Node 20 gets a confusing flag error.
*Proposal:* raise `engines.node` in the root `package.json` to `>=22.6` and add a
one-line `.nvmrc` (or `.node-version`) so version managers pick it up. One line, two
files, no code.

**B. No way to mint a staff token by hand.** RESOLVED by GEN-050: `pnpm -C apps/api
dev-token <principal>` (section 2.1). Kept here so the proposal's history is visible.

**C. The database bootstrap is a bash script that needs `psql`.** On Windows this
means Git Bash plus the PostgreSQL client tools, or WSL. *Proposal:* say so in
`database/dev/README.md` under "Run". No script change; PowerShell users just need to
know to open Git Bash for that one step.

**D. The live proxy forwards only two paths.** With `PEMO_LIVE_BASE_URL` set, the
dev server forwards `/scope` and `/properties/tree` and nothing else. This is
deliberate and correct for `main` today. When part 2 wires the notices reads and
writes, the proxy list in `apps/management-web/vite.config.ts` grows with them. No
action now; recorded so nobody is surprised that live notices do not appear in 2.0.0.

**E. Nothing else.** No missing script, no hidden environment variable, no port
conflict for fixture mode. Section 1 works on a clean clone with the right Node.

---

*End of guide. HARD STOP.*
