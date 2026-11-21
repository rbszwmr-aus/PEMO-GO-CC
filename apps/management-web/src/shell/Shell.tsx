/**
 * AppShell: Claude Design management portal chrome.
 * Full nav IA; s1–s5 + Residents + Administration Users/Groups/Roles/Email/Audit wired;
 * other items are Coming Soon stubs. Car Park is a thin ParkCore connector.
 *
 * Two rails, independent collapse. The primary nav chevron lives on the
 * brand row (ParkCore pattern): expanded it shares the title line; collapsed
 * it sits under the mark. The properties rail still uses a top-cap chevron.
 * States persist independently on the URL (`nav=collapsed`, `scopeRail=collapsed`)
 * — not localStorage; the credential-storage guard forbids those APIs.
 * Desktop staff shell only: there is no phone drawer to share this control.
 * The properties rail mounts only on place-scoped screens; otherwise the
 * canvas takes the column.
 */

import { PageInfo } from '../components/FinanceBits.tsx';
import { useMemo, useState, type ReactNode } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { bcp47, pick, t, type Locale } from '../i18n/locale.ts';
import type { ScreenId } from '../data/states.ts';
import {
  NAV_IA,
  NAV_TO_SCREEN,
  SCREEN_TO_NAV,
  findNavLabel,
  type NavItemId,
} from '../data/nav-ia.ts';
import { DevStateToolbar } from './DevStateToolbar.tsx';
import type { ScopeRef, ScopeTreeNode, ScopeTreeResponse } from '../data/types.ts';
import type { NodeKey } from '../screens/tree-collapse.ts';
import { AccountMenu } from './AccountMenu.tsx';
import { Icon, SpecIcon, ICON_SIZE, type IconSpec } from '../components/Icon.tsx';
import { LanguageTab } from './LanguageTab.tsx';
import { ScopeRail } from './ScopeRail.tsx';
import { focusKeyOf } from './scope-focus.ts';
import { isPlaceScopedRail } from './place-scoped.ts';

/** VALUE_MAPS oracle: keyof typeof MESSAGES.nav — labels live on NAV_IA. */

function NavIcon({ icon, iconImg, lucide }: { icon: string; iconImg?: string | undefined; lucide?: IconSpec | undefined }) {
  if (!iconImg && lucide) {
    return (
      <span className="pemo-nav__icon pemo-nav__icon--svg" aria-hidden="true" data-nav-icon={lucide}>
        <SpecIcon spec={lucide} size={ICON_SIZE.nav} />
      </span>
    );
  }
  if (iconImg) {
    return (
      <span className="pemo-nav__icon pemo-nav__icon--img" aria-hidden="true">
        <span className="pemo-nav__icon-mask" style={{ ['--pemo-icon-url' as string]: `url(${iconImg})` }} />
      </span>
    );
  }
  return (
    <span className="pemo-nav__icon" aria-hidden="true">
      {icon}
    </span>
  );
}

const TODAY_TZ = 'Asia/Hong_Kong';

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TODAY_TZ }).format(new Date());
}

/** "Wed, 18 November" (en) or the locale's own short weekday + date (zh-Hant), Hong Kong time. */
function todayLabel(locale: Locale): string {
  const now = new Date();
  if (locale !== 'en') {
    return new Intl.DateTimeFormat(bcp47(locale), { timeZone: TODAY_TZ, weekday: 'short', month: 'long', day: 'numeric' }).format(now);
  }
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TODAY_TZ, weekday: 'short', day: 'numeric', month: 'long' }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('weekday')}, ${pick('day')} ${pick('month')}`;
}

function estateSummary(scope: ScopeTreeResponse | null, locale: Locale): { title: string; meta: string } {
  if (!scope) {
    return {
      title: t(MESSAGES.shell.scopeFallbackTitle, locale),
      meta: t(MESSAGES.shell.scopeFallbackMeta, locale),
    };
  }
  const grantEstate = scope.grants.find((g) => g.kind === 'estate');
  const nodeEstate = scope.nodes.find((n) => n.node.kind === 'estate');
  let title: string;
  if (grantEstate) {
    title = grantEstate.label ? t(grantEstate.label, locale) : grantEstate.id;
  } else if (nodeEstate) {
    title = t(nodeEstate.label, locale);
  } else {
    title = t(MESSAGES.shell.scopeFallbackTitle, locale);
  }

  const buildings = scope.nodes.filter((n) => n.node.kind === 'building').length;
  const units = scope.nodes.filter((n) => n.node.kind === 'unit').length;
  let meta: string;
  if (buildings || units) {
    const parts: string[] = [];
    if (buildings) parts.push(pick(locale, { en: `${buildings} blocks`, 'zh-Hant': `${buildings} 座`, 'zh-Hans': `${buildings} 栋` }));
    if (units) parts.push(pick(locale, { en: `${units} units`, 'zh-Hant': `${units} 單位`, 'zh-Hans': `${units} 个单元` }));
    meta = parts.join(' · ');
  } else {
    meta = t(MESSAGES.shell.scopeGrantedMeta, locale);
  }
  return { title: String(title), meta };
}

/**
 * Breadcrumbs (4S guide section 4): ancestors are links, the current page is
 * marked with aria-current and is NOT a navigation target. "All granted
 * scopes" is a link only when a place is focused (otherwise it would point at
 * where you already are).
 */
function ScopePathCrumb({
  path,
  locale,
  pageTitle,
  onPick,
  onClear,
}: {
  path: ScopeRef[];
  locale: Locale;
  pageTitle: string;
  onPick: (key: NodeKey) => void;
  onClear: () => void;
}) {
  const empty = path.length === 0;
  return (
    <nav
      className="pemo-header__crumb"
      aria-label={t(MESSAGES.shell.breadcrumb, locale)}
      data-testid="scope-path-crumb"
      {...(empty ? { 'data-empty': 'true' } : {})}
    >
      <ol className="pemo-crumbs">
        <li>
          {empty ? (
            <span className="pemo-header__crumbMuted">{t(MESSAGES.shell.scopeAll, locale)}</span>
          ) : (
            <button type="button" className="pemo-crumb-link" data-testid="crumb-all" onClick={onClear}>
              {t(MESSAGES.shell.scopeAll, locale)}
            </button>
          )}
        </li>
        {path.map((n) => {
          const label = n.label ? t(n.label, locale) : n.id;
          return (
            <li key={`${n.kind}:${n.id}`}>
              <Icon name="ChevronRight" size={13} strokeWidth={2} className="pemo-header__crumbSep" />
              <button
                type="button"
                className="pemo-crumb-link"
                data-scope-kind={n.kind}
                onClick={() => onPick(focusKeyOf(n))}
              >
                {label}
              </button>
            </li>
          );
        })}
        <li>
          <Icon name="ChevronRight" size={13} strokeWidth={2} className="pemo-header__crumbSep" />
          <span className="pemo-header__crumbCurrent" aria-current="page">{pageTitle}</span>
        </li>
      </ol>
    </nav>
  );
}

export function Shell({
  screen,
  navId,
  state,
  locale,
  scope,
  railNodes,
  railStatus = 'ready',
  railLive = false,
  onRailRetry,
  focusKey,
  focusPath,
  pageTitle,
  onNavigate,
  onNav,
  onPickFocus,
  onClearFocus,
  navCollapsed,
  scopeCollapsed,
  onToggleNav,
  onToggleScope,
  onLogOut,
  hiddenNav,
  children,
}: {
  screen: ScreenId | 'stub';
  navId: string;
  state: string;
  locale: Locale;
  scope: ScopeTreeResponse | null;
  railNodes: readonly ScopeTreeNode[];
  /** Live mode only: whether the tree behind `railNodes` is still loading or failed (default: ready). */
  railStatus?: 'ready' | 'loading' | 'error';
  railLive?: boolean;
  onRailRetry?: () => void;
  focusKey: NodeKey | null;
  focusPath: ScopeRef[];
  pageTitle: string;
  onNavigate: (next: { screen?: ScreenId | undefined; state?: string | undefined; locale?: Locale | undefined }) => void;
  onNav: (navId: NavItemId) => void;
  onPickFocus: (key: NodeKey) => void;
  onClearFocus: () => void;
  navCollapsed: boolean;
  scopeCollapsed: boolean;
  onToggleNav: () => void;
  onToggleScope: () => void;
  onLogOut: () => void;
  /** Nav items the API refuses this person; left out, not greyed. */
  hiddenNav?: ReadonlySet<NavItemId>;
  children: ReactNode;
}) {
  const activeNav = useMemo(() => {
    if (screen !== 'stub' && SCREEN_TO_NAV[screen]) return SCREEN_TO_NAV[screen] as string;
    return navId;
  }, [screen, navId]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const g of NAV_IA) {
      for (const it of g.items) {
        if (it.children?.some((c) => c.id === activeNav) || it.id === activeNav) {
          init[it.id] = true;
        }
      }
    }
    return init;
  });

  const navOpen = !navCollapsed;
  const scopeOpen = !scopeCollapsed;
  const showScopeRail = isPlaceScopedRail(screen, navId);
  const scopeCard = estateSummary(scope, locale);
  const navCollapseLabel = navOpen ? t(MESSAGES.shell.navCollapse, locale) : t(MESSAGES.shell.navExpand, locale);

  const scopeOptions = railNodes
    .filter((n) => n.node.kind === 'building' || (focusKey !== null && focusKeyOf(n.node) === focusKey && n.node.kind !== 'estate'))
    .map((n) => ({ key: focusKeyOf(n.node), label: t(n.label, locale) }));
  const focusIsEstate = focusKey !== null && railNodes.some((n) => n.node.kind === 'estate' && focusKeyOf(n.node) === focusKey);
  const scopeSelectValue = focusKey === null || focusIsEstate ? '' : focusKey;

  return (
    <div
      className="pemo-shell"
      data-nav-collapsed={navOpen ? 'false' : 'true'}
      data-scope-collapsed={scopeOpen ? 'false' : 'true'}
      data-scope-hidden={showScopeRail ? 'false' : 'true'}
    >
      <nav
        id="pemo-main-nav"
        className="pemo-sidebar"
        aria-label={t(MESSAGES.shell.navSectionLabel, locale)}
        data-scroll="dark"
        data-collapsed={navOpen ? 'false' : 'true'}
        data-testid="nav-rail"
      >
        <div className="pemo-sidebar__brandRow">
          <div className="pemo-sidebar__mark" aria-hidden="true" />
          {navOpen ? (
            <div className="pemo-sidebar__brandText">
              <div className="pemo-sidebar__brandName">{t(MESSAGES.shell.brandName, locale)}</div>
              <div className="pemo-sidebar__brandSub">{t(MESSAGES.shell.brandSub, locale)}</div>
            </div>
          ) : null}
          <button
            type="button"
            className="pemo-rail-toggle pemo-sidebar__toggle"
            data-testid="nav-rail-toggle"
            aria-expanded={navOpen}
            aria-controls="pemo-main-nav"
            aria-label={navCollapseLabel}
            title={navCollapseLabel}
            onClick={onToggleNav}
          >
            <Icon name={navOpen ? 'ChevronLeft' : 'ChevronRight'} size={17} strokeWidth={2} />
            <span className="pemo-visually-hidden">{navCollapseLabel}</span>
          </button>
        </div>

        {navOpen ? (
          <div className="pemo-sidebar__scope" data-testid="scope-card">
            <div className="pemo-sidebar__scopeLabel">{t(MESSAGES.shell.scopeLabel, locale)}</div>
            <select
              className="pemo-sidebar__scopeSelect"
              data-testid="scope-select"
              aria-label={t(MESSAGES.shell.scopeLabel, locale)}
              title={scopeCard.meta}
              value={scopeSelectValue}
              onChange={(e) => (e.target.value ? onPickFocus(e.target.value) : onClearFocus())}
            >
              <option value="">{scopeCard.title}</option>
              {scopeOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <div className="pemo-sidebar__scopeMeta">{scopeCard.meta}</div>
          </div>
        ) : showScopeRail ? (
          <button
            type="button"
            className="pemo-sidebar__scopeIcon"
            data-testid="scope-card-icon"
            title={t(MESSAGES.shell.scopeLabel, locale)}
            onClick={onToggleScope}
          >
            <Icon name="Building2" size={17} strokeWidth={2} />
            <span className="pemo-visually-hidden">{t(MESSAGES.shell.scopeLabel, locale)}</span>
          </button>
        ) : null}

        <div className="pemo-sidebar__nav" data-scroll="dark">
          {NAV_IA.map((group) => (
            <div key={group.id} className="pemo-navGroup">
              {navOpen ? <div className="pemo-navGroup__label">{t(group.label, locale)}</div> : null}
              {group.items.filter((item) => !hiddenNav?.has(item.id)).map((item) => {
                const isActive = item.id === activeNav;
                const hasKids = Boolean(item.children?.length);
                const open = expanded[item.id] ?? false;
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      className={`pemo-nav__item${isActive ? ' pemo-nav__item--active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      data-testid="nav-item"
                      data-screen={NAV_TO_SCREEN[item.id] ?? item.id}
                      data-nav={item.id}
                      title={t(item.label, locale)}
                      onClick={() => onNav(item.id)}
                    >
                      <NavIcon icon={item.icon} iconImg={item.iconImg} lucide={item.lucide} />
                      {navOpen ? <span className="pemo-nav__label">{t(item.label, locale)}</span> : (
                        <span className="pemo-visually-hidden">{t(item.label, locale)}</span>
                      )}
                      {navOpen && hasKids ? (
                        <span
                          className="pemo-nav__chevron"
                          role="presentation"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded((prev) => ({ ...prev, [item.id]: !open }));
                          }}
                        >
                          <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={12} strokeWidth={2} />
                        </span>
                      ) : null}
                    </button>
                    {navOpen && hasKids && open
                      ? item.children!.filter((kid) => !hiddenNav?.has(kid.id)).map((kid) => {
                          const kidActive = kid.id === activeNav;
                          return (
                            <button
                              key={kid.id}
                              type="button"
                              className={`pemo-nav__item pemo-nav__item--child${kidActive ? ' pemo-nav__item--active' : ''}`}
                              aria-current={kidActive ? 'page' : undefined}
                              data-testid="nav-item"
                              data-nav={kid.id}
                              title={t(kid.label, locale)}
                              onClick={() => onNav(kid.id)}
                            >
                              <NavIcon icon={kid.icon} iconImg={kid.iconImg} lucide={kid.lucide} />
                              <span className="pemo-nav__label">{t(kid.label, locale)}</span>
                            </button>
                          );
                        })
                      : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </nav>

      <header className="pemo-header">
        <ScopePathCrumb
          path={focusPath}
          locale={locale}
          pageTitle={pageTitle}
          onPick={onPickFocus}
          onClear={onClearFocus}
        />
        <time className="pemo-header__date" dateTime={todayIso()}>{todayLabel(locale)}</time>
        <div className="pemo-header__account">
          <LanguageTab locale={locale} onNavigate={onNavigate} />
          <AccountMenu locale={locale} onLogOut={onLogOut} />
        </div>
      </header>

      {showScopeRail ? (
        <ScopeRail
          locale={locale}
          open={scopeOpen}
          onToggle={onToggleScope}
          nodes={railNodes}
          status={railStatus}
          live={railLive}
          {...(onRailRetry ? { onRetry: onRailRetry } : {})}
          focusKey={focusKey}
          onPick={onPickFocus}
          onClear={onClearFocus}
        />
      ) : null}

      <div className="pemo-content">
        <main className="pemo-main" id="main">
          <div className="pemo-pagehead">
            <div className="pemo-pagehead__title">
              <h1 className="pemo-page-title" data-testid="page-title">{pageTitle}</h1>
              <span className="pemo-pagehead__info" id="pemo-page-info" data-testid="page-info"><PageInfo /></span>
            </div>
            <div className="pemo-pagehead__actions" id="pemo-page-actions" data-testid="page-actions" />
          </div>

          {__PEMO_DEV_TOOLBAR__ && screen !== 'stub' ? (
            <div className="pemo-toolbar" data-testid="dev-state-toolbar">
              <DevStateToolbar screen={screen} state={state} onNavigate={onNavigate} />
            </div>
          ) : null}

          {children}

        </main>
      </div>
    </div>
  );
}

export { findNavLabel };
