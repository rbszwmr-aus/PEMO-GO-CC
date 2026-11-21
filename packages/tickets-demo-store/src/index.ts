export type {
  CreateTicketInput,
  DemoAdmin,
  DemoTicket,
  DemoTicketStatus,
  DemoTimelineActor,
  DemoTimelineEvent,
  DemoTimelineKind,
  HelpdeskChromeState,
  HelpdeskContactDetailChrome,
  HelpdeskQueueRowChrome,
  HelpdeskTimelineTurnChrome,
  HelpdeskTone,
  LocalizedText,
  PortalTicketDetail,
  PortalTicketSummary,
  TicketStatus,
} from './types.js';
export {
  DEMO_TICKET_STATUSES,
  FIXTURE_RESIDENT_ID,
  FIXTURE_RESIDENT_NAME,
  FIXTURE_UNIT_LABEL,
  TICKET_STATUS,
  isTicketStatus,
} from './types.js';
export { DEMO_ADMINS, seedTickets } from './seed.js';
export {
  statusToStaffChrome,
  toHelpdeskContactDetail,
  toHelpdeskQueueRow,
  toPortalSummary,
  toPortalTicketDetail,
  toPortalTicketSummary,
} from './adapters.js';
export {
  createPortalTicketStore,
  createTicketStore,
  getDemoTicketStore,
  getPortalTicketStore,
  resetDemoTicketStoreForTests,
  resetPortalTicketStoreForTests,
  type DemoTicketStore,
  type PortalTicketStore,
} from './store.js';
