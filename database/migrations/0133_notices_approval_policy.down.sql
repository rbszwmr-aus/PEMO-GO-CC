-- Reverse of 0133. Safe: the table is policy, not record — dropping it returns
-- every type to the fail-closed default, which refuses more, never less.
DROP TABLE IF EXISTS notices.approval_policy;
