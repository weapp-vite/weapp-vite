// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import type { TemplateRenderer } from '../src/runtime/template'
import { transformSync } from 'esbuild'
import { html } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { afterEach, describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { RUNTIME_ID } from '../src/plugin/constants'
import { bindRuntimeEvent, createTemplate, defineComponent, ensureNativeComponentsDefined } from '../src/runtime'

type TestElement = ComponentPublicInstance & { updateComplete: Promise<boolean> }
let sequence = 0
ensureNativeComponentsDefined()
afterEach(() => document.body.replaceChildren())

function template(mode: string): TemplateRenderer {
  const source = '<scroll-view scroll-y="true" refresher-enabled="true" refresher-triggered="{{triggered}}" bindrefresherpulling="{{handler}}" />'
  if (mode === 'legacy') {
    return createTemplate(source)
  }
  const { code } = compileWxml({ id: '/controlled-order.wxml', source, resolveTemplatePath: () => undefined, resolveWxsPath: () => undefined })
  const module = { exports: {} as { render: TemplateRenderer } }
  const imports: Record<string, unknown> = { 'lit': { html }, 'lit/directives/repeat.js': { repeat }, [RUNTIME_ID]: { bindRuntimeEvent } }
  // eslint-disable-next-line no-new-func -- 执行真实编译结果验证同步属性事件与监听提交顺序。
  new Function('require', 'module', 'exports', transformSync(code, { format: 'cjs' }).code)(
    (id: string) => imports[id],
    module,
    module.exports,
  )
  return module.exports.render
}

describe.each(['compiled', 'legacy'])('%s controlled event ordering', (mode) => {
  it.each([false, true])('binds the current handler before a synchronous controlled event, initial=%s', async (triggered) => {
    const calls: string[] = []
    const tag = `controlled-order-${++sequence}`
    defineComponent(tag, {
      template: template(mode),
      component: {
        data: { triggered, handler: 'old' },
        methods: {
          old() { calls.push('old') },
          next() { calls.push('next') },
        },
      },
    })
    const owner = document.createElement(tag) as TestElement
    document.body.append(owner)
    await owner.updateComplete
    expect(calls).toEqual(triggered ? ['old'] : [])
    if (!triggered) {
      const host = owner.shadowRoot!.querySelector('weapp-scroll-view')!
      owner.setData({ triggered: true, handler: 'next' })
      await owner.updateComplete
      expect(owner.shadowRoot!.querySelector('weapp-scroll-view')).toBe(host)
      expect(calls).toEqual(['next'])
    }
  })
})
