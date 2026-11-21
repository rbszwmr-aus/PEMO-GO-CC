/**
 * AFFORDANCES ARE READ, NEVER REASONED (UI-051 D1).
 *
 * This is the ONE place the client asks "may this control render?", and the
 * answer is a lookup in the server's `permittedActions`. Nothing here reads a
 * lifecycle state, a role, a grant, or a scope, and the guard in
 * test/guard/affordances-read-not-reasoned.test.ts asserts that this file is the
 * only reader of `permittedActions` outside the type layer — so a second copy of
 * the authorization rules cannot grow somewhere else in the client.
 *
 * WHY A LOOKUP AND NOT A TABLE. A client that knew "a draft may be submitted" would
 * be right until the day it is wrong: the lifecycle fixture already carries a draft
 * the caller may PUBLISH (an ungated type) and a pending notice the caller may NOT
 * approve (not their floor). Neither is derivable from the state. The server ran the
 * same function the acts run and wrote the answer down; the client reads it.
 *
 * CONTENT refusals are not predicted here either. `publish` also refuses a
 * half-translated notice, but that is a fact about what the author typed, shown by
 * attempting the act — hiding the control would teach the author that publishing is
 * forbidden rather than that a translation is missing (GEN-047 A4, UI-045 F6).
 */

import { ACT_OPERATION_IDS, type ActOperationId } from './types.ts';

/** Anything the server annotated with its permitted acts: a notice, or a scope node. */
export interface Permitting {
  readonly permittedActions: readonly ActOperationId[];
}

/** May the caller perform `op` on this target now? The server said. */
export function permits(target: Permitting, op: ActOperationId): boolean {
  return target.permittedActions.includes(op);
}

/**
 * The permitted acts of a target, in the CONTRACT's order rather than the
 * server's, so two responses listing the same acts render the same controls in
 * the same places. The contract's enum order is the one order nobody chose here.
 */
export function permittedOf(target: Permitting): ActOperationId[] {
  return ACT_OPERATION_IDS.filter((op) => target.permittedActions.includes(op));
}
