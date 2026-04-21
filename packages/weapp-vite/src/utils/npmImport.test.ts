import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  hasNpmDependencyPrefix,
  normalizeNpmImportLookupPath,
  normalizeNpmImportPathByPlatform,
  normalizeNpmPackageSpecifier,
  parseNpmPackageSpecifier,
  resolveNpmDependencyId,
  shouldNormalizeNpmImportByPlatform,
} from './npmImport'

describe('utils/npmImport', () => {
  it('normalizes npm lookup paths across protocol, absolute prefix and windows separators', () => {
    expect(normalizeNpmImportLookupPath('npm:tdesign-miniprogram/button/button')).toBe('tdesign-miniprogram/button/button')
    expect(normalizeNpmImportLookupPath('/node_modules/tdesign-miniprogram/button/button')).toBe('tdesign-miniprogram/button/button')
    expect(normalizeNpmImportLookupPath('\\miniprogram_npm\\tdesign-miniprogram\\button\\button')).toBe('tdesign-miniprogram/button/button')
    expect(normalizeNpmImportLookupPath('../node_modules/tdesign-miniprogram/miniprogram_dist/dialog/index.js')).toBe('tdesign-miniprogram/dialog/index')

    const aliasedMiniprogramEntry = path.join(
      process.cwd(),
      'node_modules',
      'tdesign-miniprogram',
      'miniprogram_dist',
      'dialog',
      'index.js',
    )
    expect(normalizeNpmImportLookupPath(aliasedMiniprogramEntry)).toBe('tdesign-miniprogram/dialog/index')
  })

  it('resolves dependency ids for scoped and unscoped packages', () => {
    expect(resolveNpmDependencyId('npm:dayjs/plugin/timezone')).toBe('dayjs')
    expect(resolveNpmDependencyId('/node_modules/@scope/pkg/button/index')).toBe('@scope/pkg')
    expect(resolveNpmDependencyId('')).toBe('')
  })

  it('parses package specifiers into package name and sub path', () => {
    expect(normalizeNpmPackageSpecifier(' plain-lib/button ')).toBe('plain-lib/button')
    expect(normalizeNpmPackageSpecifier('./local/button')).toBeUndefined()
    expect(normalizeNpmPackageSpecifier('C:\\windows\\button')).toBeUndefined()
    expect(parseNpmPackageSpecifier('plain-lib/button')).toEqual({
      packageName: 'plain-lib',
      subPath: 'button',
    })
    expect(parseNpmPackageSpecifier('@scope/pkg/button/index')).toEqual({
      packageName: '@scope/pkg',
      subPath: 'button/index',
    })
    expect(parseNpmPackageSpecifier('plain-lib')).toEqual({
      packageName: 'plain-lib',
      subPath: '',
    })
    expect(parseNpmPackageSpecifier('./local/button')).toBeUndefined()
    expect(parseNpmPackageSpecifier('/absolute/button')).toBeUndefined()
    expect(parseNpmPackageSpecifier('C:\\windows\\button')).toBeUndefined()
    expect(parseNpmPackageSpecifier('@scope-only')).toBeUndefined()
  })

  it('detects dependency prefixes from normalized package importees', () => {
    const dependencies = {
      'tdesign-miniprogram': '^1.0.0',
      '@scope/pkg': '^1.0.0',
    }

    expect(hasNpmDependencyPrefix(dependencies, 'npm:tdesign-miniprogram/button')).toBe(true)
    expect(hasNpmDependencyPrefix(dependencies, '/node_modules/@scope/pkg/card')).toBe(true)
    expect(hasNpmDependencyPrefix(dependencies, path.join(
      process.cwd(),
      'node_modules',
      'tdesign-miniprogram',
      'miniprogram_dist',
      'dialog',
      'index.js',
    ))).toBe(true)
    expect(hasNpmDependencyPrefix(dependencies, 'custom-lib/card')).toBe(false)
    expect(hasNpmDependencyPrefix(undefined, 'dayjs')).toBe(false)
  })

  it('normalizes npm imports only for supported platforms and matched dependencies', () => {
    const dependencies = {
      'tdesign-miniprogram': '^1.0.0',
    }

    expect(shouldNormalizeNpmImportByPlatform('tdesign-miniprogram/button/button', {
      platform: 'alipay',
      dependencies,
    })).toBe(true)

    expect(shouldNormalizeNpmImportByPlatform('/node_modules/tdesign-miniprogram/button/button', {
      platform: 'alipay',
      dependencies,
    })).toBe(true)

    expect(shouldNormalizeNpmImportByPlatform('plugin://demo/card', {
      platform: 'alipay',
      dependencies,
    })).toBe(false)

    expect(shouldNormalizeNpmImportByPlatform('custom-lib/button/button', {
      platform: 'alipay',
      dependencies,
    })).toBe(false)

    expect(shouldNormalizeNpmImportByPlatform('tdesign-miniprogram/button/button', {
      platform: 'weapp',
      dependencies,
    })).toBe(false)

    expect(normalizeNpmImportPathByPlatform('tdesign-miniprogram/button/button', {
      platform: 'alipay',
      dependencies,
    })).toBe('/node_modules/tdesign-miniprogram/button/button')

    expect(normalizeNpmImportPathByPlatform('/node_modules/tdesign-miniprogram/button/button', {
      platform: 'alipay',
      dependencies,
      alipayNpmMode: 'miniprogram_npm',
    })).toBe('/miniprogram_npm/tdesign-miniprogram/button/button')

    expect(normalizeNpmImportPathByPlatform('custom-lib/button/button', {
      platform: 'alipay',
      dependencies,
    })).toBe('custom-lib/button/button')

    expect(normalizeNpmImportPathByPlatform('plugin://demo/card', {
      platform: 'alipay',
      dependencies,
    })).toBe('plugin://demo/card')

    expect(normalizeNpmImportPathByPlatform('tdesign-miniprogram/button/button', {
      platform: 'weapp',
      dependencies,
    })).toBe('tdesign-miniprogram/button/button')
  })
})
