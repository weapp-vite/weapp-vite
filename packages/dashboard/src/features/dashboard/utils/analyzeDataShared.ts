import type {
  AnalyzeSubpackagesResult,
  ModuleSourceType,
  PackageFileEntry,
} from '../types'
import { estimateCompressedBytes } from './format'

export const totalPackageBudgetBytes = 20 * 1024 * 1024
export const singlePackageBudgetBytes = 2 * 1024 * 1024

export interface FileComparisonMaps {
  packageBytes: Map<string, number>
  fileBytes: Map<string, number>
  totalBytes: number
  compressedBytes: number
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
    }
    packageBytes.set(pkg.id, packageTotal)
  }

  return {
    packageBytes,
    fileBytes,
    totalBytes,
    compressedBytes,
  }
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
