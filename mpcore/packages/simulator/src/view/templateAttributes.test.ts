import { describe, expect, it } from 'vitest'
import { querySelectorAll } from './selectors'
import { copyTemplateAttributeMetadata, isValuelessTemplateAttribute } from './templateAttributes'
import { parseWxsTemplateDocument } from './wxsDocument'

describe('WXML valueless attribute boundaries', () => {
  it('preserves the first duplicate attribute value and its original syntax', () => {
    const root = parseWxsTemplateDocument('<probe empty="" empty bare bare="" />')
    const node = querySelectorAll(root, 'probe')[0]!
    expect(node.attribs).toEqual({ empty: '', bare: '' })
    expect(isValuelessTemplateAttribute(node, 'empty')).toBe(false)
    expect(isValuelessTemplateAttribute(node, 'bare')).toBe(true)
  })

  it('separates valueless, quoted empty and bound empty attributes across nesting and clones', () => {
    const root = parseWxsTemplateDocument('<outer enabled><probe bare empty="" bound="{{\'\'}}" /><probe empty="" /></outer>')
    const [first, second] = querySelectorAll(root, 'probe')
    expect(isValuelessTemplateAttribute(first!, 'bare')).toBe(true)
    expect(isValuelessTemplateAttribute(first!, 'empty')).toBe(false)
    expect(isValuelessTemplateAttribute(first!, 'bound')).toBe(false)
    expect(isValuelessTemplateAttribute(first!, 'enabled')).toBe(false)
    expect(isValuelessTemplateAttribute(second!, 'bare')).toBe(false)
    const clone = { ...first }
    expect(isValuelessTemplateAttribute(clone, 'bare')).toBe(true)
    copyTemplateAttributeMetadata(first!, clone)
    expect(isValuelessTemplateAttribute(clone, 'bare')).toBe(true)
    expect(isValuelessTemplateAttribute(clone, 'empty')).toBe(false)
  })

  it('clears stale target metadata when copying from an explicit-value node', () => {
    const root = parseWxsTemplateDocument('<probe bare/><probe empty=""/>')
    const [bare, explicit] = querySelectorAll(root, 'probe')
    const target = { ...bare }
    expect(isValuelessTemplateAttribute(target, 'bare')).toBe(true)
    copyTemplateAttributeMetadata(explicit!, target)
    expect(isValuelessTemplateAttribute(target, 'bare')).toBe(false)
    expect(Object.hasOwn(target, 'attributeForms')).toBe(false)
  })

  it('does not attach bare metadata when the legacy attribute object has no own value', () => {
    const root = parseWxsTemplateDocument('<probe __proto__ constructor toString/>')
    const node = querySelectorAll(root, 'probe')[0]!
    expect(Object.getPrototypeOf(node.attribs)).toBe(Object.prototype)
    expect(Object.hasOwn(node.attribs!, '__proto__')).toBe(false)
    expect(isValuelessTemplateAttribute(node, '__proto__')).toBe(false)
    expect(isValuelessTemplateAttribute(node, 'constructor')).toBe(true)
    expect(isValuelessTemplateAttribute(node, 'toString')).toBe(true)
  })
})
