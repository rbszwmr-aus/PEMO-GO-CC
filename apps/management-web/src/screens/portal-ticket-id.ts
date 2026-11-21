/**
 * Portal-ticket id test, apart from PortalTicketsPanel.tsx so the app shell can route without loading the panel.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-20) Split out of PortalTicketsPanel.tsx (initial-bundle work); the panel re-exports it.
 */

export function isPortalTicketId(id: string): boolean {
  return id.startsWith('tkt_') || id.startsWith('tkt_');
}
