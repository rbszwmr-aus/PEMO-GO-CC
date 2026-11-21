/**
 * A row's place in the hierarchy, rendered from STRUCTURE.
 *
 * ADR-007 D5/A1: nine of eleven surfaces span levels, so mixed-level rows are
 * the default response shape and a client must render them without inferring
 * level from a formatted string.
 *
 * The export renders the quarantined event's scope as prose that EMBEDS a device
 * reference — "Source reports site 8829 / node C-903 — no PEMO unit matches" —
 * and that prose reaches the dashboard three screens away. A device reference is
 * permitted to this tier, but one buried in prose is invisible to the boundary
 * scan. It arrives here as a field and is rendered as a field.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import type { ScopePath } from '../data/types.ts';
import { PlainChip } from './SeverityChip.tsx';

/** The same trail as plain text, for tooltips on truncated cells. */
export function scopePathText(scope: ScopePath, locale: Locale): string {
  if (scope.unassigned) return t(MESSAGES.s1.unassignedBadge, locale);
  return [...scope.ancestry, scope.node]
    .filter((n) => n.kind !== 'organization')
    .map((n) => (n.label ? t(n.label, locale) : n.id))
    .join(' › ');
}

/** The place in a few characters: 'B · 3/F B2' for a unit, the place's own name otherwise ('Clubhouse'). The full trail stays in the title. */
export function scopeShortText(scope: ScopePath, locale: Locale): string {
  if (scope.unassigned) return t(MESSAGES.s1.unassignedBadge, locale);
  const label = (n: { id: string; label?: Parameters<typeof t>[0] | undefined }) => (n.label ? t(n.label, locale) : n.id);
  const trim = (s: string) => s.replace(/^(Block|Flat|Tower)\s+/i, '').replace(/[座室]$/, '');
  const building = scope.ancestry.find((n) => n.kind === 'building');
  const floor = scope.ancestry.find((n) => n.kind === 'floor');
  if (scope.node.kind === 'unit') {
    const inner = [floor ? label(floor) : null, trim(label(scope.node))].filter(Boolean).join(' ');
    return [building ? trim(label(building)) : null, inner].filter(Boolean).join(' · ');
  }
  // A place named after the estate ('Wing Fu Clubhouse' in 'Wing Fu Garden') reads as its own name ('Clubhouse').
  const own = label(scope.node);
  const root = scope.ancestry[0];
  if (!root || scope.node.id === root.id) return own;
  const rootName = label(root);
  let n = 0;
  while (n < own.length && n < rootName.length && own[n]!.toLowerCase() === rootName[n]!.toLowerCase()) n += 1;
  const cjk = /[\u3400-\u9fff]/.test(own);
  const cut = cjk ? n : own.lastIndexOf(' ', n - 1) + 1;
  const rest = own.slice(cut).trim();
  return cut > 0 && rest.length > 0 && (!cjk || n >= 2) ? rest : own;
}

export function ScopePathCell({ scope, locale, short = false }: { scope: ScopePath; locale: Locale; short?: boolean }) {
  if (short && !scope.unassigned) {
    return (
      <div data-testid="scope-path" data-node-kind={scope.node.kind} title={scopePathText(scope, locale)}>
        <span className="pemo-ellip">{scopeShortText(scope, locale)}</span>
        <span className="pemo-visually-hidden">{t(MESSAGES.scopeKind[scope.node.kind], locale)}</span>
      </div>
    );
  }
  if (scope.unassigned) {
    return (
      <div data-testid="scope-unassigned">
        <PlainChip testId="unassigned-badge">{t(MESSAGES.s1.unassignedBadge, locale)}</PlainChip>
      </div>
    );
  }

  const trail = [...scope.ancestry, scope.node]
    // The Organization tier is real but is not repeated on every row; the shell
    // states the scope once. Rows show from the estate down.
    .filter((n) => n.kind !== 'organization');

  return (
    <div data-testid="scope-path" data-node-kind={scope.node.kind}>
      <span className="pemo-cell--wrap">
        {trail.map((n, i) => (
          <span key={`${n.kind}:${n.id}`}>
            {i > 0 ? <span aria-hidden="true"> › </span> : null}
            <span data-scope-kind={n.kind}>{n.label ? t(n.label, locale) : n.id}</span>
          </span>
        ))}
      </span>
      <span className="pemo-visually-hidden">
        {t(MESSAGES.scopeKind[scope.node.kind], locale)}
      </span>
    </div>
  );
}
