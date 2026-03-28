export type AlipayNpmMode = 'miniprogram_npm' | 'node_modules'

export const DEFAULT_ALIPAY_NPM_MODE: AlipayNpmMode = 'node_modules'
const NPM_PROTOCOL_RE = /^npm:/
const EXPLICIT_NPM_PREFIX_RE = /^\/(?:miniprogram_npm|node_modules)\//
const LEADING_SLASH_RE = /^\/+/

export function resolveAlipayNpmMode(mode?: string): AlipayNpmMode {
  return mode === 'miniprogram_npm' ? 'miniprogram_npm' : DEFAULT_ALIPAY_NPM_MODE
}

export function getAlipayNpmDistDirName(mode?: string): AlipayNpmMode {
  return resolveAlipayNpmMode(mode)
}

export function getAlipayNpmImportPrefix(mode?: string): string {
  return `/${getAlipayNpmDistDirName(mode)}/`
}

export function stripAlipayNpmImportPrefixes(importee: string): string {
  return importee.replace(NPM_PROTOCOL_RE, '').replace(EXPLICIT_NPM_PREFIX_RE, '')
}

export function normalizeAlipayNpmImportPath(importee: string, mode?: string): string {
  const normalized = stripAlipayNpmImportPrefixes(importee)
  return `${getAlipayNpmImportPrefix(mode)}${normalized.replace(LEADING_SLASH_RE, '')}`
}
