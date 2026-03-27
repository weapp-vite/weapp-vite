import type { MpPlatform } from '../types'
import {
  normalizePlatformNpmImportPath,
  shouldNormalizePlatformNpmImportPath,
} from '../platform'

const WINDOWS_PATH_SEPARATORS_RE = /\\/g
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

export function normalizeNpmImportPathByPlatform(
  importee: string,
  options: {
    platform?: MpPlatform
    dependencies?: Record<string, string>
    alipayNpmMode?: string
  },
) {
  const trimmed = importee.trim()
  if (!trimmed || PLUGIN_PROTOCOL_RE.test(trimmed)) {
    return importee
  }

  if (!options.platform || !shouldNormalizePlatformNpmImportPath(options.platform)) {
    return importee
  }

  const normalized = trimmed.replace(NPM_PROTOCOL_RE, '')
  if (EXPLICIT_NPM_DIR_RE.test(normalized)) {
    return normalizePlatformNpmImportPath(options.platform, normalized, {
      alipayNpmMode: options.alipayNpmMode,
    })
  }

  if (!hasNpmDependencyPrefix(options.dependencies, normalized)) {
    return importee
  }

  return normalizePlatformNpmImportPath(options.platform, normalized, {
    alipayNpmMode: options.alipayNpmMode,
  })
}
