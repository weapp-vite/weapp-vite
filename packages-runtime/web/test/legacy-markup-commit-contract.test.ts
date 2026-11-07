// @vitest-environment happy-dom

import { WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX } from '@weapp-core/constants'
import { html, render } from 'lit'
import { describe, expect, it } from 'vitest'
import { commitLegacyControlledValues, releaseLegacyControlledValues } from '../src/runtime/controlledAttributes'
import { readRuntimeDataset } from '../src/runtime/dataset'
import { createTemplate } from '../src/runtime/legacyTemplate'
import { commitLegacyDatasetBindings, releaseLegacyDatasetBindings } from '../src/runtime/legacyTemplate/dataset'
import { buildAttributeString } from '../src/runtime/legacyTemplate/dom'
import { legacyMarkup } from '../src/runtime/legacyTemplate/markup'
import { recordLegacyMarkupKeys } from '../src/runtime/legacyTemplate/markupKeys'

function renderWithContext(template: ReturnType<typeof createTemplate>, scope: Record<string, unknown>, context: object): string {
  return Reflect.apply(template, undefined, [scope, context])
}

describe('legacy markup commit contracts', () => {
  it('ignores malformed dataset anchors while committing a following valid binding', () => {
    const context = {}
    const template = createTemplate('<view data-value="{{value}}">valid</view>')
    const root = document.createElement('div')
    root.innerHTML = `<!--${WEAPP_VITE_WEB_LEGACY_DATASET_COMMENT_PREFIX}bad--><span data-value="7"></span>${renderWithContext(template, { value: 7 }, context)}`

    commitLegacyDatasetBindings(root, context)

    expect(readRuntimeDataset(root.querySelector('span'))).toEqual({ value: '7' })
    expect(readRuntimeDataset(root.querySelector('weapp-view'))).toEqual({ value: 7 })
    releaseLegacyDatasetBindings(context)
  })

  it.each([
    ['literal', 'literal'],
    ['hello {{name}}', 'hello ready'],
  ])('commits controlled attribute %s through its recorded reader', (source, expected) => {
    const context = {}
    const token = new Map<string, unknown>()
    const element = document.createElement('input')
    expect(buildAttributeString({ value: source }, { name: 'ready' }, token, ['value'])).toBe('')

    commitLegacyControlledValues(context, [{ element, token }])

    expect(element.getAttribute('value')).toBe(expected)
    releaseLegacyControlledValues(context)
  })

  it('reorders keyed nodes even when template expressions produce identical markup', () => {
    const context = {}
    const template = createTemplate('<view wx:for="{{items}}" wx:key="{{item.id}}">{{item.label}}</view>')
    const container = document.createElement('div')
    const first = { id: 'first', label: 'same' }
    const second = { id: 'second', label: 'same' }
    const update = (items: Array<typeof first>) => render(html`${legacyMarkup(renderWithContext(template, { items }, context), context)}`, container)
    update([first, second])
    const before = [...container.querySelectorAll('weapp-view')]

    update([second, first])

    const after = [...container.querySelectorAll('weapp-view')]
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[0])
    expect(container.textContent).toBe('samesame')
  })

  it('preserves retained classes and host styles while updating source values and priorities', () => {
    const context = {}
    recordLegacyMarkupKeys(context, [])
    const container = document.createElement('div')
    const update = (source: string) => render(html`${legacyMarkup(source, context)}`, container)
    update('<section>content</section>')
    const element = container.querySelector('section')!
    update('<section class="keep old" style="color:red; width:1px !important; background:blue">content</section>')
    expect(container.querySelector('section')).toBe(element)
    expect(element.style.getPropertyPriority('width')).toBe('important')
    element.classList.add('host')
    element.style.setProperty('--host-state', 'ready')

    update('<section class="keep next" style="color:red; width:1px; background:green">content</section>')

    expect(container.querySelector('section')).toBe(element)
    expect([...element.classList].sort()).toEqual(['host', 'keep', 'next'])
    expect(element.style.color).toBe('red')
    expect(element.style.width).toBe('1px')
    expect(element.style.getPropertyPriority('width')).toBe('')
    expect(element.style.background).toBe('green')
    expect(element.style.getPropertyValue('--host-state')).toBe('ready')
  })

  it('updates HTML void elements without creating child ranges', () => {
    const context = {}
    recordLegacyMarkupKeys(context, [])
    const container = document.createElement('div')
    const update = (source: string) => render(html`${legacyMarkup(source, context)}`, container)
    update('<input value="first"><br>')
    const input = container.querySelector('input')!
    const lineBreak = container.querySelector('br')!

    update('<input value="second"><br data-next="ready">')

    expect(container.querySelector('input')).toBe(input)
    expect(input.getAttribute('value')).toBe('second')
    expect(input.childNodes).toHaveLength(0)
    expect(container.querySelector('br')).toBe(lineBreak)
    expect(lineBreak.getAttribute('data-next')).toBe('ready')
    expect(lineBreak.childNodes).toHaveLength(0)
  })

  it('keeps inserting siblings when an inserted custom element removes itself on connection', () => {
    const tag = 'legacy-self-removing-commit-boundary'
    let connections = 0
    customElements.define(tag, class extends HTMLElement {
      connectedCallback() {
        connections++
        this.remove()
      }
    })
    const context = {}
    recordLegacyMarkupKeys(context, [])
    const container = document.createElement('div')
    document.body.appendChild(container)
    try {
      const update = (source: string) => render(html`${legacyMarkup(source, context)}`, container)
      update('<p>initial</p>')

      update(`<${tag}></${tag}><span>survives</span>`)

      expect(connections).toBe(1)
      expect(container.querySelector(tag)).toBeNull()
      expect(container.querySelector('p')).toBeNull()
      expect(container.querySelector('span')!.textContent).toBe('survives')
      expect(container.textContent).toBe('survives')
    }
    finally {
      container.remove()
    }
  })
})
