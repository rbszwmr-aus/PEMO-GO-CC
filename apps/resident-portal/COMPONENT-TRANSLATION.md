# Component translation — MUI (`09` §9.0) → PEMO primitives

**This document replaces the void `09uiuserportal.md` §9.0.** `R2` superseded that section's stack (React 18 + MUI v6 + `react-hook-form` + `zod` + TanStack Query + React Router + `dayjs`) but left the document reading as if MUI were the stack. Until this artifact existed, every reader of `09` was one skim from building the wrong thing.

**The rule (`R2`):** `09`'s *behaviour and acceptance criteria survive; its component names do not.* Each MUI component `09` names maps to a PEMO primitive, or to a **named gap with its cost**. A gap named is a task; a gap unnamed is an archaeology exercise.

**Stack (inherited from `UI-019/022/024`):** React 19 + Vite 6 + TypeScript, **no component library**, three runtime packages (`react`, `react-dom`, `scheduler`). Semantic HTML plus small custom primitives. `node:test` for logic, Playwright for the browser.

---

## Built now — the shell needs them

| MUI component | `09` use | PEMO primitive (this PID) |
|---|---|---|
| `AppBar` | global shell | `TopBar` (`src/shell/TopBar.tsx`) — semantic `<header>`, carries no navigation |
| `Drawer` (navigation) | mobile nav | `HamburgerDrawer` — the mobile sidebar in `Shell.tsx` (`role="dialog" aria-modal`), same full list, closes on select |
| `Skeleton` | first-paint loading | `Loading` (`StateNotice.tsx`) — skeleton bars |
| `Alert` | error / offline / permission states | `ErrorState` / `Offline` / `PermissionDenied` (`StateNotice.tsx`), `role="alert"`/`status` |
| `Chip` (status) | severity / status | `SeverityChip` (`SeverityChip.tsx`) — seven tones, icon + label, never colour alone |
| `ToggleButtonGroup` (language) | language switch | `LanguageSwitch` — segmented, `aria-pressed`, active amber-filled |
| `Tabs` (implicit) | subsystem sub-views | `TabBar` (`TabBar.tsx`) — `role="tablist"`, code + title header |

## Named gaps — a later data PID needs them, each costed. NOT built now.

| MUI component | `09` use | PEMO plan and cost |
|---|---|---|
| `Autocomplete` | keyword search (≤100 words), match mode | Listbox+combobox with `aria-activedescendant` and a list alternative for a11y. **~2–3 d** — the largest single gap |
| `DatePicker` / `TimePicker` | availability date/time window | Native `<input type=date/time>` wrapped for locale + a keyboard list alternative (`09` requires both). **~1–2 d** |
| `Select` | filter selects | Styled native `<select>`. **~0.5 d** |
| `Slider` | capacity, price range | Two native `<input type=range>` + a text-entry alternative. **~1 d** |
| `Accordion` | advanced search, FAQ | `<details>/<summary>`. **~0.5 d** |
| `Stepper` | booking wizard | Ordered-list step indicator with `aria-current`. **~1 d** (wizard itself is out) |
| `Rating` | satisfaction survey (`U-15`) | Radio-group star rating. Survey is a screen the export does not cover — **cost noted, deferred** |
| `DataGrid` | — | **Does not recur** — the portal has no dense operational grid; results are cards. Semantic HTML, as management-web ruled |
| `Pagination` | search results | Semantic pager, filter state in the URL. **~0.5 d** |
| `TreeView` | location / zone filter | Disclosure tree, `role="tree"` (recurs from management-web `B12`). **~1–2 d** |
| `Timeline` | booking timeline | Semantic ordered list. **~0.5 d** |
| `ImageList` | facility gallery | Responsive grid of `<img>`; the portal renders no imagery in this PID. **~0.5 d** |
| `Snackbar` | action success | Deferred with writes — a live region toast. **~0.5 d** |
| `Dialog` | confirmations | Deferred with writes — `<dialog>` or a focus-trapped modal. **~1 d** |
| `Tooltip` | eligibility rule text | Deferred — eligibility copy is data. **~0.5 d** |

## Superseded by the export's navigation architecture — do not build

| MUI component | `09` §9.0 use | Why it does not recur |
|---|---|---|
| `BottomNavigation` | mobile nav bar | The export replaced it with the hamburger drawer at mobile |
| `Breadcrumbs` | optional crumb band | The export has no breadcrumb; tabs carry sub-navigation |
| `Container maxWidth="lg"` | page width | The shell uses the full content region beside the sidebar |

---

## Deferred features (not components), with their reason — Ruling 5

`FR`-backed features a later reader must find rather than conclude were missed:

- **`Export results` (CSV/XLSX/PDF)** — `FR-1.25.1.1`. A format-negotiation surface over an already-fetched result set; out of the read surfaces, deferred (API-027 Ruling 5).
- **`Notify me`** (partial-availability) and the **saved-search selector** — writes/persistence, deferred.
- **`Saved facilities`** — a write; the tab renders as an empty pane here, the write is out.
