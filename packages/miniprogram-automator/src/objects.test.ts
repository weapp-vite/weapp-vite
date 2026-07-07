import type { MovableViewElement, ScrollViewElement } from './Element'

/**
 * @file 对象层行为测试。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Automator from './Automator'
import Element, { ContextElement, CustomElement, InputElement } from './Element'
import * as compat from './internal/compat'
import Native from './Native'
import Page from './Page'

vi.mock('./internal/compat', async () => {
  const actual = await vi.importActual<typeof import('./internal/compat')>('./internal/compat')
  return {
    ...actual,
    sleep: vi.fn(async () => {}),
    waitUntil: vi.fn(async (condition: () => unknown | Promise<unknown>) => await condition()),
  }
})

function createConnection(send: (method: string, params?: Record<string, any>, options?: Record<string, any>) => any) {
  return { send } as any
}

describe('Automator', () => {
  it('delegates connect and launch to the inner launcher', async () => {
    const automator = new Automator()
    const launcher = {
      connect: vi.fn(async () => 'connected'),
      launch: vi.fn(async () => 'launched'),
    };
    (automator as any).launcher = launcher

    await expect(automator.connect({ wsEndpoint: 'ws://127.0.0.1' })).resolves.toBe('connected')
    await expect(automator.launch({ projectPath: '/tmp/project' })).resolves.toBe('launched')

    expect(launcher.connect).toHaveBeenCalledWith({ wsEndpoint: 'ws://127.0.0.1' })
    expect(launcher.launch).toHaveBeenCalledWith({ projectPath: '/tmp/project' })
  })
})

describe('Native', () => {
  it('wraps native tool commands', async () => {
    const send = vi.fn(async () => ({ ok: true }))
    const native = new Native(createConnection(send))

    await native.goHome()
    await native.switchTab({ url: '/pages/index/index' })

    expect(send).toHaveBeenNthCalledWith(1, 'Tool.native', { method: 'goHome', data: undefined })
    expect(send).toHaveBeenNthCalledWith(2, 'Tool.native', {
      method: 'switchTab',
      data: { url: '/pages/index/index' },
    })
  })
})

describe('Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refreshes cached page route metadata when reusing page ids', () => {
    const pageMap = new Map<number, Page>()
    const connection = createConnection(vi.fn())

    const firstPage = Page.create(connection, {
      id: 8,
      path: '/pages/detail/index',
      query: {
        x: 'default',
      },
    }, pageMap)
    const secondPage = Page.create(connection, {
      id: 8,
      path: '/pages/detail/index',
      query: {
        x: 'alias',
      },
    }, pageMap)

    expect(secondPage).toBe(firstPage)
    expect(secondPage.path).toBe('/pages/detail/index')
    expect(secondPage.query).toEqual({
      x: 'alias',
    })
  })

  it('waits for selectors through waitUntil', async () => {
    const send = vi.fn(async () => ({
      elements: [{ elementId: 'element-1', tagName: 'view' }],
    }))
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })

    await page.waitFor('.item')

    expect(vi.mocked(compat.waitUntil)).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('Page.getElements', { selector: '.item', pageId: 7 }, {
      timeout: 2_500,
    })
  })

  it('queries data and window properties with page id', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getData') {
        return { data: { foo: 'bar' } }
      }
      if (method === 'Page.getWindowProperties') {
        return { properties: [320, 640] }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.data('foo')).resolves.toEqual({ foo: 'bar' })
    await expect(page.size()).resolves.toEqual({ width: 320, height: 640 })

    expect(send).toHaveBeenNthCalledWith(1, 'Page.getData', { path: 'foo', pageId: 8 }, {
      timeout: 12_000,
    })
    expect(send).toHaveBeenNthCalledWith(2, 'Page.getWindowProperties', {
      names: ['document.documentElement.scrollWidth', 'document.documentElement.scrollHeight'],
      pageId: 8,
    })
  })

  it('waits for rendered page wxml', async () => {
    let wxml = '<view>loading</view>'
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getElement') {
        return { elementId: 'page-root', tagName: 'page' }
      }
      if (method === 'Element.getWXML') {
        return { wxml }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.wxml()).resolves.toBe('<view>loading</view>')
    wxml = '<view>ready</view>'
    await expect(page.waitForRendered({ text: 'ready' })).resolves.toBe('<view>ready</view>')

    expect(send).toHaveBeenCalledWith('Page.getElement', {
      pageId: 8,
      selector: 'page',
    }, {
      timeout: 2_500,
    })
    expect(send).toHaveBeenCalledWith('Element.getWXML', {
      elementId: 'page-root',
      pageId: 8,
      type: 'inner',
    }, {
      timeout: 2_500,
    })
  })

  it('waits for rendered selector query nodes', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'App.callFunction') {
        return {
          result: [
            {
              dataset: {
                status: 'running',
              },
              id: 'status',
            },
            {
              dataset: {
                status: 'success',
              },
              id: 'status',
            },
          ],
        }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.renderedNodes('#status')).resolves.toEqual([
      {
        dataset: {
          status: 'running',
        },
        id: 'status',
      },
      {
        dataset: {
          status: 'success',
        },
        id: 'status',
      },
    ])
    await expect(page.waitForRendered({
      dataset: {
        status: 'success',
      },
      selector: '#status',
    })).resolves.toContain('"selector":"#status"')

    expect(send).toHaveBeenCalledWith('App.callFunction', {
      args: ['pages/a', {}, '#status'],
      functionDeclaration: expect.stringContaining('createSelectorQuery'),
    }, {
      timeout: 5_000,
    })
    expect(send).toHaveBeenCalledWith('App.callFunction', {
      args: ['pages/a', {}, '#status'],
      functionDeclaration: expect.stringContaining('wx.createSelectorQuery'),
    }, {
      timeout: 5_000,
    })
  })

  it('falls back to app-service page data when Page.getData times out', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getData within 12000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getData',
      },
    )
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getData') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return { result: 'ready' }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.data('__e2eResult.status')).resolves.toBe('ready')

    expect(send).toHaveBeenNthCalledWith(1, 'Page.getData', {
      pageId: 8,
      path: '__e2eResult.status',
    }, {
      timeout: 12_000,
    })
    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, '__e2eResult.status'],
    }, {
      timeout: 12_000,
    })
  })

  it('falls back to app-service page method calls when Page.callMethod times out', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.callMethod within 12000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.callMethod',
      },
    )
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.callMethod') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return { result: { ok: true } }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethod('runE2E', 'arg')).resolves.toEqual({ ok: true })

    expect(send).toHaveBeenNthCalledWith(1, 'Page.callMethod', {
      args: ['arg'],
      method: 'runE2E',
      pageId: 8,
    }, {
      timeout: 12_000,
    })
    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, 'runE2E', ['arg']],
    }, {
      timeout: 12_000,
    })
  })

  it('passes page query to app-service page method fallback', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.callMethod within 12000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.callMethod',
      },
    )
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.callMethod') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return { result: { ok: true } }
      }
      return {}
    })
    const page = new Page(createConnection(send), {
      id: 8,
      path: '/pages/a',
      query: {
        x: 'alias',
      },
    })

    await expect(page.callMethod('runE2E')).resolves.toEqual({ ok: true })

    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('matchesQuery'),
      args: ['/pages/a', { x: 'alias' }, 'runE2E', []],
    }, {
      timeout: 12_000,
    })
  })

  it('falls back to app-service setData when Page.setData times out', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.setData within 12000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.setData',
      },
    )
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.setData') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return { result: true }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.setData({ title: 'updated' })).resolves.toBeUndefined()

    expect(send).toHaveBeenNthCalledWith(1, 'Page.setData', {
      data: { title: 'updated' },
      pageId: 8,
    }, {
      timeout: 12_000,
    })
    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, { title: 'updated' }],
    }, {
      timeout: 12_000,
    })
  })

  it('falls back to app-service page method calls when Page.callMethod returns undefined', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.callMethod') {
        return { result: undefined }
      }
      if (method === 'App.callFunction') {
        return { result: { ok: true, source: 'app-service' } }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethod('runE2E')).resolves.toEqual({ ok: true, source: 'app-service' })

    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, 'runE2E', []],
    }, {
      timeout: 12_000,
    })
  })

  it('falls back to app-service page method calls when Page.callMethod uses a stale page stack', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.callMethod') {
        throw new Error('page is not on top of page stack')
      }
      if (method === 'App.callFunction') {
        return { result: { ok: true, source: 'route-page' } }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethod('runE2E', 'arg')).resolves.toEqual({ ok: true, source: 'route-page' })

    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, 'runE2E', ['arg']],
    }, {
      timeout: 12_000,
    })
  })

  it('retries app-service page method calls when the fallback is temporarily unavailable', async () => {
    const pageMethodTimeout = Object.assign(
      new Error('DevTools did not respond to protocol method Page.callMethod within 12000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.callMethod',
      },
    )
    const appFunctionTimeout = Object.assign(
      new Error('DevTools did not respond to protocol method App.callFunction within 12000ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'App.callFunction',
      },
    )
    let appCalls = 0
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.callMethod') {
        throw pageMethodTimeout
      }
      if (method === 'App.callFunction') {
        appCalls += 1
        if (appCalls === 1) {
          throw appFunctionTimeout
        }
        if (appCalls === 2) {
          return { result: undefined }
        }
        return { result: { ok: true, source: 'route-page-retry' } }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethod('runE2E', 'arg')).resolves.toEqual({ ok: true, source: 'route-page-retry' })

    expect(send).toHaveBeenCalledTimes(4)
    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, 'runE2E', ['arg']],
    }, {
      timeout: 12_000,
    })
    expect(send).toHaveBeenNthCalledWith(4, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, 'runE2E', ['arg']],
    }, {
      timeout: 12_000,
    })
  })

  it('uses short protocol timeouts for selector queries', async () => {
    const send = vi.fn(async () => ({
      elementId: 'element-1',
      tagName: 'view',
    }))
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await page.$('.ready')

    expect(send).toHaveBeenCalledWith('Page.getElement', {
      pageId: 8,
      selector: '.ready',
    }, {
      timeout: 2_500,
    })
  })

  it('reuses cached page instances', () => {
    const pageMap = new Map<number, Page>()
    const connection = createConnection(vi.fn())
    const first = Page.create(connection, { id: 1, path: '/a', query: {} }, pageMap)
    const second = Page.create(connection, { id: 1, path: '/b', query: { changed: true } }, pageMap)

    expect(first).toBe(second)
    expect(pageMap.size).toBe(1)
  })
})

describe('Element', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates specialized element subclasses', () => {
    const elementMap = new Map<string, Element>()
    const connection = createConnection(vi.fn())

    expect(Element.create(connection, {
      elementId: 'input-1',
      pageId: 1,
      tagName: 'input',
    }, elementMap)).toBeInstanceOf(InputElement)

    expect(Element.create(connection, {
      elementId: 'custom-1',
      pageId: 1,
      tagName: 'view',
      nodeId: 'node-1',
    }, elementMap)).toBeInstanceOf(CustomElement)

    expect(Element.create(connection, {
      elementId: 'video-1',
      pageId: 1,
      tagName: 'video',
    }, elementMap)).toBeInstanceOf(ContextElement)
  })

  it('caches public properties and throws for missing ones', async () => {
    const send = vi.fn<(method: string, params?: Record<string, any>) => Promise<any>>(async (method: string, params?: Record<string, any>) => {
      const names = params?.names
      if (method === 'Element.getProperties' && names?.[0] === '__propPublic') {
        return { properties: [{ value: true }] }
      }
      if (method === 'Element.getProperties' && names?.[0] === 'value') {
        return { properties: ['expected-value'] }
      }
      return { properties: [] }
    })
    const element = new Element(createConnection(send), {
      elementId: 'input-1',
      pageId: 2,
      tagName: 'input',
    }, new Map())

    await expect(element.property('value')).resolves.toBe('expected-value')
    await expect(element.property('missing')).rejects.toThrow('input.missing not exists')
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('uses special property branches for scroll-view and movable-view', async () => {
    const send = vi.fn<(method: string, params?: Record<string, any>) => Promise<any>>(async (method: string, params?: Record<string, any>) => {
      const functionName = params?.functionName
      const args = params?.args as any[] | undefined
      if (method === 'Element.callFunction') {
        return { result: `${functionName}:${args?.join(',') || ''}` }
      }
      if (method === 'Element.getProperties') {
        return { properties: [11] }
      }
      return { result: null }
    })
    const connection = createConnection(send)
    const scrollView = Element.create(connection, {
      elementId: 'scroll-1',
      pageId: 1,
      tagName: 'scroll-view',
    }, new Map()) as ScrollViewElement
    const movableView = Element.create(connection, {
      elementId: 'movable-1',
      pageId: 1,
      tagName: 'movable-view',
    }, new Map()) as MovableViewElement

    await expect(scrollView.property('scrollTop')).resolves.toBe('scroll-view.scrollTop:')
    await expect(movableView.property('x')).resolves.toBe(11)
  })

  it('uses short protocol timeouts for child queries and wxml reads', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'Element.getElement') {
        return { elementId: 'child-1', tagName: 'view' }
      }
      if (method === 'Element.getWXML') {
        return { wxml: '<view />' }
      }
      return {}
    })
    const element = new Element(createConnection(send), {
      elementId: 'view-1',
      pageId: 3,
      tagName: 'view',
    }, new Map())

    await element.$('.child')
    await expect(element.wxml()).resolves.toBe('<view />')

    expect(send).toHaveBeenNthCalledWith(1, 'Element.getElement', {
      elementId: 'view-1',
      pageId: 3,
      selector: '.child',
    }, {
      timeout: 2_500,
    })
    expect(send).toHaveBeenNthCalledWith(2, 'Element.getWXML', {
      elementId: 'view-1',
      pageId: 3,
      type: 'inner',
    }, {
      timeout: 2_500,
    })
  })

  it('sends longpress through touch lifecycle helpers', async () => {
    const send = vi.fn(async () => ({}))
    const element = new Element(createConnection(send), {
      elementId: 'view-1',
      pageId: 3,
      tagName: 'view',
    }, new Map())

    await element.longpress()

    expect(send).toHaveBeenNthCalledWith(1, 'Element.touchstart', { elementId: 'view-1', pageId: 3 })
    expect(vi.mocked(compat.sleep)).toHaveBeenCalledWith(350)
    expect(send).toHaveBeenNthCalledWith(2, 'Element.touchend', { elementId: 'view-1', pageId: 3 })
  })
})
