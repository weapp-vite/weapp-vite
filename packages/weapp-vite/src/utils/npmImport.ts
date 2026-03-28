import type { MpPlatform } from '../types'
import {
  normalizePlatformNpmImportPath,
  shouldNormalizePlatformNpmImportPath,
} from '../platform'

const WINDOWS_PATH_SEPARATORS_RE = /\\/g
const WINDOWS_ABSOLUTE_PATH_RE = /^[a-z]:[\\/]/i
const NPM_PROTOCOL_RE = /^npm:/
const PLUGIN_PROTOCOL_RE = /^plugin:\/\//
const EXPLICIT_NPM_DIR_RE = /^\/(?:miniprogram_npm|node_modules)\//
const LEADING_SLASHES_RE = /^\/+/

export function normalizeNpmImportLookupPath(importee: string) {
  return importee
    .replace(WINDOWS_PATH_SEPARATORS_RE, '/')
    .replace(NPM_PROTOCOL_RE, '')
    .replace(EXPLICIT_NPM_DIR_RE, '')
    .replace(LEADING_SLASHES_RE, '')
}

export function resolveNpmDependencyId(importee: string) {
  const normalizedImportee = normalizeNpmImportLookupPath(importee)
  const importeeTokens = normalizedImportee.split('/').filter(Boolean)
  if (importeeTokens.length === 0) {
    return ''
  }
  if (normalizedImportee.startsWith('@') && importeeTokens.length > 1) {
    return `${importeeTokens[0]}/${importeeTokens[1]}`
  }
  return importeeTokens[0]
}

export function normalizeNpmPackageSpecifier(specifier: string) {
  const normalized = specifier.trim()
  if (!normalized || normalized.startsWith('.') || normalized.startsWith('/') || normalized.startsWith('\\')) {
    return undefined
  }
  if (WINDOWS_ABSOLUTE_PATH_RE.test(normalized)) {
    return undefined
  }
  return normalized
}

export function parseNpmPackageSpecifier(specifier: string) {
  const normalized = normalizeNpmPackageSpecifier(specifier)
  if (!normalized) {
    return undefined
  }

  const normalizedImportee = normalizeNpmImportLookupPath(normalized)
  if (normalizedImportee.startsWith('@') && !normalizedImportee.includes('/')) {
    return undefined
  }
  const packageName = resolveNpmDependencyId(normalizedImportee)
  if (!packageName) {
    return undefined
  }

  const subPath = normalizedImportee.slice(packageName.length).replace(LEADING_SLASHES_RE, '')
  return {
    packageName,
    subPath,
  }
}

export function hasNpmDependencyPrefix(
  dependencies: Record<string, string> | undefined,
  importee: string,
) {
  if (!dependencies) {
    return false
  }

  const normalizedImportee = normalizeNpmImportLookupPath(importee)
  const importeeTokens = normalizedImportee.split('/').filter(Boolean)
  if (importeeTokens.length === 0) {
    return false
  }

  return Object.keys(dependencies).some((dep) => {
    const depTokens = dep.replace(WINDOWS_PATH_SEPARATORS_RE, '/').split('/').filter(Boolean)
    if (depTokens.length === 0 || depTokens.length > importeeTokens.length) {
      return false
    }

    for (let i = 0; i < depTokens.length; i++) {
      if (depTokens[i] !== importeeTokens[i]) {
        return false
      }
    }

    return true
  })
}

export function shouldNormalizeNpmImportByPlatform(
  importee: string,
  options: {
    platform?: MpPlatform
    dependencies?: Record<string, string>
  },
) {
  const trimmed = importee.trim()
  if (!trimmed || PLUGIN_PROTOCOL_RE.test(trimmed)) {
    return false
  }

  if (!options.platform || !shouldNormalizePlatformNpmImportPath(options.platform)) {
    return false
  }

  const normalized = trimmed.replace(NPM_PROTOCOL_RE, '')
  if (EXPLICIT_NPM_DIR_RE.test(normalized)) {
    return true
  }

  return hasNpmDependencyPrefix(options.dependencies, normalized)
}

export function normalizeNpmImportPathByPlatform(
  importee: string,
  options: {
    platform?: MpPlatform
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  },
) {
  const trimmed = importee.trim()
  if (!shouldNormalizeNpmImportByPlatform(trimmed, options)) {
    return importee
  }

  const normalized = trimmed.replace(NPM_PROTOCOL_RE, '')
  return normalizePlatformNpmImportPath(options.platform, normalized, {
    alipayNpmMode: options.alipayNpmMode,
  })
}
