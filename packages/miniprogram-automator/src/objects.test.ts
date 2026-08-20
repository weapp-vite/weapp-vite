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

function createAppServicePageConnection(
  send: (method: string, params?: Record<string, any>, options?: Record<string, any>) => any,
) {
  return {
    prefersAppServicePageProtocol: true,
    send,
  } as any
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

  it('uses app-service Page protocol immediately for affected DevTools versions', async () => {
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method !== 'App.callFunction') {
        throw new Error(`${method} should not use the broken page-frame protocol`)
      }
      if (params?.args?.[2] === 'status') {
        return { result: 'ready' }
      }
      if (params?.args?.[2] === 'runE2E') {
        return { result: { ok: true } }
      }
      return { result: [{ id: 'app-service-node' }] }
    })
    const page = new Page(
      createAppServicePageConnection(send),
      { id: 7, path: '/pages/index', query: {} },
    )

    await expect(page.$$('.hello')).resolves.toHaveLength(1)
    await expect(page.data('status')).resolves.toBe('ready')
    await expect(page.callMethod('runE2E')).resolves.toEqual({ ok: true })

    expect(send).toHaveBeenCalledTimes(3)
    expect(send).not.toHaveBeenCalledWith('Page.getElements', expect.anything(), expect.anything())
    expect(send).not.toHaveBeenCalledWith('Page.getData', expect.anything(), expect.anything())
    expect(send).not.toHaveBeenCalledWith('Page.callMethod', expect.anything(), expect.anything())
  })

  it('falls back to app-service rendered nodes when Page.getElements times out', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElements within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElements',
      },
    )
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getElements') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return {
          result: [
            { id: 'root' },
            { id: 'child' },
          ],
        }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })

    const elements = await page.$$('view')

    expect(elements).toHaveLength(2)
    expect(elements[0]?.tagName).toBe('view')
    expect(send).toHaveBeenNthCalledWith(1, 'Page.getElements', {
      pageId: 7,
      selector: 'view',
    }, {
      timeout: 2_500,
    })
    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      args: ['pages/index', {}, 'view', []],
      functionDeclaration: expect.stringContaining('createSelectorQuery'),
    }, {
      timeout: 2_500,
    })
  })

  it('keeps using app-service fallbacks after Page element RPC times out', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElements within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElements',
      },
    )
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getElements') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return { result: [{ id: 'fallback-node' }] }
      }
      throw new Error(`${method} should not be called after route fallback is active`)
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })

    await expect(page.$$('view')).resolves.toHaveLength(1)
    await expect(page.$('.hello')).resolves.not.toBeNull()

    expect(send).not.toHaveBeenCalledWith('Page.getElement', expect.anything(), expect.anything())
    expect(send).toHaveBeenCalledTimes(3)
    expect(send).toHaveBeenNthCalledWith(3, 'App.callFunction', {
      args: ['pages/index', {}, '.hello', []],
      functionDeclaration: expect.stringContaining('createSelectorQuery'),
    }, {
      timeout: 2_500,
    })
  })

  it('retries transient empty app-service selector results across consecutive queries', async () => {
    const snapshots = [
      [{ id: 'first' }],
      [],
      [{ id: 'recovered' }],
    ]
    const send = vi.fn(async (method: string) => {
      if (method !== 'App.callFunction') {
        throw new Error(`${method} should not use the page-frame protocol`)
      }
      return { result: snapshots.shift() ?? [] }
    })
    const page = new Page(
      createAppServicePageConnection(send),
      { id: 7, path: '/pages/index', query: {} },
    )

    await expect(page.$$('.hello')).resolves.toHaveLength(1)
    await expect(page.$('.hello')).resolves.not.toBeNull()

    expect(send).toHaveBeenCalledTimes(3)
    expect(vi.mocked(compat.sleep)).toHaveBeenCalledWith(220)
  })

  it('rejects interaction methods on app-service route fallback elements', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElement within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElement',
      },
    )
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getElement') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return { result: [{ id: 'fallback-node' }] }
      }
      throw new Error(`${method} should not be called for route fallback interaction`)
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })

    const element = await page.$('#action')

    await expect(element?.tap()).rejects.toThrow('App-Service route fallback 元素不支持 Element.tap')
    expect(send).not.toHaveBeenCalledWith('Element.tap', expect.anything())
  })

  it('reads offset/size/style/attributes on route fallback elements via app-service snapshot', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElement within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElement',
      },
    )
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method === 'Page.getElement') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        const declaration = params?.functionDeclaration as string
        // 快照读取(functionDeclaration 带 computedStyle 字段)
        if (declaration.includes('computedStyle')) {
          return {
            result: {
              id: 'hero',
              dataset: { type: 'banner' },
              left: 12,
              top: 34,
              width: 100,
              height: 40,
              display: 'block',
            },
          }
        }
        // renderedNodes 元素查询
        return { result: [{ id: 'hero' }] }
      }
      throw new Error(`${method} should not be called`)
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })
    const element = await page.$('.hero', { componentSelectors: ['weapp-layout-admin'] })

    await expect(element?.offset()).resolves.toEqual({ left: 12, top: 34, width: 100, height: 40 })
    await expect(element?.size()).resolves.toEqual({ width: 100, height: 40 })
    await expect(element?.style('display')).resolves.toBe('block')
    await expect(element?.attribute('id')).resolves.toBe('hero')
    await expect(element?.attribute('data-type')).resolves.toBe('banner')

    const snapshotCalls = vi.mocked(send).mock.calls.filter(
      ([method, params]) => method === 'App.callFunction'
        && (params?.functionDeclaration as string).includes('computedStyle'),
    )
    // offset/size/attribute 不带 styleNames;style 调用携带请求的样式名
    expect(snapshotCalls[0]?.[1]?.args).toEqual([
      '/pages/index',
      {},
      '.hero',
      0,
      ['weapp-layout-admin'],
      [],
    ])
    expect(
      snapshotCalls.some(([, params]) => JSON.stringify(params?.args?.[5]) === JSON.stringify(['display'])),
    ).toBe(true)
  })

  it('re-queries the snapshot on every read so values stay fresh', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElement within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElement',
      },
    )
    const rects = [
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 0, top: 200, width: 10, height: 10 },
    ]
    let snapshotReads = 0
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method === 'Page.getElement') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        const declaration = params?.functionDeclaration as string
        if (declaration.includes('computedStyle')) {
          const result = rects[Math.min(snapshotReads, rects.length - 1)]
          snapshotReads += 1
          return { result }
        }
        return { result: [{ id: 'hero' }] }
      }
      throw new Error(`${method} should not be called`)
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })
    const element = await page.$('.hero')

    await expect(element?.offset()).resolves.toMatchObject({ top: 0 })
    await expect(element?.offset()).resolves.toMatchObject({ top: 200 })
    expect(snapshotReads).toBe(2)
  })

  it('retries transient empty route fallback snapshots', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElement within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElement',
      },
    )
    const snapshots = [null, { left: 12, top: 34, width: 100, height: 40, display: 'block' }]
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method === 'Page.getElement') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        const declaration = params?.functionDeclaration as string
        if (declaration.includes('computedStyle')) {
          return { result: snapshots.shift() ?? null }
        }
        return { result: [{ id: 'hero' }] }
      }
      throw new Error(`${method} should not be called`)
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })
    const element = await page.$('.hero')

    await expect(element?.style('display')).resolves.toBe('block')
    expect(vi.mocked(compat.sleep)).toHaveBeenCalledWith(220)
  })

  it('throws a clear error for text() on route fallback elements', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElement within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElement',
      },
    )
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getElement') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return { result: [{ id: 'hero' }] }
      }
      throw new Error(`${method} should not be called`)
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })
    const element = await page.$('.hero')

    await expect(element?.text()).rejects.toThrow('route fallback 元素不支持 text')
    expect(send).not.toHaveBeenCalledWith('Element.getDOMProperties', expect.anything(), expect.anything())
  })

  it('rejects nested queries on app-service route fallback elements without page-frame RPCs', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElement within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElement',
      },
    )
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getElement') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return { result: [{ id: 'hero' }] }
      }
      throw new Error(`${method} should not be called for route fallback nested queries`)
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })
    const element = await page.$('.hero')

    await expect(element?.$('.label')).rejects.toThrow('route fallback 元素不支持 Element.$')
    await expect(element?.$$('.label')).rejects.toThrow('route fallback 元素不支持 Element.$$')
    expect(send).not.toHaveBeenCalledWith('Element.getElement', expect.anything(), expect.anything())
    expect(send).not.toHaveBeenCalledWith('Element.getElements', expect.anything(), expect.anything())
  })

  it('forces native Page RPC when fallback is disabled after a prior protocol timeout', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElements within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElements',
      },
    )
    let queryAttempts = 0
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getElements') {
        queryAttempts += 1
        if (queryAttempts === 1) {
          throw timeoutError
        }
        return { elements: [{ elementId: 'native-element', tagName: 'view' }] }
      }
      if (method === 'Page.getData') {
        return { data: 'native-data' }
      }
      if (method === 'Page.callMethod') {
        return { result: 'native-method' }
      }
      if (method === 'App.callFunction') {
        return { result: [{ id: 'fallback-node' }] }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })

    await expect(page.$$('view')).resolves.toHaveLength(1)
    await expect(page.$$('view', { fallback: false })).resolves.toHaveLength(1)
    await expect(page.data('status', { fallback: false })).resolves.toBe('native-data')
    await expect(page.callMethodWithOptions('runE2E', { fallback: false })).resolves.toBe('native-method')

    expect(send).toHaveBeenCalledWith('Page.getElements', {
      pageId: 7,
      selector: 'view',
    }, {
      timeout: 2_500,
    })
    expect(send).toHaveBeenCalledWith('Page.getData', {
      pageId: 7,
      path: 'status',
    }, {
      timeout: 2_500,
    })
    expect(send).toHaveBeenCalledWith('Page.callMethod', {
      args: [],
      method: 'runE2E',
      pageId: 7,
    }, {
      timeout: 2_500,
    })
  })

  it('reads data through app-service after Page element RPC times out', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.getElements within 2500ms'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.getElements',
      },
    )
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method === 'Page.getElements') {
        throw timeoutError
      }
      if (method === 'App.callFunction') {
        return params?.args?.[2] === 'probeStatus'
          ? { result: 'ready' }
          : { result: [{ id: 'fallback-node' }] }
      }
      throw new Error(`${method} should not be called after route fallback is active`)
    })
    const page = new Page(createConnection(send), { id: 7, path: '/pages/index', query: {} })

    await expect(page.$$('view')).resolves.toHaveLength(1)
    await expect(page.data('probeStatus')).resolves.toBe('ready')

    expect(send).not.toHaveBeenCalledWith('Page.getData', expect.anything(), expect.anything())
    expect(send).toHaveBeenNthCalledWith(3, 'App.callFunction', {
      args: ['/pages/index', {}, 'probeStatus'],
      functionDeclaration: expect.stringContaining('readPath'),
    }, {
      timeout: 12_000,
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
      timeout: 2_500,
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
      timeout: 8_000,
    })
  })

  it('waits for rendered selector query nodes', async () => {
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method === 'App.callFunction') {
        const nodes = [
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
        ]
        return {
          result: Array.isArray(params?.args?.[2])
            ? { '#status': nodes }
            : nodes,
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
      args: ['pages/a', {}, '#status', []],
      functionDeclaration: expect.stringContaining('createSelectorQuery'),
    }, {
      timeout: 5_000,
    })
    expect(send).toHaveBeenCalledWith('App.callFunction', {
      args: ['pages/a', {}, '#status', []],
      functionDeclaration: expect.stringContaining('componentSelectors.push(selector'),
    }, {
      timeout: 5_000,
    })
    expect(send).toHaveBeenCalledWith('App.callFunction', {
      args: ['pages/a', {}, '#status', []],
      functionDeclaration: expect.stringContaining('wx.createSelectorQuery'),
    }, {
      timeout: 5_000,
    })
    expect(send).toHaveBeenCalledWith('App.callFunction', {
      args: ['pages/a', {}, '#status', []],
      functionDeclaration: expect.stringContaining('setTimeout(function ()'),
    }, {
      timeout: 5_000,
    })
  })

  it('skips the page-frame selector query after switching to the app-service protocol', async () => {
    const pageCallTimeout = Object.assign(
      new Error('DevTools did not respond to protocol method Page.callMethod'),
      {
        code: 'DEVTOOLS_PROTOCOL_TIMEOUT',
        method: 'Page.callMethod',
      },
    )
    const send = vi.fn(async (
      method: string,
      params?: Record<string, any>,
      _options?: { timeout?: number },
    ) => {
      if (method === 'Page.callMethod') {
        throw pageCallTimeout
      }
      if (method === 'Page.getElement') {
        throw new Error('Page.getElement should not be used after the protocol fallback')
      }
      if (method === 'App.callFunction' && params?.functionDeclaration?.includes('createSelectorQuery')) {
        return {
          result: [{ id: 'hello' }],
        }
      }
      if (method === 'App.callFunction') {
        return {
          result: {
            __weappVitePageMethodFound: true,
            status: 'fulfilled',
            value: { ok: true },
          },
        }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/issue-706/index', query: {} })

    await expect(page.callMethod('_runE2E')).resolves.toEqual({ ok: true })
    send.mockClear()

    await expect(page.waitForRendered({
      selector: '.hello',
      timeout: 1_000,
    })).resolves.toContain('"selector":".hello"')

    expect(send).not.toHaveBeenCalledWith('Page.getElement', expect.anything(), expect.anything())
    expect(send).toHaveBeenCalledWith('App.callFunction', expect.objectContaining({
      functionDeclaration: expect.stringContaining('createSelectorQuery'),
      args: ['pages/issue-706/index', {}, '.hello', []],
    }), {
      timeout: expect.any(Number),
    })
    const renderedQueryCall = vi.mocked(send).mock.calls.find(([method, params]) => {
      return method === 'App.callFunction'
        && params?.functionDeclaration?.includes('createSelectorQuery')
    })
    const renderedQueryTimeout = renderedQueryCall?.[2]?.timeout
    expect(renderedQueryTimeout).toBeGreaterThan(0)
    expect(renderedQueryTimeout).toBeLessThanOrEqual(1_000)
    const renderedQuery = vi.mocked(send).mock.calls[0]?.[1]?.functionDeclaration as string
    expect(renderedQuery).toContain('if (nodes.length > 0)')
    expect(renderedQuery).toContain('resolve(collected)')
  })

  it('falls back to the page protocol when the app-service selector query is empty', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'App.callFunction') {
        return { result: [] }
      }
      if (method === 'Page.getElement') {
        return { elementId: 'page-root', tagName: 'view' }
      }
      if (method === 'Element.getAttributes') {
        return { attributes: ['home'] }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/home/index', query: {} })

    await expect(page.waitForRendered({
      dataset: {
        e2eRoute: 'home',
      },
      selector: '#auto-routes-home',
    })).resolves.toContain('"e2eRoute":"home"')

    expect(send).toHaveBeenCalledWith('Page.getElement', {
      pageId: 8,
      selector: '#auto-routes-home',
    }, {
      timeout: 800,
    })
    expect(send).toHaveBeenCalledWith('Element.getAttributes', {
      elementId: 'page-root',
      names: ['data-e2e-route'],
      pageId: 8,
    })
  })

  it('queries inside the page root when the page protocol cannot find a nested rendered node directly', async () => {
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method === 'App.callFunction') {
        return { result: [] }
      }
      if (method === 'Page.getElement') {
        if (params?.selector === '#nested-probe') {
          throw new Error('element not found')
        }
        if (params?.selector === 'page') {
          return { elementId: 'page-root', tagName: 'page' }
        }
        throw new Error('page root not found')
      }
      if (method === 'Element.getElement') {
        return { elementId: 'nested-probe', tagName: 'view' }
      }
      if (method === 'Element.getAttributes') {
        return { attributes: ['nested'] }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/nested/index', query: {} })

    await expect(page.waitForRendered({
      dataset: {
        e2eRoute: 'nested',
      },
      selector: '#nested-probe',
    })).resolves.toContain('"e2eRoute":"nested"')

    expect(send).toHaveBeenCalledWith('Element.getElement', {
      elementId: 'page-root',
      pageId: 8,
      selector: '#nested-probe',
    }, {
      timeout: expect.any(Number),
    })
    expect(send).toHaveBeenCalledWith('Element.getAttributes', {
      elementId: 'nested-probe',
      names: ['data-e2e-route'],
      pageId: 8,
    })
  })

  it('prefers the page protocol through app shell and layout component boundaries', async () => {
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method === 'App.callFunction') {
        throw new Error('app-service selector query timed out')
      }
      if (method === 'Page.getElement') {
        if (params?.selector === '#issue338-page') {
          throw new Error('element not found')
        }
        if (params?.selector === 'page') {
          return { elementId: 'page-root', tagName: 'page' }
        }
        throw new Error('page root not found')
      }
      if (method === 'Element.getElement') {
        if (params?.elementId === 'page-root' && params.selector === 'weapp-app-shell') {
          return { elementId: 'app-shell', nodeId: 'shell-node', tagName: 'weapp-app-shell' }
        }
        if (params?.elementId === 'app-shell' && params.selector === 'weapp-layout-default') {
          return { elementId: 'default-layout', nodeId: 'layout-node', tagName: 'weapp-layout-default' }
        }
        if (params?.elementId === 'default-layout' && params.selector === '#issue338-page') {
          return { elementId: 'issue338-page', tagName: 'view' }
        }
        throw new Error('element not found in component scope')
      }
      if (method === 'Element.getAttributes') {
        return { attributes: ['338'] }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/issue-338/index', query: {} })

    await expect(page.waitForRendered({
      dataset: {
        e2eIssue: '338',
      },
      selector: '#issue338-page',
    })).resolves.toContain('"e2eIssue":"338"')

    expect(send).toHaveBeenCalledWith('Element.getElement', {
      elementId: 'page-root',
      pageId: 8,
      selector: 'weapp-app-shell',
    }, {
      timeout: expect.any(Number),
    })
    expect(send).toHaveBeenCalledWith('Element.getElement', {
      elementId: 'app-shell',
      nodeId: 'shell-node',
      pageId: 8,
      selector: 'weapp-layout-default',
    }, {
      timeout: expect.any(Number),
    })
    expect(send).toHaveBeenCalledWith('Element.getElement', {
      elementId: 'default-layout',
      nodeId: 'layout-node',
      pageId: 8,
      selector: '#issue338-page',
    }, {
      timeout: expect.any(Number),
    })
  })

  it('queries multiple rendered selectors in one app-service call', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'App.callFunction') {
        return {
          result: {
            '#status': [
              {
                dataset: {
                  status: 'success',
                },
                height: 12,
                id: 'status',
                width: 80,
              },
            ],
            '.title': [
              {
                height: 10,
                width: 60,
              },
            ],
          },
        }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.renderedSelectorNodes(['#status', '.title'])).resolves.toEqual({
      '#status': [
        {
          dataset: {
            status: 'success',
          },
          height: 12,
          id: 'status',
          width: 80,
        },
      ],
      '.title': [
        {
          height: 10,
          width: 60,
        },
      ],
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('App.callFunction', {
      args: ['pages/a', {}, ['#status', '.title'], []],
      functionDeclaration: expect.stringContaining('maxQueries = 40'),
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
      timeout: 2_500,
    })
    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, '__e2eResult.status'],
    }, {
      timeout: 12_000,
    })
  })

  it('falls back to app-service page data when DevTools page meta is missing', async () => {
    const pageMetaError = new Error('Cannot destructure property \'rawPath\' of \'t.getPageMetaByWebviewId(...)\' as it is null.')
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getData') {
        throw pageMetaError
      }
      if (method === 'App.callFunction') {
        return { result: 'ready' }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.data('__e2eResult.status')).resolves.toBe('ready')

    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, '__e2eResult.status'],
    }, {
      timeout: 12_000,
    })
  })

  it('falls back to app-service page data when DevTools current frame times out', async () => {
    const currentFrameError = new Error('[loader] unexpected current frame status timedout')
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getData') {
        throw currentFrameError
      }
      if (method === 'App.callFunction') {
        return { result: 'ready' }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.data('__e2eResult.status')).resolves.toBe('ready')

    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, '__e2eResult.status'],
    }, {
      timeout: 12_000,
    })
  })

  it('can read page data through route fallback only', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.getData') {
        throw new Error('Page.getData should not be used')
      }
      if (method === 'App.callFunction') {
        return { result: 'ready' }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.data('__e2eResult.status', {
      routeOnly: true,
      timeout: 3_000,
    })).resolves.toBe('ready')

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('App.callFunction', {
      functionDeclaration: expect.stringContaining('readPath'),
      args: ['/pages/a', {}, '__e2eResult.status'],
    }, {
      timeout: 3_000,
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
      timeout: 2_500,
    })
    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, 'runE2E', ['arg'], expect.any(String), 17_000],
    }, {
      timeout: 12_000,
    })
  })

  it('falls back to app-service page method calls when DevTools current frame times out', async () => {
    const currentFrameError = new Error('[loader] unexpected current frame status timedout')
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.callMethod') {
        throw currentFrameError
      }
      if (method === 'App.callFunction') {
        return { result: { ok: true } }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethod('runE2E', 'arg')).resolves.toEqual({ ok: true })

    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, 'runE2E', ['arg'], expect.any(String), 17_000],
    }, {
      timeout: 12_000,
    })
  })

  it('can disable app-service page method fallback when Page.callMethod times out', async () => {
    const timeoutError = Object.assign(
      new Error('DevTools did not respond to protocol method Page.callMethod within 2500ms'),
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

    await expect(page.callMethodWithOptions('runE2E', {
      fallback: false,
      timeout: 1_000,
    })).rejects.toThrow('Page.callMethod')

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('Page.callMethod', {
      args: [],
      method: 'runE2E',
      pageId: 8,
    }, {
      timeout: 1_000,
    })
  })

  it('can call page method through route fallback only', async () => {
    const send = vi.fn(async (method: string, _params?: Record<string, any>) => {
      if (method === 'Page.callMethod') {
        throw new Error('Page.callMethod should not be used')
      }
      if (method === 'App.callFunction') {
        return { result: { ok: true, source: 'route-only' } }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethodWithOptions('runE2E', {
      routeOnly: true,
      timeout: 3_000,
    }, 'arg')).resolves.toEqual({ ok: true, source: 'route-only' })

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, 'runE2E', ['arg'], expect.any(String), 8_000],
    }, {
      timeout: 3_000,
    })
  })

  it('polls an asynchronous app-service page method without invoking it again', async () => {
    const callIds: string[] = []
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method !== 'App.callFunction') {
        throw new Error(`${method} should not be used`)
      }
      callIds.push(params?.args?.[4])
      return callIds.length === 1
        ? {
            result: {
              __weappVitePageMethodFound: true,
              status: 'pending',
            },
          }
        : {
            result: {
              __weappVitePageMethodFound: true,
              status: 'fulfilled',
              value: { ok: true },
            },
          }
    })
    const page = new Page(createAppServicePageConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethod('collectSnapshot')).resolves.toEqual({ ok: true })

    expect(send).toHaveBeenCalledTimes(2)
    expect(callIds[0]).toBeTruthy()
    expect(callIds[1]).toBe(callIds[0])
    expect(vi.mocked(compat.sleep)).toHaveBeenCalledWith(300)
    const functionDeclaration = vi.mocked(send).mock.calls[0]?.[1]?.functionDeclaration as string
    expect(functionDeclaration).toContain(`typeof getApp === 'function'`)
    expect(functionDeclaration.indexOf('if (store && store[callId])')).toBeLessThan(
      functionDeclaration.indexOf('var targetPage = resolvePage()'),
    )
  })

  it('propagates an asynchronous app-service page method rejection', async () => {
    const send = vi.fn(async () => ({
      result: {
        __weappVitePageMethodFound: true,
        error: 'selector query failed',
        status: 'rejected',
      },
    }))
    const page = new Page(createAppServicePageConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethod('collectSnapshot')).rejects.toThrow(
      'Page method collectSnapshot failed: selector query failed',
    )

    expect(send).toHaveBeenCalledTimes(1)
  })

  it('times out when an asynchronous app-service page method stays pending', async () => {
    const send = vi.fn(async () => ({
      result: {
        __weappVitePageMethodFound: true,
        status: 'pending',
      },
    }))
    const page = new Page(createAppServicePageConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethodWithOptions('collectSnapshot', {
      timeout: 600,
    })).rejects.toThrow('Timed out waiting for page method collectSnapshot after 600ms')

    expect(send).toHaveBeenCalledTimes(2)
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
      args: ['/pages/a', { x: 'alias' }, 'runE2E', [], expect.any(String), 17_000],
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
      timeout: 2_500,
    })
    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, { title: 'updated' }],
    }, {
      timeout: 12_000,
    })
  })

  it('does not fall back when Page.callMethod returns undefined after side effects', async () => {
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

    await expect(page.callMethod('runE2E')).resolves.toBeUndefined()

    expect(send).toHaveBeenCalledTimes(1)
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
      args: ['/pages/a', {}, 'runE2E', ['arg'], expect.any(String), 17_000],
    }, {
      timeout: 12_000,
    })
  })

  it('falls back to the current app-service page method when route metadata is stale', async () => {
    let appFunctionDeclaration = ''
    const send = vi.fn(async (method: string, params?: Record<string, any>) => {
      if (method === 'Page.callMethod') {
        throw new Error('page is not on top of page stack')
      }
      if (method === 'App.callFunction') {
        appFunctionDeclaration = String(params?.functionDeclaration ?? '')
        return { result: { ok: true, source: 'current-page' } }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/stale/index', query: {} })

    await expect(page.callMethod('runE2E')).resolves.toEqual({ ok: true, source: 'current-page' })

    expect(appFunctionDeclaration).toContain('fallbackPage')
    expect(send).toHaveBeenNthCalledWith(2, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('fallbackPage'),
      args: ['/pages/stale/index', {}, 'runE2E', [], expect.any(String), 17_000],
    }, {
      timeout: 12_000,
    })
  })

  it('does not retry app-service page methods that return undefined after side effects', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'Page.callMethod') {
        return { result: undefined }
      }
      if (method === 'App.callFunction') {
        return {
          result: {
            __weappVitePageMethodFound: true,
            value: undefined,
          },
        }
      }
      return {}
    })
    const page = new Page(createConnection(send), { id: 8, path: '/pages/a', query: {} })

    await expect(page.callMethod('onTap')).resolves.toBeUndefined()

    expect(send).toHaveBeenCalledTimes(1)
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
      args: ['/pages/a', {}, 'runE2E', ['arg'], expect.any(String), 17_000],
    }, {
      timeout: 12_000,
    })
    expect(send).toHaveBeenNthCalledWith(4, 'App.callFunction', {
      functionDeclaration: expect.stringContaining('getCurrentPages'),
      args: ['/pages/a', {}, 'runE2E', ['arg'], expect.any(String), 17_000],
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

  it('fills missing offset dimensions from DOM properties', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'Element.getOffset') {
        return { left: 12, top: 20 }
      }
      if (method === 'Element.getDOMProperties') {
        return { properties: [366, 22.5] }
      }
      throw new Error(`Unexpected method: ${method}`)
    })
    const element = new Element(createConnection(send), {
      elementId: 'hello',
      pageId: 1,
      tagName: 'view',
    }, new Map())

    await expect(element.offset()).resolves.toEqual({ left: 12, top: 20, width: 366, height: 22.5 })
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

  it('keeps child queries short while allowing complex WXML reads more time', async () => {
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
      timeout: 8_000,
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
