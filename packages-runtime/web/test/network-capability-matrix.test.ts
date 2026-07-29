import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetWebRuntimeHost, setWebRuntimeHost } from '../src/runtime/host'
import { writeFileSyncInternal } from '../src/runtime/polyfill/files'
import {
  buildRequestBody,
  buildRequestUrl,
  collectResponseHeaders,
  createBlobObjectUrl,
  normalizeRequestHeaders,
  normalizeRequestMethod,
  parseRequestResponseData,
  performDownloadByFetch,
  performRequestByFetch,
  performUploadByFetch,
  stripUploadContentType,
} from '../src/runtime/polyfill/network/request'

function createResponse(body: BodyInit | null, init?: ResponseInit) {
  return new Response(body, init)
}

describe('web network capability matrix', () => {
  afterEach(() => {
    resetWebRuntimeHost()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('normalizes request methods, headers, query strings and bodies', () => {
    expect(normalizeRequestMethod()).toBe('GET')
    expect(normalizeRequestMethod('post')).toBe('POST')
    expect(normalizeRequestHeaders()).toEqual({})
    const originalHeaders = { Accept: 'text/plain' }
    const clonedHeaders = normalizeRequestHeaders(originalHeaders)
    expect(clonedHeaders).toEqual(originalHeaders)
    expect(clonedHeaders).not.toBe(originalHeaders)

    expect(buildRequestUrl('/items', 'POST', { page: 1 })).toBe('/items')
    expect(buildRequestUrl('/items', 'GET', null)).toBe('/items')
    expect(buildRequestUrl('/items', 'GET', '')).toBe('/items')
    expect(buildRequestUrl('/items', 'GET', 'page=1')).toBe('/items?page=1')
    expect(buildRequestUrl('/items?sort=name', 'GET', 'page=1')).toBe('/items?sort=name&page=1')
    expect(buildRequestUrl('/items', 'GET', new URLSearchParams())).toBe('/items')
    expect(buildRequestUrl('/items', 'GET', new URLSearchParams({ page: '2' }))).toBe('/items?page=2')
    expect(buildRequestUrl('/items?sort=name', 'GET', new URLSearchParams({ page: '2' })))
      .toBe('/items?sort=name&page=2')
    expect(buildRequestUrl('/items', 'GET', {})).toBe('/items')
    expect(buildRequestUrl('/items', 'GET', { page: 3, filter: null })).toBe('/items?page=3&filter=')
    expect(buildRequestUrl('/items?sort=name', 'GET', { page: 3 })).toBe('/items?sort=name&page=3')
    expect(buildRequestUrl('/items', 'GET', 1)).toBe('/items')

    expect(buildRequestBody('GET', { page: 1 }, {})).toBeUndefined()
    expect(buildRequestBody('POST', null, {})).toBeUndefined()
    expect(buildRequestBody('POST', 'raw', {})).toBe('raw')
    const searchParams = new URLSearchParams({ page: '1' })
    expect(buildRequestBody('POST', searchParams, {})).toBe(searchParams)
    const formData = new FormData()
    expect(buildRequestBody('POST', formData, {})).toBe(formData)
    const jsonHeaders: Record<string, string> = {}
    expect(buildRequestBody('POST', { ready: true }, jsonHeaders)).toBe('{"ready":true}')
    expect(jsonHeaders).toEqual({ 'content-type': 'application/json' })
    expect(buildRequestBody('POST', { ready: true }, { 'Content-Type': 'application/json;charset=utf-8' }))
      .toBe('{"ready":true}')
    expect(buildRequestBody('POST', 42, { 'CONTENT-TYPE': 'text/plain' })).toBe('42')
  })

  it('parses request responses and response headers', async () => {
    const binary = createResponse(new Uint8Array([1, 2]))
    await expect(parseRequestResponseData(binary, { responseType: 'arraybuffer' }))
      .resolves
      .toEqual(new Uint8Array([1, 2]).buffer)
    await expect(parseRequestResponseData(createResponse('plain'), { dataType: 'text' })).resolves.toBe('plain')
    await expect(
      parseRequestResponseData(createResponse('{"ok":true}'), { dataType: 'json' }),
    ).resolves.toEqual({ ok: true })
    await expect(parseRequestResponseData(createResponse('{"ok":true}', {
      headers: { 'content-type': 'application/json;charset=utf-8' },
    }))).resolves.toEqual({ ok: true })
    await expect(
      parseRequestResponseData(createResponse('fallback')),
    ).resolves.toBe('fallback')
    await expect(parseRequestResponseData({
      headers: { get: () => null },
      text: async () => 'missing-content-type',
    } as unknown as Response)).resolves.toBe('missing-content-type')

    expect(collectResponseHeaders(createResponse('', {
      headers: { 'x-first': 'one', 'x-second': 'two' },
    }))).toMatchObject({ 'x-first': 'one', 'x-second': 'two' })
    expect(stripUploadContentType({
      'Accept': 'text/plain',
      'Content-Type': 'multipart/form-data',
      'content-TYPE': 'application/json',
    })).toEqual({ Accept: 'text/plain' })
  })

  it('creates blob URLs when supported and returns an empty fallback otherwise', () => {
    const blob = new Blob(['file'])
    const createObjectURL = vi.fn(() => 'blob:download')
    vi.stubGlobal('URL', { createObjectURL })
    expect(createBlobObjectUrl(blob)).toBe('blob:download')
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    vi.stubGlobal('URL', {})
    expect(createBlobObjectUrl(blob)).toBe('')
    vi.stubGlobal('URL', undefined)
    expect(createBlobObjectUrl(blob)).toBe('')
  })

  it('performs request fetches with query, body, headers and timeout cleanup', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(async () => createResponse('{"ok":true}', {
      status: 201,
      headers: { 'content-type': 'application/json', 'x-result': 'ready' },
    }))
    setWebRuntimeHost({ fetch })

    await expect(performRequestByFetch({
      url: ' /items ',
      data: { page: 1 },
      timeout: 10,
    })).resolves.toEqual({
      data: { ok: true },
      statusCode: 201,
      header: { 'content-type': 'application/json', 'x-result': 'ready' },
    })
    expect(fetch).toHaveBeenCalledWith('/items?page=1', expect.objectContaining({
      body: undefined,
      method: 'GET',
      signal: expect.any(AbortSignal),
    }))
    expect(vi.getTimerCount()).toBe(0)

    await expect(performRequestByFetch({
      url: '/items',
      method: 'post',
      header: { Accept: 'application/json' },
      data: { name: 'web' },
    })).resolves.toMatchObject({ statusCode: 201 })
    expect(fetch).toHaveBeenLastCalledWith('/items', expect.objectContaining({
      body: '{"name":"web"}',
      headers: { 'Accept': 'application/json', 'content-type': 'application/json' },
      method: 'POST',
    }))
  })

  it('rejects invalid requests, unavailable fetch and aborted requests', async () => {
    await expect(performRequestByFetch()).rejects.toThrow('invalid url')
    vi.stubGlobal('fetch', undefined)
    await expect(performRequestByFetch({ url: '/items' })).rejects.toThrow('fetch is unavailable')

    vi.useFakeTimers()
    const fetch = vi.fn<typeof globalThis.fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    setWebRuntimeHost({ fetch })
    const pending = performRequestByFetch({ url: '/slow', timeout: 5 })
    const rejection = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(5)
    await rejection
    expect(vi.getTimerCount()).toBe(0)

    vi.stubGlobal('AbortController', undefined)
    setWebRuntimeHost({ fetch: vi.fn(async () => createResponse('ok')) })
    await expect(performRequestByFetch({ url: '/without-abort', timeout: 5 })).resolves.toMatchObject({ data: 'ok' })
  })

  it('downloads blobs with object URL and source URL fallbacks', async () => {
    await expect(performDownloadByFetch()).rejects.toThrow('invalid url')
    vi.stubGlobal('fetch', undefined)
    await expect(performDownloadByFetch({ url: '/file' })).rejects.toThrow('fetch is unavailable')

    const fetch = vi.fn(async () => createResponse('download', { status: 206 }))
    setWebRuntimeHost({ fetch })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:file') })
    await expect(performDownloadByFetch({
      url: ' /file ',
      header: { Range: 'bytes=0-2' },
      timeout: 10,
    })).resolves.toEqual({ tempFilePath: 'blob:file', statusCode: 206 })
    expect(fetch).toHaveBeenCalledWith('/file', expect.objectContaining({
      headers: { Range: 'bytes=0-2' },
      method: 'GET',
    }))

    vi.stubGlobal('URL', {})
    await expect(performDownloadByFetch({ url: '/fallback' })).resolves.toEqual({
      tempFilePath: '/fallback',
      statusCode: 206,
    })
  })

  it('uploads memory and remote files with normalized multipart fields', async () => {
    await expect(performUploadByFetch()).rejects.toThrow('invalid url')
    await expect(performUploadByFetch({ url: '/upload' })).rejects.toThrow('invalid filePath')
    vi.stubGlobal('fetch', undefined)
    await expect(performUploadByFetch({ url: '/upload', filePath: '/file' })).rejects.toThrow('fetch is unavailable')

    const fetch = vi.fn<typeof globalThis.fetch>(async () => createResponse('uploaded', {
      status: 202,
      headers: { 'x-upload': 'done' },
    }))
    setWebRuntimeHost({ fetch })
    vi.stubGlobal('FormData', undefined)
    await expect(performUploadByFetch({ url: '/upload', filePath: '/file' })).rejects.toThrow('FormData is unavailable')
    vi.unstubAllGlobals()

    const filePath = '/__web_network_matrix__/report.txt'
    writeFileSyncInternal(filePath, 'content')
    await expect(performUploadByFetch({
      url: ' /upload ',
      filePath: ` ${filePath} `,
      header: { 'Content-Type': 'multipart/form-data', 'x-token': 'token' },
      formData: { count: 2, empty: null },
      name: ' attachment ',
      timeout: 10,
    })).resolves.toMatchObject({
      data: 'uploaded',
      statusCode: 202,
      header: { 'x-upload': 'done' },
    })
    const uploadInit = fetch.mock.calls[0]?.[1]
    expect(uploadInit).toMatchObject({
      headers: { 'x-token': 'token' },
      method: 'POST',
    })
    const body = uploadInit?.body as FormData
    expect(body.get('count')).toBe('2')
    expect(body.get('empty')).toBe('')
    expect(body.get('attachment')).toBeInstanceOf(Blob)

    fetch.mockResolvedValueOnce(createResponse('remote-file'))
    fetch.mockResolvedValueOnce(createResponse('uploaded-again', { status: 200 }))
    await expect(performUploadByFetch({
      url: '/upload',
      filePath: 'https://example.com/archive.bin?version=1',
    })).resolves.toMatchObject({ data: 'uploaded-again', statusCode: 200 })
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://example.com/archive.bin?version=1', { method: 'GET' })
    const remoteBody = fetch.mock.calls[2]?.[1]?.body as FormData
    expect(remoteBody.get('file')).toBeInstanceOf(Blob)
  })

  it('falls back to a text upload when remote file resolution fails', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(createResponse('uploaded'))
    setWebRuntimeHost({ fetch })
    await expect(performUploadByFetch({
      url: '/upload',
      filePath: 'blob:missing',
    })).resolves.toMatchObject({ data: 'uploaded' })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('maps navigator connection types and binds status listeners once', async () => {
    vi.resetModules()
    const listeners = new Map<string, () => void>()
    const addEventListener = vi.fn((type: string, listener: () => void) => listeners.set(type, listener))
    const connectionListeners = new Map<string, () => void>()
    const connection = {
      type: 'wifi',
      effectiveType: '',
      addEventListener: vi.fn((type: string, listener: () => void) => connectionListeners.set(type, listener)),
    }
    const navigatorValue: Record<string, any> = { onLine: true, connection }
    vi.stubGlobal('navigator', navigatorValue)
    vi.stubGlobal('addEventListener', addEventListener)
    const network = await import('../src/runtime/polyfill/network/status')

    expect(network.getNavigatorConnection()).toBe(connection)
    expect(network.readNetworkStatusSnapshot()).toEqual({ isConnected: true, networkType: 'wifi' })
    connection.type = 'ethernet'
    expect(network.readNetworkStatusSnapshot().networkType).toBe('wifi')
    connection.type = 'cellular'
    for (const [effectiveType, expected] of [
      ['5g', '5g'],
      ['4g', '4g'],
      ['3g', '3g'],
      ['2g', '2g'],
      ['slow-2g', '2g'],
      ['', 'unknown'],
    ]) {
      connection.effectiveType = effectiveType
      expect(network.readNetworkStatusSnapshot().networkType).toBe(expected)
    }
    connection.type = 'other'
    expect(network.readNetworkStatusSnapshot().networkType).toBe('unknown')
    navigatorValue.onLine = false
    expect(network.readNetworkStatusSnapshot()).toEqual({ isConnected: false, networkType: 'none' })

    const first = vi.fn()
    const second = vi.fn()
    network.addNetworkStatusCallback(first)
    network.addNetworkStatusCallback(second)
    expect(addEventListener).toHaveBeenCalledTimes(2)
    expect(connection.addEventListener).toHaveBeenCalledTimes(1)
    listeners.get('offline')?.()
    expect(first).toHaveBeenCalledWith({ isConnected: false, networkType: 'none' })
    expect(second).toHaveBeenCalledTimes(1)
    network.removeNetworkStatusCallback(first)
    navigatorValue.onLine = true
    connection.effectiveType = '4g'
    connectionListeners.get('change')?.()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenLastCalledWith({ isConnected: true, networkType: '4g' })
    network.removeNetworkStatusCallback()
    listeners.get('online')?.()
    expect(second).toHaveBeenCalledTimes(2)
  })

  it('resolves navigator connection fallbacks and missing browser globals', async () => {
    vi.resetModules()
    vi.stubGlobal('navigator', { onLine: true, mozConnection: { effectiveType: '3G' } })
    let network = await import('../src/runtime/polyfill/network/status')
    expect(network.getNavigatorConnection()).toEqual({ effectiveType: '3G' })
    expect(network.readNetworkStatusSnapshot()).toEqual({ isConnected: true, networkType: '3g' })

    vi.resetModules()
    vi.stubGlobal('navigator', { webkitConnection: { effectiveType: '2g' } })
    network = await import('../src/runtime/polyfill/network/status')
    expect(network.getNavigatorConnection()).toEqual({ effectiveType: '2g' })
    expect(network.readNetworkStatusSnapshot()).toEqual({ isConnected: true, networkType: '2g' })

    vi.resetModules()
    vi.stubGlobal('navigator', undefined)
    vi.stubGlobal('addEventListener', undefined)
    network = await import('../src/runtime/polyfill/network/status')
    expect(network.getNavigatorConnection()).toBeUndefined()
    expect(network.readNetworkStatusSnapshot()).toEqual({ isConnected: true, networkType: 'unknown' })
    const callback = vi.fn()
    network.addNetworkStatusCallback(callback)
    network.addNetworkStatusCallback(callback)
    network.removeNetworkStatusCallback(undefined)
  })
})
