import { describe, expect, it } from 'vitest'
import {
  getDefaultScriptModuleTagByExtension,
  getDerivedScriptModuleTagNames,
  getScriptModuleImportAttrs,
  getScriptModuleTagNames,
  isScriptModuleImportAttr,
  isScriptModuleTagName,
  normalizeImportSjsAttributes,
  normalizeScriptModuleExtension,
  resolveScriptModuleTagByPlatform,
  resolveScriptModuleTagName,
  shouldNormalizeScriptModuleAttributes,
} from './wxmlScriptModule'

describe('wxmlScriptModule utils', () => {
  it('resolves script module tag names from platform adapters', () => {
    expect(resolveScriptModuleTagByPlatform()).toBeUndefined()
    expect(resolveScriptModuleTagByPlatform('weapp', 'wxs')).toBeUndefined()
    expect(resolveScriptModuleTagByPlatform('alipay', 'sjs')).toBe('import-sjs')
    expect(resolveScriptModuleTagByPlatform('alipay', 'wxs')).toBeUndefined()
    expect(resolveScriptModuleTagByPlatform('swan', 'sjs')).toBeUndefined()
  })

  it('normalizes import-sjs attributes', () => {
    expect(
      normalizeImportSjsAttributes('<import-sjs module="helper" src="./helper.sjs"></import-sjs>'),
    ).toBe('<import-sjs name="helper" from="./helper.sjs"></import-sjs>')
  })

  it('exposes shared script module tag metadata', () => {
    expect(getDerivedScriptModuleTagNames()).toContain('import-sjs')
    expect(getScriptModuleTagNames()).toEqual(['wxs', 'sjs', 'import-sjs'])
    expect(normalizeScriptModuleExtension()).toBeUndefined()
    expect(normalizeScriptModuleExtension('.sjs')).toBe('sjs')
    expect(normalizeScriptModuleExtension('wxs')).toBe('wxs')
    expect(getDefaultScriptModuleTagByExtension()).toBe('wxs')
    expect(getDefaultScriptModuleTagByExtension('.sjs')).toBe('sjs')
    expect(getDefaultScriptModuleTagByExtension('unknown')).toBe('wxs')
    expect(resolveScriptModuleTagName({ scriptModuleExtension: 'sjs' })).toBe('sjs')
    expect(resolveScriptModuleTagName({ platform: 'alipay', scriptModuleExtension: 'sjs' })).toBe('import-sjs')
    expect(resolveScriptModuleTagName({ scriptModuleExtension: 'sjs', scriptModuleTag: 'custom-sjs' })).toBe('custom-sjs')
    expect(isScriptModuleTagName('wxs')).toBe(true)
    expect(isScriptModuleTagName('import-sjs')).toBe(true)
    expect(isScriptModuleTagName('include')).toBe(false)
    expect(getScriptModuleImportAttrs('')).toBeUndefined()
    expect(getScriptModuleImportAttrs('wxs')).toEqual(['src'])
    expect(getScriptModuleImportAttrs('import-sjs')).toEqual(['from'])
    expect(getScriptModuleImportAttrs('include')).toBeUndefined()
    expect(isScriptModuleImportAttr('wxs', 'src')).toBe(true)
    expect(isScriptModuleImportAttr('import-sjs', 'from')).toBe(true)
    expect(isScriptModuleImportAttr('import-sjs', 'src')).toBe(false)
    expect(isScriptModuleImportAttr(undefined, 'src')).toBe(false)
    expect(shouldNormalizeScriptModuleAttributes('import-sjs')).toBe(true)
    expect(shouldNormalizeScriptModuleAttributes('sjs')).toBe(false)
  })
})
