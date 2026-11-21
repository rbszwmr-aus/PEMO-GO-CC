/**
 * A PROBLEM IS PRESENTED BY ITS TYPE, NEVER BY ITS PROSE (UI-051 D2/D4).
 *
 * `Problem.type` is the contract's own registry of refusals, generated into the
 * management projection. Each type the notices surface can receive maps to its
 * own title here, so a stale-version refusal, an out-of-scope refusal and a
 * half-translated publish look DIFFERENT on screen — the post-act
 * bilingual-missing state is one of them, and collapsing it into a generic
 * "refused" panel would teach the author that publishing is forbidden rather
 * than that a translation is missing.
 *
 * Matching is on the full type URI, exact. No substring of `title` or `detail` is
 * ever inspected: server prose can be reworded, a type cannot.
 *
 * TOTALITY IS ASSERTED, NOT ASSUMED. test/guard/problem-presentation.test.ts reads
 * every `notice-*` type out of the contract's enum and requires a specific title
 * here for each; the generic fallback (the server's own title) is for types this
 * surface does not expect, and it is still rendered rather than swallowed.
 */

import { MESSAGES } from '../i18n/messages.ts';
import type { LocalizedText } from '../i18n/locale.ts';
import type { Problem } from './types.ts';

const TITLES: Record<string, LocalizedText> = {
  // The states every screen shares (UI-019).
  'https://pemo.local/problems/session-expired': MESSAGES.state.sessionExpiredTitle,
  'https://pemo.local/problems/invalid-credential': MESSAGES.state.sessionExpiredTitle,
  'https://pemo.local/problems/insufficient-scope': MESSAGES.state.deniedTitle,
  'https://pemo.local/problems/restricted-projection': MESSAGES.state.restrictedTitle,
  'https://pemo.local/problems/scope-not-found': MESSAGES.state.notFoundTitle,
  'https://pemo.local/problems/record-not-found': MESSAGES.state.notFoundTitle,
  'https://pemo.local/problems/internal-error': MESSAGES.state.errorTitle,
  // The notices refusals (ADR-019, GEN-040/042/047).
  'https://pemo.local/problems/notice-stale-version': MESSAGES.s5.refusalStaleVersion,
  'https://pemo.local/problems/notice-out-of-scope': MESSAGES.s5.refusalOutOfScope,
  'https://pemo.local/problems/notice-wrong-state': MESSAGES.s5.refusalWrongState,
  'https://pemo.local/problems/notice-incomplete-translation': MESSAGES.s5.refusalIncompleteTranslation,
  'https://pemo.local/problems/notice-empty-audience': MESSAGES.s5.refusalEmptyAudience,
  'https://pemo.local/problems/notice-schedule-inverted': MESSAGES.s5.refusalScheduleInverted,
  'https://pemo.local/problems/notice-approval-required': MESSAGES.s5.refusalApprovalRequired,
  'https://pemo.local/problems/notice-retargeting-forbidden': MESSAGES.s5.refusalRetargetingForbidden,
  'https://pemo.local/problems/notice-not-found': MESSAGES.s5.refusalNotFound,
  'https://pemo.local/problems/idempotency-key-conflict': MESSAGES.s5.refusalKeyConflict,
};

export interface ProblemPresentation {
  /** The last path segment of the type URI — the discriminator the screen carries. */
  readonly kind: string;
  /** Client-authored title for a known type; null means render the server's own. */
  readonly title: LocalizedText | null;
}

export function presentProblem(problem: Pick<Problem, 'type'>): ProblemPresentation {
  const kind = problem.type.slice(problem.type.lastIndexOf('/') + 1) || 'unknown';
  return { kind, title: TITLES[problem.type] ?? null };
}

/** The types this module presents specifically — for the totality guard. */
export const PRESENTED_TYPES: readonly string[] = Object.keys(TITLES);
