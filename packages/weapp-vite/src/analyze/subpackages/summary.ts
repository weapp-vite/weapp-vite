import type { SubPackageMetaValue } from '../../types'
import type {
  ModuleAccumulator,
  ModuleUsage,
  PackageAccumulator,
  PackageClassifierContext,
  PackageFileEntry,
  PackageReport,
  PackageType,
  SubPackageDescriptor,
} from './types'
import { posix as path } from 'pathe'

function toArray<T>(value: Iterable<T>) {
  return Array.from(value)
}

export function summarizePackages(packages: Map<string, PackageAccumulator>): PackageReport[] {
  const order: Record<PackageType, number> = {
    main: 0,
    subPackage: 1,
    independent: 2,
    virtual: 3,
  }

  const reports = toArray(packages.values()).map((pkg) => {
    const files = toArray(pkg.files.values())
    files.sort((a, b) => a.file.localeCompare(b.file))
    return {
      id: pkg.id,
      label: pkg.label,
      type: pkg.type,
      files,
    }
  })

  reports.sort((a, b) => {
    const delta = order[a.type] - order[b.type]
    if (delta !== 0) {
      return delta
    }
    if (a.id === '__main__') {
      return -1
    }
    if (b.id === '__main__') {
      return 1
    }
    return a.id.localeCompare(b.id)
  })

  return reports
}

export function summarizeModules(
  modules: Map<string, ModuleAccumulator>,
): ModuleUsage[] {
  const usage = toArray(modules.values()).map((module) => {
    const packages = toArray(module.packages.entries()).map(([packageId, files]) => {
      const sortedFiles = toArray(files).sort((a, b) => a.localeCompare(b))
      return {
        packageId,
        files: sortedFiles,
      }
    }).sort((a, b) => {
      if (a.packageId === b.packageId) {
        return 0
      }
      if (a.packageId === '__main__') {
        return -1
      }
      if (b.packageId === '__main__') {
        return 1
      }
      return a.packageId.localeCompare(b.packageId)
    })

    return {
      id: module.id,
      source: module.source,
      sourceType: module.sourceType,
      packages,
    }
  })

  usage.sort((a, b) => a.source.localeCompare(b.source))
  return usage
}

export function expandVirtualModulePlacements(
  modules: Map<string, ModuleAccumulator>,
  packages: Map<string, PackageAccumulator>,
  context: PackageClassifierContext,
) {
  for (const moduleEntry of modules.values()) {
    const virtualEntries = Array.from(moduleEntry.packages.entries())
      .filter(([packageId]) => packageId.startsWith('virtual:'))

    if (!virtualEntries.length) {
      continue
    }

    const virtualFileBases = new Map<string, string[]>()

    for (const [virtualPackageId, files] of virtualEntries) {
      const combination = virtualPackageId.slice('virtual:'.length)
      if (!combination) {
        continue
      }

      const segments = combination.split(/[_+]/).map(segment => segment.trim()).filter(Boolean)
      if (!segments.length) {
        continue
      }

      let matchingBases = virtualFileBases.get(virtualPackageId)
      if (!matchingBases) {
        matchingBases = Array.from(files).map(file => path.basename(file))
        virtualFileBases.set(virtualPackageId, matchingBases)
      }

      for (const root of segments) {
        if (!context.subPackageRoots.has(root)) {
          continue
        }

        const targetPackage = packages.get(root)
        if (!targetPackage) {
          continue
        }

        const moduleFiles = moduleEntry.packages.get(root) ?? new Set<string>()
        const targetFiles = Array.from(targetPackage.files.values())
          .filter((fileEntry) => {
            if (!matchingBases?.length) {
              return true
            }
            const base = path.basename(fileEntry.file)
            return matchingBases.includes(base)
          })
          .map(fileEntry => fileEntry.file)

        if (targetFiles.length === 0) {
          const fallback = targetPackage.files.values().next().value as PackageFileEntry | undefined
          if (fallback) {
            moduleFiles.add(fallback.file)
          }
        }
        else {
          for (const fileName of targetFiles) {
            moduleFiles.add(fileName)
          }
        }

        if (moduleFiles.size > 0) {
          moduleEntry.packages.set(root, moduleFiles)
        }
      }
    }
  }
}

export function summarizeSubPackages(metas: SubPackageMetaValue[]): SubPackageDescriptor[] {
  const descriptors = metas
    .map((meta) => {
      const root = meta.subPackage.root ?? ''
      return {
        root,
        independent: Boolean(meta.subPackage.independent),
        name: meta.subPackage.name,
      }
    })
    .filter(descriptor => descriptor.root)

  descriptors.sort((a, b) => a.root.localeCompare(b.root))
  return descriptors
}
