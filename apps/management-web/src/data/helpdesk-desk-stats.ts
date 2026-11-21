/**
 * The "Today at the desk" cards: ONE source per card for label, value and note.
 *
 * Live mode (source=live, API stats loaded): every card is the API stat
 * verbatim — label, value and note. The page's portal-ticket counts are NOT
 * spliced in, because the API's cards do not mean the same thing (the demo
 * API's second card is "IN DEMO STORE", not "answered today"). Only the
 * waiting card stays a drill into the portal-tickets list: both sides define
 * it as open/triaged tickets waiting at the desk.
 *
 * Fixture mode: the page's own cards — fixture label, and the value the page
 * computes from the portal-tickets store once it has loaded — with the page's
 * hint copy and all three desk drills.
 */
import type { HelpdeskStat } from './helpdesk-fixtures.ts';

export type DeskDrillId = 'waiting' | 'answered' | 'raised';

export interface PortalDeskCounts {
  readonly waiting: number;
  readonly answered: number;
  readonly raised: number;
}

export interface DeskStatCard {
  readonly stat: HelpdeskStat;
  /** Which drill a click opens, or null for a plain card. */
  readonly drill: DeskDrillId | null;
  /** 'page': render the page's hint for the drill. 'stat': render stat.note. */
  readonly hint: 'page' | 'stat';
}

const DRILLS: readonly DeskDrillId[] = ['waiting', 'answered', 'raised'];
const isDrill = (id: string): id is DeskDrillId => (DRILLS as readonly string[]).includes(id);

export function deskStatCards(
  stats: readonly HelpdeskStat[],
  portalCounts: PortalDeskCounts | null,
  fromLive: boolean,
): DeskStatCard[] {
  if (fromLive) {
    return stats.map((stat) => ({
      stat,
      drill: stat.id === 'waiting' ? 'waiting' : null,
      hint: 'stat',
    }));
  }
  return stats.map((stat) => {
    if (!isDrill(stat.id)) return { stat, drill: null, hint: 'stat' };
    const value = portalCounts == null ? stat.value : String(portalCounts[stat.id]);
    return { stat: { ...stat, value }, drill: stat.id, hint: 'page' };
  });
}
