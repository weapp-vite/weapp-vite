import type { Element, Node } from 'domhandler'
import { describe, expect, it, vi } from 'vitest'
import {
  createComponentPublicInstance,
  resolveComponentPublicInstanceTarget,
} from '../src/runtime/component/publicInstance'
import {
  createComponentRuntimeState,
  updateComponentRuntimeState,
} from '../src/runtime/component/state'
import {
  buildAttributeString,
  extractFor,
  isConditionalElement,
  stripControlAttributes,
} from '../src/runtime/legacyTemplate/dom'
import { AppLifecycleRuntime } from '../src/runtime/polyfill/routeRuntime/appLifecycle'

describe('runtime entry boundary contracts', () => {
  it('exposes runtime descriptors and complete proxy membership semantics', () => {
    const symbol = Symbol('runtime')
    const target = { own: 'value', [symbol]: true } as any
    const runtimePrototype = {
      runtimeMethod() {
        return this.own
      },
      runtimeValue: 1,
    }
    Object.setPrototypeOf(target, runtimePrototype)
    const componentMethod = vi.fn()
    const publicInstance = createComponentPublicInstance(
      target,
      runtimePrototype,
      key => key === 'componentMethod' ? componentMethod : undefined,
    ) as any

    expect(publicInstance.runtimeValue).toBe(1)
    expect(publicInstance.runtimeMethod()).toBe('value')
    expect(publicInstance.runtimeMethod).toBe(publicInstance.runtimeMethod)
    expect(publicInstance.componentMethod).toBe(componentMethod)
    expect(publicInstance.unknown).toBeUndefined()
    expect(publicInstance[symbol]).toBe(true)
    expect('own' in publicInstance).toBe(true)
    expect('runtimeValue' in publicInstance).toBe(true)
    expect('componentMethod' in publicInstance).toBe(true)
    expect(symbol in publicInstance).toBe(true)
    expect(Symbol('missing') in publicInstance).toBe(false)
    expect('missing' in publicInstance).toBe(false)
    expect(resolveComponentPublicInstanceTarget(publicInstance)).toBe(target)
    expect(resolveComponentPublicInstanceTarget(null)).toBeUndefined()
    expect(resolveComponentPublicInstanceTarget('value')).toBeUndefined()
  })

  it('handles app registration repair and visibility before launch', () => {
    const listeners = new Map<string, () => void>()
    const target = {
      hidden: false,
      visibilityState: 'visible' as DocumentVisibilityState,
      addEventListener: vi.fn((name: string, handler: () => void) => listeners.set(name, handler)),
      removeEventListener: vi.fn((name: string) => listeners.delete(name)),
    }
    const runtime = new AppLifecycleRuntime(() => undefined)
    runtime.bindVisibility(undefined)
    runtime.bindVisibility({ ...target, addEventListener: undefined as any })
    runtime.bindVisibility(target)
    listeners.get('visibilitychange')?.()

    const app = { globalData: 1 as any, onHide: vi.fn(), onShow: vi.fn() }
    runtime.register(app)
    expect(app.globalData).toEqual({})
    app.globalData = 1
    runtime.register({ globalData: null as any })
    expect(app.globalData).toEqual({})
    expect(runtime.getLaunchOptions()).toMatchObject({ path: '' })
    expect(runtime.getEnterOptions()).toMatchObject({ path: '' })

    runtime.ensureLaunched({ active: true, id: 'pages/home', query: {} })
    target.hidden = true
    listeners.get('visibilitychange')?.()
    expect(app.onHide).toHaveBeenCalledOnce()
    target.hidden = false
    listeners.get('visibilitychange')?.()
    expect(app.onShow).toHaveBeenCalledTimes(2)
    runtime.dispose()
    expect(target.removeEventListener).toHaveBeenCalled()
  })

  it('covers legacy loop aliases, event filtering and node kinds', () => {
    expect(extractFor({
      'wx:for': '{{items}}',
      'wx:for-item': 'entry',
      'wx:for-index': 'entry',
      'class': 'row',
    })).toEqual({
      expr: '{{items}}',
      itemName: 'entry',
      indexName: 'entryIndex',
      restAttribs: { class: 'row' },
    })
    const attributes = buildAttributeString({
      'bindtap': '',
      'bindcustom': 'handleCustom',
      'capture-catchtap': 'handleTap',
      'hidden': '{{missing}}',
    }, {})
    expect(attributes).toContain('data-mp-on-click="handleTap"')
    expect(attributes).toContain('data-mp-on-custom="handleCustom"')
    expect(attributes).toContain('data-mp-on-flags-click="capture,catch"')
    expect(attributes).not.toContain('hidden=')
    expect(stripControlAttributes({ 'wx:if': 'ready', 'id': 'root' })).toEqual({ id: 'root' })
    expect(isConditionalElement({ type: 'text' } as Node)).toBe(false)
    expect(isConditionalElement({ type: 'tag', attribs: { 'wx:elif': 'ready' } } as Element)).toBe(true)
  })

  it('normalizes empty and updated component runtime state', () => {
    const { state } = createComponentRuntimeState({ template: () => '' })
    expect(state).toMatchObject({
      styleRef: '',
      componentRef: { properties: {} },
      propertyEntries: [],
      lifetimes: {},
      pageLifetimes: {},
    })
    const result = updateComponentRuntimeState(state, {
      id: 'updated',
      template: () => 'updated',
      component: {
        properties: null as any,
      },
    })
    expect(state.id).toBe('updated')
    expect(result.nextMethods).toEqual({})

    expect(updateComponentRuntimeState(state, {
      template: () => 'empty',
    }).nextMethods).toEqual({})
  })
})
