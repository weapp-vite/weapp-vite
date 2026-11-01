// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import type { TemplateRenderer } from '../src/runtime/template'
import { transformSync } from 'esbuild'
import { html } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { RUNTIME_ID } from '../src/plugin/constants'
import { defineComponent } from '../src/runtime/component'
import { bindRuntimeEvent } from '../src/runtime/eventBinding'

type Owner = ComponentPublicInstance & { updateComplete: Promise<boolean> }
let sequence = 0

function compile(source: string): TemplateRenderer {
  const result = compileWxml({ id: '/touch-rendering.wxml', source, resolveTemplatePath: () => undefined, resolveWxsPath: () => undefined })
  const module = { exports: {} as { render: TemplateRenderer } }
  const imports: Record<string, unknown> = {
    'lit': { html },
    'lit/directives/repeat.js': { repeat },
    [RUNTIME_ID]: { bindRuntimeEvent },
  }
  // eslint-disable-next-line no-new-func -- 运行真实编译产物，验证事件回调触发 setData 的订阅生命周期。
  new Function('require', 'module', 'exports', transformSync(result.code, { format: 'cjs' }).code)(
    (id: string) => imports[id],
    module,
    module.exports,
  )
  return module.exports.render
}

function pointer(target: EventTarget, name: string) {
  target.dispatchEvent(new PointerEvent(name, {
    bubbles: true,
    composed: true,
    cancelable: true,
    pointerType: 'mouse',
    pointerId: 1,
    isPrimary: true,
    button: 0,
    buttons: name === 'pointerup' ? 0 : 1,
    clientX: 20,
    clientY: 30,
  }))
}

afterEach(() => document.body.replaceChildren())

describe('compiled touch rendering ownership', () => {
  it('ignores a focused button blur caused by focusing the next pressed touch source', async () => {
    const tag = `touch-rendering-${++sequence}`
    defineComponent(tag, {
      template: compile(`
        <button id="reset">reset</button>
        <button id="drag" bindtouchstart="touch" bindtouchend="touch" bindtouchcancel="touch">drag</button>
        <text>{{trace}}</text>
      `),
      component: {
        data: { trace: '[]' },
        methods: {
          touch(event: { type: string }) {
            this.setData({ trace: JSON.stringify([...JSON.parse(this.data.trace), event.type]) })
          },
        },
      },
    })
    const owner = document.createElement(tag) as Owner
    document.body.append(owner)
    await owner.updateComplete
    const previous = owner.shadowRoot!.querySelector<HTMLButtonElement>('#reset')!
    const target = owner.shadowRoot!.querySelector<HTMLButtonElement>('#drag')!
    const blurred = vi.fn()
    previous.addEventListener('blur', blurred)
    previous.focus()
    pointer(target, 'pointerdown')
    await owner.updateComplete
    target.focus()
    expect(blurred).toHaveBeenCalledOnce()
    pointer(document.body, 'pointerup')
    await owner.updateComplete
    expect(JSON.parse(owner.data.trace)).toEqual(['touchstart', 'touchend'])
  })

  it('retains one interested target when a touch handler triggers setData before release', async () => {
    const tag = `touch-rendering-${++sequence}`
    defineComponent(tag, {
      template: compile('<view id="drag" bindtouchstart="start" /><text>{{count}}</text>'),
      component: { data: { count: 0 }, methods: { start() { this.setData({ count: this.data.count + 1 }) } } },
    })
    const owner = document.createElement(tag) as Owner
    document.body.append(owner)
    await owner.updateComplete
    const target = owner.shadowRoot!.querySelector('#drag')!
    const ended = vi.fn()
    target.addEventListener('touchend', ended)
    pointer(target, 'pointerdown')
    await owner.updateComplete
    expect(owner.data.count).toBe(1)
    expect(owner.shadowRoot!.querySelector('#drag')).toBe(target)
    pointer(document.body, 'pointerup')
    expect(ended).toHaveBeenCalledOnce()
  })

  it('finishes a fresh caught gesture after blur and real setData trace updates', async () => {
    const tag = `touch-rendering-${++sequence}`
    defineComponent(tag, {
      template: compile(`
        <button id="reset" bindtap="reset">reset</button>
        <view bindtouchstart="parent">
          <view id="drag" catchtouchstart="touch" bindtouchmove="touch" bindtouchend="touch" bindtouchcancel="touch" />
        </view>
        <text>{{trace}}</text>
      `),
      component: {
        data: { trace: '[]', parents: 0 },
        methods: {
          touch(event: { type: string }) {
            this.setData({ trace: JSON.stringify([...JSON.parse(this.data.trace), event.type]) })
          },
          parent() { this.setData({ parents: this.data.parents + 1 }) },
          reset() { this.setData({ trace: '[]' }) },
        },
      },
    })
    const owner = document.createElement(tag) as Owner
    document.body.append(owner)
    await owner.updateComplete
    const target = owner.shadowRoot!.querySelector('#drag')!
    pointer(target, 'pointerdown')
    await owner.updateComplete
    window.dispatchEvent(new Event('blur'))
    await owner.updateComplete
    pointer(document.body, 'pointerup')
    expect(JSON.parse(owner.data.trace)).toEqual(['touchstart', 'touchcancel'])
    ;(owner.shadowRoot!.querySelector('#reset') as HTMLButtonElement).click()
    await owner.updateComplete
    expect(JSON.parse(owner.data.trace)).toEqual([])
    pointer(target, 'pointerdown')
    await owner.updateComplete
    pointer(document.body, 'pointerup')
    await owner.updateComplete
    expect(JSON.parse(owner.data.trace)).toEqual(['touchstart', 'touchend'])
    expect(owner.data.parents).toBe(0)
  })

  it('uses the latest business handler without replacing the underlying event subscription', async () => {
    const calls: string[] = []
    const tag = `touch-rendering-${++sequence}`
    defineComponent(tag, {
      template: compile('<view id="drag" bindtouchstart="{{handler}}" />'),
      component: {
        data: { handler: 'first' },
        methods: {
          first() {
            calls.push('first')
            this.setData({ handler: 'second' })
          },
          second() { calls.push('second') },
        },
      },
    })
    const owner = document.createElement(tag) as Owner
    document.body.append(owner)
    await owner.updateComplete
    const target = owner.shadowRoot!.querySelector('#drag')!
    const ended = vi.fn()
    target.addEventListener('touchend', ended)
    pointer(target, 'pointerdown')
    await owner.updateComplete
    pointer(document.body, 'pointerup')
    pointer(target, 'pointerdown')
    pointer(document.body, 'pointerup')
    expect(calls).toEqual(['first', 'second'])
    expect(ended).toHaveBeenCalledTimes(2)
  })
})
