import { wpi } from '@wevu/api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMockRequest, restoreMockRequest } from '../../apps/wevu-runtime-demo/src/pages/request-globals/shared'
import { fetch } from '../../packages-runtime/web-apis/src/fetch'

const requestLog = vi.fn()
const graphqlResponse = { data: { transport: { client: 'graphql-request', source: 'request-globals' } } }

function startRequest() {
  const events: string[] = []
  const success = vi.fn((_result: WechatMiniprogram.RequestSuccessCallbackResult) => {
    events.push('success')
  })
  const fail = vi.fn((_error: WechatMiniprogram.RequestFailCallbackErr) => {
    events.push('fail')
  })
  const complete = vi.fn(() => {
    events.push('complete')
  })
  const task = wx.request({
    url: 'https://request-globals.invalid/graphql',
    enableChunked: true,
    success,
    fail,
    complete,
  })
  return { task, events, success, fail, complete }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.stubGlobal('wx', { request: vi.fn() })
  wpi.setAdapter(undefined)
  requestLog.mockReset()
  installMockRequest(requestLog)
})

afterEach(() => {
  restoreMockRequest()
  wpi.setAdapter(undefined)
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('request globals fixture RequestTask contract', () => {
  it('emits headers, UTF-8 bytes and one successful terminal pair in order', async () => {
    const request = startRequest()
    const headers = vi.fn((value: WechatMiniprogram.RequestTaskOnHeadersReceivedListenerResult) => {
      request.events.push('headers')
      expect(value).toMatchObject({ statusCode: 200, header: { 'content-type': 'application/json' } })
    })
    const chunks: string[] = []
    request.task.onHeadersReceived(headers)
    request.task.onChunkReceived(({ data }) => {
      request.events.push('chunk')
      expect(data).toBeInstanceOf(ArrayBuffer)
      chunks.push(new TextDecoder().decode(data))
    })
    await vi.runAllTimersAsync()
    request.task.abort()
    request.task.abort()
    expect(request.events).toEqual(['headers', 'chunk', 'success', 'complete'])
    expect(headers).toHaveBeenCalledOnce()
    expect(chunks).toEqual([JSON.stringify(graphqlResponse)])
    expect(request.success).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ data: chunks[0] }))
    expect(request.fail).not.toHaveBeenCalled()
    expect(request.complete).toHaveBeenCalledOnce()
  })

  it.each(['specific', 'all'] as const)('removes %s headers and chunk listeners', async (mode) => {
    const request = startRequest()
    const removedHeaders = vi.fn()
    const keptHeaders = vi.fn()
    const removedChunk = vi.fn()
    const keptChunk = vi.fn()
    request.task.onHeadersReceived(removedHeaders)
    request.task.onHeadersReceived(keptHeaders)
    request.task.onChunkReceived(removedChunk)
    request.task.onChunkReceived(keptChunk)
    if (mode === 'specific') {
      request.task.offHeadersReceived(removedHeaders)
      request.task.offChunkReceived(removedChunk)
    }
    else {
      request.task.offHeadersReceived()
      request.task.offChunkReceived()
    }
    await vi.runAllTimersAsync()
    expect(removedHeaders).not.toHaveBeenCalled()
    expect(removedChunk).not.toHaveBeenCalled()
    expect(keptHeaders).toHaveBeenCalledTimes(mode === 'specific' ? 1 : 0)
    expect(keptChunk).toHaveBeenCalledTimes(mode === 'specific' ? 1 : 0)
    expect(request.events).toEqual(['success', 'complete'])
  })

  it.each(['before', 'headers', 'chunk'] as const)('stops delivery when aborted at %s', async (phase) => {
    const request = startRequest()
    const abort = () => {
      request.task.abort()
      request.task.abort()
    }
    request.task.onHeadersReceived(() => {
      request.events.push('headers')
      if (phase === 'headers') {
        abort()
      }
    })
    request.task.onChunkReceived(() => {
      request.events.push('chunk')
      if (phase === 'chunk') {
        abort()
      }
    })
    if (phase === 'before') {
      abort()
    }
    await vi.runAllTimersAsync()
    abort()
    const delivered = { before: [], headers: ['headers'], chunk: ['headers', 'chunk'] }[phase]
    expect(request.events).toEqual([...delivered, 'fail', 'complete'])
    expect(request.success).not.toHaveBeenCalled()
    expect(request.fail).toHaveBeenCalledExactlyOnceWith({ errMsg: 'request:fail abort' })
    expect(request.complete).toHaveBeenCalledOnce()
  })

  it('lets the actual fetch consume a chunked JSON body exactly once', async () => {
    const pending = fetch('https://request-globals.invalid/graphql', {
      method: 'POST',
      miniProgram: { enableChunked: true, timeout: 4800 },
    })
    await vi.runAllTimersAsync()
    const response = await pending
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(JSON.stringify(graphqlResponse))
    expect(response.bodyUsed).toBe(true)
    await expect(response.text()).rejects.toBeInstanceOf(TypeError)
    expect(requestLog).toHaveBeenCalledExactlyOnceWith('POST https://request-globals.invalid/graphql timeout=4800 enableChunked=true')
  })

  it('keeps the buffered fetch path readable', async () => {
    const pending = fetch('https://request-globals.invalid/fetch')
    await vi.runAllTimersAsync()
    const response = await pending
    expect(await response.json()).toEqual({ transport: 'fetch', source: 'request-globals', echo: null })
    expect(requestLog).toHaveBeenCalledOnce()
  })
})
