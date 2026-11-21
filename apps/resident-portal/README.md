# PEMO resident portal — shell

The end-user portal's **shell**, its **design-system translation**, and its **discriminated state scaffolding**. Built under `UI-028-ST`.

**The shell (UI-028-ST) rendered no data.** UI-031-ST fills two panes — Explore and Facility detail — from the merged `resident-portal` fixtures (`API-027-ST`), the first time the portal renders data. Every other pane keeps its empty/coming-soon state. Zero invented values: the only facility names, prices, states and counts shown are those a fixture supplies (`test/boundary/residue-scan.test.ts`). No writes — the contract has none.

## Stack

React 19 + Vite 6 + TypeScript, **no component library** (`R2`, inherited from `UI-019/022/024`). The browser payload is three packages: `react`, `react-dom`, `scheduler`. `node:test` for logic, Playwright for the browser. No runtime analytics (standing resident-app rule).

## What is here

- **Shell** — persistent sidebar (`236/196/drawer` at `1080/760`), top bar with no navigation, in-page tab bars, no home grid; opens on Explore.
- **Theme** — tokens from `PEMO_UI_Design_System_v2.0`, generated from `tokens/palette.json` + `severity.json`. No raw hex in any component. Seven severity tones (not the export's six).
- **i18n** — EN / 繁體中文, zero hard-coded user-visible strings.
- **State scaffolding** — loading · empty · error · permission-denied · offline, each discriminated.
- **[COMPONENT-TRANSLATION.md](./COMPONENT-TRANSLATION.md)** — replaces the void `09` §9.0.
- **[DIVERGENCES.md](./DIVERGENCES.md)** — the register.

## Commands

```
pnpm run generate     # regenerate src/**/*.g.* from tokens + severity.json + public/icons/
pnpm run dev          # vite dev server (dev state toolbar present)
pnpm run build        # generate + production build (dev toolbar EXCLUDED)
pnpm run typecheck
pnpm run check:fonts  # is this host able to draw Traditional Chinese? (UI-019-ST F3)
pnpm run test         # node suite + Playwright (browser runs against the production build)
```

## Host requirement

A Traditional Chinese font (`fonts-noto-cjk` on Debian/Ubuntu). Without one, Chinese renders as tofu — which has a reasonable advance width, so a width assertion would pass while measuring nothing. `pnpm run check:fonts` and the first browser project both gate on it (`UI-019-ST` F3).

## Generated files

`src/**/*.g.ts` and `src/**/*.g.css` are generated and committed; a stale copy fails the token/icon tests. Never hand-edit them.

## Service icons

The export references `icons/*.png` but ships none (see `public/icons/README.md` and `DIVERGENCES.md` F-ICONS). Drop the PNGs into `public/icons/` and `pnpm run generate` to activate the sidebar marks; until then the slot is reserved and the label carries wayfinding.
