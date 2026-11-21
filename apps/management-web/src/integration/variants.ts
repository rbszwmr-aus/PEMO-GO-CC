/**
 * The integration-status screen variants, apart from integration-fixture.ts (which embeds the fixture JSON) so the
 * app shell can validate a state id without loading the fixture.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-20) Split out of integration-fixture.ts (initial-bundle work); the fixture re-exports these.
 */

export const INTEGRATION_VARIANTS = ['list', 'hub-late', 'hub-silent', 'hub-never', 'needs-mapping', 'places', 'places-empty'] as const;
export type IntegrationVariant = (typeof INTEGRATION_VARIANTS)[number];
export const isIntegrationVariant = (s: string): s is IntegrationVariant => (INTEGRATION_VARIANTS as readonly string[]).includes(s);
