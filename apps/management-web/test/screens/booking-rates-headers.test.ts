/** Rate cards: long off-peak headers wrap and get enough width, never clip. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'src');

test('Rate cards off-peak columns are at least as wide as peak, and headers wrap', () => {
  const src = readFileSync(join(SRC, 'screens/BookingRates.tsx'), 'utf8');
  const w = (k: string) => Number(src.match(new RegExp(`key: '${k}',[^}]*width: '(\\d+)%'`))?.[1]);
  assert.ok(w('offRate') >= w('peakRate'), `${w('offRate')} / ${w('peakRate')}`);
  const total = [...src.matchAll(/width: '(\d+)%'/g)].reduce((a, m) => a + Number(m[1]), 0);
  assert.equal(total, 100);
  assert.match(src, /<RateCell when=\{peakWhen\} resident=\{peakRes\} visitor=\{peakVis\}/, 'hours + resident + visitor share one cell so the table fits 1024');
  const css = readFileSync(join(SRC, 'theme/base.css'), 'utf8');
  assert.match(css, /\.pemo-table\[data-testid="booking-rates-table"\] th \{ white-space: normal;/);
});
