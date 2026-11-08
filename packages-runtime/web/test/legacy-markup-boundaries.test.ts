// @vitest-environment happy-dom

import { WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX } from '@weapp-core/constants'
import { html, render } from 'lit'
import { getDirectiveClass } from 'lit/directive-helpers.js'
import { PartType } from 'lit/directive.js'
import { describe, expect, it } from 'vitest'
import { assignDataPath, cloneCommittedValue } from '../src/runtime/component/utils'
import { buildAttributeString } from '../src/runtime/legacyTemplate/dom'
import { legacyMarkup } from '../src/runtime/legacyTemplate/markup'
import { recordLegacyElementKey, recordLegacyMarkupKeys, resolveLegacyMarkupKey } from '../src/runtime/legacyTemplate/markupKeys'
import { parseSharedTemplateNodes } from '../src/runtime/legacyTemplate/parser'

describe('legacy markup boundary ownership', () => {
  it('retains unkeyed text and element identity while updating attributes and node kinds', () => {
    const context = {}
    recordLegacyMarkupKeys(context, [])
    const container = document.createElement('div')
    const update = (source: string) => render(html`${legacyMarkup(source, context)}`, container)
    update('first<div class="old" style="color:red" title="old">body</div><!--note-->')
    const original = container.querySelector('div')!
    update('second<div class="next" style="background:blue" data-note="new">body</div><!--next-->')
    expect(container.querySelector('div')).toBe(original)
    expect(original.className).toBe('next')
    expect(original.style.color).toBe('')
    expect(original.style.background).toBe('blue')
    expect(original.hasAttribute('title')).toBe(false)
    expect(original.getAttribute('data-note')).toBe('new')
    update('third<div>body</div><!--next-->')
    expect(original.hasAttribute('class')).toBe(false)
    expect(original.hasAttribute('style')).toBe(false)
    expect(original.hasAttribute('data-note')).toBe(false)
    update('<span>replacement</span>')
    expect(container.querySelector('div')).toBeNull()
    expect(container.textContent).toBe('replacement')
    const Directive = getDirectiveClass(legacyMarkup('', context))!
    expect(() => new Directive({ type: PartType.ELEMENT })).toThrow(TypeError)
  })

  it('recaptures a child range when its boundaries have been removed by the host', () => {
    const context = {}
    recordLegacyMarkupKeys(context, [])
    const container = document.createElement('div')
    const update = (value: string) => render(html`${legacyMarkup(value, context)}`, container)
    update('<article><span>first</span></article>')
    const original = container.querySelector('article')!
    original.replaceChildren()
    update('<article><span>second</span></article>')
    expect(container.querySelector('article')).not.toBe(original)
    expect(container.querySelector('span')!.textContent).toBe('second')
  })

  it('resolves anchors conservatively and preserves literal source attributes', () => {
    const context = {}
    const token = new Map<string, unknown>()
    recordLegacyElementKey(token, {}, {}, false, new Map([['title', '<safe>'], ['class', 'source']]))
    recordLegacyMarkupKeys(context, [token])
    expect(resolveLegacyMarkupKey(context, 'ordinary comment')).toBeUndefined()
    expect(resolveLegacyMarkupKey(context, `${WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX}bad`)).toBeUndefined()
    expect(resolveLegacyMarkupKey(context, `${WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX}9`)).toBeUndefined()
    const container = document.createElement('div')
    render(html`${legacyMarkup(`<!--${WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX}0--><div title="wrong"></div>`, context)}`, container)
    expect(container.querySelector('div')!.getAttribute('title')).toBe('<safe>')
    expect(container.querySelector('div')!.className).toBe('source')
  })

  it('ignores incomplete fragment anchors and updates ordinary comments', () => {
    const context = {}
    const token = new Map<string, unknown>()
    recordLegacyElementKey(token, {}, {}, true)
    recordLegacyMarkupKeys(context, [token])
    const container = document.createElement('div')
    const anchor = `<!--${WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX}0-->`
    const update = (source: string) => render(html`${legacyMarkup(source, context)}`, container)
    update(`${anchor}before<div>first</div>`)
    update(`${anchor}after<span>second</span>`)
    expect(container.textContent).toBe('aftersecond')
  })

  it('keeps empty event values inert and literal controlled attributes outside expression evaluation', () => {
    const token = new Map<string, unknown>()
    expect(buildAttributeString({ 'bind:': 'handler', 'bindtap': '', 'value': 'literal' }, {}, token, ['value']))
      .toContain('bind:="handler"')
    expect(buildAttributeString({ bindtap: '  ' }, {})).toBe('')
    expect(parseSharedTemplateNodes('<view><!DOCTYPE child></view>')[0]).toMatchObject({
      children: [expect.objectContaining({ type: 'directive' })],
    })
  })

  it('preserves non-plain values and cyclic committed snapshots without mutating old paths', () => {
    const date = new Date(0)
    const custom = Object.create({ inherited: true })
    const plain = Object.create(null)
    plain.value = 1
    const source = { date, custom, plain, shared: { value: 2 } } as Record<string, any>
    source.self = source
    source.other = source.shared
    const cloned = cloneCommittedValue(source) as typeof source
    expect(cloned.self).toBe(cloned)
    expect(cloned.date).toBe(date)
    expect(cloned.custom).toBe(custom)
    expect(cloned.plain).toEqual({ value: 1 })
    expect(cloned.other).toBe(cloned.shared)
    const target = { stable: true } as Record<string, any>
    assignDataPath(target, [], 'ignored')
    assignDataPath(target, ['items', '0', 'name'], 'first')
    expect(target).toEqual({ stable: true, items: [{ name: 'first' }] })
  })
})
