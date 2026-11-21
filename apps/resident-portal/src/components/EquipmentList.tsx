/** Equipment — included items and priced add-ons. addOnPrice null = not an add-on. */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { formatMoney } from '../format/money.ts';
import type { Equipment } from '../data/types.ts';

export function EquipmentList({ equipment, locale }: { equipment: Equipment[]; locale: Locale }) {
  const F = MESSAGES.booking.facility;
  return (
    <ul className="pemo-equipment" data-testid="equipment">
      {equipment.map((e, i) => (
        <li key={i} className="pemo-equip">
          <span className="pemo-equip__label">{t(e.label, locale)}</span>
          <span className="pemo-equip__tag">
            {e.included
              ? t(F.included, locale)
              : e.addOnPrice
                ? `${t(F.addOn, locale)} · ${formatMoney(e.addOnPrice)}`
                : t(F.addOn, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}
