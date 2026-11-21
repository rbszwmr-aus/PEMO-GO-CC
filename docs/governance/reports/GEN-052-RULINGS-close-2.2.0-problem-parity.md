# GEN-052 — Close ruling: management-web 2.2.0 — Problem-type parity, reason codes, the draft row

Date: 2026-09-03. Merged 8a39ec8 (joint landing: UI CC's b015387 on the branch, authorship recorded), Rule 7 close 1116fed on the step ruling. Step report GEN-052-step1.md. Closed; this ruling completes the record.

## Accepted
- D4: `ntc_0820_bbq` is `event_community`, ungated; publishNotice from draft is correct (ADR-019, GEN-040 case 1b). The defect was submitNotice on ungated drafts, from a hand rule in the GEN-047 ruling-(b) fixture patch — parity checked existence, not values. `notice-fixture-permissions.test.ts` pins every mob-s5 item's list to `noticeActRegistry.permitted(...)`; two rows corrected; bite proven. Accepted.
- D1: 32 declared / 9 fixtured / 23 missing; seven notices recorded from the real acts, written only if the body carries the type the file is named for; sixteen in problem-debt.json with owning PIDs. The 500 on `notice-schedule-inverted` (CHECK at INSERT before the act's publish-time check) fixed at compose/revise/correct with bite. The empty-audience refusal needed a building with zero residents — noted. Accepted.
- D2: relabel + a real wrong-state refusal (revise on withdrawn); a test requires every `refusal-*` file's name to match its Problem type. Accepted.
- D3: `notice-reasons.json` is the one source (14 distinct codes; the registry's 15 held `wrong_audience` twice); generator + `--check` in prove.sh; `reasonCode` enum on `NoticeTransitionRequest`. Accepted.
- Contract 2.1.0 → 2.2.0 additive; resident-mobile untouched; +7 refusal fixtures; 31 recorded per run. Accepted.

## Open from this PID
- The step ruling's ADDITION 1 (GEN-047 matrix gains the gated × ungated dimension) is not visible in the step report; if not built here it is GEN-054's.
- The `every source file is actually TRACKED` assertion the report names as moved — confirm it is green on main after the joint landing; if it moved for the D4/D2 reasons stated, UI-053 binds it.
- The joint-landing rule (`the-track-that-owns-the-file-writes-the-line`) is now standing; add it to the principles file in GEN-054 if GEN-052 did not.
