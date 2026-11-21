/**
 * The Problem the live clients show when a response cannot be read. It is the corpus's recorded
 * `problems/internal-error.json`, held here as a literal so the live client does not pull the whole corpus chunk
 * (test/guard/unreadable-problem.test.ts fails if the two ever differ).
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-20) New (initial-bundle work, R&T P2-3): live mode no longer loads the corpus for one Problem.
 */

import type { Problem } from './types.ts';

export const UNREADABLE_PROBLEM: Problem = {"type":"https://pemo.local/problems/internal-error","title":"Internal error","status":500,"correlationId":"2b3c4d5e-0000-4000-8000-000000000022","staffMessage":{"en":"Something went wrong on our side. Please try again shortly.","zh-Hant":"我們的系統出現問題，請稍後再試。"},"retryable":true};
