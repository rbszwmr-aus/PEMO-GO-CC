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
import { APP_ROOT } from './tokens-source.ts';

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

export interface ProofResult {
  id: string;
  target: string;
  proven: boolean;
  redInstead: string[];
  note?: string | undefined;
}

/**
 * Prove a set of mutations.
 *
 * `runSuite` returns the set of assertion names currently failing. The CONTROL:
 * the suite must be green before any mutation and green again after all of them,
 * or the results mean nothing — a harness needs a control just as an assertion
 * needs a red condition.
 */
export function proveMutations(
  mutations: Mutation[],
  runSuite: () => Set<string>,
  log: (line: string) => void = console.log,
): ProofResult[] {
  const baseline = runSuite();
  if (baseline.size > 0) {
    throw new Error(
      `the suite is not green before mutating; results would be meaningless.\n  red: ${[...baseline].join('\n  red: ')}`,
    );
  }
  log(`control: suite green before mutating`);

  const results: ProofResult[] = [];
  for (const m of mutations) {
    const undo = applyMutation(m); // throws rather than silently skipping
    try {
      const failing = runSuite();
      const proven = [...failing].some((f) => f === m.target || f.includes(m.target));
      results.push({
        id: m.id,
        target: m.target,
        proven,
        redInstead: proven ? [] : [...failing],
        note: m.note,
      });
      log(`${proven ? 'PROVEN ' : 'NOT RED'} ${m.id}  ${m.target}`);
      if (!proven) log(`         red instead: ${[...failing].join(' | ') || '(nothing)'}`);
    } finally {
      undo();
    }
  }

  const after = runSuite();
  if (after.size > 0) {
    throw new Error(`the suite did not return to green after restoring:\n  red: ${[...after].join('\n  red: ')}`);
  }
  log(`control: suite green after restoring`);
  return results;
}
