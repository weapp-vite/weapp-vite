import { describe, expect, it } from 'vitest'
import {
  getTemplateImportAttrs,
  getTemplateImportTagNames,
  isImportTag,
  isTemplateImportAttr,
  isTemplateImportTag,
  shouldNormalizeTemplateImportSource,
} from './shared'

describe('wxml shared template import helpers', () => {
  it('exposes template import tag metadata', () => {
    expect(getTemplateImportTagNames()).toEqual(['import', 'include'])
    expect(isTemplateImportTag('import')).toBe(true)
    expect(isTemplateImportTag('include')).toBe(true)
    expect(isTemplateImportTag('wxs')).toBe(false)
    expect(getTemplateImportAttrs()).toBeUndefined()
    expect(getTemplateImportAttrs('import')).toEqual(['src'])
    expect(getTemplateImportAttrs('include')).toEqual(['src'])
    expect(getTemplateImportAttrs('wxs')).toBeUndefined()
    expect(isTemplateImportAttr('import', 'src')).toBe(true)
    expect(isTemplateImportAttr('include', 'src')).toBe(true)
    expect(isTemplateImportAttr('include', 'from')).toBe(false)
    expect(isTemplateImportAttr(undefined, 'src')).toBe(false)
    expect(isImportTag('import')).toBe(true)
    expect(isImportTag('include')).toBe(true)
    expect(isImportTag('wxs')).toBe(false)
  })

  it('detects template import sources that require extension normalization', () => {
    expect(shouldNormalizeTemplateImportSource('./card.wxml')).toBe(true)
    expect(shouldNormalizeTemplateImportSource('./card.html')).toBe(true)
    expect(shouldNormalizeTemplateImportSource('./card.axml')).toBe(false)
    expect(shouldNormalizeTemplateImportSource('./card.sjs')).toBe(false)
  })
})
