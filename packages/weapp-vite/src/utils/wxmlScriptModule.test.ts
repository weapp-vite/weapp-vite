import { describe, expect, it } from 'vitest'
import { normalizeImportSjsAttributes, resolveScriptModuleTagByPlatform } from './wxmlScriptModule'

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
})
