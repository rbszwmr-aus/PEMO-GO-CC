/**
 * Money formatting — 09 formatting rules: HKD, no decimals when whole.
 * Intl.NumberFormat('en-HK', {currency:'HKD'}). A value of 0 formats as HK$0,
 * which is DISTINCT from no-policy (null), rendered elsewhere as a sentence.
 */

import type { Money } from '../data/types.ts';

const whole = (n: number) => Number.isInteger(n);

export function formatMoney(m: Money): string {
  return new Intl.NumberFormat('en-HK', {
    style: 'currency',
    currency: m.currency,
    minimumFractionDigits: whole(m.amount) ? 0 : 2,
  }).format(m.amount);
}
