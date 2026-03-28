import type { MutableCompilerContext } from '../../../context'
import type { SubPackageStyleScope } from '../../../types'
import path from 'pathe'
import { isPathInside, toPosixPath } from '../../../utils'

const LEADING_DOT_SLASH_RE = /^\.\//

function isSubPackageRelativeStyleEntry(
  normalizedEntry: string,
  normalizedRoot: string,
) {
  return normalizedEntry === normalizedRoot || normalizedEntry.startsWith(`${normalizedRoot}/`)
}

function resolveStyleEntryCandidates(
  source: string,
  subPackageRoot: string,
  absoluteSrcRoot: string,
) {
  const trimmed = source.trim()
  if (!trimmed) {
    return []
  }

  const absoluteSubRoot = path.resolve(absoluteSrcRoot, subPackageRoot)
  const normalizedEntry = toPosixPath(trimmed)
  const normalizedRoot = toPosixPath(subPackageRoot)

  if (path.isAbsolute(trimmed)) {
    return [trimmed]
  }

  if (isSubPackageRelativeStyleEntry(normalizedEntry, normalizedRoot)) {
    return [path.resolve(absoluteSrcRoot, trimmed)]
  }

  return [
    path.resolve(absoluteSubRoot, trimmed),
    path.resolve(absoluteSrcRoot, trimmed),
  ]
}

export function resolveStyleEntryAbsolutePath(
  source: string,
  subPackageRoot: string,
  configService: MutableCompilerContext['configService'],
): string | undefined {
  const service = configService
  if (!service) {
    return undefined
  }

  const trimmed = source.trim()
  if (!trimmed) {
    return undefined
  }

  const srcRoot = service.absoluteSrcRoot
  const candidates = resolveStyleEntryCandidates(trimmed, subPackageRoot, srcRoot)

  for (const candidate of candidates) {
    if (isPathInside(srcRoot, candidate)) {
      return candidate
    }
  }
}

export function getRelativePathWithinSubPackage(pathname: string, normalizedRoot: string) {
  if (!normalizedRoot) {
    return pathname
  }
  if (pathname === normalizedRoot) {
    return ''
  }
  if (pathname.startsWith(`${normalizedRoot}/`)) {
    return pathname.slice(normalizedRoot.length + 1)
  }
  return pathname
}

export function inferScopeFromRelativePath(relativePath: string | undefined): SubPackageStyleScope | undefined {
  if (!relativePath) {
    return undefined
  }
  const cleaned = relativePath.replace(LEADING_DOT_SLASH_RE, '')
  if (cleaned.includes('/')) {
    return undefined
  }
  const base = path.posix.basename(cleaned, path.posix.extname(cleaned))
  if (base === 'pages') {
    return 'pages'
  }
  if (base === 'components') {
    return 'components'
  }
  if (base === 'index') {
    return 'all'
  }
  return undefined
}

export {
  isSubPackageRelativeStyleEntry,
  resolveStyleEntryCandidates,
}
