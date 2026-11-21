/**
 * The booking screens' state registry — which fixture drives which screen state.
 *
 * Two data screens are routable: Explore and Facility detail. Availability is a
 * SECTION of Facility detail (as the export renders it — a slot picker in the
 * facility panel), and it appears only for a facility the corpus supplies an
 * availability fixture for. Only `function-room` has one, so only its detail
 * carries a grid; for the rest the section is ABSENT, not an invented grid
 * (the no-fixture discipline — an unfixtured shape has no oracle, UI-031 Finding C).
 *
 * Problem states (400/401/404/500) render the RFC 9457 body's `residentMessage`.
 */

import { CORPUS } from './corpus.g.ts';
import type { AvailabilityView, FacilityDetail, Problem, SearchResponse } from './types.ts';

export type BookingScreen = 'explore' | 'facility';

/** Explore states → SearchResponse fixture, plus the search problem states. */
export const EXPLORE_STATES = {
  default: 'explore/default.json',
  empty: 'explore/empty.json',
} as const;
export const EXPLORE_PROBLEMS = {
  'bad-request': 'problems/bad-request.json',
  'session-expired': 'problems/session-expired.json',
  'invalid-credential': 'problems/invalid-credential.json',
} as const;

/** Facility states → FacilityDetail fixture, plus the getFacility problem states. */
export const FACILITY_STATES = {
  'policy-absent': 'facility/function-room.json',
  'policy-zero': 'facility/party-room.json',
  'facility-closed': 'facility/sauna.json',
  'ineligible-present': 'facility/gym.json',
} as const;
export const FACILITY_PROBLEMS = {
  'record-not-found': 'problems/record-not-found.json',
  'internal-error': 'problems/internal-error.json',
} as const;

/** Availability fixtures, keyed by the facilityId they belong to. */
const AVAILABILITY_BY_FACILITY: Record<string, string> = {
  fac_wfg_function_room: 'availability/function-room-day.json',
};

export type ExploreState = keyof typeof EXPLORE_STATES | keyof typeof EXPLORE_PROBLEMS;
export type FacilityFixtureState = keyof typeof FACILITY_STATES | keyof typeof FACILITY_PROBLEMS;

export const EXPLORE_STATE_IDS = [
  ...Object.keys(EXPLORE_STATES), ...Object.keys(EXPLORE_PROBLEMS),
] as ExploreState[];
export const FACILITY_STATE_IDS = [
  ...Object.keys(FACILITY_STATES), ...Object.keys(FACILITY_PROBLEMS),
] as FacilityFixtureState[];

const at = <T>(path: string): T => CORPUS[path] as T;

export function searchAt(state: ExploreState): SearchResponse | undefined {
  const p = (EXPLORE_STATES as Record<string, string>)[state];
  return p ? at<SearchResponse>(p) : undefined;
}
export function facilityAt(state: FacilityFixtureState): FacilityDetail | undefined {
  const p = (FACILITY_STATES as Record<string, string>)[state];
  return p ? at<FacilityDetail>(p) : undefined;
}
export function problemAt(state: string): Problem | undefined {
  const p =
    (EXPLORE_PROBLEMS as Record<string, string>)[state] ??
    (FACILITY_PROBLEMS as Record<string, string>)[state];
  return p ? at<Problem>(p) : undefined;
}
export function availabilityFor(facilityId: string): AvailabilityView | undefined {
  const p = AVAILABILITY_BY_FACILITY[facilityId];
  return p ? at<AvailabilityView>(p) : undefined;
}

export const isExploreProblem = (s: string): boolean => s in EXPLORE_PROBLEMS;
export const isFacilityProblem = (s: string): boolean => s in FACILITY_PROBLEMS;
