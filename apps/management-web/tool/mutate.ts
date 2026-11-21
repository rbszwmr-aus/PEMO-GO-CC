/**
 * SHARED MUTATION MACHINERY.
 *
 * Every assertion in this app is proven by making it fail. That proof has its
 * own failure mode, and this file exists because it was hit:
 *
 *   An assertion needs a red condition.
 *   A harness needs a control.
 *   A MUTATION NEEDS A DID-IT-APPLY GUARD.
 *
 * Each verifies the one below it, and each is invisible when absent. In step 4 a
 * mutation string collapsed `\\b` to `\b`, matched nothing, and reported the
 * assertion as unprovable — because A MUTATION THAT DOES NOT APPLY IS
 * INDISTINGUISHABLE FROM AN ASSERTION THAT CANNOT FAIL.
 *
 * WHY IT LIVES HERE AND NOT IN THE SCRIPT THAT NEEDED IT.
 *
 * The first harness written for this PID HAD the pattern-not-found guard. The
 * second, written days later for the same purpose, did not. A safeguard learned
 * in one throwaway script does not propagate to the next: every
 * re-implementation starts from zero, and the person re-implementing is the one
 * who already knows better. So the guard lives in shared code, where the next
 * harness inherits it instead of rediscovering it.
 */

import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ROOT } from './corpus-source.ts';

export type Edit = [relativePath: string, find: string, replace: string];

export interface Mutation {
  id: string;
  /** The assertion this mutation must turn red. */
  target: string;
  edits?: Edit[];
  /** A file created for the duration of the mutation. */
  addFile?: [relativePath: string, contents: string];
  /** Free-text note, e.g. which class of mutation this is. */
  note?: string;
  /**
   * Assertions BESIDES the target that this mutation is expected to redden.
   * Declaring the blast radius is what separates "this assertion can fail" from
   * "the app can break". Anything red and undeclared is collateral and refuses
   * certification.
   */
  alsoRed?: string[];
}

export class MutationNotAppliedError extends Error {
  override name = 'MutationNotAppliedError';
}

interface Restore { (): void }

/**
 * Apply one mutation, returning a restore function.
 *
 * THE GUARD, in three parts, because each catches a different silent failure:
 *   1. the file exists
 *   2. the `find` text is present — a typo or an escaping slip fails LOUDLY
 *   3. the file's bytes actually changed — a find that equals its replace,
 *      or a no-op edit, is caught even though step 2 passed
 */
export function applyMutation(m: Mutation): Restore {
  const backups = new Map<string, string>();
  const created: string[] = [];

  const undo: Restore = () => {
    for (const [p, body] of backups) writeFileSync(p, body);
    for (const p of created) if (existsSync(p)) unlinkSync(p);
  };

  try {
    if (m.addFile) {
      const [rel, body] = m.addFile;
      const p = join(APP_ROOT, rel);
      if (existsSync(p)) {
        throw new MutationNotAppliedError(`${m.id}: addFile ${rel} already exists; refusing to clobber it`);
      }
      writeFileSync(p, body);
      created.push(p);
    }

    for (const [rel, find, replace] of m.edits ?? []) {
      const p = join(APP_ROOT, rel);
      if (!existsSync(p)) {
        throw new MutationNotAppliedError(`${m.id}: ${rel} does not exist`);
      }
      const before = readFileSync(p, 'utf8');
      if (!backups.has(p)) backups.set(p, before);

      if (!before.includes(find)) {
        throw new MutationNotAppliedError(
          `${m.id}: the find text is NOT PRESENT in ${rel}.\n` +
            `  looked for: ${JSON.stringify(find.slice(0, 120))}\n` +
            `  A mutation that does not apply is indistinguishable from an assertion that\n` +
            `  cannot fail, so this is an error rather than a silent skip. Check escaping:\n` +
            `  a JavaScript "\\\\b" collapses to "\\b" and will not match a file containing "\\\\b".`,
        );
      }

      const after = before.replace(find, replace);
      if (after === before) {
        throw new MutationNotAppliedError(
          `${m.id}: ${rel} is byte-identical after the edit. The find text was present but the ` +
            `replacement changed nothing, so the mutation would prove nothing.`,
        );
      }
      writeFileSync(p, after);
    }
  } catch (e) {
    undo();
    throw e;
  }

  return undo;
}

/**
 * A red: the failing assertion's NAME mapped to ITS OWN LOG.
 *
 * A set of names is not enough, and GEN-044 is why. Main CC's `with-mutation`
 * treated any non-zero exit as a bite, so a mutation that broke the BUILD scored
 * as a proof; five bites were false. The rule that came out of it —
 * `a-bite-is-a-named-red` — is harness-agnostic, and this harness had the same
 * defect one level in: it matched the target against a set of names with
 * `.some()`, so a mutation that reddened the whole suite certified, and nothing
 * checked that the named case had failed FOR ITS OWN REASON.
 *
 * The log is the evidence. A name with no log, or a log that is an infrastructure
 * failure rather than an assertion failure, is not a bite.
 */
export type Reds = Map<string, string>;

/** Infrastructure noise. A named case that "fails" this way has proved nothing. */
const NOT_AN_ASSERTION = [
  'ERR_MODULE_NOT_FOUND', 'SyntaxError', 'ENOENT', 'Cannot find module',
  'Test timeout of', 'Target page, context or browser has been closed',
  'net::ERR_', 'browserType.launch', 'EADDRINUSE',
];

function isAssertionFailure(log: string): boolean {
  if (log.trim().length === 0) return false;
  if (NOT_AN_ASSERTION.some((n) => log.includes(n))) return false;
  return /AssertionError|expect\(|Expected|assert\./.test(log);
}

export interface ProofResult {
  id: string;
  target: string;
  proven: boolean;
  /** Why it was not certified, when it was not. */
  reason?: string | undefined;
  /** The target's own failure log — the evidence for the bite. */
  evidence?: string | undefined;
  /** Reds beyond target and the mutation's declared `alsoRed`. */
  collateral: string[];
  redInstead: string[];
  note?: string | undefined;
}

/**
 * Prove a set of mutations.
 *
 * `runSuite` returns the failing assertions AND THEIR LOGS. Two controls, not one:
 * the suite must be green before any mutation and green again after all of them,
 * or the results mean nothing.
 *
 * A MUTATION IS CERTIFIED ONLY WHEN ALL FOUR HOLD (GEN-044, `a-bite-is-a-named-red`):
 *
 *   1. the NAMED target is red — not "something is red";
 *   2. its log is PRESENT — a name with no log is a parse artefact, not a bite;
 *   3. that log is an ASSERTION failure, not a timeout, a missing module or a
 *      browser that fell over — those say the harness broke, not that the
 *      assertion can fail;
 *   4. the blast radius is DECLARED. Reds beyond `target` + `alsoRed` are
 *      collateral, and collateral means the mutation reddened more than the thing
 *      it was aimed at, so it has not shown that assertion failing for its own
 *      reason. Declaring the radius is the honest move; suppressing it is not.
 *
 * Rule 4 is the one that bites in practice. UI-045's first list mutation edited a
 * SHARED component and reddened four screens' cells; under `.some()` it certified.
 */
export function proveMutations(
  mutations: Mutation[],
  runSuite: () => Reds,
  log: (line: string) => void = console.log,
): ProofResult[] {
  const baseline = runSuite();
  if (baseline.size > 0) {
    throw new Error(
      `the suite is not green before mutating; results would be meaningless.\n  red: ${[...baseline.keys()].join('\n  red: ')}`,
    );
  }
  log(`control: suite green before mutating`);

  const results: ProofResult[] = [];
  let sawAnyLog = false;

  for (const m of mutations) {
    const undo = applyMutation(m); // throws rather than silently skipping
    try {
      const reds = runSuite();
      const names = [...reds.keys()];
      const hit = names.find((f) => f === m.target || f.includes(m.target));
      const evidence = hit ? reds.get(hit) ?? '' : '';
      // "Is the parser working?" is a question about the RUN, not about this
      // target: a log on any red anywhere proves the parser can read one.
      for (const l of reds.values()) if (l.trim()) sawAnyLog = true;

      const declared = new Set([...(m.alsoRed ?? [])]);
      const collateral = names.filter(
        (f) => f !== hit && ![...declared].some((d) => f === d || f.includes(d)),
      );

      let reason: string | undefined;
      if (!hit) reason = 'the named assertion did not go red';
      else if (!evidence.trim()) reason = 'the named assertion is red but carries NO LOG — cannot confirm it failed for its own reason';
      else if (!isAssertionFailure(evidence)) reason = 'the named assertion failed for an INFRASTRUCTURE reason, not its own';
      else if (collateral.length > 0) reason = `${collateral.length} undeclared red(s) — the mutation is broader than its target`;

      const proven = reason === undefined;
      results.push({
        id: m.id, target: m.target, proven, reason, collateral,
        evidence: proven ? evidence.split('\n').slice(0, 2).join(' ').trim() : evidence.slice(0, 400),
        redInstead: proven ? [] : names,
        note: m.note,
      });

      log(`${proven ? 'PROVEN ' : 'NOT RED'} ${m.id}  ${m.target}`);
      if (proven) {
        // The first line that is actually a FAILURE, not the reporter's rule line.
        // Printing `────────` as the reason a bite counted would make this log
        // useless for the one job it has: showing why the assertion went red.
        const why = evidence
          .split('\n')
          .map((l) => l.trim())
          .find((l) => /AssertionError|Error:|expect\(|assert\./.test(l));
        log(`         because: ${why?.slice(0, 110) ?? '(log present, no headline found)'}`);
        if ((m.alsoRed ?? []).length) log(`         declared radius: ${(m.alsoRed ?? []).join(' | ')}`);
      } else {
        log(`         ${reason}`);
        if (collateral.length) log(`         collateral: ${collateral.slice(0, 6).join(' | ')}${collateral.length > 6 ? ` (+${collateral.length - 6})` : ''}`);
        else if (!hit) log(`         red instead: ${names.join(' | ') || '(nothing)'}`);
      }
    } finally {
      undo();
    }
  }

  // THE INSTRUMENT'S OWN CONTROL. If every mutation produced reds but not one
  // carried a log, the log parser is broken and every result above is worthless —
  // and it would look exactly like a run of honest NOT-REDs.
  if (results.some((r) => r.redInstead.length > 0 || r.proven) && !sawAnyLog) {
    throw new Error(
      'the suite reported failures but NOT ONE carried a log: the log parser is broken, ' +
        'and a harness that cannot read a failure cannot certify one.',
    );
  }

  const after = runSuite();
  if (after.size > 0) {
    throw new Error(`the suite did not return to green after restoring:\n  red: ${[...after.keys()].join('\n  red: ')}`);
  }
  log(`control: suite green after restoring`);
  return results;
}
