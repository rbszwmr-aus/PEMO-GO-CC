# GEN-008 (battery hardening) Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. Proceed to Step 2 with the reshaped Check C and the two additions below. Pin `d45c8d90`.

---

## Check C — my spec was unbuildable; your commit-trail signal replaces it. Accepted.

I specified Check C against `write_scope` as if it were machine-readable paths. It is not — GEN-007's is a predicate over file *contents*, DOC-002's is `none`, UI-004's is a G-drive path that is not in the repository at all. A parser over that is a heuristic wrong in unpredictable ways, which is principle 2's cry-wolf failure built on purpose. You were right to refuse to build it, and this is the structure-over-string discipline the project already applies to `serving_scope`: do not parse free prose when a structured signal exists.

**The structured signal is the commit trail, and you didn't assert it — you tested it.** Every commit ends `[PID-ID]`, 100% across all 11 commits since the register landed. The naive form (any tagged commit ⇒ warn) is a 100% false-positive because the allocation commit is tagged while `draft`; the discriminator that works is **a tagged commit touching paths outside `docs/governance/`** — allocations and closes are register-only, product code is the signal. Run as a decision over history: zero false positives, fires on exactly the two real windows (GEN-006's three-commit drift, GEN-005's one), silent where a PID shipped-and-closed in one commit. **Accepted in full**, including that it warns and never fails, and names the two states it cannot separate (landed-awaiting-close vs landed-and-legitimately-continuing).

## Ruling — the `[PID-ID]` convention is ENFORCED, not merely documented

Check C rests wholly on the `[PID-ID]` tag, and you named the blind spot precisely: a commit without a tag is invisible to it. **Documenting-only would leave the check with a silent blind spot — the exact failure this whole PID exists to remove.** A check built on an unenforced convention inherits the convention's unreliability. So enforce it: a CI check that every commit since the register-landing commit carries a `[PID-ID]` tag (or is on a short, listed exception set), failing loudly on a tagless commit. The push model is linear (refspec from the worktree, no merge commits), so every commit is a PID commit and the tag is always meaningful; enforcement guarantees the status quo rather than imposing a new burden. This is the `REQUIRE_DEPCRUISE` shape once more — make the foundation's absence loud instead of silently blinding.

With enforcement, Check C's second blind spot is closed at the source; its first (the landed-awaiting-close vs continuing ambiguity) is real and irreducible, so it stays a warning that names the ambiguity. Good.

## Check B — split accepted: two entry points, one implementation

Accepted as proposed. One script does `migrate; seed` and asserts a complete world **anchored on the two tables the pre-fix abort left at zero** (`dev_scaffold.screen_content`, `home_safety.safety_event`) — not on "no error", because "no error" is the empty assertion that let F1 survive; the specific tables are the specific-assertion-catches-decay principle applied. CI gains a `services: postgres` block and runs it under `REQUIRE_DB=1` so an absent database is red; `prove.sh` gains one case that skips loudly and is fatal under the same flag. Note taken that `prove.sh` has zero database references today — this is a genuinely new dependency for it, so isolate it behind the flag cleanly so the file-level cases still run with no database present.

## Check A — derivation accepted, with the abort-loudly clause as the load-bearing part

Accepted. The victim is derived from the real candidates (a non-platform module exposing an importable file; a runtime-path file excluding `testing/` and the dev seam), deterministically, and **aborts loudly when no victim can be derived rather than skipping**. That abort is the whole point — a battery that silently skips because it could not build its own injection is the empty oracle it exists to prevent. Keep it.

## Step 2

Build all three checks plus the `[PID-ID]` enforcement, and carry the four principles. Each check's red shown by making it fire: rename a target (A still finds its victim); inject an F1-shaped seed omission (B fails loudly, and fails-not-skips with no toolchain); construct a draft PID with a product-code commit outside governance (C warns), and one shipped-and-closed in a single commit (C stays silent); and a tagless commit (the enforcement check fails). HARD STOP before commit.

Your Step-1 redesign — replacing a spec I got wrong with a signal you tested against the actual history — is exactly what a hard stop is for. It is on the record as the reason Check C is buildable at all.
