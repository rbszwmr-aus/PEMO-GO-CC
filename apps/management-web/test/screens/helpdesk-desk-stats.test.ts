/**
 * Desk cards take label, value and note from ONE source per mode.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { deskStatCards } from '../../src/data/helpdesk-desk-stats.ts';
import type { HelpdeskStat } from '../../src/data/helpdesk-fixtures.ts';

const stat = (id: string, en: string, value: string, note: string): HelpdeskStat => ({
  id,
  label: { en, 'zh-Hant': en },
  value,
  note: { en: note, 'zh-Hant': note },
  tone: 'info',
});

const apiStats = [stat('waiting', 'WAITING', '2', 'demo store'), stat('answered', 'IN DEMO STORE', '3', 'in-memory only')];
const counts = { waiting: 2, answered: 0, raised: 1 };

test('live mode renders API stats verbatim — label, value and note from the API', () => {
  const cards = deskStatCards(apiStats, counts, true);
  assert.deepEqual(cards.map((c) => [c.stat.label.en, c.stat.value, c.hint]), [
    ['WAITING', '2', 'stat'],
    ['IN DEMO STORE', '3', 'stat'],
  ]);
  // The page's answered-today count (0) never lands under the API's label.
  assert.equal(cards[1]?.stat.value, '3');
  assert.deepEqual(cards.map((c) => c.drill), ['waiting', null]);
});

test('fixture mode keeps page label with page-computed values and page hints', () => {
  const fixture = [
    stat('waiting', 'WAITING', '4', 'fixture'),
    stat('answered', 'ANSWERED TODAY', '9', 'fixture'),
    stat('raised', 'RAISED AS CASES', '1', 'fixture'),
    stat('median', 'MEDIAN WAIT', '12m', 'fixture'),
  ];
  const before = deskStatCards(fixture, null, false);
  assert.deepEqual(before.map((c) => c.stat.value), ['4', '9', '1', '12m']);
  const after = deskStatCards(fixture, counts, false);
  assert.deepEqual(after.map((c) => [c.stat.label.en, c.stat.value, c.drill, c.hint]), [
    ['WAITING', '2', 'waiting', 'page'],
    ['ANSWERED TODAY', '0', 'answered', 'page'],
    ['RAISED AS CASES', '1', 'raised', 'page'],
    ['MEDIAN WAIT', '12m', null, 'stat'],
  ]);
});
