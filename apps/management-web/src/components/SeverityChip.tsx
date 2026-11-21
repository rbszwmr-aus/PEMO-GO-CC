/**
 * A severity, rendered as a SET.
 *
 * Design system section 19: a strong, surface and border are used together;
 * mixing a strong from one level with a surface from another is a one-off colour
 * by another route. Section 3.1: severity is never encoded by colour alone, so
 * every chip carries a glyph AND a visible text label.
 *
 * The values come from severity-tokens.g.ts, generated from severity.json.
 */

import { SEVERITY, type SeverityLevel } from '../theme/severity-tokens.g.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { toneForLabel, type ChipTone } from './tone.ts';

/** Text glyphs, not an icon font: a dependency for seven shapes is not worth it. */
const GLYPH: Record<SeverityLevel, string> = {
  normal: '✓',
  information: 'i',
  advisory: '!',
  warning: '▲',
  critical: '◆',
  offline: '⊘',
  unknown: '?',
};

export function SeverityChip({ level, locale }: { level: SeverityLevel; locale: Locale }) {
  const token = SEVERITY[level];
  return (
    <span
      className="pemo-chip"
      data-severity={level}
      style={{
        color: `var(--pemo-sev-${level}-strong)`,
        background: `var(--pemo-sev-${level}-surface)`,
      }}
      title={token.meaning}
    >
      <span className="pemo-chip__glyph" aria-hidden="true">{GLYPH[level]}</span>
      <span>{t(token.label, locale)}</span>
    </span>
  );
}

/**
 * A passive tag for a non-severity state. Tone comes from the label (see tone.ts)
 * unless the caller passes one; a label with no judgement stays neutral.
 */
export function PlainChip({ children, testId, tone }: { children: React.ReactNode; testId?: string; tone?: ChipTone }) {
  const resolved = tone ?? (typeof children === 'string' ? toneForLabel(children) : 'neutral');
  return <span className="pemo-chip pemo-chip--plain" data-tone={resolved} data-testid={testId}>{children}</span>;
}
