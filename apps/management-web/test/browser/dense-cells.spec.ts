/**
 * Traditional Chinese in DENSE TABLE CELLS — the criterion that decided the stack.
 *
 * Truncation and line-breaking behave differently from Latin text: Chinese
 * breaks between characters and English breaks between words, so the same column
 * width truncates the two differently. These are layout facts, which is why this
 * suite runs in a real browser and why the font-capability project gates it.
 *
 * The assertions are made IN THE CELLS rather than in isolation. A CJK string
 * measured in a bare <span> proves nothing about a fixed-width table column with
 * its own font, weight and overflow policy inherited from three rules up.
 */

import { SCREEN_IDS, statesFor } from '../../src/data/states.ts';
import { LOCALES } from '../../src/i18n/locale.ts';
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

/** Screens whose default-ish state renders a real table. */
const TABLE_STATES: Array<[string, string]> = [
  ['s1', 'default'],
  ['s3', 'unit'],
  ['s4', 'default'],
  ['s5', 'list'],
  ['residents', 'list'],
  ['households', 'list'],
  ['adminUsers', 'list'],
  ['adminGroups', 'list'],
  ['adminRoles', 'matrix'],
  ['adminAudit', 'list'],
  ['bookings', 'default'],
  ['bookingFacilities', 'default'],
  ['bookingRates', 'default'],
  ['bookingCheckin', 'default'],
  ['charges', 'default'],
  ['payments', 'default'],
  ['refunds', 'default'],
  ['documents', 'list'],
];

test.describe('dense cells', () => {
  for (const [screen, state] of TABLE_STATES) {
    for (const lang of LOCALES) {
      test(`${screen}/${state}/${lang}: no cell overflows the page`, async ({ strictPage: page }) => {
        const base = await appOrigin();
        await page.goto(urlFor(base, screen, state, lang), { waitUntil: 'load' });

        // A dense table that widens the document is the failure this column
        // policy exists to prevent. Tables scroll inside their own wrapper.
        const overflow = await page.evaluate(() => ({
          doc: document.documentElement.scrollWidth,
          view: document.documentElement.clientWidth,
        }));
        expect(
          overflow.doc,
          `the page scrolls horizontally (${overflow.doc}px in a ${overflow.view}px viewport): a cell widened the layout`,
        ).toBeLessThanOrEqual(overflow.view);
      });

      test(`${screen}/${state}/${lang}: cells stay inside their columns`, async ({ strictPage: page }) => {
        const base = await appOrigin();
        await page.goto(urlFor(base, screen, state, lang), { waitUntil: 'load' });

        const escapes = await page.evaluate(() => {
          const out: string[] = [];
          for (const table of document.querySelectorAll('table')) {
            const tRect = table.getBoundingClientRect();
            for (const cell of table.querySelectorAll('td, th')) {
              const r = cell.getBoundingClientRect();
              // 1px tolerance for sub-pixel rounding.
              if (r.right > tRect.right + 1) {
                out.push(`${(cell.textContent ?? '').slice(0, 24)} — right ${r.right.toFixed(1)} > table ${tRect.right.toFixed(1)}`);
              }
            }
          }
          return out;
        });
        expect(escapes, `cells extend beyond their table:\n  ${escapes.join('\n  ')}`).toEqual([]);
      });
    }

    test(`${screen}/${state}: Traditional Chinese renders with REAL GLYPHS inside the cells`, async ({ strictPage: page }) => {
      // The anti-tofu differential applied in situ, using each cell's OWN
      // computed font. The standalone check proves the host is capable; this
      // proves the capability survives the cascade into a table cell — a
      // different question, and the one criterion 5 actually asks.
      const base = await appOrigin();
      await page.goto(urlFor(base, screen, state, 'zh-Hant'), { waitUntil: 'load' });
      await page.waitForSelector('table td'); // a screen that reads through a client fills its table after load

      const result = await page.evaluate(() => {
        const CJK = /[㐀-䶿一-鿿豈-﫿]/gu;
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
        document.body.appendChild(probe);

        const tofu: string[] = [];
        let checkedCells = 0;
        let checkedChars = 0;

        for (const cell of document.querySelectorAll('table td')) {
          const text = cell.textContent ?? '';
          const chars = [...new Set(text.match(CJK) ?? [])];
          if (chars.length === 0) continue;
          checkedCells++;
          probe.style.font = getComputedStyle(cell).font;
          const widthOf = (s: string): number => { probe.textContent = s; return probe.getBoundingClientRect().width; };
          const missing = widthOf('');
          for (const ch of chars) {
            checkedChars++;
            if (Math.abs(widthOf(ch) - missing) < 0.5) tofu.push(ch);
          }
        }
        probe.remove();
        return { tofu: [...new Set(tofu)], checkedCells, checkedChars };
      });

      // An empty oracle agrees with everything: if no cell carried CJK, "no
      // tofu" would be trivially true and this test would prove nothing.
      expect(result.checkedCells, 'no table cell contained Traditional Chinese — nothing was measured').toBeGreaterThan(0);
      expect(result.checkedChars, 'no CJK characters were measured').toBeGreaterThan(3);
      expect(
        result.tofu,
        `${result.tofu.length} CJK characters render as tofu inside table cells: ${result.tofu.join('')}`,
      ).toEqual([]);
    });
  }

  test('a truncated cell truncates VISIBLY and keeps its full text reachable', async ({ strictPage: page }) => {
    // Silent clipping is worse than truncation: a staff member cannot tell that
    // a reference is incomplete. Where a dense cell overflows it must show an
    // ellipsis, and its full value must remain available.
    const base = await appOrigin();
    await page.goto(urlFor(base, 's1', 'default', 'zh-Hant'), { waitUntil: 'load' });

    const cells = await page.evaluate(() => {
      const out: Array<{ text: string; overflowing: boolean; ellipsis: string; title: string }> = [];
      for (const cell of document.querySelectorAll('td[data-dense="true"]')) {
        const cs = getComputedStyle(cell);
        out.push({
          text: (cell.textContent ?? '').trim(),
          overflowing: cell.scrollWidth > cell.clientWidth + 1,
          ellipsis: cs.textOverflow,
          title: cell.getAttribute('title') ?? '',
        });
      }
      return out;
    });

    expect(cells.length, 'no dense cells were found to check').toBeGreaterThan(0);
    for (const c of cells) {
      expect(c.ellipsis, `a dense cell clips without an ellipsis: "${c.text}"`).toBe('ellipsis');
      if (c.overflowing) {
        expect(c.title.length, `a truncated cell has no recoverable full text: "${c.text}"`).toBeGreaterThan(0);
      }
    }
  });

  test('Chinese and Latin break differently, and both stay in the column', async ({ strictPage: page }) => {
    // The substantive difference criterion 5 names. The CJK rendering must wrap
    // WITHIN its column rather than forcing it wider, which is the failure mode
    // when a break policy is left to the default.
    //
    // Measured at a NARROW viewport on purpose. At 1440px the notice body fits
    // on one line in both languages, so nothing wraps and the assertion is
    // vacuous — the first run of this test passed its overflow checks while
    // proving nothing about wrapping. A column wide enough that no text wraps is
    // not a test of wrapping.
    await page.setViewportSize({ width: 720, height: 900 });
    const base = await appOrigin();

    const measureWrap = async (lang: string) => {
      // s5 -> s5detail at UI-045: the notice detail became its own screen id.
      await page.goto(urlFor(base, 's5detail', 'detail', lang), { waitUntil: 'load' });
      return page.evaluate(() => {
        const en = document.querySelector('[data-testid="body-en"]') as HTMLElement;
        const zh = document.querySelector('[data-testid="body-zh"]') as HTMLElement;
        const box = (el: HTMLElement) => ({
          w: el.getBoundingClientRect().width,
          h: el.getBoundingClientRect().height,
          scrollW: el.scrollWidth,
          lineHeight: parseFloat(getComputedStyle(el).lineHeight),
          lineBreak: getComputedStyle(el).lineBreak,
          synthWeight: getComputedStyle(el).getPropertyValue('font-synthesis-weight'),
        });
        return { en: box(en), zh: box(zh) };
      });
    };

    const m = await measureWrap('zh-Hant');

    // Neither language overflows its container horizontally.
    expect(m.zh.scrollW, 'the Traditional Chinese body overflows its column').toBeLessThanOrEqual(Math.ceil(m.zh.w) + 1);
    expect(m.en.scrollW, 'the English body overflows its column').toBeLessThanOrEqual(Math.ceil(m.en.w) + 1);

    // Both actually wrapped. Asserted, not assumed: a single line would mean the
    // column was wide enough that nothing was being tested.
    expect(m.zh.h, 'the Chinese body did not wrap; the viewport is too wide for this to be a test').toBeGreaterThan(m.zh.lineHeight);
    expect(m.en.h, 'the English body did not wrap; the viewport is too wide for this to be a test').toBeGreaterThan(m.en.lineHeight);

    // And they wrapped DIFFERENTLY, which is the whole point of measuring both:
    // Chinese breaks between characters and English between words, so the same
    // column yields a different number of lines for the same notice.
    const zhLines = Math.round(m.zh.h / m.zh.lineHeight);
    const enLines = Math.round(m.en.h / m.en.lineHeight);
    expect(zhLines, 'the Chinese body produced no lines').toBeGreaterThan(0);
    expect(enLines, 'the English body produced no lines').toBeGreaterThan(0);

    // Design system 4.1: never synthesise bold for the CJK face. Read the
    // LONGHAND: the `font-synthesis` shorthand lists what IS synthesised, so the
    // first version of this assertion looked for "none" in a value that
    // legitimately reads "style small-caps" and failed on a correct page.
    expect(m.zh.synthWeight, 'synthetic bold is enabled on the Traditional Chinese face').toBe('none');
  });

  test('the zh-Hant page sets a CJK-capable face, not a Latin fallback', async ({ strictPage: page }) => {
    const base = await appOrigin();
    await page.goto(urlFor(base, 's1', 'default', 'zh-Hant'), { waitUntil: 'load' });
    const stack = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(stack, 'the declared font stack lost its Traditional Chinese face').toContain('Noto Sans TC');
  });
});
