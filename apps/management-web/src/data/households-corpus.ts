/**
 * UI-owned Households fixtures (WEB-04 vertical slice).
 *
 * Kept OUT of tests/fixtures/management-web/index.json because the management
 * OpenAPI has no listHouseholds / getHousehold reads yet (household appears only
 * nested under getUnitDetail). Contract package is read-only to this surface;
 * live stays on v0 freeze (scope + tree). See
 * docs/contracts/proposed-households-read-ops.md.
 *
 * JSON sources remain under ./households-fixtures/ for review; this module is the
 * runtime corpus (same approach as visitor-fixtures / residents-corpus).
 *
 * Detail rows are keyed by householdId so list → detail opens the matching
 * composition (caregiver / effective dates / contact preferences).
 */

import type { HouseholdDetailResponse, HouseholdListResponse } from './types.ts';

export const HOUSEHOLDS_LIST = {
  "meta": {
    "correlationId": "8b2c3d4e-hh00-4000-8000-000000000001",
    "contractVersion": "2.3.0",
    "generatedAt": "2026-08-12T09:56:00+08:00"
  },
  "counts": {
    "all": 4,
    "occupied": 3,
    "withCaregiver": 1,
    "multiMember": 2
  },
  "households": [
    {
      "householdId": "hh_wfg_a_12_a1",
      "unitId": "unit_wfg_a_12_a1",
      "unitSummary": {
        "en": "Block A · 12/F · Flat A1",
        "zh-Hant": "A座 · 12樓 · A1室"
      },
      "scope": {
        "node": {
          "kind": "unit",
          "id": "unit_wfg_a_12_a1",
          "label": {
            "en": "Flat A1",
            "zh-Hant": "A1室"
          }
        },
        "ancestry": [
          {
            "kind": "organization",
            "id": "org_wingfu_holdings",
            "label": {
              "en": "Wing Fu Property Management",
              "zh-Hant": "榮富物業管理"
            }
          },
          {
            "kind": "estate",
            "id": "est_wing_fu_garden",
            "label": {
              "en": "Wing Fu Garden",
              "zh-Hant": "榮富花園"
            }
          },
          {
            "kind": "building",
            "id": "blk_wfg_a",
            "label": {
              "en": "Block A",
              "zh-Hant": "A座"
            }
          },
          {
            "kind": "floor",
            "id": "fl_wfg_a_12",
            "label": {
              "en": "12/F",
              "zh-Hant": "12樓"
            }
          }
        ]
      },
      "primaryName": "Ho Mei-yi 何美儀",
      "primaryRole": "owner_occupier",
      "memberCount": 3,
      "occupancyFrom": "2024-03-01",
      "notificationLanguage": "zh-Hant",
      "contactEmail": "ho.meiyi@wingfu.example",
      "status": "occupied"
    },
    {
      "householdId": "hh_wfg_b_03_b2",
      "unitId": "unit_wfg_b_03_b2",
      "unitSummary": {
        "en": "Block B · 3/F · Flat B2",
        "zh-Hant": "B座 · 3樓 · B2室"
      },
      "scope": {
        "node": {
          "kind": "unit",
          "id": "unit_wfg_b_03_b2",
          "label": {
            "en": "Flat B2",
            "zh-Hant": "B2室"
          }
        },
        "ancestry": [
          {
            "kind": "organization",
            "id": "org_wingfu_holdings",
            "label": {
              "en": "Wing Fu Property Management",
              "zh-Hant": "榮富物業管理"
            }
          },
          {
            "kind": "estate",
            "id": "est_wing_fu_garden",
            "label": {
              "en": "Wing Fu Garden",
              "zh-Hant": "榮富花園"
            }
          },
          {
            "kind": "building",
            "id": "blk_wfg_b",
            "label": {
              "en": "Block B",
              "zh-Hant": "B座"
            }
          },
          {
            "kind": "floor",
            "id": "fl_wfg_b_03",
            "label": {
              "en": "3/F",
              "zh-Hant": "3樓"
            }
          }
        ]
      },
      "primaryName": "Tam Siu-fong 譚小芳",
      "primaryRole": "owner_occupier",
      "memberCount": 2,
      "occupancyFrom": "2022-11-15",
      "notificationLanguage": "zh-Hant",
      "contactEmail": "tam.siufong@wingfu.example",
      "status": "occupied"
    },
    {
      "householdId": "hh_wfg_c_08_c3",
      "unitId": "unit_wfg_c_08_c3",
      "unitSummary": {
        "en": "Block C · 8/F · Flat C3",
        "zh-Hant": "C座 · 8樓 · C3室"
      },
      "scope": {
        "node": {
          "kind": "unit",
          "id": "unit_wfg_c_08_c3",
          "label": {
            "en": "Flat C3",
            "zh-Hant": "C3室"
          }
        },
        "ancestry": [
          {
            "kind": "organization",
            "id": "org_wingfu_holdings",
            "label": {
              "en": "Wing Fu Property Management",
              "zh-Hant": "榮富物業管理"
            }
          },
          {
            "kind": "estate",
            "id": "est_wing_fu_garden",
            "label": {
              "en": "Wing Fu Garden",
              "zh-Hant": "榮富花園"
            }
          },
          {
            "kind": "building",
            "id": "blk_wfg_c",
            "label": {
              "en": "Block C",
              "zh-Hant": "C座"
            }
          },
          {
            "kind": "floor",
            "id": "fl_wfg_c_08",
            "label": {
              "en": "8/F",
              "zh-Hant": "8樓"
            }
          }
        ]
      },
      "primaryName": "Chan Ka-ming 陳家明",
      "primaryRole": "household_member",
      "memberCount": 1,
      "occupancyFrom": "2023-06-01",
      "notificationLanguage": "en",
      "contactEmail": "chan.kaming@wingfu.example",
      "status": "occupied"
    },
    {
      "householdId": "hh_wfg_a_05_a4_ended",
      "unitId": "unit_wfg_a_05_a4",
      "unitSummary": {
        "en": "Block A · 5/F · Flat A4 (ended)",
        "zh-Hant": "A座 · 5樓 · A4室（已結束）"
      },
      "scope": {
        "node": {
          "kind": "unit",
          "id": "unit_wfg_a_05_a4",
          "label": {
            "en": "Flat A4",
            "zh-Hant": "A4室"
          }
        },
        "ancestry": [
          {
            "kind": "organization",
            "id": "org_wingfu_holdings",
            "label": {
              "en": "Wing Fu Property Management",
              "zh-Hant": "榮富物業管理"
            }
          },
          {
            "kind": "estate",
            "id": "est_wing_fu_garden",
            "label": {
              "en": "Wing Fu Garden",
              "zh-Hant": "榮富花園"
            }
          },
          {
            "kind": "building",
            "id": "blk_wfg_a",
            "label": {
              "en": "Block A",
              "zh-Hant": "A座"
            }
          },
          {
            "kind": "floor",
            "id": "fl_wfg_a_05",
            "label": {
              "en": "5/F",
              "zh-Hant": "5樓"
            }
          }
        ]
      },
      "primaryName": "Cheung Tak-wah 張德華",
      "primaryRole": "tenant",
      "memberCount": 1,
      "occupancyFrom": "2021-01-01",
      "notificationLanguage": "zh-Hant",
      "contactEmail": "cheung.takwah@wingfu.example",
      "status": "ended"
    }
  ]
} as HouseholdListResponse;

export const HOUSEHOLDS_EMPTY = {
  "meta": {
    "correlationId": "8b2c3d4e-hh00-4000-8000-0000000000e0",
    "contractVersion": "2.3.0",
    "generatedAt": "2026-08-12T09:56:00+08:00"
  },
  "counts": {
    "all": 0,
    "occupied": 0,
    "withCaregiver": 0,
    "multiMember": 0
  },
  "households": []
} as HouseholdListResponse;

export const HOUSEHOLD_DETAILS: Readonly<Record<string, HouseholdDetailResponse>> = {
  "hh_wfg_a_12_a1": {
  "meta": {
    "correlationId": "8b2c3d4e-hh00-4000-8000-0000000000d1",
    "contractVersion": "2.3.0",
    "generatedAt": "2026-08-12T09:56:00+08:00"
  },
  "household": {
    "householdId": "hh_wfg_a_12_a1",
    "unitId": "unit_wfg_a_12_a1",
    "unitReference": "unit-8801-A1",
    "contactEmail": "ho.meiyi@wingfu.example",
    "unitLabel": {
      "en": "Flat A1, 12/F, Block A",
      "zh-Hant": "A座12樓A1室"
    },
    "scope": {
      "node": {
        "kind": "unit",
        "id": "unit_wfg_a_12_a1",
        "label": {
          "en": "Flat A1",
          "zh-Hant": "A1室"
        }
      },
      "ancestry": [
        {
          "kind": "organization",
          "id": "org_wingfu_holdings",
          "label": {
            "en": "Wing Fu Property Management",
            "zh-Hant": "榮富物業管理"
          }
        },
        {
          "kind": "estate",
          "id": "est_wing_fu_garden",
          "label": {
            "en": "Wing Fu Garden",
            "zh-Hant": "榮富花園"
          }
        },
        {
          "kind": "building",
          "id": "blk_wfg_a",
          "label": {
            "en": "Block A",
            "zh-Hant": "A座"
          }
        },
        {
          "kind": "floor",
          "id": "fl_wfg_a_12",
          "label": {
            "en": "12/F",
            "zh-Hant": "12樓"
          }
        }
      ]
    },
    "occupancyFrom": "2024-03-01",
    "notificationLanguage": "zh-Hant",
    "status": "occupied",
    "contactPreferences": {
      "channels": {
        "en": "App inbox · SMS fallback · estate notice board",
        "zh-Hant": "應用程式收件箱 · SMS 後備 · 大廈通告板"
      },
      "quietHours": {
        "en": "22:00–07:00 HKT (non-emergency)",
        "zh-Hant": "香港時間 22:00–07:00（非緊急）"
      }
    },
    "members": [
      {
        "residentId": "res_wfg_000412",
        "name": "Ho Mei-yi 何美儀",
        "role": "owner_occupier",
        "effectiveFrom": "2024-03-01",
        "effectiveTo": null,
        "safety": {
          "state": "granted"
        },
        "authorisation": {
          "en": "Primary resident — full household administration in the resident app.",
          "zh-Hant": "主要住戶 — 可於住戶應用程式管理住戶單位。"
        }
      },
      {
        "residentId": "res_wfg_000908",
        "name": "Chan Ka-ming 陳家明",
        "role": "household_member",
        "effectiveFrom": "2024-03-01",
        "effectiveTo": null,
        "safety": {
          "state": "not-permitted"
        },
        "authorisation": {
          "en": "Household member — safety viewing not granted by the primary resident.",
          "zh-Hant": "住戶成員 — 主要住戶未授予安全資料查看權。"
        }
      },
      {
        "residentId": "res_wfg_000733",
        "name": "Lam Siu-fung 林小鳳",
        "role": "caregiver",
        "effectiveFrom": "2025-06-01",
        "effectiveTo": "2026-09-30",
        "safety": {
          "state": "expiring",
          "expiresAt": "2026-09-30T00:00:00+08:00"
        },
        "authorisation": {
          "en": "Caregiver authorisation effective until 30 Sep 2026. Safety viewing expires with the authorisation.",
          "zh-Hant": "照顧者授權有效至 2026年9月30日。安全資料查看權隨授權一併到期。"
        }
      }
    ]
  }
} as HouseholdDetailResponse,
  "hh_wfg_b_03_b2": {
  "meta": {
    "correlationId": "8b2c3d4e-hh00-4000-8000-0000000000d2",
    "contractVersion": "2.3.0",
    "generatedAt": "2026-08-12T09:56:00+08:00"
  },
  "household": {
    "householdId": "hh_wfg_b_03_b2",
    "unitId": "unit_wfg_b_03_b2",
    "unitReference": "unit-8801-B2",
    "contactEmail": "tam.siufong@wingfu.example",
    "unitLabel": {
      "en": "Flat B2, 3/F, Block B",
      "zh-Hant": "B座3樓B2室"
    },
    "scope": {
      "node": {
        "kind": "unit",
        "id": "unit_wfg_b_03_b2",
        "label": {
          "en": "Flat B2",
          "zh-Hant": "B2室"
        }
      },
      "ancestry": [
        {
          "kind": "organization",
          "id": "org_wingfu_holdings",
          "label": {
            "en": "Wing Fu Property Management",
            "zh-Hant": "榮富物業管理"
          }
        },
        {
          "kind": "estate",
          "id": "est_wing_fu_garden",
          "label": {
            "en": "Wing Fu Garden",
            "zh-Hant": "榮富花園"
          }
        },
        {
          "kind": "building",
          "id": "blk_wfg_b",
          "label": {
            "en": "Block B",
            "zh-Hant": "B座"
          }
        },
        {
          "kind": "floor",
          "id": "fl_wfg_b_03",
          "label": {
            "en": "3/F",
            "zh-Hant": "3樓"
          }
        }
      ]
    },
    "occupancyFrom": "2022-11-15",
    "notificationLanguage": "zh-Hant",
    "status": "occupied",
    "contactPreferences": {
      "channels": {
        "en": "App inbox · phone call for urgent notices",
        "zh-Hant": "應用程式收件箱 · 緊急通知電話"
      },
      "quietHours": {
        "en": "23:00–08:00 HKT (non-emergency)",
        "zh-Hant": "香港時間 23:00–08:00（非緊急）"
      }
    },
    "members": [
      {
        "residentId": "res_wfg_000501",
        "name": "Tam Siu-fong 譚小芳",
        "role": "owner_occupier",
        "effectiveFrom": "2022-11-15",
        "effectiveTo": null,
        "safety": {
          "state": "granted"
        },
        "authorisation": {
          "en": "Primary resident — owns the unit and administers household membership.",
          "zh-Hant": "主要住戶 — 單位業主，管理住戶成員。"
        }
      },
      {
        "residentId": "res_wfg_000512",
        "name": "Tam Yee-man 譚綺雯",
        "role": "tenant",
        "effectiveFrom": "2024-09-01",
        "effectiveTo": null,
        "safety": {
          "state": "granted"
        },
        "authorisation": {
          "en": "Tenant — occupancy under a mirrored tenancy record; safety viewing granted by the primary resident.",
          "zh-Hant": "租戶 — 佔用關係來自對應租約紀錄；主要住戶已授予安全資料查看權。"
        }
      }
    ]
  }
} as HouseholdDetailResponse,
  "hh_wfg_c_08_c3": {
  "meta": {
    "correlationId": "8b2c3d4e-hh00-4000-8000-0000000000d3",
    "contractVersion": "2.3.0",
    "generatedAt": "2026-08-12T09:56:00+08:00"
  },
  "household": {
    "householdId": "hh_wfg_c_08_c3",
    "unitId": "unit_wfg_c_08_c3",
    "unitReference": "unit-8801-C3",
    "contactEmail": "chan.kaming@wingfu.example",
    "unitLabel": {
      "en": "Flat C3, 8/F, Block C",
      "zh-Hant": "C座8樓C3室"
    },
    "scope": {
      "node": {
        "kind": "unit",
        "id": "unit_wfg_c_08_c3",
        "label": {
          "en": "Flat C3",
          "zh-Hant": "C3室"
        }
      },
      "ancestry": [
        {
          "kind": "organization",
          "id": "org_wingfu_holdings",
          "label": {
            "en": "Wing Fu Property Management",
            "zh-Hant": "榮富物業管理"
          }
        },
        {
          "kind": "estate",
          "id": "est_wing_fu_garden",
          "label": {
            "en": "Wing Fu Garden",
            "zh-Hant": "榮富花園"
          }
        },
        {
          "kind": "building",
          "id": "blk_wfg_c",
          "label": {
            "en": "Block C",
            "zh-Hant": "C座"
          }
        },
        {
          "kind": "floor",
          "id": "fl_wfg_c_08",
          "label": {
            "en": "8/F",
            "zh-Hant": "8樓"
          }
        }
      ]
    },
    "occupancyFrom": "2023-06-01",
    "notificationLanguage": "en",
    "status": "occupied",
    "contactPreferences": {
      "channels": {
        "en": "Email · app inbox",
        "zh-Hant": "電郵 · 應用程式收件箱"
      },
      "quietHours": {
        "en": "None recorded",
        "zh-Hant": "未登記免打擾時段"
      }
    },
    "members": [
      {
        "residentId": "res_wfg_000908",
        "name": "Chan Ka-ming 陳家明",
        "role": "household_member",
        "effectiveFrom": "2023-06-01",
        "effectiveTo": null,
        "safety": {
          "state": "not-permitted"
        },
        "authorisation": {
          "en": "Sole recorded occupant at this unit — household_member role; no caregiver authorisation on file.",
          "zh-Hant": "此單位唯一登記佔用人（住戶成員身分）；未有照顧者授權紀錄。"
        }
      }
    ]
  }
} as HouseholdDetailResponse,
  "hh_wfg_a_05_a4_ended": {
  "meta": {
    "correlationId": "8b2c3d4e-hh00-4000-8000-0000000000d4",
    "contractVersion": "2.3.0",
    "generatedAt": "2026-08-12T09:56:00+08:00"
  },
  "household": {
    "householdId": "hh_wfg_a_05_a4_ended",
    "unitId": "unit_wfg_a_05_a4",
    "unitReference": "unit-8801-A4",
    "contactEmail": "cheung.takwah@wingfu.example",
    "unitLabel": {
      "en": "Flat A4, 5/F, Block A",
      "zh-Hant": "A座5樓A4室"
    },
    "scope": {
      "node": {
        "kind": "unit",
        "id": "unit_wfg_a_05_a4",
        "label": {
          "en": "Flat A4",
          "zh-Hant": "A4室"
        }
      },
      "ancestry": [
        {
          "kind": "organization",
          "id": "org_wingfu_holdings",
          "label": {
            "en": "Wing Fu Property Management",
            "zh-Hant": "榮富物業管理"
          }
        },
        {
          "kind": "estate",
          "id": "est_wing_fu_garden",
          "label": {
            "en": "Wing Fu Garden",
            "zh-Hant": "榮富花園"
          }
        },
        {
          "kind": "building",
          "id": "blk_wfg_a",
          "label": {
            "en": "Block A",
            "zh-Hant": "A座"
          }
        },
        {
          "kind": "floor",
          "id": "fl_wfg_a_05",
          "label": {
            "en": "5/F",
            "zh-Hant": "5樓"
          }
        }
      ]
    },
    "occupancyFrom": "2021-01-01",
    "notificationLanguage": "zh-Hant",
    "status": "ended",
    "contactPreferences": {
      "channels": {
        "en": "No active channels — occupancy ended",
        "zh-Hant": "無有效渠道 — 佔用已結束"
      },
      "quietHours": {
        "en": "Not applicable",
        "zh-Hant": "不適用"
      }
    },
    "members": [
      {
        "residentId": "res_wfg_000220",
        "name": "Cheung Tak-wah 張德華",
        "role": "tenant",
        "effectiveFrom": "2021-01-01",
        "effectiveTo": "2025-12-31",
        "safety": {
          "state": "expired",
          "expiresAt": "2025-12-31T00:00:00+08:00"
        },
        "authorisation": {
          "en": "Former tenant — occupancy ended 31 Dec 2025. Membership and safety viewing no longer effective.",
          "zh-Hant": "前租戶 — 佔用已於 2025年12月31日結束。成員資格及安全資料查看權均不再有效。"
        }
      }
    ]
  }
} as HouseholdDetailResponse,
};

/** Default detail fixture (A1) — used by the state-matrix `detail` state. */
export const HOUSEHOLDS_DETAIL_DEFAULT: HouseholdDetailResponse =
  HOUSEHOLD_DETAILS['hh_wfg_a_12_a1']!;

export const HOUSEHOLDS_CORPUS: Readonly<Record<string, unknown>> = {
  'households/list.json': HOUSEHOLDS_LIST,
  'households/empty.json': HOUSEHOLDS_EMPTY,
  'households/detail.json': HOUSEHOLDS_DETAIL_DEFAULT,
} as const;

export function householdsFixture(path: string): unknown | undefined {
  return HOUSEHOLDS_CORPUS[path];
}

export function findHouseholdDetail(householdId: string): HouseholdDetailResponse | undefined {
  return HOUSEHOLD_DETAILS[householdId];
}

/** Invoice To — list field first, then detail. Aligns with `resident.household.contact_email`. */
export function householdContactEmail(householdId: string): string | null {
  const list = HOUSEHOLDS_LIST.households.find((h) => h.householdId === householdId);
  if (list?.contactEmail) return list.contactEmail;
  return findHouseholdDetail(householdId)?.household.contactEmail ?? null;
}

export function householdIdForUnit(unitId: string): string | undefined {
  const fromList = HOUSEHOLDS_LIST.households.find((h) => h.unitId === unitId && h.status === 'occupied');
  if (fromList) return fromList.householdId;
  for (const [id, d] of Object.entries(HOUSEHOLD_DETAILS)) {
    if (d.household.unitId === unitId && d.household.status === 'occupied') return id;
  }
  return undefined;
}
