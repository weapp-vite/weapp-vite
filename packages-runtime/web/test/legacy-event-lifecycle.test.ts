// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import { afterEach, describe, expect, it } from 'vitest'
import { createTemplate, defineComponent, ensureNativeComponentsDefined } from '../src/runtime'
import { setAppStyle } from '../src/runtime/appStyle'

type TestElement = ComponentPublicInstance & { updateComplete: Promise<boolean> }
let sequence = 0

ensureNativeComponentsDefined()

afterEach(() => {
  document.body.replaceChildren()
  setAppStyle('')
})

describe('legacy component event lifecycle', () => {
  it.each([0, 3])('delivers internal button clicks through nested components after %s style updates', async (updates) => {
    const id = ++sequence
    const sourceTag = `legacy-event-source-${id}`
    const boundaryTag = `legacy-event-boundary-${id}`
    const outerTag = `legacy-event-outer-${id}`
    defineComponent(sourceTag, {
      template: createTemplate('<button id="emit-click" bindtap="click">Emit one click</button>'),
      component: {
        options: { styleIsolation: 'apply-shared' },
        methods: { click() { this.triggerEvent('click') } },
      },
    })
    defineComponent(boundaryTag, {
      template: createTemplate(`
        <view><${sourceTag} id="source" bindclick="click" bindtap="tap" /></view>
        <text id="count">{{clicks}}</text><text id="taps">{{taps}}</text>
      `),
      component: {
        data: { clicks: 0, taps: 0 },
        methods: {
          click() { this.setData({ clicks: this.data.clicks + 1 }) },
          tap() { this.setData({ taps: this.data.taps + 1 }) },
        },
      },
    })
    defineComponent(outerTag, { template: createTemplate(`<${boundaryTag} />`) })
    const outer = document.createElement(outerTag) as TestElement
    document.body.append(outer)
    await outer.updateComplete
    const boundary = outer.shadowRoot!.querySelector(boundaryTag) as TestElement
    await boundary.updateComplete
    const source = boundary.shadowRoot!.querySelector(sourceTag) as TestElement
    await source.updateComplete
    const buttonHost = source.shadowRoot!.querySelector<HTMLElement>('#emit-click')!
    const button = buttonHost.querySelector('button')!

    for (let update = 0; update < updates; update++) {
      setAppStyle(`#emit-click { color: rgb(${update}, 17, 83) }`)
      await source.updateComplete
      expect(source.shadowRoot!.querySelector('#emit-click')).toBe(buttonHost)
      expect(buttonHost.querySelector('button')).toBe(button)
    }

    button.click()
    await boundary.updateComplete
    expect(boundary.shadowRoot!.querySelector(sourceTag)).toBe(source)
    expect(source.shadowRoot!.querySelector('#emit-click')).toBe(buttonHost)
    expect(buttonHost.querySelector('button')).toBe(button)
    expect(boundary.data.clicks).toBe(1)
    expect(boundary.shadowRoot!.querySelector('#count')!.textContent).toBe('1')
    expect(boundary.shadowRoot!.querySelector('#taps')!.textContent).toBe('1')
  })
})
