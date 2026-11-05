import { describe, expect, it } from 'vitest'
import {
  getDefaultScriptModuleTagByExtension,
  getDerivedScriptModuleTagNames,
  getNativeScriptModuleByTag,
  getOutputTemplateRawTags,
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
  it('recognizes JDS only within the JD native input contract', () => {
    expect(getNativeScriptModuleByTag('jds', 'jd')?.extension).toBe('jds')
    expect(getNativeScriptModuleByTag('jds', 'weapp')).toBeUndefined()
    expect(isScriptModuleTagName('jds', 'jd')).toBe(true)
    expect(isScriptModuleTagName('jds', 'weapp')).toBe(false)
    expect(isScriptModuleTagName('jds')).toBe(false)
    expect(getScriptModuleImportAttrs('jds', 'jd')).toEqual(['src'])
    expect(getScriptModuleImportAttrs('jds', 'weapp')).toBeUndefined()
    expect(getOutputTemplateRawTags('jd')).toEqual(['wxs', 'jds'])
    expect(getOutputTemplateRawTags('weapp')).toEqual(['wxs'])
    expect(resolveScriptModuleTagName({ platform: 'jd', scriptModuleExtension: 'wxs' })).toBe('wxs')
  })

  it('resolves script module tag names from platform adapters', () => {
    expect(resolveScriptModuleTagByPlatform()).toBeUndefined()
    expect(resolveScriptModuleTagByPlatform('weapp', 'wxs')).toBeUndefined()
    expect(resolveScriptModuleTagByPlatform('alipay', 'sjs')).toBe('import-sjs')
    expect(resolveScriptModuleTagByPlatform('alipay', 'wxs')).toBeUndefined()
    expect(resolveScriptModuleTagByPlatform('swan', 'sjs')).toBe('import-sjs')
  })

  it('normalizes import-sjs attributes', () => {
    expect(
      normalizeImportSjsAttributes('<import-sjs module="helper" src="./helper.sjs"></import-sjs>'),
    ).toBe('<import-sjs name="helper" from="./helper.sjs"></import-sjs>')
  })

  it('preserves compatibility references while selecting platform-owned import attributes', () => {
    expect(getDerivedScriptModuleTagNames()).toEqual(['import-sjs', 'import-sjs'])
    expect(getScriptModuleImportAttrs('filter')).toEqual(['src'])
    expect(getScriptModuleImportAttrs('sjs')).toEqual(['src'])
    expect(getScriptModuleImportAttrs('import-sjs', 'alipay')).toEqual(['from'])
    expect(getScriptModuleImportAttrs('import-sjs', 'swan')).toEqual(['src'])
    expect(getScriptModuleImportAttrs('import-sjs', 'weapp')).toEqual(['from'])
    expect(getScriptModuleImportAttrs('wxs', 'swan')).toEqual(['src'])
    expect(shouldNormalizeScriptModuleAttributes('import-sjs', 'alipay')).toBe(true)
    expect(shouldNormalizeScriptModuleAttributes('import-sjs', 'swan')).toBe(false)
    expect(shouldNormalizeScriptModuleAttributes('import-sjs', 'weapp')).toBe(false)
    expect(getDefaultScriptModuleTagByExtension('constructor')).toBe('wxs')
    expect(getDefaultScriptModuleTagByExtension('.')).toBe('wxs')
  })

  it('keeps indexed recipes separate from prototype names and explicit aliases', () => {
    for (const name of ['constructor', 'toString', '__proto__']) {
      expect(getDefaultScriptModuleTagByExtension(name)).toBe('wxs')
      expect(getDefaultScriptModuleTagByExtension(`.${name}`)).toBe('wxs')
      expect(getScriptModuleImportAttrs(name)).toBeUndefined()
      expect(getScriptModuleImportAttrs(name, 'swan')).toBeUndefined()
      expect(isScriptModuleTagName(name)).toBe(false)
      expect(resolveScriptModuleTagName({ scriptModuleTag: name })).toBe(name)
    }
  })

  it('reads live native module attributes after the recipe index is compiled', () => {
    const native = getNativeScriptModuleByTag('jds', 'jd')!
    const original = native.sourceAttribute
    try {
      expect(getScriptModuleImportAttrs('jds', 'jd')).toEqual(['src'])
      native.sourceAttribute = 'from'
      expect(getScriptModuleImportAttrs('jds', 'jd')).toEqual(['from'])
      expect(getScriptModuleImportAttrs('jds', 'weapp')).toBeUndefined()
    }
    finally {
      native.sourceAttribute = original
    }
  })

  it('exposes shared script module tag metadata', () => {
    expect(getDerivedScriptModuleTagNames()).toContain('import-sjs')
    expect(getScriptModuleTagNames()).toEqual(['wxs', 'sjs', 'filter', 'import-sjs'])
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
