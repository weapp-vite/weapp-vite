// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import type { TemplateRenderer } from '../src/runtime/template'
import { transformSync } from 'esbuild'
import { html, nothing, render } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { RUNTIME_ID } from '../src/plugin/constants'
import { defineComponent } from '../src/runtime/component'
import { bindRuntimeEvent } from '../src/runtime/eventBinding'
import { configureInlineStyleUnits, transformInlineStyleValue } from '../src/runtime/inlineStyle'
import { ensureNativeComponentsDefined } from '../src/runtime/nativeComponents'
import { createRenderContext } from '../src/runtime/renderContext'
import { createTemplate } from '../src/runtime/template'
import { resolveStyleUnitOptions } from '../src/shared/styleUnits/options'

let sequence = 0

function compile(source: string): TemplateRenderer {
  const { code } = compileWxml({ id: '/inline-style.wxml', source, resolveTemplatePath: () => undefined, resolveWxsPath: () => undefined })
  const module = { exports: {} as { render: TemplateRenderer } }
  const imports: Record<string, unknown> = {
    'lit': { html },
    'lit/directives/repeat.js': { repeat },
    [RUNTIME_ID]: { bindRuntimeEvent, transformInlineStyleValue },
  }
  // eslint-disable-next-line no-new-func -- 执行真实模板编译结果，核验 Lit 提交后的 DOM 属性。
  new Function('require', 'module', 'exports', transformSync(code, { format: 'cjs' }).code)(
    (id: string) => imports[id],
    module,
    module.exports,
  )
  return module.exports.render
}

beforeAll(() => ensureNativeComponentsDefined())
afterEach(() => {
  document.body.replaceChildren()
  configureInlineStyleUnits()
})

describe.each(['compiled', 'legacy'])('%s inline style rendering', (mode) => {
  it('converts static, object and array styles on initial render and subsequent updates', async () => {
    configureInlineStyleUnits(resolveStyleUnitOptions({ pxPerRpx: 0.25 }))
    const source = '<view id="static" style="width:20rpx"/><view id="probe" style="{{styles}}"/>'
    const tag = `inline-style-owner-${++sequence}`
    defineComponent(tag, {
      template: mode === 'compiled' ? compile(source) : createTemplate(source),
      component: { data: { styles: [{ width: '40rpx' }, 'height:80rpx'] } },
    })
    const host = document.createElement(tag) as ComponentPublicInstance & { updateComplete: Promise<boolean> }
    document.body.append(host)
    await host.updateComplete
    expect(host.shadowRoot!.querySelector('#static')!.getAttribute('style')).toBe('width:5px')
    expect(host.shadowRoot!.querySelector('#probe')!.getAttribute('style')).toBe('width:10px;height:20px')
    await host.setData({ styles: { 'width': '80rpx', '--customHeight': '40rpx' } })
    await host.updateComplete
    expect(host.shadowRoot!.querySelector('#probe')!.getAttribute('style')).toBe('width:20px;--customHeight:10px')
    await host.setData({ styles: null })
    await host.updateComplete
    expect(host.shadowRoot!.querySelector<HTMLElement>('#probe')!.style.width).toBe('')
    await host.setData({ styles: 'width:12rpx' })
    await host.updateComplete
    expect(host.shadowRoot!.querySelector('#probe')!.getAttribute('style')).toBe('width:3px')
  })
})

it('keeps native Lit attribute behavior for primitives, nullish values and the removal sentinel', () => {
  const baseline = document.createElement('div')
  const compiled = document.createElement('div')
  const context = createRenderContext({} as ComponentPublicInstance, {})
  const template = compile('<view style="{{styles}}"/>')
  for (const value of ['color:red', false, 12, null, undefined, nothing, 'color:blue']) {
    render(html`<div style=${value}></div>`, baseline)
    render(template({ styles: value }, context), compiled)
    const expected = baseline.firstElementChild!
    const actual = compiled.querySelector('weapp-view')!
    expect(actual.hasAttribute('style')).toBe(expected.hasAttribute('style'))
    expect(actual.getAttribute('style')).toBe(expected.getAttribute('style'))
  }
})
