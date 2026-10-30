import { DomUtils } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { copyTemplateAttributeMetadata, isValuelessTemplateAttribute } from './templateAttributes'
import { parseWxsTemplateDocument } from './wxsDocument'

describe('WXML valueless attribute boundaries', () => {
  it('preserves the first duplicate attribute value and its original syntax', () => {
    const root = parseWxsTemplateDocument('<probe empty="" empty bare bare="" />')
    const node = DomUtils.getElementsByTagName('probe', root.children)[0]!
    expect(node.attribs).toEqual({ empty: '', bare: '' })
    expect(isValuelessTemplateAttribute(node, 'empty')).toBe(false)
    expect(isValuelessTemplateAttribute(node, 'bare')).toBe(true)
  })

  it('separates valueless, quoted empty and bound empty attributes across nesting and clones', () => {
    const root = parseWxsTemplateDocument('<outer enabled><probe bare empty="" bound="{{\'\'}}" /><probe empty="" /></outer>')
    const [first, second] = DomUtils.getElementsByTagName('probe', root.children)
    expect(isValuelessTemplateAttribute(first!, 'bare')).toBe(true)
    expect(isValuelessTemplateAttribute(first!, 'empty')).toBe(false)
    expect(isValuelessTemplateAttribute(first!, 'bound')).toBe(false)
    expect(isValuelessTemplateAttribute(first!, 'enabled')).toBe(false)
    expect(isValuelessTemplateAttribute(second!, 'bare')).toBe(false)
    const clone = { ...first }
    copyTemplateAttributeMetadata(first!, clone)
    expect(isValuelessTemplateAttribute(clone, 'bare')).toBe(true)
    expect(isValuelessTemplateAttribute(clone, 'empty')).toBe(false)
  })
})
