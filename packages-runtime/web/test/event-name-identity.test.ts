// @vitest-environment happy-dom

import { html } from 'lit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { compileWxml } from '../src/compiler/wxml'
import { bindRuntimeEvent, createTemplate } from '../src/runtime'
import { defineComponent } from '../src/runtime/component'

type EventSourceElement = HTMLElement & {
  triggerEvent: (name: string, detail?: unknown) => void
}

describe('WXML event name identity', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('preserves custom event case in compiled listeners while retaining native aliases', () => {
    const result = compileWxml({
      id: '/src/pages/index/index.wxml',
      source: `
        <event-child
          bind:ready="handleReady"
          bind:onready="handleLowerReady"
          bind:onReady="handleCamelReady"
          bindTap="handleTap"
        />
      `,
      componentTags: {
        'event-child': 'wv-component-components-event-child-index',
      },
      resolveTemplatePath: () => undefined,
      resolveWxsPath: () => undefined,
    })

    expect(result.code).toContain('"ready"')
    expect(result.code).toContain('"onready"')
    expect(result.code).toContain('"onReady"')
    expect(result.code).toContain('"click"')
    expect(result.code).toContain('"tap"')
  })

  it('delivers case-distinct custom events through compiled component listeners', async () => {
    const handleReady = vi.fn()
    const handleLowerReady = vi.fn()
    const handleCamelReady = vi.fn()
    const handleTap = vi.fn()

    defineComponent('wv-issue-966-compiled-child', {
      template: () => html`<span>child</span>`,
      component: {},
    })
    defineComponent('wv-issue-966-compiled-parent', {
      template: (scope, ctx) => html`
        <wv-issue-966-compiled-child
          ${bindRuntimeEvent('ready', ctx.event('ready', 'handleReady', scope))}
          ${bindRuntimeEvent('onready', ctx.event('onready', 'handleLowerReady', scope))}
          ${bindRuntimeEvent('onReady', ctx.event('onReady', 'handleCamelReady', scope))}
        ></wv-issue-966-compiled-child>
        <button class="tap" ${bindRuntimeEvent('click', ctx.event('tap', 'handleTap', scope))}>tap</button>
      `,
      component: {
        methods: {
          handleReady,
          handleLowerReady,
          handleCamelReady,
          handleTap,
        },
      },
    })

    const parent = document.createElement('wv-issue-966-compiled-parent') as HTMLElement & {
      setData: (patch: Record<string, unknown>) => void | Promise<void>
      updateComplete: Promise<boolean>
    }
    document.body.append(parent)
    await parent.updateComplete
    await parent.setData({ rerender: true })

    const root = parent.shadowRoot!
    const child = root.querySelector('wv-issue-966-compiled-child') as EventSourceElement
    child.triggerEvent('ready', { source: 'ready' })
    child.triggerEvent('onready', { source: 'lower' })
    child.triggerEvent('onReady', { source: 'camel' })
    root.querySelector('.tap')!.dispatchEvent(new Event('click'))

    expect(handleReady).toHaveBeenCalledOnce()
    expect(handleLowerReady).toHaveBeenCalledOnce()
    expect(handleCamelReady).toHaveBeenCalledOnce()
    expect(handleTap).toHaveBeenCalledOnce()
    expect(handleCamelReady).toHaveBeenCalledWith(expect.objectContaining({
      detail: { source: 'camel' },
      type: 'onReady',
    }))
  })

  it('delivers exact event names through legacy templates without changing native aliases', async () => {
    const handleReady = vi.fn()
    const handleLowerReady = vi.fn()
    const handleCamelReady = vi.fn()
    const handleTap = vi.fn()

    defineComponent('wv-issue-966-legacy-child', {
      template: () => html`<span>child</span>`,
      component: {},
    })
    defineComponent('wv-issue-966-legacy-parent', {
      template: createTemplate(`
        <wv-issue-966-legacy-child
          bind:ready="handleReady"
          bind:onready="handleLowerReady"
          bind:onReady="handleCamelReady"
        />
        <view class="tap" bindTap="handleTap">tap</view>
      `),
      component: {
        methods: {
          handleReady,
          handleLowerReady,
          handleCamelReady,
          handleTap,
        },
      },
    })

    const parent = document.createElement('wv-issue-966-legacy-parent') as HTMLElement & {
      updateComplete: Promise<boolean>
    }
    document.body.append(parent)
    await parent.updateComplete

    const root = parent.shadowRoot!
    const child = root.querySelector('wv-issue-966-legacy-child') as EventSourceElement
    child.triggerEvent('ready', { source: 'ready' })
    child.triggerEvent('onready', { source: 'lower' })
    child.triggerEvent('onReady', { source: 'camel' })
    root.querySelector('.tap')!.dispatchEvent(new Event('click'))

    expect(handleReady).toHaveBeenCalledOnce()
    expect(handleLowerReady).toHaveBeenCalledOnce()
    expect(handleCamelReady).toHaveBeenCalledOnce()
    expect(handleTap).toHaveBeenCalledOnce()
    expect(handleCamelReady).toHaveBeenCalledWith(expect.objectContaining({
      detail: { source: 'camel' },
      type: 'onReady',
    }))
  })
})
