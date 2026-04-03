import { beforeEach, describe, expect, it, vi } from 'vitest'

const wpiRequestMock = vi.hoisted(() => vi.fn())

vi.mock('@wevu/api', () => ({
  wpi: {
    request: wpiRequestMock,
  },
}))

function setGlobalValue(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

describe('request globals runtime', () => {
  beforeEach(() => {
    wpiRequestMock.mockReset()
    delete (globalThis as Record<string, any>).fetch
    delete (globalThis as Record<string, any>).Headers
    delete (globalThis as Record<string, any>).Request
    delete (globalThis as Record<string, any>).Response
    delete (globalThis as Record<string, any>).AbortController
    delete (globalThis as Record<string, any>).AbortSignal
    delete (globalThis as Record<string, any>).XMLHttpRequest
    delete (globalThis as Record<string, any>).Blob
    delete (globalThis as Record<string, any>).FormData
    delete (globalThis as Record<string, any>).wx
  })

  it('installs missing globals without overwriting existing ones', async () => {
    const existingFetch = vi.fn()
    ;(globalThis as Record<string, any>).fetch = existingFetch

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals()

    expect(globalThis.fetch).toBe(existingFetch)
    expect(typeof globalThis.XMLHttpRequest).toBe('function')
    expect(typeof globalThis.AbortController).toBe('function')
    expect(typeof globalThis.Headers).toBe('function')
  })

  it('supports fetch through @wevu/api request bridge without requiring wevu/fetch', async () => {
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      options.success?.({
        data: '{"ok":true}',
        statusCode: 200,
        header: {
          'content-type': 'application/json',
        },
      })
      return {
        abort: vi.fn(),
      }
    })

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals()

    const response = await globalThis.fetch('https://example.com/data', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    })

    expect(wpiRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/data',
      method: 'POST',
      responseType: 'arraybuffer',
    }))
    expect(await response.json()).toEqual({ ok: true })
  })

  it('supports axios-style xhr requests through the injected fetch bridge', async () => {
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      options.success?.({
        data: '{"ok":true}',
        statusCode: 200,
        header: {
          'content-type': 'application/json',
        },
      })
      return {
        abort: vi.fn(),
      }
    })

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals()

    const xhr = new globalThis.XMLHttpRequest()
    xhr.open('GET', 'https://example.com/data')
    xhr.responseType = 'json'
    await xhr.send()

    expect(wpiRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/data',
      method: 'GET',
    }))
    expect(xhr.status).toBe(200)
    expect(xhr.response).toEqual({ ok: true })
    expect(xhr.readyState).toBe(xhr.DONE)
    expect(xhr.getResponseHeader('content-type')).toBe('application/json')
  })

  it('supports installing only abort globals', async () => {
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['AbortController', 'AbortSignal'],
    })

    expect(typeof globalThis.AbortController).toBe('function')
    expect(typeof globalThis.AbortSignal).toBe('function')
    expect(globalThis.fetch).toBeUndefined()
    expect(globalThis.XMLHttpRequest).toBeUndefined()
  })

  it('installs request globals onto both runtime global and mini-program host objects', async () => {
    ;(globalThis as Record<string, any>).wx = {}

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['fetch'],
    })

    expect(typeof globalThis.fetch).toBe('function')
    expect(typeof (globalThis as any).wx.fetch).toBe('function')
    expect(typeof (globalThis as any).wx.URL).toBe('function')
    expect(typeof (globalThis as any).wx.URLSearchParams).toBe('function')
    expect(typeof globalThis.Blob).toBe('function')
    expect(typeof globalThis.FormData).toBe('function')
  })

  it('promotes installed request globals to free global bindings when possible', async () => {
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['fetch', 'AbortController', 'AbortSignal'],
    })

    // eslint-disable-next-line no-new-func, unicorn/new-for-builtins
    expect(Function('return typeof fetch')()).toBe('function')
    // eslint-disable-next-line no-new-func, unicorn/new-for-builtins
    expect(Function('return typeof AbortController')()).toBe('function')
    // eslint-disable-next-line no-new-func, unicorn/new-for-builtins
    expect(Function('return typeof AbortSignal')()).toBe('function')
  })

  it('replaces broken URL constructors exposed by the runtime host', async () => {
    const originalUrl = globalThis.URL
    const originalUrlSearchParams = globalThis.URLSearchParams

    try {
      setGlobalValue('URL', () => undefined)
      setGlobalValue('URLSearchParams', () => undefined)

      const { installRequestGlobals } = await import('../src')
      installRequestGlobals({
        targets: ['fetch'],
      })

      expect(() => new globalThis.URL('https://request-globals.test/graphql')).not.toThrow()
      expect(new globalThis.URLSearchParams({ client: 'graphql-request' }).toString()).toBe('client=graphql-request')
    }
    finally {
      setGlobalValue('URL', originalUrl)
      setGlobalValue('URLSearchParams', originalUrlSearchParams)
    }
  })

  it('provides URL and URLSearchParams support required by graphql-request style callers', async () => {
    const { URLPolyfill, URLSearchParamsPolyfill } = await import('../src/url')
    const url = new URLPolyfill('https://example.com/graphql?existing=1')
    url.searchParams.append('query', 'hello world')

    expect(url.toString()).toBe('https://example.com/graphql?existing=1&query=hello+world')

    const searchParams = new URLSearchParamsPolyfill()
    searchParams.append('variables', '{"ok":true}')
    expect(searchParams.toString()).toBe('variables=%7B%22ok%22%3Atrue%7D')
  })
})
