import type { DemoNotice, DemoVisitor } from './types.js';
import { FIXTURE_RESIDENT_ID, FIXTURE_UNIT_ID } from './types.js';

export function seedNotices(): DemoNotice[] {
  return [
    {
      noticeId: 'ntc_seed_lift_maintenance',
      title: 'Lift B maintenance — 24 Sep',
      body:
        'Lift B in Block A will be out of service 09:00–17:00 on 24 Sep for scheduled maintenance. Use Lift A or the stairs. Enquiries: management office.',
      publishedAt: '2026-09-21T09:00:00+08:00',
      severity: 'warning',
      category: 'maintenance',
    },
    {
      noticeId: 'ntc_seed_water_tank',
      title: 'Water tank cleaning — overnight',
      body:
        'Estate water tank cleaning overnight 25–26 Sep. Expect brief low pressure around 01:00–04:00. Fill bottles beforehand if needed.',
      publishedAt: '2026-09-20T16:30:00+08:00',
      severity: 'info',
      category: 'utilities',
    },
    {
      noticeId: 'ntc_seed_fire_drill',
      title: 'Annual fire drill — 28 Sep 10:00',
      body:
        'Please evacuate via nearest stairwell when the alarm sounds. Assembly point: podium garden. Pets must be on leads.',
      publishedAt: '2026-09-19T11:00:00+08:00',
      severity: 'critical',
      category: 'safety',
    },
    {
      noticeId: 'ntc_seed_clubhouse_hours',
      title: 'Clubhouse extended hours this weekend',
      body:
        'Clubhouse open until 22:00 Fri–Sun this week for Mid-Autumn activities. Booking still required for private rooms.',
      publishedAt: '2026-09-18T14:00:00+08:00',
      severity: 'info',
      category: 'amenities',
    },
  ];
}

export function seedVisitors(): DemoVisitor[] {
  return [
    {
      visitorId: 'vis_seed_courier',
      name: 'SF Express courier',
      purpose: 'Parcel delivery',
      expectedFrom: '2026-09-23T14:00:00+08:00',
      expectedTo: '2026-09-23T16:00:00+08:00',
      hostUnitId: FIXTURE_UNIT_ID,
      idStub: null,
      residentRef: FIXTURE_RESIDENT_ID,
      status: 'expected',
      createdAt: '2026-09-22T10:00:00+08:00',
      updatedAt: '2026-09-22T10:00:00+08:00',
      checkedOutAt: null,
    },
    {
      visitorId: 'vis_seed_plumber',
      name: 'Wong Kai-ming',
      purpose: 'Kitchen U-bend repair',
      expectedFrom: '2026-09-21T09:00:00+08:00',
      expectedTo: '2026-09-21T12:00:00+08:00',
      hostUnitId: FIXTURE_UNIT_ID,
      idStub: 'HKID****1234',
      residentRef: FIXTURE_RESIDENT_ID,
      status: 'checked_out',
      createdAt: '2026-09-20T18:00:00+08:00',
      updatedAt: '2026-09-21T11:45:00+08:00',
      checkedOutAt: '2026-09-21T11:45:00+08:00',
    },
  ];
}
