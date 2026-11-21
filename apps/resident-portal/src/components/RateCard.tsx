/** The rate card — one row per RateCardRow, with its applicability as a plain
 *  sentence (09: rate rules as plain sentences). Prices are server data. */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { formatMoney } from '../format/money.ts';
import type { RateCardRow } from '../data/types.ts';

export function RateCard({ rates, locale }: { rates: RateCardRow[]; locale: Locale }) {
  return (
    <table className="pemo-rates" data-testid="rates">
      <tbody>
        {rates.map((r, i) => (
          <tr key={i} className="pemo-rate">
            <td className="pemo-rate__label">{t(r.label, locale)}</td>
            <td className="pemo-rate__price pemo-mono">{formatMoney(r.price)}</td>
            <td className="pemo-rate__applies">{t(MESSAGES.booking.facility.appliesTo, locale)}: {t(r.appliesTo, locale)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
