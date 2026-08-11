import { describe, expect, it, vi } from 'vitest'
import { resolveTemplateExpression } from './templateExpression'

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
})
