import type { MutableCompilerContext } from '../../context'
import type { SubPackageStyleScope } from '../../types'
import path from 'pathe'
import { isPathInside, toPosixPath } from '../../utils'

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
  const absoluteSubRoot = path.resolve(srcRoot, subPackageRoot)
  const normalizedEntry = toPosixPath(trimmed)
  const normalizedRoot = toPosixPath(subPackageRoot)

  const candidates: string[] = []
  if (path.isAbsolute(trimmed)) {
    candidates.push(trimmed)
  }
  else if (normalizedEntry === normalizedRoot || normalizedEntry.startsWith(`${normalizedRoot}/`)) {
    candidates.push(path.resolve(srcRoot, trimmed))
  }
  else {
    candidates.push(path.resolve(absoluteSubRoot, trimmed))
    candidates.push(path.resolve(srcRoot, trimmed))
  }

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
  const cleaned = relativePath.replace(/^\.\//, '')
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
