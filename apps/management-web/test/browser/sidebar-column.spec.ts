/**
 * The sidebar is a sticky, viewport-tall column with its own scrolling nav, and its tint runs the full
 * height of a long page, collapsed or expanded, so nothing below the nav reads as blank page.
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

for (const width of [1440, 1024]) {
  for (const nav of ['expanded', 'collapsed']) {
    test(`long page: the sidebar stays in view and its tint fills the column - ${width}px ${nav}`, async ({ strictPage: page }) => {
      await page.setViewportSize({ width, height: 600 });
      const base = await appOrigin();
      await page.goto(urlFor(base, 'visitorLog', 'default', 'en') + (nav === 'collapsed' ? '&nav=collapsed' : ''), { waitUntil: 'load' });
      const facts = await page.evaluate(() => {
        const sb = document.querySelector('.pemo-sidebar') as HTMLElement;
        const shell = document.querySelector('.pemo-shell') as HTMLElement;
        const nav = sb.querySelector('.pemo-sidebar__nav') as HTMLElement;
        window.scrollTo(0, document.documentElement.scrollHeight);
        const r = sb.getBoundingClientRect();
        return {
          tall: document.documentElement.scrollHeight > innerHeight * 1.5,
          sticky: getComputedStyle(sb).position,
          top: Math.round(r.top), height: Math.round(r.height), vh: innerHeight,
          navScroll: getComputedStyle(nav).overflowY,
          tint: getComputedStyle(sb).backgroundColor,
          columnPaint: getComputedStyle(shell).backgroundImage,
          sbWidth: Math.round(r.width),
        };
      });
      expect(facts.tall).toBe(true);
      expect(facts.sticky).toBe('sticky');
      expect(Math.abs(facts.top)).toBe(0); // still pinned after scrolling to the bottom
      expect(facts.height).toBe(facts.vh);
      expect(facts.navScroll).toBe('auto');
      // The column behind the sidebar is painted the sidebar tint, as wide as the sidebar.
      expect(facts.columnPaint).toContain('linear-gradient');
      expect(facts.columnPaint).toContain(facts.tint);
      expect(facts.columnPaint).toContain(`${facts.sbWidth}px`);
    });
  }
}
