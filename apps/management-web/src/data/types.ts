/**
 * The shapes this app renders, mirroring
 * packages/api-contracts/management-web/openapi.yaml.
 *
 * Hand-written rather than generated, and deliberately PARTIAL: it covers what
 * the five read surfaces render and nothing else. A generator would have added
 * a dependency to restate a contract this app only consumes.
 *
 * The contract is read-only to this PID. If these types and the contract
 * disagree, the contract is right and this file is the defect.
 */

import type { LocalizedText } from '../i18n/locale.ts';
import type { SeverityLevel } from '../theme/severity-tokens.g.ts';

export type ScopeKind =
  | 'organization' | 'portfolio' | 'estate' | 'phase'
  | 'building' | 'floor' | 'unit' | 'location';

export interface ScopeRef {
  kind: ScopeKind;
  id: string;
  label?: LocalizedText;
}

export interface ScopePath {
  node: ScopeRef;
  ancestry: ScopeRef[];
  /** True when the row belongs to NO hierarchy node at all — ADR-006 C4. */
  unassigned?: boolean;
}

export interface Meta {
  correlationId: string;
  contractVersion: string;
  generatedAt: string;
  partial?: boolean;
  degraded?: Array<{ section: string; reason: LocalizedText }>;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  correlationId: string;
  staffMessage?: LocalizedText;
  retryable?: boolean;
}

export type ServiceTargetState = 'met' | 'due' | 'overdue' | 'held' | 'action-required';
export interface ServiceTarget {
  state: ServiceTargetState;
  dueAt?: string | null;
  elapsedMinutes?: number | null;
  label: LocalizedText;
}

export type CommunicationState =
  | 'not-resident-visible' | 'published' | 'published-acknowledged'
  | 'update-overdue' | 'scheduled' | 'all-clear-sent' | 'quarantined';

export interface DeliveryState {
  status: 'scheduled' | 'delivered' | 'read' | 'blocked';
  at?: string | null;
}

export interface SafetyPermission {
  state: 'granted' | 'not-permitted' | 'expiring' | 'expired';
  expiresAt?: string | null;
}

export interface IntegrationFeed {
  key: 'twoiothub' | 'cmms';
  name: string;
  state: 'healthy' | 'degraded' | 'unavailable' | 'unknown';
  lastExchangeAt?: string | null;
}

export interface SafetyEventRow {
  eventId: string;
  reference: string;
  severity: SeverityLevel;
  title: LocalizedText;
  scope: ScopePath;
  /** Device or zone reference for a quarantined event. A FIELD, never prose. */
  unmappedSourceRef?: string | null;
  scopeSummary?: LocalizedText;
  source: 'in-unit-sensor' | 'fire-panel' | 'management';
  occurredAt: string;
  communication: CommunicationState;
  needsAction: boolean;
}

export interface SafetyEventListResponse {
  meta: Meta;
  events: SafetyEventRow[];
  window: { hours: number; returned: number; total: number; retentionMonths: number };
}

export interface SafetyEventDetailResponse {
  meta: Meta;
  event: SafetyEventRow;
  residentProjection: { title: LocalizedText; instruction: LocalizedText; disclaimer: LocalizedText };
}

export interface SafetyEventDeliveryResponse {
  meta: Meta;
  recipients: Array<{ recipientId: string; name: string; role: LocalizedText; state: DeliveryState }>;
  timeline: Array<{ at: string; what: LocalizedText; by?: string; tone?: string }>;
}

export interface SafetyEventSourceResponse {
  meta: Meta;
  sourceSystem: 'twoiothub';
  sourceEventId: string;
  classification: {
    source: { code: string; level: string };
    pemo: { severity: SeverityLevel; policyVersion: string; classifiedAt: string };
  };
  occurredAt: string;
  mapping: { state: 'mapped' | 'unmapped' | 'building'; sourceNodeRef?: string | null; unitId?: string | null };
}

export interface OverviewResponse {
  meta: Meta;
  counters: Array<{
    key: 'open-cases' | 'safety-events-window' | 'notices-active' | 'units-unknown-state';
    value: number;
    label: LocalizedText;
    windowHours?: number | null;
    basis?: { includesSeverities?: SeverityLevel[]; deduplicatedByUnit?: boolean };
  }>;
  attention: Array<{
    kind: 'safety' | 'case' | 'notice';
    title: LocalizedText;
    subtitle?: LocalizedText;
    target: ServiceTarget;
    link: { kind: string; id: string };
  }>;
  integrationHealth: IntegrationFeed[];
  recentNotices: NoticeRow[];
}

/**
 * THE ACT VOCABULARY — the contract's own operationIds (GEN-047 Amendment 1, A1).
 *
 * Declared as a runtime tuple so the type is derived from it and a node test can
 * compare the tuple against the contract's enum. Hand-listing is how a vocabulary
 * goes stale silently; this list is asserted equal to the contract on every run,
 * so widening the enum fails here until the client follows.
 */
export const ACT_OPERATION_IDS = [
  'addEstateContact', 'addMembership', 'approveNotice', 'composeNotice', 'conferGrant',
  'correctNotice', 'declineNotice', 'endOccupancy', 'provisionOrganization',
  'publishManagementUpdate', 'publishNotice', 'recordOccupancy', 'registerPrincipal',
  'removeMembership', 'reviseNotice', 'revokeGrant', 'submitNotice', 'withdrawNotice',
] as const;
export type ActOperationId = (typeof ACT_OPERATION_IDS)[number];

/** The seven notice transitions — the acts that address an EXISTING notice. */
export const NOTICE_TRANSITIONS = [
  'reviseNotice', 'submitNotice', 'approveNotice', 'declineNotice',
  'publishNotice', 'correctNotice', 'withdrawNotice',
] as const;
export type NoticeTransition = (typeof NOTICE_TRANSITIONS)[number];

export interface ScopeTreeNode {
  node: ScopeRef;
  parent?: ScopeRef | null;
  label: LocalizedText;
  summary?: LocalizedText;
  depth: number;
  /** Sibling order. Trees are sorted by sequence then id, never by label. */
  sequence?: number;
  attention?: boolean;
  /**
   * THE CONTAINER CARRIES IT TOO (GEN-047 Amendment 1, A2). The creation acts
   * this caller may perform NOW with a target under this node. At 2.1.0 the only
   * value that can appear is composeNotice.
   */
  permittedActions: ActOperationId[];
}

export interface PageMeta {
  limit?: number;
  after?: string | null;
  next: string | null;
  total?: number;
}

export interface ScopeTreeResponse { meta: Meta; grants: ScopeRef[]; nodes: ScopeTreeNode[]; page?: PageMeta }
export interface PropertyTreeResponse { meta: Meta; nodes: ScopeTreeNode[]; page?: PageMeta }

export interface UnitDetailResponse {
  meta: Meta;
  unit: {
    unitId: string;
    unitReference: string;
    label: LocalizedText;
    scope: ScopePath;
    facts: {
      homeSafety: { enrolled: boolean; serviceCount?: number };
      occupancyFrom: string;
      notificationLanguage: 'en' | 'zh-Hant';
      sizeAndType?: { systemOfRecord: 'pemo' | 'erp' | 'cmms'; areaSqFt?: number | null; layout?: string | null };
      mapping?: { state?: 'mapped' | 'unmapped'; sourceNodeRef?: string | null };
    };
    household: Array<{ name: string; role: LocalizedText; from?: string; to?: string | null; safety: SafetyPermission }>;
    externalReferences: Array<{ system: 'twoiothub' | 'cmms' | 'erp'; reference: string; state: 'linked' | 'read-only' | 'stale' | 'unavailable' }>;
  };
}

/* ------------------------------------------------------------------ */
/* Residents directory (UI-owned fixture shapes; not yet in OpenAPI)   */
/* ------------------------------------------------------------------ */

/** Directory / invitation / verification projection for WEB-05. */
export type ResidentDirectoryState =
  | 'verified'
  | 'invited'
  | 'pending_verification'
  | 'expired_scope';

export type ResidentOccupancyRole =
  | 'owner_occupier'
  | 'tenant'
  | 'household_member'
  | 'caregiver';

export interface ResidentListItem {
  residentId: string;
  displayName: string;
  preferredLanguage: 'en' | 'zh-Hant';
  directoryState: ResidentDirectoryState;
  primaryRole: ResidentOccupancyRole | null;
  unitSummary: LocalizedText | null;
  scope: ScopePath | null;
  invitation: { state: 'sent' | 'accepted' | 'expired'; sentAt: string; channel: 'app' | 'counter' | 'email' } | null;
  verification: { state: 'verified' | 'pending'; verifiedAt?: string };
  scopeEndedAt?: string;
}

export interface ResidentListResponse {
  meta: Meta;
  counts: {
    all: number;
    verified: number;
    invited: number;
    pendingVerification: number;
    expiredScope: number;
  };
  residents: ResidentListItem[];
}

export interface ResidentOccupancyRow {
  occupancyId: string;
  role: ResidentOccupancyRole;
  unitClass: 'residential' | 'parking' | 'storage';
  status: 'active' | 'ended';
  effectiveFrom: string;
  effectiveTo: string | null;
  householdId: string;
  scope: ScopePath;
}

export interface ResidentDetailResponse {
  meta: Meta;
  resident: {
    residentId: string;
    displayName: string;
    preferredLanguage: 'en' | 'zh-Hant';
    directoryState: ResidentDirectoryState;
    passReference: string | null;
    verification: { state: 'verified' | 'pending'; verifiedAt?: string };
    occupancies: ResidentOccupancyRow[];
  };
}

/* ------------------------------------------------------------------ */
/* Households directory (UI-owned fixture shapes; not yet in OpenAPI) */
/* ------------------------------------------------------------------ */

export type HouseholdOccupancyStatus = 'occupied' | 'ended';

export interface HouseholdListItem {
  householdId: string;
  unitId: string;
  unitSummary: LocalizedText;
  scope: ScopePath;
  primaryName: string;
  primaryRole: ResidentOccupancyRole;
  memberCount: number;
  occupancyFrom: string;
  notificationLanguage: 'en' | 'zh-Hant';
  /** Invoice To. Maps to `resident.household.contact_email`. */
  contactEmail: string | null;
  status: HouseholdOccupancyStatus;
}

export interface HouseholdListResponse {
  meta: Meta;
  counts: {
    all: number;
    occupied: number;
    withCaregiver: number;
    multiMember: number;
  };
  households: HouseholdListItem[];
}

export interface HouseholdMemberRow {
  residentId: string;
  name: string;
  role: ResidentOccupancyRole;
  effectiveFrom: string;
  effectiveTo: string | null;
  safety: SafetyPermission;
  authorisation: LocalizedText;
}

export interface HouseholdDetailResponse {
  meta: Meta;
  household: {
    householdId: string;
    unitId: string;
    unitReference: string;
    unitLabel: LocalizedText;
    scope: ScopePath;
    occupancyFrom: string;
    notificationLanguage: 'en' | 'zh-Hant';
    /** Invoice To. Maps to `resident.household.contact_email`. */
    contactEmail: string | null;
    status: HouseholdOccupancyStatus;
    contactPreferences: {
      channels: LocalizedText;
      quietHours: LocalizedText;
    };
    members: HouseholdMemberRow[];
  };
}

/* ------------------------------------------------------------------ */
/* Administration Email (UI-owned fixture SMTP; not in OpenAPI) */
/* ------------------------------------------------------------------ */

export type AdminEmailEncryption = 'none' | 'starttls' | 'tls';

export interface AdminEmailConfig {
  smtpHost: string;
  smtpPort: number;
  encryption: AdminEmailEncryption;
  username: string;
  smtpPass: string;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  testRecipient: string;
}

/* ------------------------------------------------------------------ */
/* Administration directory (UI-owned fixture shapes; not in OpenAPI) */
/* ------------------------------------------------------------------ */

/** Fixture staff roles — not the contract ConferGrantRequest enum. */
export type StaffRoleId =
  | 'administrator'
  | 'estate_manager'
  | 'help_desk'
  | 'security';

export type StaffDirectoryStatus = 'active' | 'inactive';

export type StaffFeatureId =
  | 'view_overview'
  | 'view_safety'
  | 'manage_cases'
  | 'manage_notices'
  | 'manage_visitors'
  | 'manage_properties'
  | 'manage_helpdesk'
  | 'admin_users'
  | 'manage_groups'
  | 'view_reports'
  | 'manage_access'
  | 'view_audit'
  | 'manage_residents'
  | 'manage_households'
  | 'manage_documents'
  | 'manage_bookings'
  | 'manage_payments';

export const STAFF_ROLE_IDS: readonly StaffRoleId[] = [
  'administrator',
  'estate_manager',
  'help_desk',
  'security',
];

export const STAFF_FEATURE_IDS: readonly StaffFeatureId[] = [
  'view_overview',
  'view_safety',
  'manage_cases',
  'manage_notices',
  'manage_visitors',
  'manage_properties',
  'manage_helpdesk',
  'admin_users',
  'manage_groups',
  'view_reports',
  'manage_access',
  'view_audit',
  'manage_residents',
  'manage_households',
  'manage_documents',
  'manage_bookings',
  'manage_payments',
];

export interface AdminUserListItem {
  staffId: string;
  displayName: string;
  email: string;
  roles: StaffRoleId[];
  status: StaffDirectoryStatus;
  groupCount: number;
}

export interface AdminUserListResponse {
  meta: Meta;
  counts: {
    all: number;
    active: number;
    inactive: number;
  };
  users: AdminUserListItem[];
}

export interface AdminUserGroupRef {
  groupId: string;
  name: LocalizedText;
}

export interface AdminUserDetailResponse {
  meta: Meta;
  user: {
    staffId: string;
    displayName: string;
    email: string;
    jobTitle: LocalizedText;
    status: StaffDirectoryStatus;
    roles: StaffRoleId[];
    groups: AdminUserGroupRef[];
    scopeSummary: LocalizedText;
  };
}

export interface AdminGroupListItem {
  groupId: string;
  name: LocalizedText;
  description: LocalizedText;
  memberCount: number;
  defaultRoles: StaffRoleId[];
  defaultScope: LocalizedText;
}

export interface AdminGroupListResponse {
  meta: Meta;
  counts: {
    all: number;
  };
  groups: AdminGroupListItem[];
}

export interface AdminGroupMemberRow {
  staffId: string;
  displayName: string;
  status: StaffDirectoryStatus;
}

export interface AdminGroupDetailResponse {
  meta: Meta;
  group: {
    groupId: string;
    name: LocalizedText;
    description: LocalizedText;
    members: AdminGroupMemberRow[];
    defaultRoles: StaffRoleId[];
    defaultScope: LocalizedText;
    /**
     * Session extras beyond the group’s default roles through the matrix.
     * Displayed PEMO grants = RoleFeatures ∪ pemo_features − pemo_denied.
     */
    pemo_features?: readonly string[];
    /** Session ungrants of role-derived PEMO features. */
    pemo_denied?: readonly string[];
    /**
     * Optional ParkCore claim stubs for Groups Rights when `parkcore` is licensed.
     * EffectiveAllowed = RoleAllows(parkcore_role) ∪ filter(parkcore_actions).
     * Empty / invalid role → no table grants. Not a management-web OpenAPI field.
     * Session ungrants of role-derived actions live in parkcore_denied.
     */
    parkcore_role?: string;
    parkcore_actions?: readonly string[];
    parkcore_denied?: readonly string[];
  };
}

export interface AdminRolesMatrixResponse {
  meta: Meta;
  roles: readonly StaffRoleId[];
  features: readonly StaffFeatureId[];
  granted: Readonly<Record<StaffRoleId, readonly StaffFeatureId[]>>;
}

export interface CaseListResponse {
  meta: Meta;
  cases: Array<{
    reference: string;
    subject: LocalizedText;
    category: 'building-services' | 'enquiry' | 'complaint';
    scope: ScopePath;
    assignee: { state: 'assigned' | 'unassigned'; name?: string | null };
    target: ServiceTarget;
    status: 'new' | 'in-progress' | 'awaiting-resident' | 'resolved' | 'closed';
  }>;
  counts: { open: number; assignedToMe?: number; overdue: number; all: number };
}

/**
 * `NoticeRow` is the S2 OVERVIEW's compact summary and keeps the pre-ADR-019
 * vocabulary ON PURPOSE. `GEN-043` retained it unchanged through the MAJOR:
 * `recentNotices` is a different operation, and a major bump is not a licence to
 * reshape everything that touches the word "notice". Do not "harmonise" these two
 * vocabularies — they describe different payloads, and the contract says so.
 */
export type NoticeState = 'draft' | 'awaiting-approval' | 'scheduled' | 'published' | 'withdrawn';
export type NoticeType = 'building-services' | 'planned-interruption' | 'community' | 'emergency-follow-up';

export interface NoticeRow {
  noticeId: string;
  type: NoticeType;
  title: LocalizedText;
  state: NoticeState;
  publishedAt?: string | null;
}

/**
 * ---------------------------------------------------------------- ADR-019 notices
 *
 * The staff notices surface, reshaped at `GEN-043` — the breaking change that took
 * management-web to `2.0.0`.
 *
 * TWO VOCABULARIES, DISJOINT BY CONSTRUCTION. `NoticeLifecycleState` is what the
 * notice IS; `NoticeDisposition` is what an actor DID. The contract makes the two
 * enums share no value so that comparing against the wrong one is a type error
 * rather than a silent false. They are declared separately here for the same
 * reason, and neither is hand-extended.
 *
 * Titles: at 2.0.0 the LIST carried `titleEn` ONLY (UI-045 finding G2). GEN-047
 * closed it — the list carries both languages from 2.1.0, and `stateEnteredAt`
 * and `permittedActions` are REQUIRED on list item and detail alike (step ruling
 * b: an always-emitted field declared optional is a false contract).
 */
export type NoticeLifecycleState =
  | 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'live' | 'expired' | 'withdrawn';

export type NoticeDisposition =
  | 'draft_saved' | 'approval_requested' | 'approval_granted'
  | 'publication_released' | 'withdrawal_recorded';

export type StaffNoticeType = 'general' | 'planned_interruption' | 'emergency' | 'event_community';

export interface StaffNoticeListItem {
  noticeId: string;
  /** The contract types this as a bare string with NO enum on the list item. See G3. */
  noticeType: string;
  titleEn: string;
  titleZhHant: string;
  lifecycleState: NoticeLifecycleState;
  /** When the notice entered `lifecycleState` — the latest assertion's recordedAt (GEN-047 D2). */
  stateEnteredAt: string;
  /** The acts THIS caller may perform on THIS notice NOW, decided by the server (GEN-047 D1). */
  permittedActions: ActOperationId[];
  publishAt?: string | null;
  expireAt?: string | null;
  mandatoryAck: boolean;
  version: number;
}

export interface StaffNoticeListResponse { meta: Meta; notices: StaffNoticeListItem[] }

/** One row of the targeting rule. Names a node, or an ADR-003 Location, or both. */
export interface NoticeTarget {
  nodeKind?: 'organization' | 'estate' | 'building' | 'floor' | 'unit' | null;
  nodeId?: string | null;
  locationId?: string | null;
}

export interface NoticeHistoryEntry {
  version: number;
  disposition: NoticeDisposition;
  recordedAt: string;
  recordedBy: string;
}

export interface StaffNoticeDetail {
  noticeId: string;
  noticeType: StaffNoticeType;
  titleEn: string;
  titleZhHant: string;
  bodyEn: string;
  bodyZhHant: string;
  lifecycleState: NoticeLifecycleState;
  stateEnteredAt: string;
  permittedActions: ActOperationId[];
  publishAt?: string | null;
  expireAt?: string | null;
  mandatoryAck: boolean;
  version: number;
  responseOptions?: string[] | null;
  targets: NoticeTarget[];
  /** STAFF ONLY — residents never receive the disposition chain. */
  history: NoticeHistoryEntry[];
}

export interface StaffNoticeDetailResponse { meta: Meta; notice: StaffNoticeDetail }

export interface NoticeRecipientStatus {
  residentId: string;
  unitId: string;
  read?: string | null;
  acknowledged?: string | null;
  response?: string | null;
}

export interface NoticeOutstandingResponse {
  meta: Meta;
  noticeId: string;
  mandatoryAck: boolean;
  recipients: NoticeRecipientStatus[];
}

/* ------------------------------------------------------- the write surface (UI-051) */

/**
 * `ComposeNoticeRequest`, field for field. BOTH LANGUAGES ARE PRESENT IN THE SHAPE
 * even though a draft may leave them empty: publication refuses a half-translated
 * notice, and the contract keeps that decision at publish time rather than in the
 * schema. The form renders exactly these fields and no others.
 */
export interface ComposeNoticeRequest {
  noticeType: StaffNoticeType;
  titleEn: string;
  titleZhHant: string;
  bodyEn: string;
  bodyZhHant: string;
  publishAt?: string | null;
  expireAt?: string | null;
  mandatoryAck?: boolean;
  incidentRef?: string | null;
  responseOptions?: string[] | null;
  targets: NoticeTarget[];
}

/**
 * `NoticeTransitionRequest`, shared by all seven transitions. `fromVersion` is what
 * makes a retry distinguishable from a late duplicate; the optional content
 * fields are JUDGED BY THE ACT (submit ignores them, correct refuses a changed
 * `targets`), so the shape passes them through rather than dropping them.
 */
export interface NoticeTransitionRequest {
  fromVersion: number;
  titleEn?: string;
  titleZhHant?: string;
  bodyEn?: string;
  bodyZhHant?: string;
  publishAt?: string | null;
  expireAt?: string | null;
  mandatoryAck?: boolean;
  responseOptions?: string[];
  targets?: NoticeTarget[];
  /** The contract types this as a bare string: no vocabulary is declared for it. See UI-051 G-findings. */
  reasonCode?: string | null;
}

export interface NoticeActResponse { meta: Meta; noticeId: string; version: number }
