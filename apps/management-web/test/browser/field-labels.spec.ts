/**
 * Field labels are one muted grey-green at regular weight, a step smaller than the dark values:
 * the key column of every detail list and the label above every form field. Detail screens keep
 * system ids out of the main view (they live in the collapsed IT details).
 */
import { appOrigin, expect, test, urlFor } from './support/harness.ts';

const screens: Array<[string, string, string]> = [
  ['helpdeskDetail', 'detail', ''],
  ['residentsDetail', 'detail', ''],
  ['visitorRegister', 'blank', ''],
  ['adminEmail', 'default', ''],
  ['visitorCounter', 'walk-in', ''],
  ['chargesDetail', 'detail', ''],
];

const luminance = (rgb: string): number => {
  const [r, g, b] = (/rgba?\((\d+), (\d+), (\d+)/.exec(rgb) ?? []).slice(1).map(Number);
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
};

for (const [screen, state, extra] of screens) {
  test(`${screen}/${state}: labels are muted, regular weight and smaller than their values`, async ({ strictPage: page }) => {
    await page.goto(urlFor(await appOrigin(), screen, state, 'zh-Hant') + extra, { waitUntil: 'load' });
    await expect(page.getByTestId('page-title')).toBeVisible();
    const facts = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--text-label)';
      document.body.appendChild(probe);
      const token = getComputedStyle(probe).color;
      probe.remove();
      const read = (el: Element) => { const cs = getComputedStyle(el); return { color: cs.color, weight: cs.fontWeight, size: parseFloat(cs.fontSize) }; };
      const keys = [...document.querySelectorAll('main dl.pemo-dl > dt, main dl.pemo-dl > div > dt')].map(read);
      const fields = [...document.querySelectorAll('main label.pemo-field')]
        .filter((l) => !l.closest('[data-testid$="-filters"]'))
        .map((l) => ({ label: read(l), control: (() => { const c = l.querySelector('input, select, textarea'); return c ? read(c) : null; })() }));
      const value = document.querySelector('main dl.pemo-dl dd');
      return { token, keys, fields, value: value ? read(value) : null };
    });
    expect(facts.keys.length + facts.fields.length).toBeGreaterThan(0);
    for (const k of facts.keys) {
      expect(k.color).toBe(facts.token);
      expect(k.weight).toBe('400');
      if (facts.value) expect(k.size).toBeLessThan(facts.value.size);
    }
    for (const f of facts.fields) {
      expect(f.label.color).toBe(facts.token);
      expect(f.label.weight).toBe('400');
      if (f.control) {
        expect(f.label.size).toBeLessThan(f.control.size);
        expect(luminance(f.control.color)).toBeLessThan(luminance(f.label.color)); // the value is darker than its label
      }
    }
    if (facts.value) expect(luminance(facts.value.color)).toBeLessThan(luminance(facts.token));
  });
}

test('Help desk contact detail: the contact id is in the collapsed IT details, not on the main view', async ({ strictPage: page }) => {
  await page.goto(urlFor(await appOrigin(), 'helpdeskDetail', 'detail', 'en') + '&contact=hd_2026_0812_001', { waitUntil: 'load' });
  await expect(page.getByTestId('helpdesk-detail')).toBeVisible();
  await expect(page.getByTestId('helpdesk-contact-facts')).not.toContainText('hd_2026');
  await expect(page.getByTestId('helpdesk-it-details')).toBeVisible();
  await expect(page.getByTestId('helpdesk-it-details')).not.toHaveAttribute('open', '');
  expect(await page.getByTestId('helpdesk-detail').innerText()).not.toMatch(/\bhd_\d|tkt_|vis_/);
  // The pop-up's close button is the way out: the detail draws no back link of its own.
  await expect(page.getByTestId('helpdesk-back')).toHaveCount(0);
  await page.getByTestId('helpdesk-it-details').locator('summary').click();
  await expect(page.getByTestId('helpdesk-it-details')).toContainText('hd_2026_0812_001');
});
