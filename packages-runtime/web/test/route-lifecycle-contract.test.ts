// @vitest-environment happy-dom

import type { PageStackEntry } from '../src/runtime/polyfill/routeRuntime/options'
import {
  WEVU_PAGE_LAYOUT_NAME_KEY,
  WEVU_PAGE_LAYOUT_PROPS_KEY,
  WEVU_PAGE_LAYOUT_SETTER_KEY,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  attachRouteMeta,
  augmentPageComponentOptions,
  dispatchPageLifetimeToComponents,
  hidePageInstance,
  showPageInstance,
} from '../src/runtime/polyfill/routeRuntime/lifecycle'

function createRecord() {
  return {
    hooks: {
      onHide: vi.fn(),
      onLoad: vi.fn(),
      onReady: vi.fn(),
      onShow: vi.fn(),
      onUnload: vi.fn(),
    },
    instances: new Set<any>(),
    tag: 'weapp-page-contract',
  }
}

describe('route page lifecycle contract', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('dispatches page lifetimes through light and shadow DOM trees', () => {
    const page = document.createElement('div') as any
    const renderRoot = document.createElement('main')
    page.renderRoot = renderRoot
    renderRoot.append(document.createTextNode('text'))
    const light = document.createElement('section') as any
    light.__weappInvokePageLifetime = vi.fn()
    const shadowHost = document.createElement('article')
    const shadow = shadowHost.attachShadow({ mode: 'open' })
    const shadowChild = document.createElement('span') as any
    shadowChild.__weappInvokePageLifetime = vi.fn()
    shadow.append(shadowChild)
    renderRoot.append(light, shadowHost)

    dispatchPageLifetimeToComponents(page, 'resize')
    expect(light.__weappInvokePageLifetime).toHaveBeenCalledWith('resize')
    expect(shadowChild.__weappInvokePageLifetime).toHaveBeenCalledWith('resize')

    const shadowPage = document.createElement('div') as any
    shadowPage.attachShadow({ mode: 'open' })
    dispatchPageLifetimeToComponents(shadowPage, 'show')
    dispatchPageLifetimeToComponents(document.createElement('div') as any, 'hide')
    dispatchPageLifetimeToComponents({ renderRoot: {} } as any, 'show')
    dispatchPageLifetimeToComponents({ renderRoot: { querySelectorAll: vi.fn() } } as any, 'show')
  })

  it('runs augmented page hooks, layout setters, visibility, and entry cleanup', () => {
    const calls: string[] = []
    const record = createRecord()
    const component = augmentPageComponentOptions({
      lifetimes: {
        attached() {
          calls.push('original:attached')
        },
        created() {
          calls.push('original:created')
        },
        detached() {
          calls.push('original:detached')
        },
        ready() {
          calls.push('original:ready')
        },
      },
    }, record as any)
    const instance = document.createElement('div') as any
    instance.setData = vi.fn()
    const entry: PageStackEntry = { active: true, id: 'pages/home', query: { id: '7' } }
    attachRouteMeta(instance, { entry, id: 'pages/home', query: entry.query } as any)

    component.lifetimes!.created!.call(instance)
    expect(record.instances.has(instance)).toBe(true)
    instance[WEVU_PAGE_LAYOUT_SETTER_KEY](false)
    expect(instance.setData).toHaveBeenLastCalledWith({
      [WEVU_PAGE_LAYOUT_NAME_KEY]: '__wv_no_layout',
      [WEVU_PAGE_LAYOUT_PROPS_KEY]: {},
    })
    instance[WEVU_PAGE_LAYOUT_SETTER_KEY]('default', { title: 'Home' })
    expect(instance.setData).toHaveBeenLastCalledWith({
      [WEVU_PAGE_LAYOUT_NAME_KEY]: 'default',
      [WEVU_PAGE_LAYOUT_PROPS_KEY]: { title: 'Home' },
    })
    instance[WEVU_PAGE_LAYOUT_SETTER_KEY]('empty')
    expect(instance.setData).toHaveBeenLastCalledWith({
      [WEVU_PAGE_LAYOUT_NAME_KEY]: 'empty',
      [WEVU_PAGE_LAYOUT_PROPS_KEY]: {},
    })

    component.lifetimes!.attached!.call(instance)
    component.lifetimes!.attached!.call(instance)
    expect(entry.instance).toBe(instance)
    expect(record.hooks.onLoad).toHaveBeenCalledTimes(1)
    expect(record.hooks.onLoad).toHaveBeenCalledWith({ id: '7' })
    expect(record.hooks.onShow).toHaveBeenCalledTimes(2)

    component.lifetimes!.ready!.call(instance)
    showPageInstance(instance, record as any)
    hidePageInstance(instance, record as any)
    hidePageInstance(instance, record as any)
    showPageInstance(instance, record as any)
    expect(record.hooks.onHide).toHaveBeenCalledTimes(1)
    expect(record.hooks.onShow).toHaveBeenCalledTimes(3)

    component.lifetimes!.detached!.call(instance)
    expect(entry.instance).toBeUndefined()
    expect(record.hooks.onUnload).toHaveBeenCalledTimes(1)
    expect(record.instances.has(instance)).toBe(false)
    expect(calls).toEqual([
      'original:created',
      'original:attached',
      'original:attached',
      'original:ready',
      'original:detached',
    ])
  })

  it('handles missing route metadata, inactive entries, and unloaded state guards', () => {
    const record = createRecord()
    const component = augmentPageComponentOptions({}, record as any)
    const instance = document.createElement('div') as any
    instance.setData = vi.fn()

    showPageInstance(instance, record as any)
    hidePageInstance(instance, record as any)
    component.lifetimes!.created!.call(instance)
    component.lifetimes!.attached!.call(instance)
    component.lifetimes!.ready!.call(instance)
    component.lifetimes!.detached!.call(instance)
    component.lifetimes!.detached!.call(instance)
    expect(record.hooks.onLoad).toHaveBeenCalledWith({})
    expect(record.hooks.onUnload).toHaveBeenCalledTimes(1)

    const inactive = document.createElement('div') as any
    const entry = { active: false, id: 'pages/inactive', query: {} }
    attachRouteMeta(inactive, { entry, id: entry.id, query: {} } as any)
    component.lifetimes!.created!.call(inactive)
    component.lifetimes!.attached!.call(inactive)
    component.lifetimes!.ready!.call(inactive)
    expect(record.hooks.onShow).toHaveBeenCalledTimes(1)
    component.lifetimes!.detached!.call(inactive)
  })
})
