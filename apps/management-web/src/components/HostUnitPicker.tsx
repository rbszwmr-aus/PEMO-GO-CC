/**
 * Pick the host flat from the location tree: a search box, a block filter and a
 * short list of matching flats, each shown as "Block A · 12/F · Flat A1". The id
 * goes with the choice; it is never shown. Lives inside a write form, so every
 * control is a form field.
 */
import { useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import type { ScopeTreeNode } from '../data/types.ts';
import { searchUnits, unitChoices } from '../data/unit-choices.ts';
import type { HostRef } from '../data/front-counter-client.ts';
import { Icon } from './Icon.tsx';

export function HostUnitPicker({
  nodes,
  value,
  onChange,
  locale,
}: {
  nodes: readonly ScopeTreeNode[];
  value: HostRef | null;
  onChange: (next: HostRef | null) => void;
  locale: Locale;
}) {
  const M = MESSAGES.counter;
  const choices = useMemo(() => unitChoices(nodes, locale), [nodes, locale]);
  const buildings = useMemo(() => [...new Set(choices.map((c) => c.building).filter(Boolean))], [choices]);
  const [query, setQuery] = useState('');
  const [building, setBuilding] = useState<string | null>(null);
  const results = useMemo(() => searchUnits(choices, query, building), [choices, query, building]);

  if (value) {
    return (
      <div className="pemo-hostpick pemo-hostpick--chosen" data-testid="host-chosen">
        <span className="pemo-hostpick__label" data-testid="host-chosen-label">{value.unit_label}</span>
        <button
          type="button"
          className="pemo-button"
          data-form-field="true"
          data-testid="host-change"
          onClick={() => { onChange(null); setQuery(''); }}
        >
          {t(M.hostChange, locale)}
        </button>
      </div>
    );
  }
  return (
    <div className="pemo-hostpick" data-testid="host-picker">
      <label className="pemo-hostpick__search">
        <Icon name="Search" size={16} />
        <input
          type="search"
          autoComplete="off"
          value={query}
          placeholder={t(M.hostSearch, locale)}
          aria-label={t(M.hostSearch, locale)}
          data-form-field="true"
          data-testid="host-search"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="pemo-hostpick__blocks" role="group" aria-label={t(M.fieldHost, locale)}>
        {[null, ...buildings].map((b) => (
          <button
            key={b ?? 'all'}
            type="button"
            className="pemo-hostpick__block"
            aria-pressed={building === b}
            data-form-field="true"
            data-testid="host-block"
            onClick={() => setBuilding(b)}
          >
            {b ?? t(M.hostAllBlocks, locale)}
          </button>
        ))}
      </div>
      {results.length === 0 ? (
        <p className="pemo-meta" data-testid="host-none">{t(M.hostNoMatch, locale)}</p>
      ) : (
        <ul className="pemo-hostpick__list" data-testid="host-results">
          {results.map((c) => (
            <li key={c.unit_id}>
              <button
                type="button"
                className="pemo-hostpick__option"
                data-form-field="true"
                data-testid="host-option"
                onClick={() => onChange({ unit_id: c.unit_id, unit_label: c.unit_label })}
              >
                {c.unit_label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
