/**
 * The shapes this app renders, mirroring
 * packages/api-contracts/resident-portal/openapi.yaml (READ-ONLY to this PID).
 *
 * Hand-written and deliberately faithful: if these types and the contract
 * disagree, the CONTRACT is right and this file is the defect. Every policy
 * field is `| null` because `null` means "the property does not operate this
 * policy" and is a different statement from a set value (R7) — the type system
 * carries that distinction so a component cannot quietly drop it.
 */

import type { LocalizedText } from '../i18n/locale.ts';

export interface Meta {
  correlationId: string;
  contractVersion: string;
  generatedAt: string;
}

export interface Money {
  amount: number;
  currency: 'HKD';
}

export type Category =
  | 'function-and-event' | 'sports-and-fitness' | 'wellness' | 'outdoor' | 'community';

export type FacilityStateName = 'open' | 'closed' | 'coming-soon';

export interface FacilityState {
  state: FacilityStateName;
  reason: LocalizedText | null;
  /** date (YYYY-MM-DD) or null. Null = unknown; NEVER invent one (e.g. the export's "25 Aug"). */
  expectedReturn: string | null;
}

/** unavailable deliberately collapses booked-by-another and held — render ONE thing. */
export type SlotState = 'available' | 'unavailable' | 'past' | 'blocked';

export type EligibilityReason =
  | 'residency-standing-required' | 'membership-required' | 'per-person-quota-reached'
  | 'booking-window-closed' | 'facility-closed';

export interface Eligibility {
  eligible: boolean;
  /** Present iff eligible is false. The caller's OWN conditions — never another party. */
  reason: EligibilityReason | null;
}

export interface BookingWindow {
  opensDaysBefore: number;
  closesHoursBefore: number;
}

export interface CancellationTier {
  untilHoursBefore: number;
  refundPercent: number;
}

/** R7: every field nullable; null/omitted = "property does not operate this policy". */
export interface FacilityRules {
  bookingWindow?: BookingWindow | null;
  perPersonQuotaPerMonth?: number | null;
  cancellationLadder?: CancellationTier[] | null;
  adminFee?: Money | null;
  noShowReleaseMinutes?: number | null;
  makeUpAllowed?: boolean | null;
}

export interface RateCardRow {
  label: LocalizedText;
  price: Money;
  appliesTo: LocalizedText;
}

export interface Equipment {
  label: LocalizedText;
  included: boolean;
  addOnPrice?: Money | null;
}

export interface ComposedLocation {
  locationId: string;
  locationClass?: 'clubhouse' | 'public_facility';
  parentLocationId?: string | null;
  buildingLabel?: LocalizedText | null;
  floorLabel?: LocalizedText | null;
  provisional: boolean;
}

export interface FacilityCard {
  facilityId: string;
  name: LocalizedText;
  category: Category;
  location: ComposedLocation;
  capacity?: number | null;
  fromPrice?: Money | null;
  availability: FacilityState;
  nextFreeSlot?: string | null;
  eligibility: Eligibility;
}

export interface FacetCount {
  key: string;
  count: number;
  /** Provenance prose. NOT rendered to the user (Finding A: currently page-scoped and false). */
  basis: string;
}

export interface Facets {
  scope: 'world' | 'page';
  categories: FacetCount[];
  filters: FacetCount[];
}

export interface SearchResponse {
  meta: Meta;
  results: FacilityCard[];
  facets: Facets;
  page: { page: number; pageSize: number; total: number };
}

export interface FacilityDetail {
  meta: Meta;
  facilityId: string;
  name: LocalizedText;
  category: Category;
  location: ComposedLocation;
  availability: FacilityState;
  eligibility: Eligibility;
  overview: {
    description: LocalizedText;
    amenities?: LocalizedText[];
    accessibility?: LocalizedText[];
    capacity?: number | null;
    slotGranularityMinutes?: number | null;
    serviceHours?: LocalizedText | null;
  };
  rates: RateCardRow[];
  rules: FacilityRules;
  equipment: Equipment[];
  faq: { question: LocalizedText; answer: LocalizedText }[];
}

export interface AvailabilitySlot {
  startsAt: string;
  endsAt: string;
  state: SlotState;
}

export interface AvailabilityView {
  meta: Meta;
  facilityId: string;
  view: 'day' | 'week' | 'month';
  from: string;
  facilityState: FacilityState;
  slots: AvailabilitySlot[];
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  correlationId: string;
  residentMessage?: LocalizedText;
  retryable?: boolean;
}
