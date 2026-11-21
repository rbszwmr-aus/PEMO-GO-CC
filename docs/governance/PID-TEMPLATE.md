# PID template — copy this per task

A PID file lives at `governance/pids/<ID>.md`. It has YAML front-matter (which the index generator reads) and a short human body. That is the entire schema.

```markdown
---
id: GEN-001
type: GEN            # API | GEN | UI | DOC — must equal the id prefix
version: v1.0
from: Master Brain
to: <executor session, e.g. PEMO Contract>
status: draft        # draft | running | done | merged
pin: current origin/main - report commit + tree at Step 1
write_scope: <path globs>. Read-only = everything else.
closed:              # date, YYYY-MM-DD. Empty until status is done or merged.
---

# <ID> — <one-line title>

## What to build
Plain prose. What, and why it is this and not the obvious alternative.
Derive shapes; do not restate decisions that live in an ADR — cite them.

## Done when
The acceptance line(s). Each must be checkable, and each proven by making it
fail, not by argument. If the world must contain something for the test to
bite, say "seed-first".

## Steps & stops   (only if multi-step)
Step 1 → reports/<ID>-step1.md — HARD STOP, Brain rules before Step 2
Step 2 → … — HARD STOP before commit
```

That is it: **front-matter + three prose sections.** A single-step PID drops the last section.

Everything the old schema carried as mandatory fields — Purpose essays, Related, Gates, Supersedes, Decision owner, long Status prose, Out-of-scope, severity meta — is gone. Say any of it in *What to build* if it matters; otherwise let it go.

## Notes on the schema

- **`type` must equal the id prefix.** The enum is `API | GEN | UI | DOC` and nothing else. Carrying an ADR into the repository is a `DOC` or `GEN` task like any other — ADRs carry their own sequence and are excluded from the PID scan, so there is no `ADR-` PID.
- **`closed`** holds the date a PID closed. It is empty until `status` is `done` or `merged`, and it is what the archive index is generated from — without it in the source, the archive table would have to be hand-written, which is the defect this whole structure removes.
- **There is no `reports:` key, and the schema is closed.** A PID's report list is **derived** from the `reports/` directory by `<ID>-` prefix, never declared. The declaration used to exist and drifted from the directory *uniformly*, across every PID that had one, because `reports/<ID>-step*.md` cannot match a ruling file and rulings are first-class evidence. The allowed keys are exactly `id, type, version, from, to, status, pin, write_scope, closed`; **any other key is an error**, including a leftover `reports:`, because a tolerated leftover goes on declaring something no longer true.
- **`pin` and `write_scope`** are the only two fields beyond the obvious, and each earns its place by a real incident: pin drift once staged a whole branch tree over `main`, and a missing write-scope is how two sessions edit the files git merges worst.
- The process invariants — hard stop, no-assert-state, allocation, merge-by-tree-hash — are **global rules** in `00-START-HERE.md`, inherited by every PID and never copied into a header.
