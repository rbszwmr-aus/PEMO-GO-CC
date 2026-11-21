# GEN-012 (B — principle carry + role-model check) Step 1 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Filed. Proceed to Step 2. Pin `7c511063`. Commit the allocation now (see §0). Rulings below.

---

## §0 — commit the allocation

Yes, commit the PID file and regenerated index. Taking a number *is* creating and committing the file — every prior PID's allocation was its own commit. The hard stop is before the **Step 2 deliverable** commit, not before allocation. You were right to ask rather than assume; the answer is proceed.

## Part 1 — the fifth principle: carry it. Five, not four.

Your scan found 15 carried, 5 missing, and you refused to work from my list as the authority — correct, the reports are the source. The four I named are genuinely absent (and you caught that the destructive-target principle is *present* with only its ordering clause missing — so its fix is an amendment, not a new line).

**The fifth — `GEN-001-RULINGS-step1:49`, "enumerate the filesystem, then interrogate git per file; never ask git what exists" — carry it.** The ruling hedged ("the reasoning is the principle one layer over") and you were right to flag the ambiguity rather than resolve it silently. I resolve it: it is a principle. It is general, it is load-bearing, and it **recurred** — GEN-011's untracked `0116` was applied by the migration runner precisely because git-tracking is not existence, which is this principle biting a second time. Carry it at the general level: *git tracking is not existence; a tool that reads the filesystem acts on what is on disk, tracked or not — enumerate the filesystem, then interrogate git per file.* Twenty after the carry.

**The recall limit — accepted as stated.** The method carries the *marked* principles and does not claim completeness; the three "this is not a new principle" rulings are evidence the convention is used deliberately but not proof it is used exhaustively, and you said so rather than glossing it. That is rule 8, and it is the honest claim: every marked principle is carried, not "the corpus is now exhaustive."

## Part 2 — the missing premise, and it is the load-bearing half of B

You reframed it correctly and the measurement is the proof: a superuser bypasses privilege checks and leaves **nothing** in `role_table_grants`, so `grants-complete.sh`'s EXCESS arm — the load-bearing one — is blind to the exact attack that fully defeats D1's fourth property. Green over a rewritten-and-erased audit. **So the role-model assertion is not an addition to the check; it is the premise without which the whole grant check is theatre.** It has been missing since GEN-010 — not a live breach, because `pemo_app` is non-superuser today, but a guard blind to the one drift that would matter. And the twice-measured discipline (the empty-table "succeeded" you refused to earn) is exactly right.

### How wide — the full declared posture, derived from the declaration

You flagged `NOCREATEDB NOCREATEROLE NOBYPASSRLS` as a candidate widening beyond the `rolsuper` + ownership I named, and asked rather than assumed. **Widen to the full declared set.** I named `rolsuper` and ownership as the two I knew defeat the guarantee directly; but the check's correct scope is *the least-privilege posture as `000-roles.sql` declares it holds*, and a subset check passes green while a declared attribute drifts — `NOCREATEROLE` especially, because a role that can create roles can escalate itself past every other assertion. So assert `rolsuper=false`, `createrole=false`, `createdb=false`, `bypassrls=false`, and owns nothing.

**Derive the expected attributes from `000-roles.sql`, not a hand-written list** — the same discipline the grant arm already uses against `information_schema`: a maintained list is what goes stale, and the declaration is the model. Prove each by flipping it on a throwaway database and showing the check fires, ownership included. Ownership is a separate necessary fact, not redundancy: an owner grants itself anything regardless of `rolsuper`.

## The join-key cost, and the numbering gap — one-time carry, no fragile standing check

You are right that keying the match on bolded lead sentences makes report wording load-bearing, and I would rather confirm than have you absorb it: **this carry is one-time.** Content-matching is fine for a reconciliation done once and verified (your 15/5 split is verified). Do **not** build a *standing* reconciliation check keyed on wording — that would make every future reword a false "missing," the cry-wolf class. If a standing "principles stay in sync" guard is ever wanted, it needs stable principle **ids** cited in both the ruling and the file, which is the same gap behind your other finding: the rulings cite "principle 43" / "principle 11" against a file that does not number them, so those references do not resolve and you matched by content. **Owed, not B's scope:** give principles stable ids (slugs) so ruling references resolve; your content-match is the correct interim, and B carries the five by content.

## Step 2

Carry the five missing principles (each present exactly once, proven by dropping one and showing the count/grep catches it) and amend the destructive-target principle with its ordering clause. Add the role-model premise to `grants-complete.sh` — the full declared posture derived from `000-roles.sql`, each attribute proven to fire by flipping it against a planted audit row, so the guard is no longer green over a rewritable audit. HARD STOP before the deliverable commit.

Then A begins — the next scope-only write.
