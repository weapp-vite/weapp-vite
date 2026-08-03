import { REQUEST_GLOBAL_ACTUALS_KEY, REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const wpiRequestMock = vi.hoisted(() => vi.fn())
const wpiConnectSocketMock = vi.hoisted(() => vi.fn())
const wpiGetAdapterMock = vi.hoisted(() => vi.fn())
const wpiResolveTargetMock = vi.hoisted(() => vi.fn())

vi.mock('@wevu/api', () => ({
  wpi: {
    getAdapter: wpiGetAdapterMock,
    request: wpiRequestMock,
    resolveTarget: wpiResolveTargetMock,
  },
}))

function setGlobalValue(key: string, value: unknown) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value,
  })
}

function countBodyByteSequence(body: Uint8Array, expected: Uint8Array) {
  if (expected.byteLength === 0 || body.byteLength < expected.byteLength) {
    return 0
  }

  let count = 0
  for (let offset = 0; offset <= body.byteLength - expected.byteLength; offset++) {
    let matched = true
    for (let index = 0; index < expected.byteLength; index++) {
      if (body[offset + index] !== expected[index]) {
        matched = false
        break
      }
    }
    if (matched) {
      count += 1
    }
  }
  return count
}

function bodyContainsBytes(body: Uint8Array, expected: Uint8Array) {
  return countBodyByteSequence(body, expected) > 0
}

function createBlobLike(buffer: ArrayBuffer, type = 'application/octet-stream') {
  return {
    size: buffer.byteLength,
    type,
    async arrayBuffer() {
      return buffer.slice(0)
    },
  }
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
    wpiGetAdapterMock.mockReset()
    wpiGetAdapterMock.mockReturnValue({
      connectSocket: wpiConnectSocketMock,
    })
    wpiResolveTargetMock.mockReset()
    wpiResolveTargetMock.mockReturnValue({
      supported: true,
      target: 'connectSocket',
    })
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

  it('preserves complete existing globals for every install target', async () => {
    const runtime = await import('../src')
    const existing = {
      fetch: vi.fn(),
      Headers: runtime.HeadersPolyfill,
      Request: runtime.RequestPolyfill,
      Response: runtime.ResponsePolyfill,
      TextEncoder: runtime.TextEncoderPolyfill,
      TextDecoder: runtime.TextDecoderPolyfill,
      AbortController: runtime.AbortControllerPolyfill,
      AbortSignal: runtime.AbortSignalPolyfill,
      XMLHttpRequest: runtime.XMLHttpRequestPolyfill,
      WebSocket: runtime.WebSocketPolyfill,
      atob: runtime.atobPolyfill,
      btoa: runtime.btoaPolyfill,
      queueMicrotask: runtime.queueMicrotaskPolyfill,
      performance: runtime.performancePolyfill,
      crypto: runtime.cryptoPolyfill,
      Event: runtime.EventPolyfill,
      CustomEvent: runtime.CustomEventPolyfill,
    }
    for (const [key, value] of Object.entries(existing)) {
      setGlobalValue(key, value)
    }

    runtime.installWebRuntimeGlobals()

    for (const [key, value] of Object.entries(existing)) {
      expect((globalThis as Record<string, any>)[key]).toBe(value)
    }
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

  it('serializes FormData Blob and File values into multipart fetch bodies', async () => {
    let requestOptions: Record<string, any> | undefined
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      requestOptions = options
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
    installRequestGlobals({
      targets: ['fetch'],
    })

    const formData = new globalThis.FormData()
    formData.append('message', 'hello')
    formData.append('blob-file', new globalThis.Blob(['blob payload'], { type: 'text/plain' }), 'blob.txt')
    formData.append('file-file', new globalThis.File(['file payload'], 'file.txt', { type: 'text/plain' }))

    const response = await globalThis.fetch('https://request-globals.invalid/upload', {
      body: formData,
      method: 'POST',
    })

    expect(await response.json()).toEqual({ ok: true })
    expect(requestOptions?.header['content-type']).toMatch(/^multipart\/form-data; boundary=----weapp-vite-formdata-/)
    expect(requestOptions?.data).toBeInstanceOf(ArrayBuffer)

    const multipartBody = new TextDecoder().decode(requestOptions?.data)
    expect(multipartBody).toContain('name="message"')
    expect(multipartBody).toContain('hello')
    expect(multipartBody).toContain('name="blob-file"; filename="blob.txt"')
    expect(multipartBody).toContain('Content-Type: text/plain')
    expect(multipartBody).toContain('blob payload')
    expect(multipartBody).toContain('name="file-file"; filename="file.txt"')
    expect(multipartBody).toContain('file payload')
  })

  it('preserves host ArrayBuffer-like values in Blob and File multipart bodies', async () => {
    let requestOptions: Record<string, any> | undefined
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      requestOptions = options
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
    installRequestGlobals({
      targets: ['fetch'],
    })

    const original = Uint8Array.from([0, 1, 2, 3, 0xF0, 0x9F, 0x94, 0xA5, 0xFF]).buffer
    const hostBuffer = {} as ArrayBuffer
    Object.defineProperties(hostBuffer, {
      byteLength: {
        configurable: true,
        value: original.byteLength,
      },
      slice: {
        configurable: true,
        value: original.slice.bind(original),
      },
      [Symbol.toStringTag]: {
        configurable: true,
        value: 'ArrayBuffer',
      },
    })

    expect(hostBuffer).not.toBeInstanceOf(ArrayBuffer)

    const formData = new globalThis.FormData()
    formData.append('blob-file', new globalThis.Blob([hostBuffer], { type: 'application/octet-stream' }), 'downloaded-blob.bin')
    formData.append('file-file', new globalThis.File([hostBuffer], 'downloaded-file.bin', { type: 'application/octet-stream' }))

    const response = await globalThis.fetch('https://request-globals.invalid/upload', {
      body: formData,
      method: 'POST',
    })

    expect(await response.json()).toEqual({ ok: true })
    expect(requestOptions?.data).toBeInstanceOf(ArrayBuffer)

    const body = new Uint8Array(requestOptions?.data)
    const encodedString = new TextEncoder().encode('[object ArrayBuffer]')
    const expectedBytes = new Uint8Array(original)
    expect(bodyContainsBytes(body, encodedString)).toBe(false)
    expect(countBodyByteSequence(body, expectedBytes)).toBe(2)
  })

  it('preserves binary fetch bodies through init and Request polyfill inputs', async () => {
    const requestOptionsList: Array<Record<string, any>> = []
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      requestOptionsList.push(options)
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
    installRequestGlobals({
      targets: ['fetch', 'Request'],
    })

    const bytes = Uint8Array.from([0, 1, 2, 3, 0xF0, 0x9F, 0x94, 0xA5, 0xFF])
    const buffer = bytes.buffer
    const view = new DataView(buffer)
    const blobLike = createBlobLike(buffer)
    const url = 'https://request-globals.invalid/raw-upload'
    const cases: Array<[string, Parameters<typeof globalThis.fetch>[0], Parameters<typeof globalThis.fetch>[1] | undefined]> = [
      ['arraybuffer-init', url, { body: buffer, method: 'POST' }],
      ['uint8array-init', url, { body: bytes, method: 'POST' }],
      ['dataview-init', url, { body: view, method: 'POST' }],
      ['blob-init', url, { body: new globalThis.Blob([buffer], { type: 'application/octet-stream' }), method: 'POST' }],
      ['file-init', url, { body: new globalThis.File([buffer], 'raw-file.bin', { type: 'application/octet-stream' }), method: 'POST' }],
      ['blob-like-init', url, { body: blobLike as BodyInit, method: 'POST' }],
      ['arraybuffer-request', new globalThis.Request(url, { body: buffer, method: 'POST' }), undefined],
      ['blob-request', new globalThis.Request(url, { body: new globalThis.Blob([buffer], { type: 'application/octet-stream' }), method: 'POST' }), undefined],
      ['blob-like-request', new globalThis.Request(url, { body: blobLike as BodyInit, method: 'POST' }), undefined],
    ]

    for (const [, input, init] of cases) {
      const response = await globalThis.fetch(input, init)
      expect(await response.json()).toEqual({ ok: true })
    }

    expect(requestOptionsList).toHaveLength(cases.length)
    for (const [index, [caseName]] of cases.entries()) {
      const requestOptions = requestOptionsList[index]
      expect(requestOptions?.data, caseName).toBeInstanceOf(ArrayBuffer)
      expect(new Uint8Array(requestOptions?.data), caseName).toEqual(bytes)
    }
    expect(requestOptionsList[3]?.header['content-type']).toBe('application/octet-stream')
    expect(requestOptionsList[4]?.header['content-type']).toBe('application/octet-stream')
    expect(requestOptionsList[5]?.header['content-type']).toBe('application/octet-stream')
    expect(requestOptionsList[7]?.header['content-type']).toBe('application/octet-stream')
    expect(requestOptionsList[8]?.header['content-type']).toBe('application/octet-stream')
  })

  it('preserves FormData bodies when fetch receives a Request polyfill', async () => {
    let requestOptions: Record<string, any> | undefined
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      requestOptions = options
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
    installRequestGlobals({
      targets: ['fetch', 'Request'],
    })

    const formData = new globalThis.FormData()
    formData.append('message', 'hello')
    formData.append('file', new globalThis.File(['file payload'], 'file.txt', { type: 'text/plain' }))

    const request = new globalThis.Request('https://request-globals.invalid/upload', {
      body: formData,
      method: 'POST',
    })
    const response = await globalThis.fetch(request)

    expect(await response.json()).toEqual({ ok: true })
    expect(requestOptions?.header['content-type']).toMatch(/^multipart\/form-data; boundary=----weapp-vite-formdata-/)
    expect(requestOptions?.data).toBeInstanceOf(ArrayBuffer)

    const multipartBody = new TextDecoder().decode(requestOptions?.data)
    expect(multipartBody).toContain('name="message"')
    expect(multipartBody).toContain('hello')
    expect(multipartBody).toContain('name="file"; filename="file.txt"')
    expect(multipartBody).toContain('file payload')
  })

  it('does not treat generic arrayBuffer readers as Blob-like fetch bodies', async () => {
    let requestOptions: Record<string, any> | undefined
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      requestOptions = options
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
    installRequestGlobals({
      targets: ['fetch'],
    })

    const genericBody = {
      async arrayBuffer() {
        return Uint8Array.from([1, 2, 3]).buffer
      },
    }
    const response = await globalThis.fetch('https://request-globals.invalid/raw-upload', {
      body: genericBody as BodyInit,
      method: 'POST',
    })

    expect(await response.json()).toEqual({ ok: true })
    expect(requestOptions?.data).toBe('[object Object]')
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
    const placeholderPerformance = { now: vi.fn() }
    ;(placeholderPerformance as any)[REQUEST_GLOBAL_PLACEHOLDER_KEY] = true
    const placeholderCrypto = { getRandomValues: vi.fn() }
    ;(placeholderCrypto as any)[REQUEST_GLOBAL_PLACEHOLDER_KEY] = true

    setGlobalValue('fetch', placeholderFetch)
    setGlobalValue('WebSocket', placeholderWebSocket)
    setGlobalValue('performance', placeholderPerformance)
    setGlobalValue('crypto', placeholderCrypto)

    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({
      targets: ['fetch', 'WebSocket', 'performance', 'crypto'],
    })

    expect(globalThis.fetch).not.toBe(placeholderFetch)
    expect(globalThis.WebSocket).not.toBe(placeholderWebSocket)
    expect(globalThis.performance).not.toBe(placeholderPerformance)
    expect(globalThis.crypto).not.toBe(placeholderCrypto)
    expect(typeof globalThis.fetch).toBe('function')
    expect(typeof globalThis.WebSocket).toBe('function')
    expect(typeof globalThis.performance.now).toBe('function')
    expect(typeof globalThis.crypto.getRandomValues).toBe('function')
    expect((globalThis as any)[REQUEST_GLOBAL_ACTUALS_KEY].performance).toBe(globalThis.performance)
    expect((globalThis as any)[REQUEST_GLOBAL_ACTUALS_KEY].crypto).toBe(globalThis.crypto)
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
    const relativeUrlCases = [
      ['/123', 'fake://abc/'],
      ['123', 'fake://abc/'],
      ['/123', 'fake://abc'],
      ['123', 'fake://abc'],
    ] as const
    const params = new URLSearchParamsPolyfill('b=2&a=1&a=0')
    params.sort()

    expect(parsed?.href).toBe('https://request-globals.invalid/graphql?b=2&a=1')
    for (const [input, base] of relativeUrlCases) {
      expect(new URLPolyfill(input, base).href).toBe('fake://abc/123')
      expect(URLPolyfill.parse(input, base)?.href).toBe('fake://abc/123')
    }
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
    expect((new globalThis.Headers() as any).getSetCookie()).toEqual([])
    expect(await jsonResponse.json()).toEqual({ ok: true })
    expect(errorResponse.status).toBe(0)
    expect(errorResponse.type).toBe('error')
    expect((globalThis.URL as any).parse('/missing-base')).toBe(null)
    expect((globalThis.URL as any).canParse('/missing-base')).toBe(false)
  })

  it('patches host URLSearchParams size and sort when both helpers are absent', async () => {
    class MinimalUrlSearchParams {
      private entriesList: Array<[string, string]>

      constructor(source = '') {
        this.entriesList = source.split('&').filter(Boolean).map((entry) => {
          const [key = '', value = ''] = entry.split('=')
          return [key, value]
        })
      }

      append(key: string, value: string) {
        this.entriesList.push([key, value])
      }

      delete(key: string) {
        this.entriesList = this.entriesList.filter(([entryKey]) => entryKey !== key)
      }

      entries() {
        return this.entriesList[Symbol.iterator]()
      }

      forEach(callback: (value: string, key: string) => void) {
        for (const [key, value] of this.entriesList) {
          callback(value, key)
        }
      }

      toString() {
        return this.entriesList.map(entry => entry.join('=')).join('&')
      }
    }

    setGlobalValue('URLSearchParams', MinimalUrlSearchParams)
    const { installWebRuntimeGlobals } = await import('../src')
    installWebRuntimeGlobals({ targets: ['fetch'] })
    const params = new globalThis.URLSearchParams('b=2&a=1&a=0')
    expect(params.size).toBe(3)
    params.sort()
    expect(params.toString()).toBe('a=1&a=0&b=2')
    const ascending = new globalThis.URLSearchParams('a=1&b=2')
    ascending.sort()
    expect(ascending.toString()).toBe('a=1&b=2')
  })

  it('replaces constructors with missing prototypes and accepts complete Headers helpers', async () => {
    const NoPrototypeUrlSearchParams = function NoPrototypeUrlSearchParams() {}
    NoPrototypeUrlSearchParams.prototype = undefined as never
    const HeaderWithoutPrototype = (() => undefined) as any
    setGlobalValue('URLSearchParams', NoPrototypeUrlSearchParams)
    setGlobalValue('Headers', HeaderWithoutPrototype)
    const { HeadersPolyfill, installWebRuntimeGlobals, URLSearchParamsPolyfill } = await import('../src')
    installWebRuntimeGlobals({ targets: ['fetch', 'Headers'] })
    expect(globalThis.URLSearchParams).toBe(URLSearchParamsPolyfill)
    expect(globalThis.Headers).toBe(HeadersPolyfill)

    class CompleteHeaders {
      getSetCookie() {
        return []
      }
    }
    setGlobalValue('Headers', CompleteHeaders)
    installWebRuntimeGlobals({ targets: ['Headers'] })
    expect(globalThis.Headers).toBe(CompleteHeaders as any)
  })

  it('replaces URL constructors that throw only during relative compatibility checks', async () => {
    class RelativeThrowingUrl extends URL {
      constructor(input: string, base?: string) {
        if (base) {
          throw new TypeError('relative URLs unsupported')
        }
        super(input)
      }
    }
    setGlobalValue('URL', RelativeThrowingUrl)
    const { installWebRuntimeGlobals, URLPolyfill } = await import('../src')
    installWebRuntimeGlobals({ targets: ['fetch'] })
    expect(globalThis.URL).toBe(URLPolyfill)
  })

  it('falls back when host constructor patches reject property definitions', async () => {
    class FrozenUrlSearchParams {
      constructor(_source = '') {}

      entries() {
        return [][Symbol.iterator]()
      }

      forEach() {}
    }
    Object.freeze(FrozenUrlSearchParams.prototype)
    const miniHost = {
      Blob: globalThis.Blob,
      File: globalThis.File,
      FormData: globalThis.FormData,
      URL: globalThis.URL,
      URLSearchParams: FrozenUrlSearchParams,
    }
    ;(globalThis as Record<string, any>).wx = miniHost

    const { installWebRuntimeGlobals, URLSearchParamsPolyfill } = await import('../src')
    installWebRuntimeGlobals({ targets: ['fetch'] })
    expect(miniHost.URLSearchParams).toBe(URLSearchParamsPolyfill)
  })

  it('handles empty installed bindings, rejecting aliases and the abort-only helper', async () => {
    Object.defineProperty(globalThis, 'global', {
      configurable: true,
      get: () => null,
      set: () => {
        throw new TypeError('read only alias')
      },
    })
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      get: () => null,
      set: () => undefined,
    })
    const { installAbortGlobals, installWebRuntimeGlobals } = await import('../src')
    expect(() => installWebRuntimeGlobals({ targets: ['fetch'] })).not.toThrow()
    expect(installAbortGlobals()).toBe(globalThis)
    expect(typeof globalThis.AbortController).toBe('function')
    expect(typeof globalThis.AbortSignal).toBe('function')
  })

  it('replaces host URL constructors whose relative custom-protocol parsing diverges from Web behavior', async () => {
    const originalUrl = globalThis.URL

    class MisalignedHostURL {
      readonly href: string

      constructor(input: string, base?: string) {
        this.href = base ? `${base}//${input}` : input
      }
    }

    try {
      setGlobalValue('URL', MisalignedHostURL)

      const { installWebRuntimeGlobals, URLPolyfill } = await import('../src')
      installWebRuntimeGlobals({
        targets: ['fetch'],
      })

      expect((globalThis as Record<string, any>).URL).toBe(URLPolyfill)
      expect(globalThis.URL.parse('123', 'fake://abc')?.href).toBe('fake://abc/123')
    }
    finally {
      setGlobalValue('URL', originalUrl)
    }
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

  it('normalizes fetch inputs, headers and body types across request-like callers', async () => {
    const requestOptions: Array<Record<string, any>> = []
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      requestOptions.push(options)
      options.success?.({
        data: new Uint8Array([111, 107]),
        statusCode: 201,
        header: [['X-Result', 'first'], ['x-result', 'second']],
      })
      return undefined
    })

    const {
      fetch: requestGlobalsFetch,
      FormDataPolyfill,
      URLPolyfill,
      URLSearchParamsPolyfill,
    } = await import('../src')

    const params = new URLSearchParamsPolyfill('query=hello+world')
    const paramsResponse = await requestGlobalsFetch(new URLPolyfill('https://request-globals.invalid/params'), {
      body: params,
      headers: [['X-Client', 'tuple'], []] as any,
      method: 'POST',
    })
    expect(await paramsResponse.text()).toBe('ok')
    expect(paramsResponse.status).toBe(201)
    expect(paramsResponse.headers.get('x-result')).toBe('second')
    expect(requestOptions[0]).toEqual(expect.objectContaining({
      data: 'query=hello+world',
      header: {
        'X-Client': 'tuple',
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      method: 'POST',
    }))

    const arrayBuffer = Uint8Array.from([1, 2]).buffer
    await requestGlobalsFetch({
      url: 'https://request-globals.invalid/request-like-buffer',
      method: 'POST',
      headers: { 'X-Array': ['a', 'b'] },
      clone: () => ({ arrayBuffer: async () => arrayBuffer }),
    })
    expect(new Uint8Array(requestOptions[1]?.data)).toEqual(new Uint8Array(arrayBuffer))
    expect(requestOptions[1]?.header).toEqual({ 'X-Array': 'a, b' })

    await requestGlobalsFetch({
      url: 'https://request-globals.invalid/request-like-text',
      method: 'POST',
      clone: () => ({ text: async () => 'cloned text' }),
    }, {
      headers: new Map([['X-Map', 'yes']]),
    })
    expect(requestOptions[2]).toEqual(expect.objectContaining({
      data: 'cloned text',
      header: {
        'X-Map': 'yes',
        'content-type': 'text/plain;charset=UTF-8',
      },
    }))

    await requestGlobalsFetch('https://request-globals.invalid/blob', {
      body: {
        arrayBuffer: async () => Uint8Array.from([3]).buffer,
        size: 1,
        type: 'application/custom',
      },
      headers: { 'Content-Type': 'application/explicit' },
      method: 'POST',
    })
    expect(requestOptions[3]?.header).toEqual({ 'Content-Type': 'application/explicit' })
    expect(new Uint8Array(requestOptions[3]?.data)).toEqual(Uint8Array.from([3]))

    await requestGlobalsFetch('https://request-globals.invalid/object', {
      body: { value: 1 },
      headers: 42,
      method: 'POST',
    })
    expect(requestOptions[4]).toEqual(expect.objectContaining({
      data: '[object Object]',
      header: {},
      method: 'POST',
    }))

    await requestGlobalsFetch('https://request-globals.invalid/unsupported-method', {
      method: 'unsupported',
    })
    expect(requestOptions[5]?.method).toBe('GET')

    await requestGlobalsFetch('https://request-globals.invalid/headers-like', {
      headers: {
        forEach(callback: (value: string, key: string) => void) {
          callback('ignored', ' ')
          callback('yes', 'X-Headers-Like')
        },
      },
    })
    expect(requestOptions[6]?.header).toEqual({ 'X-Headers-Like': 'yes' })

    await requestGlobalsFetch({
      clone: () => ({ text: async () => 'discarded GET body' }),
      method: 'GET',
      url: 'https://request-globals.invalid/request-like-get',
    })
    expect(requestOptions[7]?.data).toBeUndefined()

    await requestGlobalsFetch('https://request-globals.invalid/params-explicit-type', {
      body: new URLSearchParamsPolyfill('x=1'),
      headers: { 'Content-Type': 'x/params' },
      method: 'POST',
    })
    expect(requestOptions[8]?.header).toEqual({ 'Content-Type': 'x/params' })

    const explicitForm = new FormDataPolyfill()
    explicitForm.append('x', '1')
    await requestGlobalsFetch('https://request-globals.invalid/form-explicit-type', {
      body: explicitForm,
      headers: { 'Content-Type': 'x/form' },
      method: 'POST',
    })
    expect(requestOptions[9]?.header).toEqual({ 'Content-Type': 'x/form' })
  })

  it('rejects invalid, consumed and body-bearing GET fetch inputs', async () => {
    const { fetch: requestGlobalsFetch } = await import('../src')

    await expect(requestGlobalsFetch({} as any)).rejects.toThrow('invalid request url')
    await expect(requestGlobalsFetch('https://request-globals.invalid/get-body', {
      body: 'invalid',
    })).rejects.toThrow('GET/HEAD request cannot have body')
    await expect(requestGlobalsFetch({
      bodyUsed: true,
      clone: () => ({}),
      method: 'POST',
      url: 'https://request-globals.invalid/consumed',
    })).rejects.toThrow('request body is already used')
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      options.success?.({ data: '', header: {}, statusCode: 204 })
    })
    await expect(requestGlobalsFetch({
      clone: () => ({}),
      method: 'POST',
      url: 'https://request-globals.invalid/no-readable-body',
    })).resolves.toBeTruthy()
  })

  it('handles fetch pre-abort, in-flight abort, bridge failures and settled callbacks', async () => {
    const { AbortControllerPolyfill, fetch: requestGlobalsFetch } = await import('../src')
    const preAborted = new AbortControllerPolyfill()
    preAborted.abort()
    const originalDomException = globalThis.DOMException
    try {
      setGlobalValue('DOMException', undefined)
      await expect(requestGlobalsFetch('https://request-globals.invalid/pre-abort', {
        signal: preAborted.signal as any,
      })).rejects.toMatchObject({ name: 'AbortError' })
    }
    finally {
      setGlobalValue('DOMException', originalDomException)
    }

    let pendingOptions: Record<string, any> | undefined
    const abortTask = vi.fn()
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      pendingOptions = options
      return { abort: abortTask }
    })
    const controller = new AbortControllerPolyfill()
    const pending = requestGlobalsFetch('https://request-globals.invalid/in-flight', {
      signal: controller.signal as any,
    })
    await vi.waitFor(() => expect(pendingOptions).toBeDefined())
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(abortTask).toHaveBeenCalledOnce()
    pendingOptions?.fail?.({ errMsg: 'late failure' })
    pendingOptions?.success?.({ data: 'late', header: {}, statusCode: 200 })

    let settledAbortListener: (() => void) | undefined
    const stickySignal = {
      aborted: false,
      addEventListener(_type: string, listener: () => void) {
        settledAbortListener = listener
      },
      removeEventListener() {},
    }
    wpiRequestMock.mockImplementationOnce((options: Record<string, any>) => {
      options.success?.({ data: 'done', header: {}, statusCode: 200 })
    })
    await expect(requestGlobalsFetch('https://request-globals.invalid/settled-abort', {
      signal: stickySignal as any,
    })).resolves.toBeTruthy()
    expect(() => settledAbortListener?.()).not.toThrow()

    wpiRequestMock.mockImplementationOnce((options: Record<string, any>) => {
      options.fail?.({ errMsg: 'request:fail simulated' })
      return { abort: vi.fn() }
    })
    await expect(requestGlobalsFetch('https://request-globals.invalid/fail-object')).rejects.toThrow('request:fail simulated')

    wpiRequestMock.mockImplementationOnce((options: Record<string, any>) => {
      options.fail?.('plain failure')
      return { abort: vi.fn() }
    })
    await expect(requestGlobalsFetch('https://request-globals.invalid/fail-string')).rejects.toThrow('plain failure')
  })

  it('covers xhr state guards, successful body modes and network failure', async () => {
    const { HeadersPolyfill, ResponsePolyfill, XMLHttpRequestPolyfill } = await import('../src')
    const xhr = new XMLHttpRequestPolyfill()
    expect(xhr.getAllResponseHeaders()).toBe('')
    expect(xhr.getResponseHeader('x-test')).toBe(null)
    expect(() => xhr.setRequestHeader('x-test', 'early')).toThrow('invalid readyState')
    await expect(xhr.send()).rejects.toThrow('invalid readyState')
    xhr.abort()

    const responseBuffer = Uint8Array.from([1, 2, 3]).buffer
    const fetchMock = vi.fn().mockResolvedValue(new ResponsePolyfill(responseBuffer, {
      headers: { 'X-Test': 'yes' },
      status: 206,
      statusText: 'Partial',
      url: 'https://request-globals.invalid/final',
    }))
    setGlobalValue('fetch', fetchMock)
    setGlobalValue('Headers', HeadersPolyfill)
    xhr.open('', 'https://request-globals.invalid/arraybuffer')
    xhr.setRequestHeader('X-Request', 'one')
    xhr.setRequestHeader('X-Request', 'two')
    xhr.responseType = 'arraybuffer'
    const states: number[] = []
    xhr.onreadystatechange = () => states.push(xhr.readyState)
    await xhr.send()
    expect(new Uint8Array(xhr.response)).toEqual(Uint8Array.from([1, 2, 3]))
    expect(xhr.status).toBe(206)
    expect(xhr.statusText).toBe('Partial')
    expect(xhr.responseURL).toBe('https://request-globals.invalid/final')
    expect(xhr.getAllResponseHeaders()).toContain('X-Test: yes')
    expect(states).toEqual([xhr.HEADERS_RECEIVED, xhr.LOADING, xhr.DONE])
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: { 'X-Request': 'one, two' },
      method: 'GET',
    }))
    expect(() => xhr.setRequestHeader('late', 'no')).toThrow('invalid readyState')

    const emptyJson = new XMLHttpRequestPolyfill()
    setGlobalValue('fetch', vi.fn().mockResolvedValue(new ResponsePolyfill('', { status: 200 })))
    emptyJson.open('GET', 'https://request-globals.invalid/empty-json')
    emptyJson.responseType = 'json'
    await emptyJson.send()
    expect(emptyJson.response).toBe(null)

    const failed = new XMLHttpRequestPolyfill()
    const onerror = vi.fn()
    const onloadend = vi.fn()
    setGlobalValue('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    failed.onerror = onerror
    failed.onloadend = onloadend
    failed.open('GET', 'https://request-globals.invalid/offline')
    await expect(failed.send()).rejects.toThrow('offline')
    expect(failed.readyState).toBe(failed.DONE)
    expect(failed.status).toBe(0)
    expect(onerror).toHaveBeenCalledOnce()
    expect(onloadend).toHaveBeenCalledOnce()
  })

  it('covers xhr abort and timeout completion paths', async () => {
    const { XMLHttpRequestPolyfill } = await import('../src')
    const abortingFetch = vi.fn((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason ?? new Error('aborted')))
    }))
    setGlobalValue('fetch', abortingFetch)

    const aborted = new XMLHttpRequestPolyfill()
    const onabort = vi.fn()
    aborted.onabort = onabort
    aborted.open('GET', 'https://request-globals.invalid/abort')
    const abortedSend = aborted.send()
    aborted.abort()
    await abortedSend
    expect(aborted.readyState).toBe(aborted.DONE)
    expect(onabort).toHaveBeenCalledOnce()

    vi.useFakeTimers()
    try {
      const timedOut = new XMLHttpRequestPolyfill()
      const ontimeout = vi.fn()
      timedOut.ontimeout = ontimeout
      timedOut.timeout = 10
      timedOut.open('GET', 'https://request-globals.invalid/timeout')
      const timeoutSend = timedOut.send()
      await vi.advanceTimersByTimeAsync(10)
      await timeoutSend
      expect(timedOut.readyState).toBe(timedOut.DONE)
      expect(ontimeout).toHaveBeenCalledOnce()
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('uses xhr response defaults and the internal fetch bridge when no global fetch exists', async () => {
    const { HeadersPolyfill, XMLHttpRequestPolyfill } = await import('../src')
    const responseWithoutMetadata = {
      headers: new HeadersPolyfill(),
      status: 200,
      statusText: undefined,
      url: undefined,
      async arrayBuffer() {
        return new ArrayBuffer(0)
      },
      async text() {
        return 'plain'
      },
    }
    setGlobalValue('fetch', vi.fn().mockResolvedValue(responseWithoutMetadata))
    const defaults = new XMLHttpRequestPolyfill()
    defaults.open('GET', 'https://request-globals.invalid/default-response')
    await defaults.send()
    expect(defaults.statusText).toBe('')
    expect(defaults.responseURL).toBe('https://request-globals.invalid/default-response')
    expect(defaults.response).toBe('plain')

    delete (globalThis as Record<string, any>).fetch
    wpiRequestMock.mockImplementation((options: Record<string, any>) => {
      options.success?.({ data: 'internal', header: {}, statusCode: 200 })
    })
    const internal = new XMLHttpRequestPolyfill()
    internal.open('GET', 'https://request-globals.invalid/internal-fetch')
    await internal.send()
    expect(internal.responseText).toBe('internal')
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

  it('reports unavailable websocket adapters and invalid socket tasks', async () => {
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({ targets: ['WebSocket'] })

    wpiResolveTargetMock.mockReturnValue(undefined)
    expect(() => new globalThis.WebSocket('wss://request-globals.invalid/unsupported')).toThrow(/not supported/u)

    wpiResolveTargetMock.mockReturnValue({ supported: false, target: 'connectSocket' })
    expect(() => new globalThis.WebSocket('wss://request-globals.invalid/unsupported-target')).toThrow(/not supported/u)

    wpiGetAdapterMock.mockReturnValue(undefined)
    wpiResolveTargetMock.mockReturnValue({ supported: true, target: 'connectSocket' })
    expect(() => new globalThis.WebSocket('wss://request-globals.invalid/missing-adapter')).toThrow(/not supported/u)
    wpiGetAdapterMock.mockReturnValue({ connectSocket: wpiConnectSocketMock })

    wpiResolveTargetMock.mockReturnValue({ supported: true, target: 'missingSocketMethod' })
    expect(() => new globalThis.WebSocket('wss://request-globals.invalid/missing-method')).toThrow(/not supported/u)

    wpiResolveTargetMock.mockReturnValue({ supported: true, target: 'connectSocket' })
    wpiConnectSocketMock.mockReturnValue(null)
    expect(() => new globalThis.WebSocket('wss://request-globals.invalid/invalid-task')).toThrow(/SocketTask/u)
  })

  it('handles websocket connection failure, duplicate runtime events and default close data', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({ targets: ['WebSocket'] })

    const socket = new globalThis.WebSocket('wss://request-globals.invalid/connect-failure')
    const openSpy = vi.fn()
    const messageSpy = vi.fn()
    const errorSpy = vi.fn()
    const closeSpy = vi.fn()
    socket.onopen = openSpy
    socket.onmessage = messageSpy
    socket.onerror = errorSpy
    socket.onclose = closeSpy

    const connectOptions = wpiConnectSocketMock.mock.calls.at(-1)?.[0]
    connectOptions.fail({ errMsg: undefined })
    expect(socket.readyState).toBe(socket.CLOSED)
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: '' }))
    expect(closeSpy).toHaveBeenCalledWith(expect.objectContaining({
      code: 1000,
      reason: '',
      wasClean: true,
    }))

    mockSocket.emitOpen()
    mockSocket.emitMessage({ data: 'ignored' })
    mockSocket.emitClose({ code: 4001, reason: 'ignored duplicate' })
    expect(openSpy).not.toHaveBeenCalled()
    expect(messageSpy).not.toHaveBeenCalled()
    expect(closeSpy).toHaveBeenCalledOnce()
  })

  it('covers websocket send and close payload variants and host failures', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({ targets: ['WebSocket'] })

    const socket = new globalThis.WebSocket('wss://request-globals.invalid/payloads', 'chat')
    const errorSpy = vi.fn()
    const messageSpy = vi.fn()
    socket.onerror = errorSpy
    socket.onmessage = messageSpy
    mockSocket.emitOpen()
    mockSocket.emitOpen()

    socket.send(Uint8Array.from([1, 2]))
    socket.send(Uint8Array.from([3, 4]).buffer)
    expect(mockSocket.sendMock).toHaveBeenCalledTimes(2)
    expect(mockSocket.sendMock.mock.calls[0]?.[0].data).toBeInstanceOf(ArrayBuffer)
    expect(mockSocket.sendMock.mock.calls[1]?.[0].data).toBeInstanceOf(ArrayBuffer)
    mockSocket.sendMock.mock.calls[0]?.[0].fail(new Error('send failed'))
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'send failed' }))
    expect(() => socket.send({} as any)).toThrow(/data must be/u)

    socket.send({
      arrayBuffer: async () => {
        throw new Error('blob read failed')
      },
      size: 1,
      type: 'application/octet-stream',
    } as any)
    await vi.waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'blob read failed' }))
    })

    socket.send(new globalThis.Blob(['send failure']))
    await vi.waitFor(() => expect(mockSocket.sendMock).toHaveBeenCalledTimes(3))
    mockSocket.sendMock.mock.calls[2]?.[0].fail({ errMsg: 'async send failed' })
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'async send failed' }))

    mockSocket.emitMessage({ data: 'text message' })
    expect(messageSpy).toHaveBeenCalledWith(expect.objectContaining({ data: 'text message' }))
    mockSocket.emitError('unknown host failure' as any)
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: undefined }))

    const originalTextEncoder = globalThis.TextEncoder
    const originalDomException = globalThis.DOMException
    try {
      setGlobalValue('TextEncoder', undefined)
      setGlobalValue('DOMException', undefined)
      expect(() => socket.close(2000)).toThrow(/invalid code/u)
      expect(() => socket.close(3000, '中文')).not.toThrow()
    }
    finally {
      setGlobalValue('TextEncoder', originalTextEncoder)
      setGlobalValue('DOMException', originalDomException)
    }
    mockSocket.closeMock.mock.calls[0]?.[0].fail({ errMsg: 'close failed' })
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: 'close failed' }))
    socket.close()
  })

  it('forwards an argument-free websocket close', async () => {
    const mockSocket = createMockSocketTask()
    wpiConnectSocketMock.mockImplementation(() => mockSocket.task)
    const { installRequestGlobals } = await import('../src')
    installRequestGlobals({ targets: ['WebSocket'] })
    setGlobalValue('URL', undefined)
    const socket = new globalThis.WebSocket('wss://request-globals.invalid/default-close')
    mockSocket.emitOpen()
    socket.close()
    expect(mockSocket.closeMock).toHaveBeenCalledWith(expect.objectContaining({
      code: undefined,
      reason: undefined,
    }))
  })
})
