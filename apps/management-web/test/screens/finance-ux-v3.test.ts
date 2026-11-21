/**
 * UX v3 declutter, Payments & refunds slice: icons, status tags, the
 * review → confirm send, and en + zh-Hant copy with no fixture/demo wording.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { ICON_NAMES, ICON_SHAPES } from '../../src/components/icon-shapes.ts';
import {
  CHARGE_STATUS_TAG,
  FINANCE_OBJECT_ICON,
  PAYMENT_METHOD_ICON,
  REFUND_STATUS_TAG,
  nextSendStep,
  type SendEvent,
  type SendStep,
} from '../../src/finance/finance-ui.ts';
import { NAV_IA } from '../../src/data/nav-ia.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'src');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

test('icon shapes are vendored lucide with the ISC notice, and no icon package is imported', () => {
  const src = read('components/icon-shapes.ts');
  assert.match(src, /ISC License/);
  assert.match(src, /Lucide Icons and Contributors/);
  assert.ok(ICON_NAMES.length >= 20 && ICON_NAMES.length <= 48, `${ICON_NAMES.length} shapes`);
  for (const name of ICON_NAMES) assert.ok(ICON_SHAPES[name].length > 0, `${name} has no shape`);
  for (const f of ['components/Icon.tsx', 'components/FinanceBits.tsx', 'screens/Charges.tsx', 'screens/Payments.tsx', 'screens/Refunds.tsx', 'shell/Shell.tsx']) {
    assert.doesNotMatch(read(f), /from ['"]lucide/, `${f} imports a lucide package`);
  }
  const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as { dependencies: Record<string, string> };
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['react', 'react-dom']);
});

test('finance nav uses Wallet / Receipt / CreditCard / Refund composite', () => {
  const finance = NAV_IA.flatMap((g) => g.items).find((i) => i.id === 'finance');
  assert.ok(finance);
  assert.equal(finance.lucide, 'Wallet');
  const kids = Object.fromEntries((finance.children ?? []).map((c) => [c.id, c.lucide]));
  assert.deepEqual(kids, { 'fin-charges': 'Receipt', 'fin-payments': 'CreditCard', 'fin-refunds': 'Refund' });
  assert.equal(FINANCE_OBJECT_ICON.refund, 'Refund');
});

test('refund composite: Banknote dominant with a small Undo2 arrow', () => {
  const icon = read('components/Icon.tsx');
  assert.match(icon, /<Icon name="Banknote" size=\{size\}/);
  assert.match(icon, /<Icon name="Undo2" size=\{arrow\}/);
  assert.match(icon, /size \* 0\.36/);
});

test('status tags: Due is pale red, Overdue is the one urgent solid tag, every tag icon exists', () => {
  assert.equal(CHARGE_STATUS_TAG.overdue.tone, 'urgent');
  assert.equal(CHARGE_STATUS_TAG.due.tone, 'alert');
  assert.equal(CHARGE_STATUS_TAG.partial.tone, 'attention');
  assert.equal(CHARGE_STATUS_TAG.paid.tone, 'positive');
  for (const v of [...Object.values(CHARGE_STATUS_TAG), ...Object.values(REFUND_STATUS_TAG)]) {
    assert.ok(ICON_NAMES.includes(v.icon), v.icon);
    if (v !== CHARGE_STATUS_TAG.overdue) assert.notEqual(v.tone, 'urgent', 'only urgent items get a strong fill');
  }
  for (const v of Object.values(PAYMENT_METHOD_ICON)) assert.ok(ICON_NAMES.includes(v), v);
});

test('status-tag CSS: light solid background, NO border; strong fill only for urgent', () => {
  const css = read('theme/base.css');
  const base = css.match(/\.pemo-tag \{[^}]*\}/)?.[0] ?? '';
  assert.match(base, /border: 0;/);
  // 4S guide section 6: attention is the guide's own pair (--s4-tag-attention-*), the rest ride the severity aliases.
  for (const [tone, surface] of [['alert', '--pemo-sev-critical-surface'], ['attention', '--s4-tag-attention-bg'], ['positive', '--pemo-sev-normal-surface'], ['info', '--pemo-sev-information-surface']]) {
    const rule = css.match(new RegExp(`\\.pemo-tag\\[data-tone='${tone}'\\] \\{[^}]*\\}`))?.[0] ?? '';
    assert.match(rule, new RegExp(`background: var\\(${surface}\\)`), tone);
    assert.doesNotMatch(rule, /border/, `${tone} must not carry a border`);
  }
  const urgent = css.match(/\.pemo-tag\[data-tone='urgent'\] \{[^}]*\}/)?.[0] ?? '';
  assert.match(urgent, /background: var\(--s4-tag-urgent-bg\)/);
  assert.match(css, /font-variant-numeric: tabular-nums/);
});

test('buttons and row actions: white with a grey border, light tint on hover; rows alternate', () => {
  const css = read('theme/base.css');
  const btn = css.match(/\.pemo-button \{\n  font: inherit[^}]*\}/)?.[0] ?? '';
  assert.match(btn, /background: var\(--pemo-common-white\)/);
  assert.match(btn, /border: 1px solid var\(--pemo-neutral-300\)/);
  assert.match(css, /\.pemo-rowlink \{ border: 1px solid var\(--pemo-neutral-300\)/, 'Invoice row link is grey, not green');
  assert.match(css, /\.pemo-button:not\(:disabled\):hover \{ background: var\(--pemo-brand-primaryTint\); border-color: var\(--s4-hover-border\); \}/, '4S guide: ordinary buttons turn soft green on hover');
  assert.match(css, /tbody tr:nth-child\(even\) > td \{ background: var\(--pemo-neutral-50\); \}/);
});

test('finance and booking tables fit their card: no floor width, no truncation', () => {
  const css = read('theme/base.css');
  assert.match(css, /\.pemo-table-wrap \{ overflow-x: auto; position: relative; \}/, 'wrap must contain abs-positioned captions too');
  for (const id of ['charges-table', 'payments-table', 'refunds-table', 'booking-rates-table', 'bookings-table', 'booking-checkin-table', 'booking-facilities-table']) {
    assert.doesNotMatch(css, new RegExp(`\\.pemo-table\\[data-testid="${id}"\\] \\{ min-width: \\d+rem; \\}`), `${id} has a floor, so it scrolls in its card`);
  }
  assert.match(css, /\.pemo-calendar-table \{ min-width: 0; \}/);
  assert.match(css, /container-type: inline-size; overflow-x: visible;/, 'table wraps are size containers that never scroll');
  const table = read('components/Table.tsx');
  assert.match(table, /@container \(max-width:\$\{Math\.round\(c\.hideBelow \* TYPE_SCALE\) - 1\}px\)/, 'narrow cards drop low-priority columns');
  for (const f of ['Charges', 'Payments', 'Refunds', 'EmailOutbox', 'Bookings', 'BookingCheckin', 'BookingFacilities']) {
    const src = read(`screens/${f}.tsx`);
    assert.match(src, /hideBelow: \d+/, `${f} has no narrow-card column plan`);
    assert.match(src, /data-alt="/, `${f} drops a column without a context line`);
  }
  const block = css.slice(css.indexOf('UX re-check 1: finance and facility-booking tables'));
  assert.match(block, /td\.pemo-cell--dense \{ white-space: normal; overflow: visible; text-overflow: clip; \}/);
  assert.match(block, /-webkit-line-clamp: unset/);
  assert.doesNotMatch(css, /td\.pemo-cell--unit[^{]*\{[^}]*text-overflow: ellipsis/, 'Charges Unit must not truncate');
});

test('Charges: one tag per cell — status and invoice-email state in separate columns', () => {
  const charges = read('screens/Charges.tsx');
  assert.match(charges, /<td data-testid="charge-row-tags">\s*<ChargeStatusChip/);
  assert.match(charges, /<td data-testid="charge-row-email">\s*<InvoiceSendChip/);
  const widths = [...charges.matchAll(/key: '(?:period|household|unit|amount|outstanding|status|email|invoice)', label: t\(M\.col\w+, locale\), width: '(\d+)%'/g)].map((m) => Number(m[1])).slice(0, 8);
  assert.equal(widths.length, 8);
  assert.equal(widths.reduce((a, b) => a + b, 0), 100);
});

test('main pages carry no system ids or source tags; detail pages keep them in collapsed IT details', () => {
  const listPart = (src: string, detailFn: RegExp) => src.slice(0, src.search(detailFn));
  const screens = [
    ['Charges', read('screens/Charges.tsx'), /export function ChargesDetail/],
    ['Payments', read('screens/Payments.tsx'), /export function PaymentsDetail/],
    ['Refunds', read('screens/Refunds.tsx'), /export function RefundsDetail/],
  ] as const;
  for (const [name, src, fn] of screens) {
    assert.ok(src.search(fn) > 0, `${name} detail fn`);
    const list = listPart(src, fn);
    assert.doesNotMatch(list, /pemo-identifier|<SourceTag |fixture-label|\{(?:c|p|r|b)\.(?:charge|payment|refund|booking|household)Id\}</, `${name} list shows an id`);
    const detail = src.slice(src.search(fn));
    assert.match(detail, /<ITDetails/, `${name} detail has no IT details`);
  }
  assert.doesNotMatch(read('screens/Bookings.tsx'), /pemo-identifier|<SourceTag |fixture-label|\{(?:b)\.(?:booking|household)Id\}</, 'Bookings list shows an id');
  assert.match(read('screens/BookingDialog.tsx'), /<ITDetails/, 'Bookings pop-up has no IT details');
  for (const f of ['BookingCalendar', 'BookingCheckin', 'BookingRates']) {
    assert.doesNotMatch(read(`screens/${f}.tsx`), /fixture-label|pemo-identifier">\{b\.bookingId/, f);
  }
  assert.match(read('screens/BookingFacilities.tsx'), /<ITDetails/);
  const bits = read('components/FinanceBits.tsx');
  assert.match(bits, /<details className="pemo-itdetails"/);
  assert.doesNotMatch(bits, /<details[^>]* open/, 'IT details start collapsed');
  assert.equal(MESSAGES.finance.itDetails.en, 'IT details');
  assert.equal(MESSAGES.finance.itDetails['zh-Hant'], 'IT 詳情');
});

test('send goes review → confirm; success only after the send reports back', () => {
  const run = (events: SendEvent[]) => events.reduce<SendStep>((s, e) => nextSendStep(s, e), 'idle');
  assert.equal(run(['confirm']), 'idle', 'confirm without review must not send');
  assert.equal(run(['send']), 'review');
  assert.equal(run(['send', 'cancel']), 'idle');
  assert.equal(run(['send', 'confirm']), 'sending');
  assert.equal(run(['send', 'succeeded']), 'review', 'no success before confirm');
  assert.equal(run(['send', 'confirm', 'succeeded']), 'sent');
  assert.equal(run(['send', 'confirm', 'failed']), 'failed');
  assert.equal(run(['send', 'confirm', 'failed', 'send']), 'review');
  assert.equal(run(['send', 'confirm', 'cancel']), 'sending', 'cannot cancel mid-send');
});

test('finance copy: en + zh-Hant for every string, and no fixture/demo/stub wording', () => {
  const walk = (o: unknown, path: string, out: Array<[string, { en: string; 'zh-Hant': string }]>) => {
    if (o && typeof o === 'object' && 'en' in o && 'zh-Hant' in o) out.push([path, o as never]);
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`, out);
    return out;
  };
  for (const [path, v] of walk(MESSAGES.finance, 'finance', [])) {
    assert.ok(v.en.trim() && v['zh-Hant'].trim(), `${path} missing a locale`);
    assert.doesNotMatch(v.en, /fixture|demo|stub|sandbox/i, `${path}: "${v.en}"`);
    assert.doesNotMatch(v['zh-Hant'], /固定|示範）|Stub/, `${path}: "${v['zh-Hant']}"`);
  }
  const M = MESSAGES.finance;
  assert.equal(M.sendInvoiceNow.en, 'Send');
  assert.equal(M.downloadInvoicePdf.en, 'PDF');
  assert.equal(M.runDueInvoiceSends.en, 'Send due');
  assert.equal(M.backToCharges.en, 'Charges');
  assert.equal(M.openInvoice.en, 'Invoice');
  assert.equal(M.fixtureLabel.en, 'Sample data');
  assert.equal(M.liveLabel.en, 'Live');
});

test('finance screens: no stacked notes, Invoice row link, honest empty state', () => {
  const charges = read('screens/Charges.tsx');
  const payments = read('screens/Payments.tsx');
  const refunds = read('screens/Refunds.tsx');
  for (const [name, src] of [['Charges', charges], ['Payments', payments], ['Refunds', refunds]] as const) {
    assert.doesNotMatch(src, /BoundaryNote|M\.filterNote|countsHeading|invoiceSendNote|outboxSmtpNote/, name);
    assert.match(src, /<NoMatch /, `${name} has no honest empty state`);
    assert.match(src, /<NumCell /, `${name} amounts are not tabular`);
  }
  assert.match(charges, /testId="charge-open"/);
  assert.match(charges, /label=\{t\(M\.openInvoice, locale\)\}/);
  assert.match(charges, /data-testid="invoice-send-confirm"/);
  assert.doesNotMatch(refunds, /data-testid="refund-execute"/, 'deferred acts stay absent, not disabled controls');
  assert.doesNotMatch(read('screens/EmailOutbox.tsx'), /outboxSmtpNote/);
});

test('money cells never truncate: no ellipsis, no clip, nowrap', () => {
  const css = read('theme/base.css');
  const money = css.match(/\.pemo-table td\.pemo-cell--money \{[^}]*\}/)?.[0] ?? '';
  assert.match(money, /white-space: nowrap/);
  assert.match(money, /overflow: visible/);
  for (const m of css.matchAll(/[^}]*pemo-cell--money[^{]*\{[^}]*\}/g)) {
    assert.doesNotMatch(m[0], /text-overflow|overflow: hidden/, m[0]);
  }
  const bits = read('components/FinanceBits.tsx');
  const numCell = bits.slice(bits.indexOf('export function NumCell'));
  assert.match(numCell.slice(0, 400), /className="pemo-cell--money pemo-num"/);
  assert.doesNotMatch(numCell.slice(0, 400), /pemo-cell--dense/);
  for (const f of ['screens/Charges.tsx', 'screens/Payments.tsx', 'screens/Refunds.tsx', 'screens/BookingRates.tsx']) {
    assert.doesNotMatch(read(f), /<DenseCell title=\{(amount|outstanding|hkd\(|peakRes|peakVis|offRes|offVis)/, `${f} puts money in a truncating cell`);
  }
});

test('icon-only controls carry an accessible name', () => {
  const bits = read('components/FinanceBits.tsx');
  for (const fn of ['InfoTip', 'FilterMark']) {
    const body = bits.slice(bits.indexOf(`export function ${fn}`));
    assert.match(body.slice(0, 600), /aria-label=\{(text|label)\}/, `${fn} lacks aria-label`);
  }
});

test('UX re-check 1: outbox, charge detail, footer, deferred line, bookings declutter, tag borders', () => {
  const outbox = read('screens/EmailOutbox.tsx');
  assert.doesNotMatch(outbox, /attachmentName|pemo-identifier|SmtpTag|\{e\.subject\}/, 'outbox shows codes / file names / SMTP tag');
  assert.match(outbox, /staffSubject\(e\.chargeId, locale\)/);
  const charges = read('screens/Charges.tsx');
  const detail = charges.slice(charges.indexOf('export function ChargesDetail'));
  assert.doesNotMatch(detail, /M\.colKind/, 'Kind repeats the title');
  assert.match(detail, /\[M\.itInvoiceNumber, /, 'invoice number belongs in IT details');
  assert.doesNotMatch(read('shell/Shell.tsx'), /SCOPE_GAP/, 'developer scope-kinds footer is back');
  const deferred = read('components/DeferredActions.tsx');
  assert.doesNotMatch(deferred, /deferred\.body|listLabel|<ul/);
  assert.equal(MESSAGES.deferred.heading.en, 'Not available yet');
  const bookings = read('screens/Bookings.tsx');
  assert.doesNotMatch(bookings, /M\.boundaryNote|M\.filterNote|M\.countsHeading|M\.filterHeading|borderLeft|ScopePathCell scope=\{b\.scope\}/);
  assert.match(bookings, /humanSlot\(b, locale\)/);
  assert.doesNotMatch(read('screens/BookingRates.tsx'), /M\.ratesNote/);
  assert.doesNotMatch(read('screens/BookingFacilities.tsx'), /M\.facilitiesNote/);
  const css = read('theme/base.css');
  for (const rule of css.match(/\.pemo-tag(?:\[[^\]]*\])? \{[^}]*\}/g) ?? []) {
    assert.doesNotMatch(rule.replace('border-radius', ''), /border(?!: 0;)/, `tag rule has a border: ${rule}`);
  }
  assert.match(css, /\.pemo-chip--plain \{[^}]*border-color: transparent;/);
  assert.match(charges, /<td className="pemo-nowrap" data-testid="charge-row-period">/, 'Period never wraps');
  assert.doesNotMatch(read('shell/ScopeRail.tsx'), /scope-pick-prompt/, 'G3 hint is back');
});
