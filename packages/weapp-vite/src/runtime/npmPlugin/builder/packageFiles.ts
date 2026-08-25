import type { NpmPackageFilesConfig } from '../../../types'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import picomatch from 'picomatch'

function normalizePattern(pattern: string) {
  return pattern.replaceAll('\\', '/')
}

export function createNpmPackageFileMatcher(config?: NpmPackageFilesConfig) {
  const include = config?.include?.length
    ? picomatch(config.include.map(normalizePattern), { dot: true })
    : () => true
  const exclude = config?.exclude?.length
    ? picomatch(config.exclude.map(normalizePattern), { dot: true })
    : () => false

  return (relativePath: string) => {
    const normalizedPath = normalizePattern(relativePath)
    return include(normalizedPath) && !exclude(normalizedPath)
  }
}

export function createNpmPackageCopyFilter(sourceRoot: string, config?: NpmPackageFilesConfig) {
  if (!config?.include?.length && !config?.exclude?.length) {
    return undefined
  }

  const matches = createNpmPackageFileMatcher(config)
  return async (sourcePath: string) => {
    const relativePath = path.relative(sourceRoot, sourcePath)
    if (!relativePath) {
      return true
    }

    const stat = await fs.stat(sourcePath)
    return stat.isDirectory() || matches(relativePath)
  }
}
