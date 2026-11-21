/**
 * Pop-up host for the Payments chain (Charge, Payment, Refund), the Households /
 * Residents, Facility, Help desk contact and Admin user / group details. The list stays mounted underneath (its filters survive opening and
 * closing); the detail route renders in ONE pop-up. A link inside the pop-up (charge ->
 * household -> resident, payment -> charge ...) changes the route, so the pop-up's
 * content swaps in place and never stacks. The pop-up remembers one previous view and
 * offers a back arrow to it (two entries at most). Detail URLs keep working: a deep link
 * renders the list with the pop-up open.
 *
 * @version 0.1.1
 * @changelog
 *   0.1.1 (2026-11-20) Chain constants moved to chain-screens.ts (re-exported here); the list and the detail each sit in their own Suspense (its fallback is the same busy marker the app uses), since screens load on demand.
 *   0.1.0 (2026-11-19) New. Replaces the five full-page detail routes.
 */

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '../components/Dialog.tsx';
import { BackLink } from '../components/FinanceBits.tsx';
import { DetailChromeCtx, type DetailHead } from '../components/DetailChrome.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import type { Locale } from '../i18n/locale.ts';
import type { ScreenId } from '../data/states.ts';
import { CHAIN_LIST_OF, CHAIN_LIST_STATE, isChainScreen } from './chain-screens.ts';

export { CHAIN_LIST_OF, CHAIN_LIST_STATE, isChainScreen };

/** The route fields that name one detail view. */
export type ChainView = {
  screen: ScreenId;
  state: string;
  charge?: string | undefined; payment?: string | undefined; refund?: string | undefined; household?: string | undefined; resident?: string | undefined;
  facility?: string | undefined; contact?: string | undefined; user?: string | undefined; group?: string | undefined;
};

export function ChainHost({
  view, locale, renderScreen, titleOf, onGo,
}: {
  view: ChainView;
  locale: Locale;
  /** Render one screen body (the same body the app shows for that route). */
  renderScreen: (screen: ScreenId, state: string) => ReactNode;
  titleOf: (screen: ScreenId) => string;
  onGo: (view: Partial<ChainView> & { screen: ScreenId }) => void;
}) {
  const isDetail = view.screen in CHAIN_LIST_OF;
  const [origin, setOrigin] = useState<ScreenId>(CHAIN_LIST_OF[view.screen] ?? view.screen);
  if (!isDetail && origin !== view.screen) setOrigin(view.screen);
  const listScreen = isDetail ? origin : view.screen;

  const [head, setHead] = useState<DetailHead | null>(null);
  const [prev, setPrev] = useState<ChainView | null>(null);
  const last = useRef<{ key: string; view: ChainView; detail: boolean } | null>(null);
  const key = JSON.stringify(view);
  useEffect(() => {
    const before = last.current;
    if (!isDetail) setPrev(null);
    else if (before && before.key !== key && before.detail) setPrev(before.view);
    last.current = { key, view, detail: isDetail };
  }, [key, view, isDetail]);

  // A link inside the pop-up swaps its content, which unmounts the focused link; keep focus (and Escape) in the pop-up.
  useEffect(() => {
    if (!isDetail) return;
    const panel = document.querySelector<HTMLElement>('[data-testid="chain-dialog"]');
    if (!panel) return;
    if (!panel.contains(document.activeElement)) panel.focus();
    panel.scrollTop = 0;
  }, [key, isDetail]);

  const close = () => onGo({
    screen: listScreen, state: CHAIN_LIST_STATE[listScreen] ?? 'default',
    charge: undefined, payment: undefined, refund: undefined, household: undefined, resident: undefined,
    facility: undefined, contact: undefined, user: undefined, group: undefined,
  });

  return (
    <>
      <Suspense fallback={<div className="pemo-screen-loading" aria-busy="true" data-testid="screen-loading" />}>{renderScreen(listScreen, isDetail ? (CHAIN_LIST_STATE[listScreen] ?? 'default') : view.state)}</Suspense>
      {isDetail ? (
        <Dialog title={head?.title ?? titleOf(view.screen)} info={head?.info} locale={locale} onClose={close} wide testId="chain-dialog">
          {prev ? (
            <BackLink
              href="#"
              label={MESSAGES.ui.back}
              locale={locale}
              testId="chain-dialog-back"
              always
              onBack={() => {
                const to = prev;
                setPrev(null);
                onGo(to);
              }}
            />
          ) : null}
          <DetailChromeCtx.Provider value={setHead}><Suspense fallback={<div className="pemo-screen-loading" aria-busy="true" data-testid="screen-loading" />}>{renderScreen(view.screen, view.state)}</Suspense></DetailChromeCtx.Provider>
        </Dialog>
      ) : null}
    </>
  );
}
