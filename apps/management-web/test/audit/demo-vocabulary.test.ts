/** The demo API records the writes of the other screens in a dotted vocabulary; the Audit log says each in words, never “Other change”. */

import test from 'node:test';
import assert from 'node:assert/strict';

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, type AuditAction, type AuditEntityType } from '../../src/audit/audit-log.ts';
import { MESSAGES } from '../../src/i18n/messages.ts';
import { LOCALES } from '../../src/i18n/locale.ts';

const DEMO_ACTIONS = [
  'document.upload', 'document.add_version', 'document.update_metadata', 'document.check_out', 'document.check_in', 'document.download', 'document.write',
  'lookup.create', 'lookup.update', 'lookup.reorder', 'lookup.deactivate', 'lookup.delete',
  'ticket.create', 'ticket.assign', 'ticket.set_status',
  'visitor.create', 'visitor.redeem_pass', 'visitor.check_out',
  'notification.mark_read', 'notification.mark_all_read',
];
const DEMO_ENTITIES = ['document', 'lookup_item', 'lookup_list', 'ticket', 'visitor', 'pass', 'notification'];

test('every action and record kind the demo API writes has its own words in en, 繁 and 简', () => {
  for (const a of DEMO_ACTIONS) {
    assert.ok((AUDIT_ACTIONS as readonly string[]).includes(a), `${a} is in the vocabulary`);
    const m = MESSAGES.audit.action[a as AuditAction];
    for (const l of LOCALES) assert.ok(m[l] && m[l] !== MESSAGES.audit.unknownAction[l], `${a} in ${l}`);
  }
  for (const x of DEMO_ENTITIES) {
    assert.ok((AUDIT_ENTITY_TYPES as readonly string[]).includes(x), `${x} is in the record kinds`);
    const m = MESSAGES.audit.entityType[x as AuditEntityType];
    for (const l of LOCALES) assert.ok(m[l] && m[l] !== MESSAGES.audit.unknownType[l], `${x} in ${l}`);
  }
});
