import type { ClassifiedPackage, ModuleAccumulator, ModuleSourceType, PackageAccumulator, PackageFileEntry } from './types'

export function ensurePackage(
  packages: Map<string, PackageAccumulator>,
  classification: ClassifiedPackage,
): PackageAccumulator {
  const existing = packages.get(classification.id)
  if (existing) {
    return existing
  }
  const created: PackageAccumulator = {
    ...classification,
    files: new Map<string, PackageFileEntry>(),
  }
  packages.set(classification.id, created)
  return created
}

export function ensureModule(
  modules: Map<string, ModuleAccumulator>,
  id: string,
  source: string,
  sourceType: ModuleSourceType,
): ModuleAccumulator {
  const existing = modules.get(id)
  if (existing) {
    return existing
  }
  const created: ModuleAccumulator = {
    id,
    source,
    sourceType,
    packages: new Map<string, Set<string>>(),
  }
  modules.set(id, created)
  return created
}

export function registerModuleInPackage(
  modules: Map<string, ModuleAccumulator>,
  moduleId: string,
  source: string,
  sourceType: ModuleSourceType,
  packageId: string,
  fileName: string,
) {
  const moduleEntry = ensureModule(modules, moduleId, source, sourceType)
  const files = moduleEntry.packages.get(packageId) ?? new Set<string>()
  files.add(fileName)
  moduleEntry.packages.set(packageId, files)
}
