import type { MpPlatform } from '../types'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
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
const NODE_MODULES_SEGMENT = '/node_modules/'
const STRIP_SCRIPT_EXTENSION_RE = /\.[cm]?[jt]sx?$/

const miniprogramRootCache = new Map<string, string | undefined>()

function stripScriptExtension(value: string) {
  return value.replace(STRIP_SCRIPT_EXTENSION_RE, '')
}

function readMiniprogramRoot(packageRoot: string) {
  const cached = miniprogramRootCache.get(packageRoot)
  if (cached !== undefined || miniprogramRootCache.has(packageRoot)) {
    return cached
  }

  const packageJsonPath = path.join(packageRoot, 'package.json')
  if (!existsSync(packageJsonPath)) {
    miniprogramRootCache.set(packageRoot, undefined)
    return undefined
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { miniprogram?: string }
    const miniprogramRoot = typeof packageJson.miniprogram === 'string'
      ? packageJson.miniprogram.replace(WINDOWS_PATH_SEPARATORS_RE, '/').replace(LEADING_SLASHES_RE, '')
      : undefined
    miniprogramRootCache.set(packageRoot, miniprogramRoot)
    return miniprogramRoot
  }
  catch {
    miniprogramRootCache.set(packageRoot, undefined)
    return undefined
  }
}

function normalizeAbsoluteNodeModulesImport(importee: string) {
  const nodeModulesIndex = importee.lastIndexOf(NODE_MODULES_SEGMENT)
  if (nodeModulesIndex === -1) {
    return undefined
  }

  const packageStart = nodeModulesIndex + NODE_MODULES_SEGMENT.length
  const packagePath = importee.slice(packageStart).replace(LEADING_SLASHES_RE, '')
  const packageTokens = packagePath.split('/').filter(Boolean)
  if (packageTokens.length === 0) {
    return undefined
  }

  const packageTokenCount = packageTokens[0].startsWith('@') ? 2 : 1
  if (packageTokens.length < packageTokenCount) {
    return undefined
  }

  const packageName = packageTokens.slice(0, packageTokenCount).join('/')
  const packageRoot = `${importee.slice(0, packageStart)}${packageName}`
  let subPath = packageTokens.slice(packageTokenCount).join('/')
  const miniprogramRoot = readMiniprogramRoot(packageRoot)
  if (miniprogramRoot && (subPath === miniprogramRoot || subPath.startsWith(`${miniprogramRoot}/`))) {
    subPath = subPath.slice(miniprogramRoot.length).replace(LEADING_SLASHES_RE, '')
  }

  const normalizedSubPath = stripScriptExtension(subPath)
  return normalizedSubPath ? `${packageName}/${normalizedSubPath}` : packageName
}

export function normalizeNpmImportLookupPath(importee: string) {
  const normalized = importee
    .replace(WINDOWS_PATH_SEPARATORS_RE, '/')
    .replace(NPM_PROTOCOL_RE, '')
  const nodeModulesResolved = normalizeAbsoluteNodeModulesImport(normalized)
  if (nodeModulesResolved) {
    return nodeModulesResolved
  }
  return normalized
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
  if (!options.platform) {
    return importee
  }

  const normalized = trimmed.replace(NPM_PROTOCOL_RE, '')
  return normalizePlatformNpmImportPath(options.platform, normalized, {
    alipayNpmMode: options.alipayNpmMode,
  })
}
