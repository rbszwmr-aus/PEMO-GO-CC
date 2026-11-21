/**
 * Fixture license for platform modules. URL-constructed like live mode.
 *
 * Default demo estate is dual-buy: PEMO + ParkCore. Groups Rights shows the
 * PEMO | ParkCore module switcher only when `parkcore` is in this list.
 *
 * Absent `modules` → default. `?modules=pemo` is PEMO-only (hide the ParkCore
 * module and its domain tabs).
 */

export const PLATFORM_MODULE_IDS = ['pemo', 'parkcore'] as const;
export type PlatformModuleId = (typeof PLATFORM_MODULE_IDS)[number];

export const MODULES_PARAM = 'modules';

/** Wing Fu Garden demo estate is licensed for both products. */
export const DEFAULT_LICENSED_MODULES: readonly PlatformModuleId[] = ['pemo', 'parkcore'];

export function isPlatformModuleId(value: string): value is PlatformModuleId {
  return (PLATFORM_MODULE_IDS as readonly string[]).includes(value);
}

export function canonicalizeLicensedModules(ids: readonly string[]): PlatformModuleId[] {
  return PLATFORM_MODULE_IDS.filter((id) => ids.includes(id));
}

function sameAsDefault(ids: readonly PlatformModuleId[]): boolean {
  if (ids.length !== DEFAULT_LICENSED_MODULES.length) return false;
  return DEFAULT_LICENSED_MODULES.every((id) => ids.includes(id));
}

export function readLicensedModules(params: URLSearchParams): readonly PlatformModuleId[] {
  const raw = params.get(MODULES_PARAM);
  if (raw === null) return DEFAULT_LICENSED_MODULES;
  return canonicalizeLicensedModules(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

export function writeLicensedModules(
  params: URLSearchParams,
  modules: readonly PlatformModuleId[],
): void {
  const canonical = canonicalizeLicensedModules(modules);
  if (sameAsDefault(canonical)) return;
  params.set(MODULES_PARAM, canonical.join(','));
}

export function isModuleLicensed(
  modules: readonly PlatformModuleId[],
  id: PlatformModuleId,
): boolean {
  return modules.includes(id);
}
