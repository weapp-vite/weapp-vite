import type {
  AnalyzeSubpackagesResult,
  ModuleSourceType,
  PackageFileEntry,
} from '../types'
import { estimateCompressedBytes } from './format'

export const totalPackageBudgetBytes = 20 * 1024 * 1024
export const singlePackageBudgetBytes = 2 * 1024 * 1024
export const budgetWarningRatio = 0.85

export interface FileComparisonMaps {
  packageBytes: Map<string, number>
  fileBytes: Map<string, number>
  moduleBytes: Map<string, {
    source: string
    sourceType: ModuleSourceType
    bytes: number
    packageId: string
    packageLabel: string
    file: string
  }>
  totalBytes: number
  compressedBytes: number
}

export interface ModulePlacement {
  source: string
  sourceType: ModuleSourceType
  packageId: string
  packageLabel: string
  file: string
}

export function getFileSize(file: PackageFileEntry) {
  return file.size ?? 0
}

export function getFileCompressedSize(file: PackageFileEntry) {
  return file.brotliSize ?? file.gzipSize ?? estimateCompressedBytes(getFileSize(file), file.file, file.type)
}

export function getCompressedSizeSource(file: PackageFileEntry): 'real' | 'estimated' {
  return typeof file.brotliSize === 'number' || typeof file.gzipSize === 'number'
    ? 'real'
    : 'estimated'
}

export function createFileKey(packageId: string, fileName: string) {
  return `${packageId}\u0000${fileName}`
}

export function createComparisonMaps(result: AnalyzeSubpackagesResult | null): FileComparisonMaps {
  const packageBytes = new Map<string, number>()
  const fileBytes = new Map<string, number>()
  const moduleBytes = new Map<string, FileComparisonMaps['moduleBytes'] extends Map<string, infer Value> ? Value : never>()
  let totalBytes = 0
  let compressedBytes = 0

  for (const pkg of result?.packages ?? []) {
    let packageTotal = 0
    for (const file of pkg.files) {
      const size = getFileSize(file)
      packageTotal += size
      totalBytes += size
      compressedBytes += getFileCompressedSize(file)
      fileBytes.set(createFileKey(pkg.id, file.file), size)
      for (const mod of file.modules ?? []) {
        const bytes = mod.bytes ?? mod.originalBytes ?? 0
        const existing = moduleBytes.get(mod.id)
        if (!existing || existing.bytes < bytes) {
          moduleBytes.set(mod.id, {
            source: mod.source,
            sourceType: mod.sourceType,
            bytes,
            packageId: pkg.id,
            packageLabel: pkg.label,
            file: file.file,
          })
        }
      }
    }
    packageBytes.set(pkg.id, packageTotal)
  }

  return {
    packageBytes,
    fileBytes,
    moduleBytes,
    totalBytes,
    compressedBytes,
  }
}

export function createModulePlacementMap(result: AnalyzeSubpackagesResult): Map<string, ModulePlacement> {
  const map = new Map<string, ModulePlacement>()
  for (const pkg of result.packages) {
    for (const file of pkg.files) {
      for (const mod of file.modules ?? []) {
        if (!map.has(mod.id)) {
          map.set(mod.id, {
            source: mod.source,
            sourceType: mod.sourceType,
            packageId: pkg.id,
            packageLabel: pkg.label,
            file: file.file,
          })
        }
      }
    }
  }
  return map
}

export function createModuleInfoMap(result: AnalyzeSubpackagesResult | null) {
  const map = new Map<string, { bytes: number, originalBytes: number, sourceType: ModuleSourceType }>()

  for (const pkg of result?.packages ?? []) {
    for (const file of pkg.files) {
      for (const mod of file.modules ?? []) {
        const existing = map.get(mod.id)
        const bytes = mod.bytes ?? 0
        const originalBytes = mod.originalBytes ?? bytes
        if (!existing) {
          map.set(mod.id, {
            bytes,
            originalBytes,
            sourceType: mod.sourceType,
          })
          continue
        }
        map.set(mod.id, {
          bytes: Math.max(existing.bytes, bytes),
          originalBytes: Math.max(existing.originalBytes, originalBytes),
          sourceType: existing.sourceType,
        })
      }
    }
  }

  return map
}
