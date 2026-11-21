/**
 * Decorative glyphs for the seven severity levels — one per level, kept in plain
 * TypeScript so a node test can import it without JSX (Node's type stripping does
 * not parse JSX). Meaning is carried by the label, never by these glyphs.
 *
 * B13 recurs here in its original form — glyph versus severity.json's named icon
 * for the seven shapes. Text glyphs avoid an icon dependency, as the management
 * web chose; the choice stays open for the Product Owner (DIVERGENCES.md).
 */

import type { SeverityLevel } from '../theme/severity-tokens.g.ts';

export const SEVERITY_GLYPH: Record<SeverityLevel, string> = {
  normal: '✓',
  information: 'ⓘ',
  advisory: '●',
  warning: '▲',
  critical: '◆',
  offline: '⊘',
  unknown: '?',
};
