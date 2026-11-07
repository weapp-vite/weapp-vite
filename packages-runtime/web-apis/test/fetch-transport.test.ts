import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendFetchRequest } from '../src/fetch/transport'

const request = vi.hoisted(() => vi.fn())
vi.mock('@wevu/api', () => ({ wpi: { request } }))

type RequestMeta = Parameters<typeof sendFetchRequest>[0]
type HeadersListener = (value: { statusCode: number, header: Record<string, string> }) => void
type ChunkListener = (value: { data: ArrayBuffer }) => void

function meta(overrides: Partial<RequestMeta> = {}): RequestMeta {
  return { url: 'https://example.test/stream', method: 'GET', headers: {}, body: undefined, signal: null, miniProgram: { enableChunked: true }, ...overrides }
}

function transport() {
  let callbacks!: { success: (value: unknown) => void, fail: (error: unknown) => void }
  let headers!: HeadersListener
  let chunk!: ChunkListener
  const task = {
    abort: vi.fn(),
    onHeadersReceived: vi.fn((listener: HeadersListener) => { headers = listener }),
    offHeadersReceived: vi.fn(),
    onChunkReceived: vi.fn((listener: ChunkListener) => { chunk = listener }),
    offChunkReceived: vi.fn(),
  }
  request.mockImplementation((input) => {
    callbacks = input
    return task
  })
  return {
    task,
    headers(statusCode = 200) { headers({ statusCode, header: { 'content-type': 'text/plain' } }) },
    chunk() { chunk({ data: new Uint8Array([65]).buffer }) },
    finish() { callbacks.success({ data: new ArrayBuffer(0), statusCode: 200, header: {} }) },
    fail() { callbacks.fail({ errMsg: 'connection lost' }) },
  }
}

beforeEach(() => {
  request.mockReset()
})

describe('fetch transport callback ownership', () => {
  it('rejects a signal aborted after preparation without opening a transport', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled before transport')
    controller.abort(reason)
    await expect(sendFetchRequest(meta({ signal: controller.signal }))).rejects.toBe(reason)
    expect(request).not.toHaveBeenCalled()
  })

  it('ignores duplicate headers and late callbacks after a successful response', async () => {
    const value = transport()
    const pending = sendFetchRequest(meta())
    value.headers(201)
    value.headers(500)
    const response = await pending
    const text = response.text()
    value.chunk()
    value.finish()
    value.headers(500)
    value.chunk()
    value.fail()
    await expect(text).resolves.toBe('A')
    expect(response.status).toBe(201)
    expect(value.task.abort).not.toHaveBeenCalled()
    expect(value.task.offHeadersReceived).toHaveBeenCalledOnce()
    expect(value.task.offChunkReceived).toHaveBeenCalledOnce()
  })

  it('rejects a chunk before headers and ignores callbacks after termination', async () => {
    const value = transport()
    const pending = sendFetchRequest(meta())
    const rejected = expect(pending).rejects.toMatchObject({ name: 'NotSupportedError', message: expect.stringContaining('headers before chunks') })
    value.chunk()
    value.headers()
    value.chunk()
    value.finish()
    await rejected
    expect(value.task.abort).toHaveBeenCalledOnce()
  })

  it('ignores response chunks for HEAD before and after headers', async () => {
    const value = transport()
    const pending = sendFetchRequest(meta({ method: 'HEAD' }))
    value.chunk()
    value.headers()
    value.chunk()
    value.finish()
    expect((await pending).body).toBeNull()
    expect(value.task.abort).not.toHaveBeenCalled()
  })

  it('cleans up a synchronous failure while registering the chunk listener', async () => {
    const value = transport()
    value.task.onChunkReceived.mockImplementationOnce(() => value.fail())
    await expect(sendFetchRequest(meta())).rejects.toThrow('connection lost')
    expect(value.task.abort).toHaveBeenCalledOnce()
    expect(value.task.offHeadersReceived).toHaveBeenCalled()
    expect(value.task.offChunkReceived).toHaveBeenCalled()
  })

  it('defers task abort when the signal fires synchronously inside request creation', async () => {
    const controller = new AbortController()
    const reason = new Error('cancelled while creating transport')
    const abort = vi.fn()
    request.mockImplementation(() => {
      controller.abort(reason)
      return { abort }
    })
    await expect(sendFetchRequest(meta({ signal: controller.signal }))).rejects.toBe(reason)
    expect(abort).toHaveBeenCalledOnce()
  })

  it('rechecks a legacy signal whose aborted state changes during startup', async () => {
    const value = transport()
    const signal = {
      get aborted() { return request.mock.calls.length > 0 },
      reason: undefined,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }
    await expect(sendFetchRequest(meta({ signal: signal as unknown as AbortSignal }))).rejects.toMatchObject({ name: 'AbortError' })
    expect(value.task.abort).toHaveBeenCalledOnce()
    expect(signal.removeEventListener).toHaveBeenCalledWith('abort', expect.any(Function))
  })

  it('preserves synchronous host exceptions and removes the abort subscription', async () => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const failure = new Error('host request unavailable')
    request.mockImplementation(() => {
      throw failure
    })
    await expect(sendFetchRequest(meta({ signal: controller.signal }))).rejects.toBe(failure)
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
    remove.mockRestore()
  })
})
