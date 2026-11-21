/**
 * Facility booking gets meaningful lucide icons (v3 §5) from the same vendored
 * set as finance: nav children and their row actions share BOOKING_ICON.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { ICON_NAMES } from '../../src/components/icon-shapes.ts';
import { BOOKING_ICON, NAV_IA } from '../../src/data/nav-ia.ts';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'src');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

test('Facility booking nav children carry lucide icons; the approved parent PNG stays', () => {
  const booking = NAV_IA.flatMap((g) => g.items).find((i) => i.id === 'booking');
  assert.ok(booking);
  assert.equal(booking.iconImg, '/icons/clubhouse-w.png');
  const kids = Object.fromEntries((booking.children ?? []).map((c) => [c.id, c.lucide]));
  assert.deepEqual(kids, {
    'bk-bookings': 'ClipboardList',
    'bk-calendar': 'CalendarDays',
    'bk-checkin': 'CalendarCheck',
    'bk-facilities': 'MapPin',
    'bk-rates': 'Tag',
  });
});

test('every BOOKING_ICON is a vendored shape', () => {
  for (const name of Object.values(BOOKING_ICON)) assert.ok(ICON_NAMES.includes(name as never), name);
});

test('booking row actions and headings use the shared icons, not glyphs', () => {
  const checkin = read('screens/BookingCheckin.tsx');
  assert.match(checkin, /BOOKING_ICON\.markIn[\s\S]*markCheckedIn/);
  assert.match(checkin, /BOOKING_ICON\.noShow[\s\S]*markNoShow/);
  assert.match(read('screens/BookingCalendar.tsx'), /BOOKING_ICON\.calendar/);
  assert.match(read('screens/BookingFacilities.tsx'), /BOOKING_ICON\.facilities/);
  assert.match(read('screens/BookingRates.tsx'), /BOOKING_ICON\.rates/);
  assert.match(read('screens/Bookings.tsx'), /BOOKING_ICON\.bookings/);
});
