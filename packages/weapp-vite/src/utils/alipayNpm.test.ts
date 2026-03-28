import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ALIPAY_NPM_MODE,
  getAlipayNpmDistDirName,
  getAlipayNpmImportPrefix,
  normalizeAlipayNpmImportPath,
  resolveAlipayNpmMode,
  stripAlipayNpmImportPrefixes,
} from './alipayNpm'

describe('alipayNpm utils', () => {
  it('resolves alipay npm modes with node_modules default', () => {
    expect(DEFAULT_ALIPAY_NPM_MODE).toBe('node_modules')
    expect(resolveAlipayNpmMode()).toBe('node_modules')
    expect(resolveAlipayNpmMode('node_modules')).toBe('node_modules')
    expect(resolveAlipayNpmMode('miniprogram_npm')).toBe('miniprogram_npm')
    expect(resolveAlipayNpmMode('custom')).toBe('node_modules')
  })

  it('builds alipay npm dist dir names and import prefixes', () => {
    expect(getAlipayNpmDistDirName()).toBe('node_modules')
    expect(getAlipayNpmDistDirName('miniprogram_npm')).toBe('miniprogram_npm')
    expect(getAlipayNpmImportPrefix()).toBe('/node_modules/')
    expect(getAlipayNpmImportPrefix('miniprogram_npm')).toBe('/miniprogram_npm/')
  })

  it('normalizes alipay npm import paths across npm protocol and explicit prefixes', () => {
    expect(stripAlipayNpmImportPrefixes('npm:dayjs')).toBe('dayjs')
    expect(stripAlipayNpmImportPrefixes('/node_modules/dayjs')).toBe('dayjs')
    expect(stripAlipayNpmImportPrefixes('/miniprogram_npm/dayjs')).toBe('dayjs')
    expect(normalizeAlipayNpmImportPath('npm:dayjs')).toBe('/node_modules/dayjs')
    expect(normalizeAlipayNpmImportPath('/node_modules/dayjs')).toBe('/node_modules/dayjs')
    expect(normalizeAlipayNpmImportPath('/miniprogram_npm/dayjs', 'miniprogram_npm')).toBe('/miniprogram_npm/dayjs')
    expect(normalizeAlipayNpmImportPath('/miniprogram_npm/dayjs')).toBe('/node_modules/dayjs')
  })
})
