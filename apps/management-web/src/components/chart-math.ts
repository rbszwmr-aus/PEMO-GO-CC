/**
 * Chart axis maths, kept apart from the SVG component so node tests can import it.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New: niceMax.
 */

/** Round the top of the axis up to 4, 6, 8, 10, 20, 40, 60 ... (even, so the middle grid line is whole too) so the three grid lines are whole numbers. */
export function niceMax(max: number): number {
  if (max <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 4, 6, 8, 10]) if (step * mag >= max) return step * mag;
  return 10 * mag;
}
