/**
 * The in-page tab bar for a subsystem.
 *
 * Each subsystem shows its short CODE and title above its tab row (the export's
 * `GROUPS`). The title is an h1 in the constrained page-title style. Tabs are
 * navigable routes; the pane each opens is an empty state, not data (this PID
 * renders none). A tab that the export shows with a count badge reserves the
 * badge slot — the count itself is data and is not rendered (B2).
 */

import { t, type Locale } from '../i18n/locale.ts';
import { MESSAGES } from '../i18n/messages.ts';
import type { GroupDef } from '../data/services.ts';
import { Badge } from '../components/Badge.tsx';

export function TabBar({
  group, activeTab, locale, onSelect,
}: {
  group: GroupDef;
  activeTab: string;
  locale: Locale;
  onSelect: (tabId: string) => void;
}) {
  const titleId = `subsystem-${group.id}`;
  return (
    <div className="pemo-subsystem" data-testid="subsystem" data-group={group.id}>
      <div className="pemo-subsystem__head">
        <span className="pemo-subsystem__code pemo-mono" data-testid="subsystem-code">{t(MESSAGES.groupCodes[group.id], locale)}</span>
        <h1 id={titleId} className="pemo-page-title pemo-subsystem__title">{t(group.title, locale)}</h1>
      </div>
      <div className="pemo-tabs" role="tablist" aria-labelledby={titleId}>
        {group.tabs.map((tab) => {
          const on = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`pemo-tab${on ? ' pemo-tab--active' : ''}`}
              data-testid="subsystem-tab"
              data-tab={tab.id}
              onClick={() => onSelect(tab.id)}
            >
              <span className="pemo-tab__label">{t(tab.label, locale)}</span>
              {tab.badge ? <Badge present /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
