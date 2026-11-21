/**
 * The shell: persistent sidebar, top bar with no navigation, responsive frame.
 *
 * Breakpoints are 1080/760 (PID section 1, Ruling 6 — the PID is the controlling
 * document; the export's code uses 1120, recorded rejected in DIVERGENCES.md):
 *   desktop >= 1080  rail sidebar, 228px (240px from 1600px, 4S guide)
 *   tablet  760-1079 rail sidebar, 190px
 *   mobile  < 760    sidebar hidden, hamburger opens a drawer with the same list
 *
 * There is no home grid — the portal opens on Explore (the export removed U-01).
 * The dev state toolbar is build-excluded (see DevStateToolbar); nothing here
 * decides that at run time.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import type { ServiceId } from '../data/services.ts';
import type { PaneState } from '../data/states.ts';
import { ServiceSidebar } from './ServiceSidebar.tsx';
import { TopBar } from './TopBar.tsx';
import { DevStateToolbar } from './DevStateToolbar.tsx';

export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

export function breakpointFor(width: number): Breakpoint {
  if (width < 760) return 'mobile';
  if (width < 1080) return 'tablet';
  return 'desktop';
}

function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() =>
    breakpointFor(typeof window === 'undefined' ? 1440 : window.innerWidth),
  );
  useEffect(() => {
    const onResize = () => setBp(breakpointFor(window.innerWidth));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return bp;
}

export interface NavIntent {
  service?: ServiceId;
  tab?: string;
  state?: string;
  locale?: Locale;
  /** Help desk ticket id; null clears it from the URL. */
  ticket?: string | null;
  /** Estate notice id; null clears it from the URL. */
  notice?: string | null;
  /** Visitor id; null clears it from the URL. */
  visitor?: string | null;
  /** Invoice id; null clears it from the URL. */
  invoice?: string | null;
  /** Invoices status filter (unpaid|overdue|partial|paid); null clears it. */
  invoiceFilter?: string | null;
}

export function Shell({
  service, state, stateOptions, locale, onNavigate, children,
}: {
  service: ServiceId;
  state: string;
  stateOptions?: readonly string[];
  locale: Locale;
  onNavigate: (next: NavIntent) => void;
  children: ReactNode;
}) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);

  // A wider viewport closes the drawer, so it can never be stuck open on a rail.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  const selectService = (id: ServiceId) => {
    onNavigate({ service: id });
    setDrawerOpen(false);
  };

  return (
    <div className="pemo-shell" data-breakpoint={bp} data-testid="shell">
      <a className="pemo-skip" href="#pemo-content">{t(MESSAGES.shell.skipToContent, locale)}</a>

      <TopBar
        locale={locale}
        showMenuButton={isMobile}
        onToggleMenu={() => setDrawerOpen((v) => !v)}
        onLocale={(l) => onNavigate({ locale: l })}
        onOpenNotifications={() => selectService('notifications')}
      />

      <div className="pemo-body">
        {!isMobile ? (
          <div className="pemo-rail" data-testid="rail">
            <ServiceSidebar active={service} locale={locale} onSelect={selectService} idPrefix="rail" />
          </div>
        ) : null}

        {isMobile && drawerOpen ? (
          <>
            <div
              className="pemo-drawer-scrim"
              data-testid="drawer-scrim"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <div className="pemo-drawer" role="dialog" aria-modal="true"
                 aria-label={t(MESSAGES.shell.navSectionLabel, locale)} data-testid="drawer">
              <button
                type="button"
                className="pemo-drawer__close"
                aria-label={t(MESSAGES.shell.closeMenu, locale)}
                data-testid="drawer-close"
                onClick={() => setDrawerOpen(false)}
              >
                <span aria-hidden="true">✕</span>
              </button>
              <ServiceSidebar active={service} locale={locale} onSelect={selectService} idPrefix="drawer" />
            </div>
          </>
        ) : null}

        <main
          id="pemo-content"
          ref={contentRef}
          className="pemo-content"
          tabIndex={-1}
          aria-label={t(MESSAGES.shell.contentLabel, locale)}
          data-testid="content"
        >
          {children}
        </main>
      </div>

      {__PEMO_DEV_TOOLBAR__ ? (
        <DevStateToolbar
          service={service}
          state={state}
          stateOptions={stateOptions ?? [state]}
          onNavigate={(next) => onNavigate(next)}
        />
      ) : null}
    </div>
  );
}
