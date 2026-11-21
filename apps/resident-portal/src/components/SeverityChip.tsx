/**
 * The seven-tone severity chip — the primitive that realises PID section 4.
 *
 * SEVEN tones, read from severity.json (via severity-tokens.g.ts), not the
 * export's six: the export collapses `offline` and `unknown` and puts all six
 * strongs on one lightness plane. §3.1: severity is never carried by colour
 * alone, so every chip shows an ICON and a visible LABEL, in the active locale.
 *
 * B13 recurs here in its original form — glyph versus named icon for the seven
 * shapes. severity.json names icons (`check-circle`, `cloud-off`, …); rendering
 * those would add an icon dependency for seven marks. This uses text glyphs, as
 * the management web did, so the chip carries icon + label with no dependency.
 * The glyph is aria-hidden; the label is the accessible name. The glyph-vs-icon
 * choice stays open for the Product Owner (recorded in DIVERGENCES.md).
 *
 * This primitive renders NO data in this PID — there is no severity to show — so
 * it is not placed in a shell pane. It is delivered for the data PID and covered
 * by test/tokens/severity-chip.test.ts, which renders all seven server-side.
 */

import { SEVERITY, type SeverityLevel } from '../theme/severity-tokens.g.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { SEVERITY_GLYPH } from './severity-glyphs.ts';

export function SeverityChip({ level, locale }: { level: SeverityLevel; locale: Locale }) {
  const token = SEVERITY[level];
  return (
    <span
      className={`pemo-severity pemo-severity--${level}`}
      data-testid="severity-chip"
      data-level={level}
    >
      <span className="pemo-severity__glyph" aria-hidden="true">{SEVERITY_GLYPH[level]}</span>
      <span className="pemo-severity__label">{t(token.label, locale)}</span>
    </span>
  );
}
