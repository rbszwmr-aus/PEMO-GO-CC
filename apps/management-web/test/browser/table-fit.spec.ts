/**
 * UX re-check 2: no finance or facility-booking table may scroll inside its
 * card, and no cell's text may spill into (overlap) its neighbour or be
 * clipped — at 1440, 1280 and 1024 with both left rails open, en and zh-Hant.
 * Fails when a table is wider than its container (scrollWidth > clientWidth)
 * or when any cell's text box extends past the cell's own rect.
 */

import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const SCREENS = [
  'charges', 'chargesDetail', 'payments', 'paymentsDetail', 'refunds', 'refundsDetail',
  'bookings', 'bookingsDetail', 'bookingCalendar', 'bookingCheckin',
  'bookingFacilities', 'bookingFacilitiesDetail', 'bookingRates',
] as const;
const WIDTHS = [1440, 1280, 1024] as const;

for (const width of WIDTHS) {
  test(`finance + booking tables fit their card at ${width}, no overlap or clipping`, async ({ strictPage: page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const base = await appOrigin();
    const problems: string[] = [];
    for (const lang of ['en', 'zh-Hant'] as const) {
      for (const screen of SCREENS) {
        await page.goto(urlFor(base, screen, screen.endsWith('Detail') ? 'detail' : 'default', lang), { waitUntil: 'load' });
        await expect(page.locator('[data-testid="page-title"]')).toBeVisible();
        const found = await page.evaluate(() => {
          const out: string[] = [];
          if (document.documentElement.scrollWidth > document.documentElement.clientWidth) out.push('page scrolls sideways');
          for (const t of Array.from(document.querySelectorAll<HTMLTableElement>('main table'))) {
            const id = t.dataset.testid ?? t.className;
            const wrap = t.parentElement!;
            if (t.scrollWidth > wrap.clientWidth + 1 || wrap.scrollWidth > wrap.clientWidth + 1) out.push(`${id} scrolls in its card`);
            for (const cell of Array.from(t.querySelectorAll<HTMLElement>('th, td'))) {
              if (cell.offsetParent === null || cell.getBoundingClientRect().width < 1) continue; // collapsed narrow-card column
              const cr = cell.getBoundingClientRect();
              const range = document.createRange();
              range.selectNodeContents(cell);
              const spill = Array.from(range.getClientRects()).some((r) => r.width > 0 && (r.right > cr.right + 1 || r.left < cr.left - 1));
              const clipped = [cell, ...Array.from(cell.querySelectorAll<HTMLElement>('*'))].some((el) => {
                const cs = getComputedStyle(el);
                return cs.overflowX !== 'visible' && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1;
              });
              if (spill || clipped) out.push(`${id}: "${(cell.textContent ?? '').trim().slice(0, 24)}" ${spill ? 'overlaps' : 'is clipped'}`);
            }
            // fix7: no row padded out by an invisible column, no tag on two lines.
            for (const tr of Array.from(t.querySelectorAll<HTMLTableRowElement>('tbody tr'))) {
              let need = 0; let lh = 20;
              for (const cell of Array.from(tr.cells)) {
                if (cell.offsetParent === null) continue;
                const cs = getComputedStyle(cell);
                lh = parseFloat(cs.lineHeight) || 20;
                const range = document.createRange(); range.selectNodeContents(cell);
                const rs = Array.from(range.getClientRects()).filter((r) => r.height > 0);
                const h = rs.length ? Math.max(...rs.map((r) => r.bottom)) - Math.min(...rs.map((r) => r.top)) : 0;
                need = Math.max(need, h + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom));
              }
              const rh = tr.getBoundingClientRect().height;
              if (rh > need + 2.5 * lh) out.push(`${id}: row "${(tr.textContent ?? '').trim().slice(0, 24)}" is ${Math.round(rh)}px for ${Math.round(need)}px of content`);
            }
            for (const tag of Array.from(t.querySelectorAll<HTMLElement>('.pemo-tag, .pemo-chip'))) {
              if (tag.offsetParent === null) continue;
              const cs = getComputedStyle(tag);
              const one = (parseFloat(cs.lineHeight) || 18) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
              if (tag.getBoundingClientRect().height > one * 1.4) out.push(`${id}: tag "${(tag.textContent ?? '').trim()}" wraps onto two lines`);
            }
          }
          return out;
        });
        for (const f of found) problems.push(`${screen} ${lang}: ${f}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
}
