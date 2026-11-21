/**
 * L3 pop-up for create and detail. It may hold its own LineTabs and ButtonTabs
 * (L4), but never another Dialog: a Dialog rendered inside a Dialog throws, so
 * a "confirm" inside one must be an inline step (see `.pemo-dialog__confirm`).
 * Escape and the scrim close it; focus is trapped inside and returned on close.
 *
 * @version 0.2.1
 * @changelog
 *   0.2.1 (2026-11-19) The wide pop-up is back to 760px (info pop-ups are one column); two columns are only for input forms (FormGrid).
 *   0.2.0 (2026-11-19) The pop-up is a size container and the wide pop-up is 880px, so FormGrid and detail lists can use two columns.
 *   0.1.0 (2026-11-19) New; same scrim and panel classes as the Admin > Lists
 *     dialog. Rendered in place (fixed scrim), not portalled, so the fields
 *     stay inside <main> for the page-level label and field rules.
 */

import { createContext, useContext, useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Icon } from './Icon.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { InfoTip } from './FinanceBits.tsx';

const InDialog = createContext(false);

const FOCUSABLE =
  'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';

export function Dialog({
  title,
  locale,
  onClose,
  children,
  wide,
  testId = 'dialog',
  info,
}: {
  title: string;
  info?: string | undefined;
  locale: Locale;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  testId?: string;
}) {
  if (useContext(InDialog)) {
    throw new Error('A pop-up may not open on top of a pop-up; use an inline confirm step.');
  }
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>('input,select,textarea') ?? panel.current;
    first?.focus();
    return () => before?.focus?.();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      closeRef.current();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const nodes = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (nodes.length === 0) return;
    const first = nodes[0] as HTMLElement;
    const last = nodes[nodes.length - 1] as HTMLElement;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <InDialog.Provider value>
      <div
        className="pemo-dialog-scrim"
        data-testid={`${testId}-scrim`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) closeRef.current();
        }}
      >
        <div
          ref={panel}
          className={wide ? 'pemo-dialog pemo-dialog--wide' : 'pemo-dialog'}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          data-testid={testId}
          onKeyDown={onKeyDown}
        >
          <div className="pemo-dialog__head">
            <h2 className="pemo-dialog__title">{title}{info ? <InfoTip text={info} /> : null}</h2>
            <button
              type="button"
              className="pemo-dialog__close"
              aria-label={t(MESSAGES.ui.close, locale)}
              data-testid={`${testId}-close`}
              data-tree-chrome="true"
              onClick={() => closeRef.current()}
            >
              <Icon name="X" size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </InDialog.Provider>
  );
}
