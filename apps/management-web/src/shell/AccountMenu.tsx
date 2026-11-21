import { useEffect, useId, useRef, useState } from 'react';
import { t, type Locale } from '../i18n/locale.ts';
import { MESSAGES } from '../i18n/messages.ts';
import { Icon } from '../components/Icon.tsx';

export function AccountMenu({
  locale,
  onLogOut,
}: {
  locale: Locale;
  onLogOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="pemo-account" data-testid="account-menu" ref={wrapRef}>
      <button
        type="button"
        className="pemo-account__btn"
        data-testid="account-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="pemo-account__avatar" data-testid="account-avatar" aria-hidden="true">
          {t(MESSAGES.account.initials, locale)}
        </span>
        <span className="pemo-account__label">{t(MESSAGES.account.button, locale)}</span>
        <Icon name="ChevronDown" size={17} strokeWidth={2} className="pemo-account__caret" />
      </button>
      {open ? (
        <div
          className="pemo-account__menu"
          id={menuId}
          role="menu"
          data-testid="account-menu-panel"
        >
          <div className="pemo-account__identity">
            <div className="pemo-account__name" data-testid="account-display-name">
              {t(MESSAGES.account.displayName, locale)}
            </div>
            <div className="pemo-account__role" data-testid="account-role">
              {t(MESSAGES.account.roleLine, locale)}
            </div>
          </div>
          <div className="pemo-account__rule" role="separator" />
          <button
            type="button"
            className="pemo-account__logout"
            role="menuitem"
            data-testid="account-logout"
            onClick={() => {
              setOpen(false);
              onLogOut();
            }}
          >
            {t(MESSAGES.account.logOut, locale)}
          </button>
        </div>
      ) : null}
    </div>
  );
}
