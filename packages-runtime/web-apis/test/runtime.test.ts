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
  beforeEach(() => {
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
    expect(typeof globalThis.FormData).toBe('function')
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

    for (const key of ['fetch', 'URL', 'URLSearchParams', 'Blob', 'FormData'] as const) {
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
