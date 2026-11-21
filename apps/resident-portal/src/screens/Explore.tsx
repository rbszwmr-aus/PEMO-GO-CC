/**
 * Explore — the facility search results and world-scoped facet counts.
 *
 * The results list renders EVERY card the response carries, including the
 * ineligible one (marked with its reason). It must not filter on eligibility —
 * test 5 mutates exactly that and asserts the gym reappears. The facet counts
 * come from FacetCounts, which reads `facet.count` (the world scope), never the
 * returned rows — test 7's oracle is the empty response with non-zero counts.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { FacilityCard } from '../components/FacilityCard.tsx';
import { FacetCounts } from '../components/FacetCounts.tsx';
import type { SearchResponse } from '../data/types.ts';

export function Explore({ search, locale }: { search: SearchResponse; locale: Locale }) {
  const X = MESSAGES.booking.explore;
  const results = search.results; // NOT filtered — the inversion depends on it.
  return (
    <div className="pemo-explore" data-testid="explore">
      <header className="pemo-explore__head">
        <h1 className="pemo-page-title">{t(X.title, locale)}</h1>
        <p className="pemo-explore__count" data-testid="explore-count">
          {search.page.total} {t(X.resultCount, locale)}
        </p>
        <p className="pemo-explore__deferred">{t(X.searchDeferred, locale)}</p>
      </header>

      <div className="pemo-explore__body">
        <FacetCounts search={search} locale={locale} />

        {results.length === 0 ? (
          <section className="pemo-explore__empty" data-testid="explore-empty" role="status">
            <h2>{t(X.noResults, locale)}</h2>
            <p>{t(X.noResultsBody, locale)}</p>
          </section>
        ) : (
          <ul className="pemo-explore__results" data-testid="explore-results">
            {results.map((card) => (
              <li key={card.facilityId}>
                <FacilityCard card={card} locale={locale} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
