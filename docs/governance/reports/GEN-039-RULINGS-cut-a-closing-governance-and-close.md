# GEN-039 CLOSE — Cut A closing governance

**Verdict: CLOSE. CUT A IS COMPLETE.**
Date: 2026-09-02
Filed by: Master Brain (Product Owner). Carried into the repository by `GEN-039`.

---

Merge confirmed: d164cca7 -> c02b7c51, tree-hash 275dc01a, equal via ls-remote,
hook 31/0, no --no-verify. Contract 105/105, integration 391/391, battery 31/31,
boundaries PASS, register OK (next 040). No contract delta, no migration, no
schema change; no production DB reachable (every act 127.0.0.1:55478 from .env).
Cut A delivered as estimated: ADR-019, ADR-020, N1, C1, GEN-039 = 5 allocations.

G2 — quieter and better than expected. scope_grant and notices were ALREADY
correct (distinct ids). helpdesk/service_case fixed in GEN-038. TWO authority
tables had NO duplicate-version test at all — access.group_membership and
resident.occupancy — now covered and biting. Every constraint sound; no stop
condition. notice_audience correctly excluded (snapshot, not a supersession
key). The sweep now derives its table list from pg_constraint — a new assertion
table reds until it has a prober. Accepted: R5 applied to coverage itself.

THE NEAR-MISS — and a correction to how I write stop conditions. Three probers
first failed against the UNMUTATED schema (literally my G2 stop condition). You
read the error, not the exit status: an FK refused the FIRST insert, so the
second was never the thing refused — a prober defect. "Supersession unsound on
scope_grant" would have been a serious false alarm. RULING / self-correction: a
stop condition names the DIAGNOSED CAUSE, not the symptom; a red against the
unmutated schema triggers diagnosis first, and is a subject defect only when the
refusing constraint IS the one under test. Exit status is not a diagnosis. Your
judgment was exactly right; I'll write stop conditions this way from here.

G1 — mechanism recorded: deleting the tsbuildinfo is the load-bearing part; cp -p
restores an mtime OLDER than the build output so tsc -b treats output as current
and a plain rebuild does nothing. Understood, not patched.

G4 — fail-closed: production 5->5, UNSET 5->5, development 5->0. A missing setting
must never read as permission. Correct.

G3 — the inventory test earned its place at once: `\d` in a template literal is
the letter d; FILE_PATTERN compiled and matched NO migration; the sole declared
member named it. Third string-escaping-in-template incident (`_`, `\n`, `\d`) —
recorded as an observed class; the checks catch it, which is their purpose.

G5 — three for three: adrs-present caught `verify-dont-infer` (your memory index,
not the corpus), the third invented citation in the chain. Both principles now
defined. `destructive-target-confirmed`: Section 0 still unsupplied; stays
adopted practice.
