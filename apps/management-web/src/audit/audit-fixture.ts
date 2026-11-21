/**
 * Audit log, S04: the fixture the screen reads until the contract freezes.
 *
 * audit-fixture.json is a GET /admin/audit-log response written out in full
 * (docs/contracts/audit-log-v0-PROPOSED_v0.1.md, section 3.1): the screen cannot tell it from a real one.
 * Wing Fu Garden, September 2026, on the clock the other fixtures use. It is JSON on purpose, because
 * it is a wire document and carries the contract’s role names as data. Reads are never audited, so there
 * is no row for opening this page.
 */

import type { AuditEvent, AuditLogResponse } from './audit-log.ts';
import { newestFirst } from './audit-log.ts';
import fixture from './audit-fixture.json' with { type: 'json' };

export const AUDIT_FIXTURE: AuditLogResponse = fixture as AuditLogResponse;

/** Newest first, as the route returns it. */
export const AUDIT_FIXTURE_EVENTS: readonly AuditEvent[] = [...AUDIT_FIXTURE.events].sort(newestFirst);
