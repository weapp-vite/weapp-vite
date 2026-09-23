import type { ClientRequest, IncomingMessage } from 'node:http'
import { EventEmitter } from 'node:events'
import https from 'node:https'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLatestVersionFromNpm, getPackageVersionsFromNpm, latestVersion } from '../src/npm'

function createRequestHarness() {
  const request = Object.assign(new EventEmitter(), { destroy: vi.fn() })
  let onResponse: (response: IncomingMessage) => void
  const get = vi.spyOn(https, 'get').mockImplementation(((_url, _options, callback) => {
    onResponse = callback!
    return request as unknown as ClientRequest
  }) as typeof https.get)

  function respond(data: string, statusCode: number | undefined = 200) {
    const response = Object.assign(new EventEmitter(), {
      statusCode,
      resume: vi.fn(),
      setEncoding: vi.fn(),
    })
    onResponse(response as unknown as IncomingMessage)
    if (statusCode && statusCode >= 200 && statusCode < 300) {
      response.emit('data', data)
      response.emit('end')
    }
    return response
  }

  function startResponse() {
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200,
      resume: vi.fn(),
      setEncoding: vi.fn(),
    })
    onResponse(response as unknown as IncomingMessage)
    return response
  }

  return { request, get, respond, startResponse }
}

describe('official npm metadata requests', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('requests scoped packages from the official registry with abbreviated metadata', async () => {
    const { get, respond, request } = createRequestHarness()
    const result = getPackageVersionsFromNpm('@weapp-vite/dashboard')
    respond(JSON.stringify({ versions: { '7.1.4': {}, '7.2.0': {} } }))
    await expect(result).resolves.toEqual(['7.1.4', '7.2.0'])
    expect(get).toHaveBeenCalledWith(
      'https://registry.npmjs.org/%40weapp-vite%2Fdashboard',
      { headers: { Accept: 'application/vnd.npm.install-v1+json' } },
      expect.any(Function),
    )
    expect(request.destroy).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([301, 404, 503])('rejects HTTP %s without following another registry', async (status) => {
    const { respond, request } = createRequestHarness()
    const result = getPackageVersionsFromNpm('weapp-vite')
    const response = respond('', status)
    await expect(result).rejects.toThrow(`status ${status}`)
    expect(response.resume).toHaveBeenCalledOnce()
    expect(request.destroy).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects invalid JSON and destroys the failed request', async () => {
    const { respond, request } = createRequestHarness()
    const result = getPackageVersionsFromNpm('weapp-vite')
    respond('{invalid')
    await expect(result).rejects.toThrow()
    expect(request.destroy).toHaveBeenCalledOnce()
  })

  it.each([null, [], {}, { versions: [] }, { versions: '7.2.0' }])('rejects malformed version metadata %j', async (metadata) => {
    const { respond } = createRequestHarness()
    const result = getPackageVersionsFromNpm('weapp-vite')
    respond(JSON.stringify(metadata))
    await expect(result).rejects.toThrow('missing versions')
  })

  it('destroys requests on connection errors', async () => {
    const { request } = createRequestHarness()
    const result = getPackageVersionsFromNpm('weapp-vite')
    request.emit('error', new Error('connection failed'))
    await expect(result).rejects.toThrow('connection failed')
    expect(request.destroy).toHaveBeenCalledOnce()
  })

  it.each(['error', 'aborted'])('rejects interrupted response streams (%s)', async (event) => {
    const { startResponse, request } = createRequestHarness()
    const result = getPackageVersionsFromNpm('weapp-vite')
    startResponse().emit(event, new Error('stream failed'))
    await expect(result).rejects.toThrow(event === 'error' ? 'stream failed' : 'aborted')
    expect(request.destroy).toHaveBeenCalledOnce()
  })

  it('bounds a stalled request and destroys its socket after five seconds', async () => {
    const { request } = createRequestHarness()
    const result = getPackageVersionsFromNpm('weapp-vite')
    const rejected = expect(result).rejects.toThrow('timed out after 5000ms')
    await vi.advanceTimersByTimeAsync(5_000)
    await rejected
    expect(request.destroy).toHaveBeenCalledWith(expect.any(Error))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('counts streaming time toward the request deadline', async () => {
    const { request, startResponse } = createRequestHarness()
    const result = getPackageVersionsFromNpm('weapp-vite')
    const rejected = expect(result).rejects.toThrow('timed out')
    const response = startResponse()
    response.emit('data', '{')
    await vi.advanceTimersByTimeAsync(4_999)
    expect(request.destroy).not.toHaveBeenCalled()
    response.emit('data', '"versions":')
    await vi.advanceTimersByTimeAsync(1)
    await rejected
    expect(request.destroy).toHaveBeenCalledOnce()
  })

  it('cancels in-flight requests through the shared AbortSignal', async () => {
    const { request } = createRequestHarness()
    const controller = new AbortController()
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener')
    const result = getPackageVersionsFromNpm('weapp-vite', controller.signal)
    controller.abort(new Error('group deadline'))
    await expect(result).rejects.toThrow('group deadline')
    expect(request.destroy).toHaveBeenCalledOnce()
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not open a socket for an already aborted group', async () => {
    const { get } = createRequestHarness()
    const controller = new AbortController()
    controller.abort(new Error('cancelled before request'))
    await expect(getPackageVersionsFromNpm('weapp-vite', controller.signal)).rejects.toThrow('cancelled before request')
    expect(get).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('removes abort listeners after a successful response', async () => {
    const { respond, request } = createRequestHarness()
    const controller = new AbortController()
    const result = getPackageVersionsFromNpm('weapp-vite', controller.signal)
    respond('{"versions":{}}')
    await result
    controller.abort()
    expect(request.destroy).not.toHaveBeenCalled()
  })

  it('cleans up timers when creating the request throws', async () => {
    vi.spyOn(https, 'get').mockImplementation(() => {
      throw new Error('invalid request')
    })
    await expect(getPackageVersionsFromNpm('weapp-vite')).rejects.toThrow('invalid request')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('preserves the latest-version API', async () => {
    const { get, respond } = createRequestHarness()
    const result = getLatestVersionFromNpm('weapp-tailwindcss')
    respond('{"version":"4.0.0"}')
    await expect(result).resolves.toBe('4.0.0')
    expect(get.mock.calls[0]?.[0]).toBe('https://registry.npmjs.org/weapp-tailwindcss/latest')
  })

  it.each([{}, { version: 7 }, { version: '' }])('rejects malformed latest metadata %j', async (metadata) => {
    const { respond } = createRequestHarness()
    const result = getLatestVersionFromNpm('weapp-tailwindcss')
    respond(JSON.stringify(metadata))
    await expect(result).rejects.toThrow('missing version')
  })

  it('preserves latestVersion prefixes and null fallback', async () => {
    await expect(latestVersion('example', '~', async () => '1.2.3')).resolves.toBe('~1.2.3')
    await expect(latestVersion('example', '^', async () => '')).resolves.toBeNull()
    await expect(latestVersion('example', '^', async () => {
      throw new Error('offline')
    })).resolves.toBeNull()
  })
})
