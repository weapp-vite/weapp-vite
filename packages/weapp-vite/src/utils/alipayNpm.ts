export type AlipayNpmMode = 'miniprogram_npm' | 'node_modules'

export const DEFAULT_ALIPAY_NPM_MODE: AlipayNpmMode = 'node_modules'

export function resolveAlipayNpmMode(mode?: string): AlipayNpmMode {
  return mode === 'miniprogram_npm' ? 'miniprogram_npm' : DEFAULT_ALIPAY_NPM_MODE
}

export function getAlipayNpmDistDirName(mode?: string): string {
  return resolveAlipayNpmMode(mode)
}

export function getAlipayNpmImportPrefix(mode?: string): string {
  return `/${getAlipayNpmDistDirName(mode)}/`
}

export function normalizeAlipayNpmImportPath(importee: string, mode?: string): string {
  const normalized = importee.replace(/^npm:/, '').replace(/^\/(?:miniprogram_npm|node_modules)\//, '')
  return `${getAlipayNpmImportPrefix(mode)}${normalized.replace(/^\/+/, '')}`
}
