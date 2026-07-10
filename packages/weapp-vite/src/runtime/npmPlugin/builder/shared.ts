import type { PackageJson } from 'pkg-types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'

export type PackageExportEntry = string | {
  import?: PackageExportEntry
  module?: PackageExportEntry
  default?: PackageExportEntry
  require?: PackageExportEntry
  browser?: PackageExportEntry
  development?: PackageExportEntry
  production?: PackageExportEntry
  [key: string]: PackageExportEntry | undefined
}

export async function collectFiles(root: string) {
  const files: string[] = []
  let pendingDirs = [root]

  while (pendingDirs.length > 0) {
    const currentDirs = pendingDirs
    pendingDirs = []

    const batches = await Promise.all(currentDirs.map(async (current) => {
      const dirs: string[] = []
      const currentFiles: string[] = []
      const entries = await fs.readdir(current, { withFileTypes: true })
      for (const entry of entries) {
        const filePath = path.resolve(current, entry.name)
        if (entry.isDirectory()) {
          dirs.push(filePath)
        }
        else if (entry.isFile()) {
          currentFiles.push(filePath)
        }
      }
      return {
        dirs,
        files: currentFiles,
      }
    }))

    for (const batch of batches) {
      files.push(...batch.files)
      pendingDirs.push(...batch.dirs)
    }
  }

  return files
}

export function resolveExportPath(entry: PackageExportEntry | undefined): string | undefined {
  if (!entry) {
    return
  }

  if (typeof entry === 'string') {
    return entry
  }

  return (
    resolveExportPath(entry.import)
    ?? resolveExportPath(entry.module)
    ?? resolveExportPath(entry.default)
    ?? resolveExportPath(entry.browser)
    ?? resolveExportPath(entry.development)
    ?? resolveExportPath(entry.production)
  )
}

export async function resolvePreferredPackageEntry(rootPath: string, pkg: PackageJson) {
  const exportsField = pkg.exports
  const exportEntry = typeof exportsField === 'string'
    ? exportsField
    : exportsField && !Array.isArray(exportsField) && '.' in exportsField
      ? (exportsField['.'] as PackageExportEntry | undefined)
      : undefined

  const candidates = [
    resolveExportPath(exportEntry),
    typeof (pkg as any).module === 'string' ? (pkg as any).module : undefined,
    typeof (pkg as any)['jsnext:main'] === 'string' ? (pkg as any)['jsnext:main'] : undefined,
    typeof pkg.main === 'string' ? pkg.main : undefined,
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0)

  for (const candidate of candidates) {
    const resolved = path.resolve(rootPath, candidate)
    if (await fs.pathExists(resolved)) {
      return resolved
    }
  }
}
