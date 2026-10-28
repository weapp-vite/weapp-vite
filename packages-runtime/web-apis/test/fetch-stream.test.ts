import { EventSourceParserStream } from 'eventsource-parser/stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetch } from '../src/fetch'
import { resetMiniProgramNetworkDefaults, setMiniProgramNetworkDefaults } from '../src/networkDefaults'
import { TextDecoderStreamPolyfill } from '../src/streams'

const request = vi.hoisted(() => vi.fn())
vi.mock('@wevu/api', () => ({ wpi: { request } }))

function createTransport() {
  let options: Record<string, any>
  let headers: ((value: any) => void) | undefined
  let chunk: ((value: { data: ArrayBuffer }) => void) | undefined
  const task = {
    abort: vi.fn(() => options.fail({ errMsg: 'request:fail abort' })),
    onHeadersReceived: vi.fn((listener) => { headers = listener }),
    offHeadersReceived: vi.fn((listener) => {
      if (headers === listener) {
        headers = undefined
      }
    }),
    onChunkReceived: vi.fn((listener) => { chunk = listener }),
    offChunkReceived: vi.fn((listener) => {
      if (chunk === listener) {
        chunk = undefined
      }
    }),
  }
  request.mockImplementation((input) => {
    options = input
    return task
  })
  return {
    task,
    get options() { return options! },
    headers(statusCode: number | undefined = 200) { headers?.({ statusCode, header: { 'content-type': 'text/event-stream' } }) },
    chunk(bytes: Uint8Array) { chunk?.({ data: bytes.slice().buffer }) },
    finish() { options!.success({ data: '', statusCode: 200, header: {} }) },
    fail() { options!.fail({ errMsg: 'request:fail disconnected' }) },
  }
}

beforeEach(() => {
  request.mockReset()
  resetMiniProgramNetworkDefaults()
})
afterEach(() => resetMiniProgramNetworkDefaults())

describe('fetch response streaming', () => {
  it('delivers an actual parser event before the request ends, including split UTF-8', async () => {
    const transport = createTransport()
    setMiniProgramNetworkDefaults({ request: { enableChunked: true } })
    const pending = fetch('https://stream.test/chat', { method: 'POST', headers: { Authorization: 'Bearer fixture' }, body: 'prompt' })
    await vi.waitFor(() => expect(transport.task.onHeadersReceived).toHaveBeenCalledOnce())
    transport.headers()
    const response = await pending
    expect(response.status).toBe(200)
    expect(transport.options).toMatchObject({ method: 'POST', header: { Authorization: 'Bearer fixture' }, enableChunked: true })
    const reader = response.body!.pipeThrough(new TextDecoderStreamPolyfill()).pipeThrough(new EventSourceParserStream()).getReader()
    const event = reader.read()
    const bytes = new TextEncoder().encode('id: first\ndata: 中文🙂\n\n')
    for (const byte of bytes) {
      transport.chunk(new Uint8Array([byte]))
    }
    await expect(event).resolves.toMatchObject({ done: false, value: { id: 'first', data: '中文🙂' } })
    expect(response.bodyUsed).toBe(true)
    transport.finish()
    await expect(reader.read()).resolves.toMatchObject({ done: true })
    expect(transport.task.abort).not.toHaveBeenCalled()
  })

  it.each([204, 205, 304])('returns a null body for HTTP %s', async (status) => {
    const transport = createTransport()
    const pending = fetch('https://stream.test', { miniProgram: { enableChunked: true } })
    await vi.waitFor(() => expect(transport.task.onHeadersReceived).toHaveBeenCalled())
    transport.headers(status)
    expect((await pending).body).toBeNull()
    transport.finish()
  })

  it('does not invent a successful status when early metadata is absent', async () => {
    const transport = createTransport()
    const pending = fetch('https://stream.test', { miniProgram: { enableChunked: true } })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'NotSupportedError' })
    await vi.waitFor(() => expect(transport.task.onHeadersReceived).toHaveBeenCalled())
    // 显式构造缺失字段，避免测试辅助函数的默认参数补成 200。
    transport.task.onHeadersReceived.mock.calls[0]![0]({ header: {} })
    await rejected
    expect(transport.task.abort).toHaveBeenCalledOnce()
  })

  it('rejects missing chunk support and a success callback without early headers', async () => {
    request.mockImplementation(() => ({ abort: vi.fn() }))
    await expect(fetch('https://stream.test', { miniProgram: { enableChunked: true } })).rejects.toMatchObject({ name: 'NotSupportedError' })
    const transport = createTransport()
    const pending = fetch('https://stream.test', { miniProgram: { enableChunked: true } })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'NotSupportedError' })
    await vi.waitFor(() => expect(transport.task.onHeadersReceived).toHaveBeenCalled())
    transport.finish()
    await rejected
  })

  it('does not register a chunk listener after a synchronous terminal headers callback', async () => {
    const transport = createTransport()
    transport.task.onHeadersReceived.mockImplementationOnce((listener) => {
      listener({ header: {} })
    })
    await expect(fetch('https://stream.test', { miniProgram: { enableChunked: true } })).rejects.toMatchObject({ name: 'NotSupportedError' })
    expect(transport.task.onChunkReceived).not.toHaveBeenCalled()
    expect(transport.task.abort).toHaveBeenCalledOnce()
  })

  it.each(['abort', 'disconnect', 'cancel'] as const)('propagates %s after returning Response and detaches listeners', async (mode) => {
    const transport = createTransport()
    const controller = new AbortController()
    const pending = fetch('https://stream.test', { signal: controller.signal, miniProgram: { enableChunked: true } })
    await vi.waitFor(() => expect(transport.task.onHeadersReceived).toHaveBeenCalled())
    transport.headers()
    const response = await pending
    const reader = response.body!.getReader()
    transport.chunk(new Uint8Array([65]))
    await expect(reader.read()).resolves.toMatchObject({ done: false, value: new Uint8Array([65]) })
    if (mode === 'cancel') {
      await reader.cancel()
      await expect(reader.read()).resolves.toMatchObject({ done: true })
    }
    else {
      const read = reader.read()
      const rejected = expect(read).rejects.toMatchObject({ name: mode === 'abort' ? 'AbortError' : 'TypeError' })
      if (mode === 'abort') {
        controller.abort()
      }
      else { transport.fail() }
      await rejected
    }
    transport.chunk(new Uint8Array([66]))
    transport.finish()
    expect(transport.task.offChunkReceived).toHaveBeenCalledOnce()
    expect(transport.task.offHeadersReceived).toHaveBeenCalledOnce()
  })

  it('keeps HTTP error statuses readable instead of treating them as network failures', async () => {
    const transport = createTransport()
    const pending = fetch('https://stream.test', { miniProgram: { enableChunked: true } })
    await vi.waitFor(() => expect(transport.task.onHeadersReceived).toHaveBeenCalled())
    transport.headers(429)
    const response = await pending
    expect(response.ok).toBe(false)
    const text = response.text()
    transport.chunk(new TextEncoder().encode('retry later'))
    transport.finish()
    await expect(text).resolves.toBe('retry later')
  })
})

it('cancels native Request body preparation before starting a network request', async () => {
  const cancellation = vi.fn()
  const body = new ReadableStream<Uint8Array>({ cancel: cancellation })
  const input = new Request('https://stream.test/upload', { method: 'POST', body, duplex: 'half' } as RequestInit)
  const controller = new AbortController()
  const pending = fetch(input, { signal: controller.signal })
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  await vi.waitFor(() => expect(cancellation).toHaveBeenCalledOnce())
  expect(request).not.toHaveBeenCalled()
})

it('rejects a pre-aborted request before reading its input body', async () => {
  const controller = new AbortController()
  controller.abort()
  const input = new Request('https://stream.test/upload', { method: 'POST', body: 'input' })
  await expect(fetch(input, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  expect(input.bodyUsed).toBe(false)
  expect(request).not.toHaveBeenCalled()
})
