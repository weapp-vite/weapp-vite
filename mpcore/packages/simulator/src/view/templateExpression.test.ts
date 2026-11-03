import { describe, expect, it, vi } from 'vitest'
import { resolveTemplateExpression } from './templateExpression'
import { createWxsModuleLoader } from './wxs'

describe('template expression', () => {
  it('evaluates WXML literals, members and operators without dynamic execution', () => {
    const source = {
      active: true,
      index: 1,
      items: [{ label: 'first' }, { label: 'second' }],
      type: 'month',
    }

    expect(resolveTemplateExpression(source, '{{[120, 240]}}')).toEqual([120, 240])
    expect(resolveTemplateExpression(source, '{{ { default: true, current: index } }}')).toEqual({ default: true, current: 1 })
    expect(resolveTemplateExpression(source, `type === 'month' || type === 'monthrange'`)).toBe(true)
    expect(resolveTemplateExpression(source, `active ? items[index].label : ''`)).toBe('second')
    expect(resolveTemplateExpression(source, 'items.1.label')).toBe('second')
    expect(resolveTemplateExpression(source, '{ current: items.1 }')).toEqual({
      current: source.items[1],
    })
    expect(resolveTemplateExpression(source, 'index + 1')).toBe(2)
  })

  it('does not execute calls or expose constructor chains', () => {
    const callback = vi.fn(() => 'called')
    const source = { callback, value: {} }

    expect(resolveTemplateExpression(source, 'callback()')).toBeUndefined()
    expect(resolveTemplateExpression(source, 'value.constructor')).toBeUndefined()
    expect(callback).not.toHaveBeenCalled()
  })

  it('consumes observed WXML string tokens in values and object keys', () => {
    const value = String.raw`c\x22d`
    expect(resolveTemplateExpression({}, String.raw`{'a\'b': "c\"d"}`)).toEqual({
      [String.raw`a\x27b`]: value,
    })
    expect(resolveTemplateExpression({}, String.raw`{['a\'b']: "c\"d"}`)).toEqual({
      [String.raw`a\x27b`]: value,
    })
  })

  it('preserves JavaScript string values from page data and WXS exports', () => {
    const loader = createWxsModuleLoader({
      readSource: () => '',
      resolvePath: (_owner, request) => request,
      execute(_source, _file, module) {
        module.exports = {
          quoted: () => 'a\'b',
          slashed: () => String.raw`a\'b`,
        }
      },
    })
    const tools = loader.load('strings.wxs')
    const source = { tools, quoted: 'a\'b', slashed: String.raw`a\'b` }
    expect(resolveTemplateExpression(source, 'quoted')).toBe('a\'b')
    expect(resolveTemplateExpression(source, 'slashed')).toBe(String.raw`a\'b`)
    expect(resolveTemplateExpression(source, 'tools.quoted()')).toBe('a\'b')
    expect(resolveTemplateExpression(source, 'tools.slashed()')).toBe(String.raw`a\'b`)
    loader.clear()
  })

  it('only invokes registered WXS exports and preserves their receiver with cloned data', () => {
    const loader = createWxsModuleLoader({
      readSource: () => '',
      resolvePath: (_owner, request) => request,
      execute(_source, _file, module) {
        module.exports = {
          prefix: 'wxs:',
          label(this: { prefix: string }, value: { label: string }) {
            value.label = `${this.prefix}${value.label}`
            return value.label
          },
        }
      },
    })
    const tools = loader.load('tools.wxs')
    const source = { tools, value: { label: 'weapp' } }
    expect(resolveTemplateExpression(source, 'tools.label(value)')).toBe('wxs:weapp')
    expect(resolveTemplateExpression(source, 'tools["label"](value)')).toBe('wxs:weapp')
    expect(source.value.label).toBe('weapp')
    expect(resolveTemplateExpression(source, 'tools.label.call(null, value)')).toBeUndefined()
    expect(resolveTemplateExpression(source, 'tools.label.constructor("return globalThis")()')).toBeUndefined()
    expect(loader.load('tools.wxs')).toBe(tools)
    loader.clear()
    expect(loader.load('tools.wxs')).not.toBe(tools)
  })
})
