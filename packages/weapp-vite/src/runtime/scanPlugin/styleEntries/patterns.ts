import type { SubPackageStyleScope } from '../../../types'
import { toPosixPath } from '../../../utils'
import { DEFAULT_SCOPE_INCLUDES } from './config'

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? value : [value]
}

function normalizePattern(pattern: string, normalizedRoot: string): string | undefined {
  const trimmed = pattern.trim()
  if (!trimmed) {
    return undefined
  }

  let normalized = toPosixPath(trimmed)
  if (normalizedRoot && normalized.startsWith(`${normalizedRoot}/`)) {
    normalized = normalized.slice(normalizedRoot.length + 1)
  }
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }
  normalized = normalized.replace(/^\/+/, '')
  if (!normalized) {
    return '**/*'
  }
  if (normalized.endsWith('/')) {
    normalized = `${normalized}**`
  }
  return normalized
}

export function resolveIncludePatterns(
  descriptor: Pick<{ scope: SubPackageStyleScope, include?: string | string[] }, 'scope' | 'include'>,
  normalizedRoot: string,
): string[] {
  const normalized = new Set<string>()
  for (const pattern of toArray(descriptor.include)) {
    const resolved = normalizePattern(pattern, normalizedRoot)
    if (resolved) {
      normalized.add(resolved)
    }
  }
  if (!normalized.size) {
    const defaults = DEFAULT_SCOPE_INCLUDES[descriptor.scope] ?? DEFAULT_SCOPE_INCLUDES.all
    for (const pattern of defaults) {
      const resolved = normalizePattern(pattern, normalizedRoot)
      if (resolved) {
        normalized.add(resolved)
      }
    }
  }
  return Array.from(normalized)
}

export function resolveExcludePatterns(
  descriptor: Pick<{ exclude?: string | string[] }, 'exclude'>,
  normalizedRoot: string,
): string[] {
  const normalized = new Set<string>()
  for (const pattern of toArray(descriptor.exclude)) {
    const resolved = normalizePattern(pattern, normalizedRoot)
    if (resolved) {
      normalized.add(resolved)
    }
  }
  return Array.from(normalized)
}
