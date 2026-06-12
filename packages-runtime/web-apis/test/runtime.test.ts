import { REQUEST_GLOBAL_ACTUALS_KEY, REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const wpiRequestMock = vi.hoisted(() => vi.fn())
const wpiConnectSocketMock = vi.hoisted(() => vi.fn())

vi.mock('@wevu/api', () => ({
  wpi: {
    getAdapter: () => ({
      connectSocket: wpiConnectSocketMock,
    }),
    request: wpiRequestMock,
    resolveTarget: () => ({
      supported: true,
      target: 'connectSocket',
    }),
  },
}))

function setGlobalValue(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

function createMockSocketTask() {
  let openListener: (() => void) | undefined
  let messageListener: ((result: { data: string | ArrayBuffer }) => void) | undefined
  let errorListener: ((result: { errMsg?: string }) => void) | undefined
  let closeListener: ((result: { code: number, reason: string }) => void) | undefined
  const sendMock = vi.fn()
  const closeMock = vi.fn()

  return {
    closeMock,
    emitClose(result: { code: number, reason: string }) {
      closeListener?.(result)
    },
    emitError(result: { errMsg?: string }) {
      errorListener?.(result)
    },
    emitMessage(result: { data: string | ArrayBuffer }) {
      messageListener?.(result)
    },
    emitOpen() {
      openListener?.()
    },
    task: {
      close: closeMock,
      onClose: (listener: (result: { code: number, reason: string }) => void) => {
        closeListener = listener
      },
      onError: (listener: (result: { errMsg?: string }) => void) => {
        errorListener = listener
      },
      onMessage: (listener: (result: { data: string | ArrayBuffer }) => void) => {
        messageListener = listener
      },
      onOpen: (listener: () => void) => {
        openListener = listener
      },
      send: sendMock,
    },
    sendMock,
  }
}

describe('request globals runtime', () => {
  beforeEach(async () => {
    wpiRequestMock.mockReset()
    delete (globalThis as Record<string, any>).fetch
    delete (globalThis as Record<string, any>).Headers
    delete (globalThis as Record<string, any>).Request
    delete (globalThis as Record<string, any>).Response
    delete (globalThis as Record<string, any>).TextEncoder
    delete (globalThis as Record<string, any>).TextDecoder
    delete (globalThis as Record<string, any>).AbortController
    delete (globalThis as Record<string, any>).AbortSignal
    delete (globalThis as Record<string, any>).XMLHttpRequest
    delete (globalThis as Record<string, any>).WebSocket
    delete (globalThis as Record<string, any>).Blob
    delete (globalThis as Record<string, any>).File
    delete (globalThis as Record<string, any>).FormData
    delete (globalThis as Record<string, any>).atob
    delete (globalThis as Record<string, any>).btoa
    delete (globalThis as Record<string, any>).queueMicrotask
    delete (globalThis as Record<string, any>).performance
    delete (globalThis as Record<string, any>).crypto
    delete (globalThis as Record<string, any>).Event
    delete (globalThis as Record<string, any>).CustomEvent
    delete (globalThis as Record<string, any>).wx
    delete (globalThis as Record<string, any>).my
    delete (globalThis as Record<string, any>).tt
    delete (globalThis as Record<string, any>).swan
    delete (globalThis as Record<string, any>).global
    delete (globalThis as Record<string, any>).self
    delete (globalThis as Record<string, any>).window
    delete (globalThis as Record<string, any>)[REQUEST_GLOBAL_ACTUALS_KEY]
    wpiConnectSocketMock.mockReset()
    const { resetMiniProgramNetworkDefaults } = await import('../src')
    resetMiniProgramNetworkDefaults()
  })

  it('installs missing globals without overwriting existing ones', async () => {
    const existingFetch = vi.fn()
    ;(globalThis as Record<string, any>).fetch = existingFetch

    const { installWebRuntimeGlobals } = await import('../src')
    installWebRuntimeGlobals()

    expect(globalThis.fetch).toBe(existingFetch)
    expect(typeof globalThis.XMLHttpRequest).toBe('function')
    expect(typeof globalThis.AbortController).toBe('function')
    expect(typeof globalThis.Headers).toBe('function')
    expect(typeof globalThis.WebSocket).toBe('function')
    expect(typeof globalThis.TextEncoder).toBe('function')
    expect(typeof globalThis.TextDecoder).toBe('function')
    expect(typeof globalThis.atob).toBe('function')
    expect(typeof globalThis.btoa).toBe('function')
    expect(typeof globalThis.queueMicrotask).toBe('function')
    expect(typeof globalThis.performance.now).toBe('function')
    expect(typeof globalThis.crypto.getRandomValues).toBe('function')
    expect(typeof globalThis.Event).toBe('function')
    expect(typeof globalThis.CustomEvent).toBe('function')
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

    const response = await globalThis.fetch('https://request-globals.invalid/data', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    })

    expect(wpiRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://request-globals.invalid/data',
      method: 'POST',
      responseType: 'arraybuffer',
    }))
    expect(await response.json()).toEqual({ ok: true })
  })

  it('forwards whitelisted mini-program request options through fetch init extensions', async () => {
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

    const response = await globalThis.fetch('https://request-globals.invalid/data', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
      miniProgram: {
        enableHttp2: true,
        timeout: 4_321,
      },
      miniprogram: {
        enableChunked: true,
      },
    })

    expect(wpiRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://request-globals.invalid/data',
      method: 'POST',
      responseType: 'arraybuffer',
      enableHttp2: true,
      enableChunked: true,
      timeout: 4_321,
    }))
    expect(await response.json()).toEqual({ ok: true })
  })

  it('applies runtime mini-program request defaults to fetch and xhr callers', async () => {
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

    const {
      installRequestGlobals,
      setMiniProgramNetworkDefaults,
    } = await import('../src')
    installRequestGlobals()
    setMiniProgramNetworkDefaults({
      request: {
        enableHttp2: true,
        timeout: 4_321,
      },
    })

    await globalThis.fetch('https://request-globals.invalid/default-fetch')

    const xhr = new globalThis.XMLHttpRequest()
    xhr.open('GET', 'https://request-globals.invalid/default-xhr')
    await xhr.send()

    expect(wpiRequestMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      enableHttp2: true,
      timeout: 4_321,
      url: 'https://request-globals.invalid/default-fetch',
    }))
    expect(wpiRequestMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      enableHttp2: true,
      timeout: 4_321,
      url: 'https://request-globals.invalid/default-xhr',
    }))
  })

  it('accepts mini-program network defaults directly in installWebRuntimeGlobals options', async () => {
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
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)

    const {
      getMiniProgramNetworkDefaults,
      installWebRuntimeGlobals,
    } = await import('../src')

    installWebRuntimeGlobals({
      targets: ['fetch', 'XMLHttpRequest', 'WebSocket'],
      networkDefaults: {
        request: {
          enableHttp2: true,
          timeout: 4_321,
        },
        socket: {
          timeout: 6_789,
          forceCellularNetwork: true,
        },
      },
    })

    await globalThis.fetch('https://request-globals.invalid/default-fetch')

    const xhr = new globalThis.XMLHttpRequest()
    xhr.open('GET', 'https://request-globals.invalid/default-xhr')
    await xhr.send()

    const socket = new globalThis.WebSocket('wss://request-globals.invalid/socket-default')

    expect(socket).toBeTruthy()
    expect(getMiniProgramNetworkDefaults()).toEqual({
      request: {
        enableHttp2: true,
        timeout: 4_321,
      },
      socket: {
        timeout: 6_789,
        forceCellularNetwork: true,
      },
    })
    expect(wpiRequestMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      enableHttp2: true,
      timeout: 4_321,
      url: 'https://request-globals.invalid/default-fetch',
    }))
    expect(wpiRequestMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      enableHttp2: true,
      timeout: 4_321,
      url: 'https://request-globals.invalid/default-xhr',
    }))
    expect(wpiConnectSocketMock).toHaveBeenCalledWith(expect.objectContaining({
      forceCellularNetwork: true,
      timeout: 6_789,
      url: 'wss://request-globals.invalid/socket-default',
    }))
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
    xhr.open('GET', 'https://request-globals.invalid/data')
    xhr.responseType = 'json'
    await xhr.send()

    expect(wpiRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://request-globals.invalid/data',
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
    expect(typeof (globalThis as any).wx.TextEncoder).toBe('function')
    expect(typeof (globalThis as any).wx.TextDecoder).toBe('function')
    expect(typeof globalThis.Blob).toBe('function')
    expect(typeof globalThis.File).toBe('function')
    expect(typeof globalThis.FormData).toBe('function')
  })

  it('installs File and preserves FormData filenames for blob values', async () => {
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['fetch'],
    })

    const file = new globalThis.File(['hello'], 'hello.txt', {
      lastModified: 123,
      type: 'text/plain',
    })
    expect(file).toBeInstanceOf(globalThis.Blob)
    expect(file.name).toBe('hello.txt')
    expect(file.lastModified).toBe(123)
    expect(file.size).toBe(5)
    expect(await file.text()).toBe('hello')

    const formData = new globalThis.FormData()
    formData.append('from-file', file)
    formData.append('from-blob', new globalThis.Blob(['blob text'], { type: 'text/plain' }), 'blob.txt')
    formData.set('from-file', file, 'renamed.txt')

    const renamed = formData.get('from-file') as File
    const blobFile = formData.get('from-blob') as File
    expect(renamed).toBeInstanceOf(globalThis.File)
    expect(renamed.name).toBe('renamed.txt')
    expect(renamed.type).toBe('text/plain')
    expect(renamed.lastModified).toBe(123)
    expect(await renamed.text()).toBe('hello')
    expect(blobFile).toBeInstanceOf(globalThis.File)
    expect(blobFile.name).toBe('blob.txt')
    expect(blobFile.type).toBe('text/plain')
    expect(await blobFile.text()).toBe('blob text')
  })

  it('installs request globals onto additional mini-program host globals discovered from shared platform registry', async () => {
    ;(globalThis as Record<string, any>).swan = {}

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['fetch', 'crypto'],
    })

    expect(typeof globalThis.fetch).toBe('function')
    expect(typeof (globalThis as any).swan.fetch).toBe('function')
    expect(typeof (globalThis as any).swan.URL).toBe('function')
    expect(typeof (globalThis as any).swan.URLSearchParams).toBe('function')
    expect(typeof (globalThis as any).swan.TextEncoder).toBe('function')
    expect(typeof (globalThis as any).swan.TextDecoder).toBe('function')
    expect(typeof (globalThis as any).swan.crypto?.getRandomValues).toBe('function')
  })

  it('installs text codec globals required by request runtime and preserves unicode roundtrip', async () => {
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['fetch'],
    })

    expect(typeof globalThis.TextEncoder).toBe('function')
    expect(typeof globalThis.TextDecoder).toBe('function')

    const bytes = new globalThis.TextEncoder().encode('你好, weapp-vite')
    expect(new globalThis.TextDecoder().decode(bytes)).toBe('你好, weapp-vite')
  })

  it('installs request globals onto global alias hosts used by websocket libraries', async () => {
    ;(globalThis as Record<string, any>).global = {}
    ;(globalThis as Record<string, any>).self = {}
    ;(globalThis as Record<string, any>).window = {}

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['WebSocket'],
    })

    expect(typeof globalThis.WebSocket).toBe('function')
    expect(typeof globalThis.URL).toBe('function')
    expect(typeof (globalThis as any).global.WebSocket).toBe('function')
    expect(typeof (globalThis as any).global.URL).toBe('function')
    expect((globalThis as any).self).toBe(globalThis)
    expect((globalThis as any).window).toBe(globalThis)
  })

  it('ignores null alias hosts when installing request globals', async () => {
    ;(globalThis as Record<string, any>).global = null
    ;(globalThis as Record<string, any>).self = null
    ;(globalThis as Record<string, any>).window = null

    const { installRequestGlobals } = await import('../src')

    expect(() => installRequestGlobals({
      targets: ['fetch', 'XMLHttpRequest', 'WebSocket'],
    })).not.toThrow()
    expect(typeof globalThis.fetch).toBe('function')
    expect(typeof globalThis.XMLHttpRequest).toBe('function')
    expect(typeof globalThis.WebSocket).toBe('function')
  })

  it('ignores host objects that reject injected request globals', async () => {
    const throwingHost = Object.create(null)

    for (const key of ['fetch', 'URL', 'URLSearchParams', 'Blob', 'File', 'FormData'] as const) {
      Object.defineProperty(throwingHost, key, {
        configurable: true,
        enumerable: true,
        get: () => undefined,
        set: () => {
          throw new TypeError(`Cannot set property '${key}' of host`)
        },
      })
    }

    ;(globalThis as Record<string, any>).wx = throwingHost

    const { installRequestGlobals } = await import('../src')

    expect(() => installRequestGlobals({
      targets: ['fetch'],
    })).not.toThrow()
    expect(typeof globalThis.fetch).toBe('function')
    expect(typeof globalThis.URL).toBe('function')
    expect(typeof globalThis.URLSearchParams).toBe('function')
  })

  it('replaces lazy placeholder globals with real runtime implementations', async () => {
    const placeholderFetch = vi.fn()
    ;(placeholderFetch as any)[REQUEST_GLOBAL_PLACEHOLDER_KEY] = true
    const placeholderWebSocket = vi.fn()
    ;(placeholderWebSocket as any)[REQUEST_GLOBAL_PLACEHOLDER_KEY] = true

    setGlobalValue('fetch', placeholderFetch)
    setGlobalValue('WebSocket', placeholderWebSocket)

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['fetch', 'WebSocket'],
    })

    expect(globalThis.fetch).not.toBe(placeholderFetch)
    expect(globalThis.WebSocket).not.toBe(placeholderWebSocket)
    expect(typeof globalThis.fetch).toBe('function')
    expect(typeof globalThis.WebSocket).toBe('function')
  })

  it('syncs installed request globals to the runtime host and actuals registry', async () => {
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['fetch', 'AbortController', 'AbortSignal'],
    })

    expect(typeof globalThis.fetch).toBe('function')
    expect(typeof globalThis.AbortController).toBe('function')
    expect(typeof globalThis.AbortSignal).toBe('function')
    expect(typeof (globalThis as any)[REQUEST_GLOBAL_ACTUALS_KEY].fetch).toBe('function')
    expect(typeof (globalThis as any)[REQUEST_GLOBAL_ACTUALS_KEY].AbortController).toBe('function')
    expect(typeof (globalThis as any)[REQUEST_GLOBAL_ACTUALS_KEY].AbortSignal).toBe('function')
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

      expect(() => new globalThis.URL('https://request-globals.invalid/graphql')).not.toThrow()
      expect(new globalThis.URLSearchParams({ client: 'graphql-request' }).toString()).toBe('client=graphql-request')
    }
    finally {
      setGlobalValue('URL', originalUrl)
      setGlobalValue('URLSearchParams', originalUrlSearchParams)
    }
  })

  it('provides URL and URLSearchParams support required by graphql-request style callers', async () => {
    const { URLPolyfill, URLSearchParamsPolyfill } = await import('../src/url')
    const url = new URLPolyfill('https://request-globals.invalid/graphql?existing=1')
    url.searchParams.append('query', 'hello world')

    expect(url.toString()).toBe('https://request-globals.invalid/graphql?existing=1&query=hello+world')

    const searchParams = new URLSearchParamsPolyfill()
    searchParams.append('variables', '{"ok":true}')
    expect(searchParams.toString()).toBe('variables=%7B%22ok%22%3Atrue%7D')
  })

  it('provides low-cost URL and URLSearchParams modern helpers', async () => {
    const { URLPolyfill, URLSearchParamsPolyfill } = await import('../src/url')

    const parsed = URLPolyfill.parse('/graphql?b=2&a=1', 'https://request-globals.invalid/base/')
    const params = new URLSearchParamsPolyfill('b=2&a=1&a=0')
    params.sort()

    expect(parsed?.href).toBe('https://request-globals.invalid/graphql?b=2&a=1')
    expect(URLPolyfill.parse('/graphql')).toBeNull()
    expect(URLPolyfill.canParse('/graphql', 'https://request-globals.invalid')).toBe(true)
    expect(URLPolyfill.canParse('/graphql')).toBe(false)
    expect(params.size).toBe(3)
    expect(params.toString()).toBe('a=1&a=0&b=2')
  })

  it('provides Headers.getSetCookie and static Response helpers', async () => {
    const { HeadersPolyfill, ResponsePolyfill } = await import('../src')

    const headers = new HeadersPolyfill()
    headers.append('Set-Cookie', 'session=issue-448')
    headers.append('Set-Cookie', 'theme=dark')

    const jsonResponse = ResponsePolyfill.json({ ok: true })
    const errorResponse = ResponsePolyfill.error()

    expect(headers.get('set-cookie')).toBe('session=issue-448, theme=dark')
    expect(headers.getSetCookie()).toEqual(['session=issue-448', 'theme=dark'])
    expect(jsonResponse.status).toBe(200)
    expect(jsonResponse.headers.get('content-type')).toBe('application/json')
    expect(await jsonResponse.json()).toEqual({ ok: true })
    expect(errorResponse.status).toBe(0)
    expect(errorResponse.ok).toBe(false)
    expect(errorResponse.type).toBe('error')
  })

  it('keeps directly imported web-apis polyfills interoperable', async () => {
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      options.success?.({
        data: 'ok',
        statusCode: 200,
        header: {
          'content-type': 'text/plain;charset=UTF-8',
        },
      })
      return {
        abort: vi.fn(),
      }
    })

    const {
      RequestPolyfill,
      ResponsePolyfill,
      TextDecoderPolyfill,
      TextEncoderPolyfill,
      URLPolyfill,
      fetch: requestGlobalsFetch,
    } = await import('../src')

    const request = new RequestPolyfill(
      new URLPolyfill('/polyfill', 'https://request-globals.invalid'),
      {
        body: 'payload',
        method: 'POST',
      },
    )
    expect(request.url).toBe('https://request-globals.invalid/polyfill')
    expect(request.body).toBeNull()
    expect(Object.hasOwn(request, 'body')).toBe(false)
    expect(Object.hasOwn(request, 'bodyUsed')).toBe(false)
    expect(request.bodyUsed).toBe(false)
    expect(await request.text()).toBe('payload')
    expect(request.bodyUsed).toBe(true)

    const response = new ResponsePolyfill('123')
    expect(response.body).toBeNull()
    expect(Object.hasOwn(response, 'body')).toBe(false)
    expect(Object.hasOwn(response, 'bodyUsed')).toBe(false)
    expect(Object.keys(response)).not.toContain('body')
    expect(Object.keys(response)).not.toContain('bodyValue')
    expect(await response.text()).toBe('123')

    const fetchResponse = await requestGlobalsFetch(
      new URLPolyfill('/polyfill', 'https://request-globals.invalid'),
    )
    expect(wpiRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://request-globals.invalid/polyfill',
    }))
    expect(await fetchResponse.text()).toBe('ok')

    const bytes = new TextEncoderPolyfill().encode('你好, issue-459')
    expect(new TextDecoderPolyfill().decode(bytes)).toBe('你好, issue-459')
  })

  it('installs the next batch of web runtime globals with stable behavior', async () => {
    setGlobalValue('performance', undefined)
    setGlobalValue('crypto', undefined)
    ;(globalThis as Record<string, any>).wx = {
      getPerformance: () => ({
        now: () => 321.5,
      }),
      getRandomValues: (typedArray: Uint8Array) => {
        typedArray.set([1, 2, 3, 4].slice(0, typedArray.length))
        return typedArray
      },
    }

    const { installWebRuntimeGlobals } = await import('../src')
    installWebRuntimeGlobals({
      targets: ['atob', 'btoa', 'queueMicrotask', 'performance', 'crypto', 'Event', 'CustomEvent'],
    })

    expect(globalThis.btoa('AB')).toBe('QUI=')
    expect(globalThis.atob('QUI=')).toBe('AB')
    expect(globalThis.performance.now()).toBe(321.5)

    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(4))
    expect([...bytes]).toEqual([1, 2, 3, 4])

    const microtaskSpy = vi.fn()
    globalThis.queueMicrotask(microtaskSpy)
    await Promise.resolve()
    expect(microtaskSpy).toHaveBeenCalledTimes(1)

    const event = new globalThis.Event('tick')
    const customEvent = new globalThis.CustomEvent('payload', {
      detail: { ok: true },
      cancelable: true,
    })
    customEvent.preventDefault()

    expect(event.type).toBe('tick')
    expect(customEvent.detail).toEqual({ ok: true })
    expect(customEvent.defaultPrevented).toBe(true)
  })

  it('patches incomplete host constructors before local bindings use newer helpers', async () => {
    class HostURL extends URL {}
    class HostURLSearchParams extends URLSearchParams {}
    class HostHeaders {
      private readonly headers = new Map<string, string>()

      append(key: string, value: string) {
        const normalizedKey = key.toLowerCase()
        const current = this.headers.get(normalizedKey)
        this.headers.set(normalizedKey, current ? `${current}, ${value}` : value)
      }

      get(key: string) {
        return this.headers.get(key.toLowerCase()) ?? null
      }
    }

    class HostResponse {
      readonly headers: HostHeaders
      readonly status: number

      constructor(_body?: unknown, init: Record<string, any> = {}) {
        this.headers = init.headers ?? new HostHeaders()
        this.status = init.status ?? 200
      }
    }

    ;(HostURL as Record<string, any>).parse = undefined
    ;(HostURL as Record<string, any>).canParse = undefined
    ;(HostURLSearchParams.prototype as Record<string, any>).sort = undefined
    ;(HostHeaders.prototype as Record<string, any>).getSetCookie = undefined
    ;(HostResponse as Record<string, any>).json = undefined
    ;(HostResponse as Record<string, any>).error = undefined

    setGlobalValue('URL', HostURL)
    setGlobalValue('URLSearchParams', HostURLSearchParams)
    setGlobalValue('Headers', HostHeaders)
    setGlobalValue('Response', HostResponse)

    const { installWebRuntimeGlobals } = await import('../src')
    installWebRuntimeGlobals({
      targets: ['fetch', 'Headers', 'Response'],
    })

    const params = new globalThis.URLSearchParams('b=2&a=1&a=0')
    params.sort()
    const headers = new globalThis.Headers()
    headers.append('Set-Cookie', 'session=issue-448')
    const jsonResponse = globalThis.Response.json({ ok: true })
    const errorResponse = globalThis.Response.error()

    expect((globalThis.URL as any).parse('/next', 'https://issue-448.invalid')?.href).toBe('https://issue-448.invalid/next')
    expect((globalThis.URL as any).canParse('/next', 'https://issue-448.invalid')).toBe(true)
    expect(params.size).toBe(3)
    expect(params.toString()).toBe('a=1&a=0&b=2')
    expect((headers as any).getSetCookie()).toEqual(['session=issue-448'])
    expect(await jsonResponse.json()).toEqual({ ok: true })
    expect(errorResponse.status).toBe(0)
    expect(errorResponse.type).toBe('error')
  })

  it('falls back to additional mini-program host getRandomValues implementations', async () => {
    setGlobalValue('crypto', undefined)
    ;(globalThis as Record<string, any>).swan = {
      getRandomValues: (typedArray: Uint8Array) => {
        typedArray.set([9, 8, 7, 6].slice(0, typedArray.length))
        return typedArray
      },
    }

    const { installWebRuntimeGlobals } = await import('../src')
    installWebRuntimeGlobals({
      targets: ['crypto'],
    })

    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(4))
    expect([...bytes]).toEqual([9, 8, 7, 6])
  })

  it('falls back to additional mini-program host performance implementations', async () => {
    setGlobalValue('performance', undefined)
    ;(globalThis as Record<string, any>).swan = {
      getPerformance: () => ({
        now: () => 456.75,
      }),
    }

    const { installWebRuntimeGlobals } = await import('../src')
    installWebRuntimeGlobals({
      targets: ['performance'],
    })

    expect(globalThis.performance.now()).toBe(456.75)
  })

  it('supports mini-program SocketTask through the injected WebSocket bridge', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['WebSocket'],
    })

    const socket = new globalThis.WebSocket('wss://request-globals.invalid/socket', ['chat'])
    const openSpy = vi.fn()
    const messageSpy = vi.fn()
    const errorSpy = vi.fn()
    const closeSpy = vi.fn()

    socket.onopen = openSpy
    socket.onmessage = messageSpy
    socket.onerror = errorSpy
    socket.onclose = closeSpy

    expect(socket.readyState).toBe(socket.CONNECTING)
    expect(wpiConnectSocketMock).toHaveBeenCalledWith(expect.objectContaining({
      protocols: ['chat'],
      url: 'wss://request-globals.invalid/socket',
    }))

    mockSocket.emitOpen()
    expect(socket.readyState).toBe(socket.OPEN)
    expect(openSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'open',
    }))

    socket.binaryType = 'arraybuffer'
    mockSocket.emitMessage({
      data: new Uint8Array([1, 2, 3]).buffer,
    })
    expect(messageSpy).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.any(ArrayBuffer),
      origin: 'wss://request-globals.invalid',
      type: 'message',
    }))

    socket.send('hello')
    expect(mockSocket.sendMock).toHaveBeenCalledWith(expect.objectContaining({
      data: 'hello',
    }))

    mockSocket.emitError({
      errMsg: 'connectSocket:fail simulated',
    })
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
      message: 'connectSocket:fail simulated',
      type: 'error',
    }))

    socket.close(1000, 'done')
    expect(socket.readyState).toBe(socket.CLOSING)
    expect(mockSocket.closeMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 1000,
      reason: 'done',
    }))

    mockSocket.emitClose({
      code: 1000,
      reason: 'done',
    })
    expect(socket.readyState).toBe(socket.CLOSED)
    expect(closeSpy).toHaveBeenCalledWith(expect.objectContaining({
      code: 1000,
      reason: 'done',
      type: 'close',
      wasClean: true,
    }))
  })

  it('applies runtime mini-program websocket defaults and supports init-object overrides', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)

    const {
      installRequestGlobals,
      setMiniProgramNetworkDefaults,
    } = await import('../src')
    installRequestGlobals({
      targets: ['WebSocket'],
    })
    setMiniProgramNetworkDefaults({
      socket: {
        timeout: 6_789,
        forceCellularNetwork: true,
      },
    })

    const socket = new globalThis.WebSocket('wss://request-globals.invalid/socket-default')
    const socketWithOverrides = new globalThis.WebSocket('wss://request-globals.invalid/socket-override', {
      protocols: ['chat'],
      miniProgram: {
        timeout: 1_234,
        header: {
          'x-socket-client': 'socket.io-client',
        },
      },
    } as any)

    expect(socket).toBeTruthy()
    expect(socketWithOverrides).toBeTruthy()
    expect(wpiConnectSocketMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      forceCellularNetwork: true,
      timeout: 6_789,
      url: 'wss://request-globals.invalid/socket-default',
    }))
    expect(wpiConnectSocketMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      forceCellularNetwork: true,
      timeout: 1_234,
      protocols: ['chat'],
      header: {
        'x-socket-client': 'socket.io-client',
      },
      url: 'wss://request-globals.invalid/socket-override',
    }))
  })

  it('rejects invalid websocket urls and invalid protocols', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['WebSocket'],
    })

    expect(() => new globalThis.WebSocket('https://request-globals.invalid/socket')).toThrow(/invalid URL/u)
    expect(() => new globalThis.WebSocket('wss://request-globals.invalid/socket#hash')).toThrow(/contains fragment/u)
    expect(() => new globalThis.WebSocket('wss://request-globals.invalid/socket', ['chat', 'chat'])).toThrow(/duplicated subprotocol/u)
    expect(() => new globalThis.WebSocket('wss://request-globals.invalid/socket', 'chat room')).toThrow(/invalid subprotocol/u)
  })

  it('throws on send before open and after close', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['WebSocket'],
    })

    const socket = new globalThis.WebSocket('wss://request-globals.invalid/socket')

    expect(() => socket.send('early')).toThrow(/CONNECTING state/u)

    mockSocket.emitOpen()
    socket.close(1000, 'done')
    mockSocket.emitClose({
      code: 1000,
      reason: 'done',
    })

    expect(() => socket.send('late')).toThrow(/not open/u)
  })

  it('emits blob-like message data by default for binary frames', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['WebSocket'],
    })

    const socket = new globalThis.WebSocket('wss://request-globals.invalid/socket')
    const messageSpy = vi.fn()
    socket.onmessage = messageSpy

    mockSocket.emitOpen()
    mockSocket.emitMessage({
      data: new Uint8Array([4, 5, 6]).buffer,
    })

    expect(messageSpy).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        size: 3,
      }),
      type: 'message',
    }))
  })

  it('validates close code and reason length before forwarding to SocketTask', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['WebSocket'],
    })

    const socket = new globalThis.WebSocket('wss://request-globals.invalid/socket')
    mockSocket.emitOpen()

    expect(() => socket.close(2000, 'bad-code')).toThrow(/invalid code/u)
    expect(() => socket.close(3000, 'a'.repeat(124))).toThrow(/longer than 123 bytes/u)

    socket.close(3000, 'normal-close')
    expect(mockSocket.closeMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 3000,
      reason: 'normal-close',
    }))
  })

  it('supports sending Blob payloads through SocketTask', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['WebSocket', 'fetch'],
    })

    const socket = new globalThis.WebSocket('wss://request-globals.invalid/socket')
    mockSocket.emitOpen()

    socket.send(new globalThis.Blob(['hello']))
    await vi.waitFor(() => {
      expect(mockSocket.sendMock).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.any(ArrayBuffer),
      }))
    })
  })
})
