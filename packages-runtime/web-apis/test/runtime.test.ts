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
    delete (globalThis as Record<string, any>).AbortController
    delete (globalThis as Record<string, any>).AbortSignal
    delete (globalThis as Record<string, any>).XMLHttpRequest
    delete (globalThis as Record<string, any>).WebSocket
    delete (globalThis as Record<string, any>).Blob
    delete (globalThis as Record<string, any>).FormData
    delete (globalThis as Record<string, any>).wx
    delete (globalThis as Record<string, any>).global
    delete (globalThis as Record<string, any>).__weappViteRequestGlobalsActuals__
    delete (globalThis as Record<string, any>).__weappViteRequestGlobalsActuals
    wpiConnectSocketMock.mockReset()
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
    expect(typeof globalThis.WebSocket).toBe('function')
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
    expect(typeof globalThis.Blob).toBe('function')
    expect(typeof globalThis.FormData).toBe('function')
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
    expect(typeof (globalThis as any).global.WebSocket).toBe('function')
    expect((globalThis as any).self).toBe(globalThis)
    expect((globalThis as any).window).toBe(globalThis)
  })

  it('replaces lazy placeholder globals with real runtime implementations', async () => {
    const placeholderFetch = vi.fn()
    ;(placeholderFetch as any).__weappViteRequestGlobalsPlaceholder__ = true
    const placeholderWebSocket = vi.fn()
    ;(placeholderWebSocket as any).__weappViteRequestGlobalsPlaceholder__ = true

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
    expect(typeof (globalThis as any).__weappViteRequestGlobalsActuals.fetch).toBe('function')
    expect(typeof (globalThis as any).__weappViteRequestGlobalsActuals.AbortController).toBe('function')
    expect(typeof (globalThis as any).__weappViteRequestGlobalsActuals.AbortSignal).toBe('function')
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
