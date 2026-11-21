/**
 * Facet counts — WORLD-SCOPED, rendered from the response, NEVER recomputed.
 *
 * `facets.scope` is `world`: the counts describe the caller's full accessible
 * facility set, not the returned page, so they survive a query that returns an
 * empty page (explore/empty.json: results [], counts 3/3/2/2/3 — the oracle).
 * A component that derives them from `results` shows all zeros there and looks
 * correct on every other fixture. So each count comes from `facet.count`.
 *
 * The `basis` prose is NOT read for display: it is currently page-scoped and
 * false on the empty fixture (UI-031 Finding A, filed for the contract track).
 * The machine-readable `scope` is the truth; the prose is not rendered.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import type { SearchResponse, Category } from '../data/types.ts';

const CAT = MESSAGES.booking.category;
const FILT = MESSAGES.booking.explore.filter;

export function FacetCounts({ search, locale }: { search: SearchResponse; locale: Locale }) {
  const facets = search.facets;
  // The count is `c.count` — the WORLD-scoped figure the server sent. It is NOT
  // recomputed from `search.results`: doing so would show all zeros on the
  // empty-results fixture (test 7's oracle) while looking correct everywhere else.
  return (
    <aside className="pemo-facets" data-testid="facets" data-scope={facets.scope}>
      <section>
        <h2 className="pemo-facets__heading">{t(MESSAGES.booking.explore.categoriesHeading, locale)}</h2>
        <ul className="pemo-facets__list">
          {facets.categories.map((c) => (
            <li key={c.key} className="pemo-facet" data-testid="facet-category" data-key={c.key}>
              <span className="pemo-facet__label">
                {c.key in CAT ? t(CAT[c.key as Category], locale) : c.key}
              </span>
              <span className="pemo-facet__count" data-testid="facet-count">{c.count}</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="pemo-facets__heading">{t(MESSAGES.booking.explore.filtersHeading, locale)}</h2>
        <ul className="pemo-facets__list">
          {facets.filters.map((f) => (
            <li key={f.key} className="pemo-facet" data-testid="facet-filter" data-key={f.key}>
              <span className="pemo-facet__label">
                {f.key in FILT ? t(FILT[f.key as keyof typeof FILT], locale) : f.key}
              </span>
              <span className="pemo-facet__count" data-testid="facet-count">{f.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
