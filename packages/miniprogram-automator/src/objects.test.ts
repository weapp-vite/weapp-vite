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
      args: ['/pages/a', {}, 'runE2E', ['arg']],
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
      args: ['/pages/a', {}, 'runE2E', ['arg']],
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
    const send = vi.fn(async (method: string) => {
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
      args: ['/pages/a', {}, 'runE2E', ['arg']],
    }, {
      timeout: 3_000,
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
      args: ['/pages/a', {}, 'runE2E', ['arg']],
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
      args: ['/pages/stale/index', {}, 'runE2E', []],
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
