/**
 * What a detail view tells the pop-up that holds it. Inside the detail pop-up the record's own title is the
 * pop-up's title (no second heading under it) and the detail's back link is not drawn (the pop-up's close
 * button and Escape are the way out). Outside a pop-up nothing changes.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';

export type DetailHead = { title: string; info?: string | undefined };

/** Set by the pop-up host around the detail it shows; null everywhere else. */
export const DetailChromeCtx = createContext<((head: DetailHead | null) => void) | null>(null);

/** True inside the detail pop-up. With a title, it becomes the pop-up's title (and its (i) text). */
export function useDetailChrome(title: string | null, info?: string): boolean {
  const set = useContext(DetailChromeCtx);
  useEffect(() => {
    if (!set || title === null) return undefined;
    set({ title, info });
    return () => set(null);
  }, [set, title, info]);
  return set !== null;
}

/** The record's title as a panel heading; inside the detail pop-up it is the pop-up's title instead. */
export function DetailTitle({ title }: { title: string }) {
  const inDialog = useDetailChrome(title);
  return inDialog ? null : <h2 className="pemo-panel__title">{title}</h2>;
}

/** A detail's own way back: drawn on a page, not inside the pop-up (its close button and Escape do that). */
export function DetailBack({ children }: { children: ReactNode }) {
  const inDialog = useDetailChrome(null);
  return inDialog ? null : <>{children}</>;
}

/** A detail whose first panel is only a heading and notes: a panel on a page, and just the pop-up's title (notes kept for assistive technology) inside it. */
export function DetailHeadPanel({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  const inDialog = useDetailChrome(title);
  if (inDialog) return <section className="pemo-visually-hidden" data-testid={testId}>{children}</section>;
  return (
    <section className="pemo-panel" data-testid={testId}>
      <h2 className="pemo-panel__title">{title}</h2>
      {children}
    </section>
  );
}
