-- Organizations — the tenancy root (ADR-002).
--
-- TWO organizations are seeded, and the second is not decoration. Cross-
-- organization isolation is a SECURITY test: a resident of Organization A must
-- not reach Organization B by any path, and a test cannot prove that without a
-- Organization B that actually holds data worth reaching.
--
-- The unit label is configurable per organization (PLT-01, ADR-003 Q5): Unit,
-- Flat and Room are alternative labels for the same level, and the label belongs
-- to the Organization tier rather than to Property Core's structure.
INSERT INTO platform.organization
  (organization_id, code, name_en, name_zh_hant, unit_label_en, unit_label_zh_hant, default_language)
VALUES
  ('org_wingfu_holdings', 'WFH', 'Wing Fu Property Holdings', '榮富物業集團', 'Flat', '室', 'en'),
  ('org_harbour_property', 'HBP', 'Harbour Property Management', '海景物業管理', 'Unit', '單位', 'en')
ON CONFLICT (organization_id) DO NOTHING;
