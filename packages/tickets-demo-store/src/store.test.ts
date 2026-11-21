import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createTicketStore,
  FIXTURE_RESIDENT_ID,
  FIXTURE_RESIDENT_NAME,
  FIXTURE_UNIT_LABEL,
  statusToStaffChrome,
  toHelpdeskQueueRow,
  toPortalTicketDetail,
} from './index.js';

describe('tickets-demo-store', () => {
  it('seeds and lists for fixture resident', () => {
    const store = createTicketStore();
    const mine = store.listForReporter(FIXTURE_RESIDENT_ID);
    assert.ok(mine.length >= 2);
    assert.equal(store.listAll().length, mine.length);
  });

  it('create → assign → status round-trip; ids are tkt_', () => {
    const store = createTicketStore([]);
    const created = store.create({
      subject: 'Lift button stuck',
      body: 'Floor 12 call button does not light.',
      category: 'access',
      unitLabel: FIXTURE_UNIT_LABEL,
      reporterRef: FIXTURE_RESIDENT_ID,
      createdByName: FIXTURE_RESIDENT_NAME,
    });
    assert.ok(created.id.startsWith('tkt_'));
    assert.equal(created.status, 'open');
    assert.equal(created.assignedAdminId, null);

    const assigned = store.assign(created.id, {
      adminId: 'stf_wfg_manager',
      adminLabel: 'Chan Mei-ling 陳美玲',
    });
    assert.ok(assigned);
    assert.equal(assigned.assignedAdminId, 'stf_wfg_manager');
    assert.equal(assigned.status, 'open'); // assign is not a status

    const progressed = store.setStatus(created.id, 'in_progress', 'Tech booked');
    assert.ok(progressed);
    assert.equal(progressed.status, 'in_progress');
    assert.ok(progressed.timeline.some((e) => e.kind === 'note'));

    const detail = toPortalTicketDetail(progressed);
    assert.equal(detail.assignedAdminLabel, 'Chan Mei-ling 陳美玲');
    assert.ok(!detail.timeline.some((e) => e.kind === 'note')); // internal note hidden
    assert.equal(statusToStaffChrome(progressed.status), 'in_progress');
    assert.equal(toHelpdeskQueueRow(progressed).state, 'in_progress');
  });

  it('maps chrome like compose-helpdesk', () => {
    assert.equal(statusToStaffChrome('awaiting_resident'), 'in_progress');
    assert.equal(statusToStaffChrome('triaged'), 'waiting');
    assert.equal(statusToStaffChrome('closed'), 'closed');
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(statusToStaffChrome('open', past), 'overdue');
  });
});
