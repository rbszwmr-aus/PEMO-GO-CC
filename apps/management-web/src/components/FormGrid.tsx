/**
 * Two-column field grid for INPUT forms in pop-ups and on pages (PT rule, 2026-11-19: use the room, pair
 * the fields; read-only info pop-ups stay one column of label/value rows).
 *
 * `FormGrid` lays its children out in two equal columns once the surrounding pop-up is about 720px
 * wide or more (the pop-up's own width decides, not the window's), and in one column below that.
 * Pair related fields in source order: from / to, start / end, first / last name, phone / email,
 * amount / currency. A field that needs the whole row (notes, a multi-line box, a table, a hint)
 * takes `SPAN`. Do not use it on a detail list (`<dl className="pemo-dl">`): `SPAN` is for FormGrid children only.
 *
 * Field names stay light grey and values bold: that comes from the shared `pemo-field` / `pemo-dl` rules.
 *
 * @version 0.3.0
 * @changelog
 *   0.3.0 (2026-11-19) Scope: input forms only. Detail lists in pop-ups are back to one column.
 *   0.2.0 (2026-11-19) `page` prop: the same grid on a full-page form, keyed to the window (1100px) instead of a pop-up.
 *   0.1.0 (2026-11-19) New. Rules live in theme/base.css (`.pemo-formgrid`, container query on `.pemo-dialog`).
 */

import type { ReactNode } from 'react';

/** Class for a field, hint or block that takes both columns. */
export const SPAN = 'pemo-formgrid__span';

/** `page` is for a form on a full page (no pop-up around it): two columns from a 1100px window up. */
export function FormGrid({ children, testId, page }: { children: ReactNode; testId?: string | undefined; page?: boolean | undefined }) {
  return (
    <div className={page ? 'pemo-formgrid pemo-formgrid--page' : 'pemo-formgrid'} data-testid={testId}>
      {children}
    </div>
  );
}
