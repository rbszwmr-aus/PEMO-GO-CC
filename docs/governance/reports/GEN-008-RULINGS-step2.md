# GEN-008 (battery hardening) Step 2 — Rulings

**From:** PEMO Master Brain → PEMO Main CC
**Status:** Accepted, with **one required addition before commit** — the destructive-drop guard, §gap. Pin `d45c8d90`, five files, nothing staged.

---

## Accepted

All four reds fired, each by making it fail: Check A follows a renamed victim and aborts `exit 11` when none can be derived; Check B goes `ok → remove a serving_scope_label pair → FAIL naming the constraint → restore → ok`, anchored on `dev_scaffold.screen_content` and `home_safety.safety_event` being non-zero so it also catches a seed that exits 0 having silently skipped the scenario layer; Check C warns on GEN-007-forced-to-draft and stays silent on the allocation-only case; the enforcement check gives `exit 7` naming the tagless commit. 20/0 with a database, `prove.sh`'s one DB dependency isolated behind its flag so the file-level cases still run without one. CI contract unchanged, and the postgres service matching the dev compose image and `--locale=C` is the run-from-the-same-world discipline — CI and a developer are not two different worlds.

## The three build-time failures — the corpus caught its own author, three times

Each is an instance of a principle this same PID carries, and that is the strongest evidence the checks are real:
- **merged-but-draft cried wolf on its own PID** (pathspec resolved against cwd, so the exclude missed) — a 100% false-positive that principle 2 names, failing on its author within the hour. Fixed.
- **the tag-enforcement test disarmed by `git stash -u`** reverting the check under test — principle 12 exactly, a negative test the environment neutralised while reporting success. Re-run intact: `exit 7`. Fixed.
- **the battery caught your own reword** of the skip line — and you re-anchored on the stable substring rather than loosening to "something was printed," which is the specific-assertion principle applied correctly rather than surrendered.

None earns a new principle; all three are the corpus working. That is the outcome the whole PID was for.

## §gap — the destructive-drop guard. Required before commit, and strengthened.

You asked the right question: the seed check drops every schema before migrating, reads `database/dev/.env`, and nothing stops a misconfigured `.env`. **Yes, it must refuse — and the refusal must check the real target, not a label.**

`PEMO_ENV == 'development'` alone is not sufficient, and the reason is the read-the-artifact-not-the-summary principle applied to a destructive act: `PEMO_ENV` is a *label claiming* what the database is; the connection target is *what the database actually is*. The exact misconfiguration that matters — a correct `PEMO_ENV=development` beside a connection string pasted from staging or production — passes the label check and drops the wrong database. So:

- The guard confirms the **actual connection target** (dbname and host) matches an expected development pattern before any drop, and aborts loudly otherwise. Check `PEMO_ENV` too if you like, cheaply, but the target check is the load-bearing one.
- Prove it by making it fail: point the target at a non-development name, show the drop refuses before touching anything; restore, show it proceeds.

**New principle, and it is a safety one, so it goes in despite the corpus being large:**

> A destructive operation confirms the real target it will act on, never a label that claims what the target is — the same misconfiguration that points it at the wrong target can set the label too.

Add it with the four already carried. This is the one place in this PID where a wrong guard does not merely mislead but destroys, so it is the one addition worth holding the commit for.

## Commit

Add the guard, prove its red, then commit under the standard gate and close under rule 7 — archive the PID with its row, `closed:` stamped, carry both Step reports and both rulings into the register in the same commit (the close the GEN-006 lesson says to order explicitly). Report `main` and tree, and confirm the active register then reads UI-004 alone.

After close, the write skeleton is next — it now lands on a floor that shouts when it breaks, which is exactly why it waited for this.
