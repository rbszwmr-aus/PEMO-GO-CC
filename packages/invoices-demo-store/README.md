# @pemo/invoices-demo-store

In-memory, **read-only** demo household invoices (management fee / strata
charges) for the resident-portal Invoices screen. Pure TypeScript (no React,
no pg). Freeze: `docs/contracts/resident-portal-v0-invoices-demo.md`.

- Invoice ids reuse the strata charge id style: `chg_wfg_a1_YYYYMM[_suffix]`
  (the two that exist in `database/seeds/80-strata-wing-fu-charges.sql` —
  `chg_wfg_a1_202609`, `chg_wfg_a1_202608` — keep the same id, amount and
  payment `pay_wfg_r1001`).
- Amounts are **integer HKD** (`amountHkd`, `paidHkd`, `balanceHkd`), same as
  the management-web strata freeze.
- Fixture household `hh_wfg_a_12_a1` (Ho Mei-yi, Block A 12/F Flat A1) is
  resolved from demo resident `res_demo_ho_mei_yi`.
- Process singleton via `getDemoInvoiceStore()`. No writes.
