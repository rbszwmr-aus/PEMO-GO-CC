/**
 * Line tabs inside a pop-up (L4) that split one detail into panes. Only the active
 * pane is mounted; the tab strip keeps the pop-up's own test-id root.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New. Used by the Charge, Household and Resident pop-ups (L4 tabs; the pane resets when the record changes).
 */

import { useState, type ReactNode } from 'react';
import { LineTabs, type TabItem } from './Tabs.tsx';
import type { Locale } from '../i18n/locale.ts';

export type Pane<Id extends string> = TabItem<Id> & { node: ReactNode };

export function DetailPanes<Id extends string>({
  panes, locale, root, ariaLabel,
}: {
  panes: Pane<Id>[];
  locale: Locale;
  root: string;
  ariaLabel: string;
}) {
  const [active, setActive] = useState<Id>(panes[0]!.id);
  const shown = panes.find((p) => p.id === active) ?? panes[0]!;
  return (
    <>
      <LineTabs items={panes.map(({ node: _n, ...tab }) => tab)} active={shown.id} locale={locale} onChange={setActive} ariaLabel={ariaLabel} root={root} />
      <div className="pemo-detail-pane">{shown.node}</div>
    </>
  );
}
