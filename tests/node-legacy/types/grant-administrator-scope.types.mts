/**
 * THE TYPE-LEVEL BITE FOR ADR-018.
 *
 * This file is NOT executed. It is COMPILED, and its passing condition is that
 * every `@ts-expect-error` below is a REAL error. `tsc` reports an unused
 * `@ts-expect-error` as an error in its own right, so if the guard is widened --
 * if a `G-2` site starts accepting a raw node set again, or if the branded value
 * acquires a public constructor -- the expected errors disappear and this file
 * STOPS COMPILING. That is the bite: the mutation is "accept the raw set", the
 * plausible wrong rule, not a syntactic deletion.
 *
 * WHY A SEPARATE FILE AND A SEPARATE COMPILE. `tests/**` is not in any project's
 * `include`, and the test runner strips types rather than checking them, so a
 * type error in a test is invisible to the whole gate. A type-level guarantee
 * needs a step that actually typechecks; `type-level-authority.test.ts` runs
 * `tsc --noEmit` over exactly this file and asserts the exit status. `.mts` so
 * the compile is ESM without a `package.json` under `tests/`, which the workspace
 * globs deliberately do not cover.
 *
 * --- A RESIDUAL, MEASURED AND NAMED -----------------------------------------
 *
 * A DELIBERATE double cast -- `{ nodeKeys } as unknown as GrantAdministratorScope`
 * -- still compiles, as it does for every branded type in TypeScript; the single
 * cast `{ nodeKeys } as GrantAdministratorScope` compiles too, because an
 * assertion to a type with EXTRA properties is permitted. I measured both rather
 * than assuming. That is not what ADR-018 closes. The hole was a wide parameter
 * accepting a correctly-typed value that had never been filtered -- reachable by
 * writing ordinary code, invisible in review. Forging the brand requires writing
 * the word `as` next to the name of the type you are subverting, in a diff.
 */

import {
  mayAdministerGroup, isEffectiveAdministratorAt, grantAdministratorScope,
  uncoveredNodes, noRoleScope,
} from '../../modules/access/dist/index.js';
import type { RoleScope } from '../../modules/access/dist/index.js';
import type { ModuleDb } from '../../modules/platform/dist/index.js';

declare const tx: ModuleDb;
declare const rawNodeKeys: readonly string[];

// --- THE HOLE, PROVED SHUT ---------------------------------------------------

// A raw, unfiltered node set is exactly what every G-2 site took before ADR-018.
// @ts-expect-error a raw node set is not an administrator scope
await mayAdministerGroup(tx, 'grp_x', 'org_x', rawNodeKeys);

// @ts-expect-error the single-node floor refuses it too
await isEffectiveAdministratorAt(tx, 'org_x', 'stf_x', rawNodeKeys, 'organization:org_x');

// Nor can the value be forged structurally: the brand is a module-private
// `unique symbol`, so no literal outside that file has the property.
// @ts-expect-error an object literal cannot satisfy the brand
await mayAdministerGroup(tx, 'grp_x', 'org_x', { nodeKeys: rawNodeKeys });

// --- THE ROLE IS IN THE TYPE (GEN-040 D2) ------------------------------------
//
// Generalising ADR-018 to `RoleScope<R>` had to preserve the original property AND
// add one: two scopes of DIFFERENT ROLES must not be interchangeable. Without this
// the generalisation would be a regression wearing a nicer type — three
// structurally identical flat sets, freely substitutable, which is the hole one
// level up.

declare const staffScope: RoleScope<'estate_staff'>;
declare const approverScope: RoleScope<'approver'>;
declare const needsApprover: (s: RoleScope<'approver'>) => void;
declare const needsAdministrator: (s: RoleScope<'grant_administrator'>) => void;

// @ts-expect-error an estate_staff scope is not an approver scope
needsApprover(staffScope);

// @ts-expect-error nor is an approver scope an administrator scope
needsAdministrator(approverScope);

// @ts-expect-error and the raw set is still refused, whatever the role
needsApprover(rawNodeKeys);

// The right role passes, and the covering conjunction accepts any role's scope —
// it asks "does THIS scope cover these nodes", which is role-agnostic by design.
needsApprover(approverScope);
void uncoveredNodes(staffScope, rawNodeKeys);
void uncoveredNodes(noRoleScope('approver'), rawNodeKeys);

// --- WHAT IS STILL ALLOWED ---------------------------------------------------
// The one constructor. No expect-error: this must keep compiling, or the file
// would "pass" by having broken the legitimate path.
declare const expand: (nodes: readonly { kind: string; id: string }[]) => Promise<readonly string[]>;
declare const grants: Parameters<typeof grantAdministratorScope>[0];
const scope = await grantAdministratorScope(grants, expand as Parameters<typeof grantAdministratorScope>[1]);
await mayAdministerGroup(tx, 'grp_x', 'org_x', scope);
