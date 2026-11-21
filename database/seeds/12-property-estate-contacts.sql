-- Estate contacts and directory (PRP-04), owned by Property Core.
--
-- This is what MOB-03's help-desk card reads. Opening hours are stored as bounds
-- rather than as an `openNow` boolean, so the answer is computed at the request
-- instant and cannot go stale.
--
-- Telephone numbers are placeholders chosen NOT to match the hk-mobile-number
-- pattern in forbidden-terms.json: 999 is the emergency number and 3123 4567 has a
-- 3 prefix, which is a landline range. Fixtures and seeds must contain no personal
-- data.
INSERT INTO property.estate_contact
  (contact_id, estate_id, contact_kind, name_en, name_zh_hant, telephone,
   hours_en, hours_zh_hant, instructions_en, instructions_zh_hant,
   opens_at, closes_at, typical_reply_minutes, sort_order)
VALUES
  ('ctc_wfg_office', 'est_wing_fu_garden', 'management_office',
   'Management Office', '管理處', '3123 4567',
   'Open 08:00–20:00 daily', '每日08:00至20:00開放',
   'Staff usually reply within 30 minutes during office hours.', '辦公時間內職員通常於30分鐘內回覆。',
   '08:00', '20:00', 30, 0),

  ('ctc_wfg_emergency', 'est_wing_fu_garden', 'emergency',
   'Emergency services', '緊急服務', '999',
   'Always available', '全日24小時',
   'Call 999 for fire, ambulance or police.', '火警、救護或報警請致電999。',
   NULL, NULL, NULL, 1),

  ('ctc_twc_office', 'est_tsz_wan_court', 'management_office',
   'Management Office', '管理處', '3123 8899',
   'Open 09:00–18:00 daily', '每日09:00至18:00開放',
   'Staff usually reply within 60 minutes during office hours.', '辦公時間內職員通常於60分鐘內回覆。',
   '09:00', '18:00', 60, 0)
ON CONFLICT (contact_id) DO NOTHING;
