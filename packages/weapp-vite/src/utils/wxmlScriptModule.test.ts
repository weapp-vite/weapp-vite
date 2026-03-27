import { describe, expect, it } from 'vitest'
import {
  getScriptModuleImportAttrs,
  getScriptModuleTagNames,
  isScriptModuleImportAttr,
  isScriptModuleTagName,
  normalizeImportSjsAttributes,
  resolveScriptModuleTagByPlatform,
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
    expect(getScriptModuleTagNames()).toEqual(['wxs', 'sjs', 'import-sjs'])
    expect(isScriptModuleTagName('wxs')).toBe(true)
    expect(isScriptModuleTagName('import-sjs')).toBe(true)
    expect(isScriptModuleTagName('include')).toBe(false)
    expect(getScriptModuleImportAttrs('wxs')).toEqual(['src'])
    expect(getScriptModuleImportAttrs('import-sjs')).toEqual(['from'])
    expect(getScriptModuleImportAttrs('include')).toBeUndefined()
    expect(isScriptModuleImportAttr('wxs', 'src')).toBe(true)
    expect(isScriptModuleImportAttr('import-sjs', 'from')).toBe(true)
    expect(isScriptModuleImportAttr('import-sjs', 'src')).toBe(false)
    expect(isScriptModuleImportAttr(undefined, 'src')).toBe(false)
  })
})
