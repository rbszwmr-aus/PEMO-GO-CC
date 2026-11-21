# ADR-004 — Package manager and workspace tooling

**Status:** `Accepted` — decided by the Product Owner on 2026-08-13.
**Date:** 2026-08-13
**Author:** CC Architecture Session, under `API-005-ST`
**Decision owner:** Product Owner (user)
**Target location:** `docs/adr/ADR-004-package-manager-and-workspace-tooling.md`
**Committing session:** `PEMO Contract` — authored and committed under `API-005-ST`; `Target location` and this field backfilled by `API-016-ST`.
**Resolves:** `package manager` and `build system`, listed as **Unresolved** in `docs/architecture/repository-and-dependency-rules.md`.
**Raised by:** the `API-005-ST` Step 1 review.

## Context

The repository was documentation-only until this PID. `API-005-ST` §2.0 requires it to create the monorepo root — `package.json`, the workspace configuration, `tsconfig.base.json`, a lockfile, `.gitignore` and `.editorconfig` — so that `GEN-006-ST` and `UI-007-ST`, which run concurrently, never both edit a root file. That reasoning is sound and the hazard was confirmed: the root really was empty.

**A lockfile cannot be written without selecting a package manager.** npm, pnpm and yarn produce different and mutually unreadable lockfiles, and the workspace declaration differs with the choice. `tsconfig.base.json` similarly commits the repository to TypeScript as its build baseline.

The committed architecture baseline states, verbatim:

> **Unresolved:** package manager, framework, build system and enforcement tooling.

and `docs/adr/README.md` defines `Unresolved` as "intentionally undecided". Resolving such an item is precisely what an ADR is for, so this decision is recorded here rather than arriving silently inside a lockfile.

This ADR does **not** select a backend framework, cloud, broker, storage or observability vendor. Those remain Unresolved.

## Decision

**pnpm**, with `pnpm-workspace.yaml` declaring `apps/*`, `modules/*` and `packages/*`, and the version pinned through the `packageManager` field in `package.json`.

## Why — the reason is architectural, not ergonomic

The committed baseline states two rules that the repository has, so far, no mechanism to enforce:

> Principle 2 — Modules do not write directly to another module's tables.
> Principle 3 — No cross-module database foreign keys.

and, in `repository-and-dependency-rules.md`:

> Modules depend on shared primitives and approved contracts, not another module's persistence.

**pnpm's `node_modules` layout is strict by default.** It installs a symlinked tree in which a package can resolve only the dependencies it has actually declared in its own `package.json`. npm and yarn use a hoisted layout, in which a package can `import` a transitive dependency it never declared and the build still succeeds — the failure appears later, somewhere else, when the hoisting changes.

For a modular monolith whose entire integrity argument rests on modules not reaching into each other, that difference is the decision. Under pnpm, a module that imports another module's internals without declaring the dependency **fails to resolve at build time**. The architecture's boundary rule stops being a convention that reviewers must notice and becomes a mechanism that fails loudly.

`GEN-006-ST` is separately required to justify a module-enforcement mechanism. This gives it one layer of that enforcement for free, at the package-manager level, before it writes any code.

## Rejected alternative — npm workspaces

Rejected, and it is worth being accurate about why.

npm workspaces is not deficient tooling. It is bundled with Node and needs no additional install step, it keeps the workspace declaration inside `package.json` rather than adding a second file, and for this PID's own needs — one validation script with four devDependencies — it would have been entirely adequate. The Step 1 review recommended it on exactly those grounds.

**It was rejected for weaker default enforcement, not for quality.** Its hoisted `node_modules` layout permits phantom dependencies, so it cannot mechanically enforce principles 2 and 3. That is a real difference for this repository, and it is the only one that decided the matter.

Two honest costs of choosing pnpm:

- It is not bundled with Node. It is reached through `corepack`, which ships with Node 20 and later, and the version is pinned in `packageManager` so every session resolves the same one. No global install is required.
- Strictness surfaces as build failures that a hoisted layout would have hidden. That is the intended behaviour, but it will look like friction the first time a module hits it, and it should not then be worked around by enabling hoisting.

Yarn was not seriously considered: it offers no enforcement advantage over pnpm and adds a third toolchain to a project that has none yet.

## Consequences

- `pnpm-workspace.yaml` declares `apps/*`, `modules/*` and `packages/*`. The globs are empty today; the downstream PIDs populate them.
- `pnpm-lock.yaml` is the repository's lockfile and is committed.
- `packageManager` in `package.json` pins the pnpm version, so `corepack` resolves the same one everywhere without a global install.
- `GEN-006-ST` retains its single permitted root exception: adding its own runtime dependencies to `package.json` and the lockfile, in one dedicated commit, recorded in its report. Nothing else at the root.
- `UI-007-ST` is unaffected. `apps/resident-mobile` is a Flutter application with its own `pubspec.yaml` and does not participate in the Node workspace. The `.gitignore` already carries its entries.
- **Do not enable `shamefully-hoist` or `node-linker=hoisted`.** Either would discard the only reason this package manager was chosen. If a dependency genuinely requires hoisting, that is an architecture decision and a new ADR, not a line in `.npmrc`.

## Status of the baseline document

`docs/architecture/repository-and-dependency-rules.md` still lists the package manager and build system as `Unresolved`. This PID must not modify any of the twelve committed architecture documents, so that line is left standing and the divergence is recorded here instead. Updating it is a documentation-correction PID for the Master Brain to allocate.
