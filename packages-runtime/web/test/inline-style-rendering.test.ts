// @vitest-environment happy-dom

import type { ComponentPublicInstance } from '../src/runtime/component'
import type { TemplateRenderer } from '../src/runtime/template'
import { transformSync } from 'esbuild'
import { html, nothing, render } from 'lit'
import { repeat } from 'lit/directives/repeat.js'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { RUNTIME_ID } from '../src/plugin/constants'
import { defineComponent } from '../src/runtime/component'
import { readRuntimeDataset } from '../src/runtime/dataset'
import { bindRuntimeDataset } from '../src/runtime/datasetBinding'
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
    [RUNTIME_ID]: { bindRuntimeDataset, bindRuntimeEvent, transformInlineStyleValue },
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

  it.each(['{{styles}}', ' {{styles}} '])('preserves typed datasets while updating, clearing and restoring inline styles with %s', async (styleBinding) => {
    configureInlineStyleUnits(resolveStyleUnitOptions({ pxPerRpx: 0.25 }))
    const source = `<view id="probe" data-item="{{item}}" data-index="{{index}}" data-enabled="{{enabled}}" style="${styleBinding}" bindtap="capture"/>`
    const capture = vi.fn()
    const initialItem = { id: 'first', values: [1, 2] }
    const nextItem = { id: 'next', values: [3, 4] }
    const tag = `inline-style-dataset-owner-${++sequence}`
    defineComponent(tag, {
      template: mode === 'compiled' ? compile(source) : createTemplate(source),
      component: {
        data: { item: initialItem, index: 0, enabled: false, styles: [{ width: '40rpx' }, 'height:80rpx'] },
        methods: { capture },
      },
    })
    const host = document.createElement(tag) as ComponentPublicInstance & { updateComplete: Promise<boolean> }
    document.body.append(host)
    await host.updateComplete

    function assertState(item: typeof initialItem, index: number, enabled: boolean, width: string, height = '') {
      const element = host.shadowRoot!.querySelector<HTMLElement>('#probe')!
      const dataset = { item, index, enabled }
      expect(element.style.width).toBe(width)
      expect(element.style.height).toBe(height)
      expect(readRuntimeDataset(element)).toMatchObject(dataset)
      capture.mockClear()
      element.dispatchEvent(new MouseEvent('click'))
      expect(capture).toHaveBeenCalledOnce()
      expect(capture.mock.calls[0]![0]).toMatchObject({
        target: { dataset },
        currentTarget: { dataset },
      })
    }

    assertState(initialItem, 0, false, '10px', '20px')
    await host.setData({ item: nextItem, index: 1, enabled: true, styles: { width: '80rpx' } })
    await host.updateComplete
    assertState(nextItem, 1, true, '20px')
    for (const { styles, width } of [
      { styles: null, width: '' },
      { styles: 'width:12rpx', width: '3px' },
      { styles: [], width: '' },
      { styles: 'width:16rpx', width: '4px' },
    ]) {
      await host.setData({ styles })
      await host.updateComplete
      assertState(nextItem, 1, true, width)
    }
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
