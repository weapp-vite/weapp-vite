import { win32 as pathWin32, relative as relativeNative } from 'node:path'
import path from 'pathe'
import { resolveNpmDependencyId } from '../../../utils/npmImport'
import { normalizePath, toPosixPath } from '../../../utils/path'

const LEADING_SLASHES_RE = /^\/+/
const WINDOWS_PATH_RE = /\\|^[A-Z]:[\\/]/i
const TRAILING_SLASHES_RE = /\/+$/

function matchDependencyPath(patterns: (string | RegExp)[], value: string) {
  const dependencyId = resolveNpmDependencyId(toPosixPath(value).replace(LEADING_SLASHES_RE, ''))
  return patterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return dependencyId === pattern || value === pattern || value.startsWith(`${pattern}/`)
    }

    pattern.lastIndex = 0
    if (pattern.test(dependencyId)) {
      return true
    }

    pattern.lastIndex = 0
    return pattern.test(value)
  })
}

export function resolveCopyFilterRelativePath(sourceRoot: string, sourcePath: string) {
  const normalizedRoot = normalizePath(sourceRoot).replace(TRAILING_SLASHES_RE, '')
  const normalizedPath = normalizePath(sourcePath)
  if (normalizedPath === normalizedRoot) {
    return ''
  }
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1)
  }

  const relativePath = WINDOWS_PATH_RE.test(sourceRoot) || WINDOWS_PATH_RE.test(sourcePath)
    ? pathWin32.relative(sourceRoot, sourcePath)
    : relativeNative(sourceRoot, sourcePath)

  return toPosixPath(relativePath)
}

export function resolveNpmSourceCacheOutDir(cwd: string, npmDistDirName: string) {
  return path.resolve(cwd, '.weapp-vite/npm-source', npmDistDirName)
}

export function matchDependencyCopyPath(patterns: (string | RegExp)[], value: string) {
  return matchDependencyPath(patterns, value)
}
