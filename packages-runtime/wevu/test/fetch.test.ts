import type {
  WeapiMiniProgramRequestSuccessResult,
  WeapiMiniProgramRequestTask,
} from '@wevu/api'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetch } from '@/fetch'

interface MockRequestOptions {
  url?: string
  method?: string
  header?: Record<string, string>
  data?: unknown
  responseType?: 'text' | 'arraybuffer'
  success?: (res: WeapiMiniProgramRequestSuccessResult) => void
  fail?: (error: unknown) => void
}

const { requestMock } = vi.hoisted(() => ({
  requestMock: vi.fn<(options: MockRequestOptions) => WeapiMiniProgramRequestTask | undefined>(),
}))

vi.mock('@wevu/api', () => ({
  wpi: {
    request: requestMock,
  },
}))

function encodeJson(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).buffer
}

describe('wevu/fetch', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('resolves Response and keeps fetch status semantics', async () => {
    requestMock.mockImplementation((options) => {
      options.success?.({
        data: encodeJson({ ok: true }),
        statusCode: 201,
        header: {
          'content-type': 'application/json',
          'x-trace-id': 'trace-1',
        },
      } as unknown as WeapiMiniProgramRequestSuccessResult)
      return {
        abort: vi.fn(),
      } as unknown as WeapiMiniProgramRequestTask
    })

    const response = await fetch('https://example.com/user', {
      method: 'POST',
      headers: {
        'x-token': 'abc',
      },
      body: 'hello',
    })

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://example.com/user',
      method: 'POST',
      responseType: 'arraybuffer',
      header: expect.objectContaining({
        'x-token': 'abc',
        'content-type': 'text/plain;charset=UTF-8',
      }),
      data: 'hello',
    }))
    expect(response.status).toBe(201)
    expect(response.ok).toBe(true)
    expect(response.headers.get('x-trace-id')).toBe('trace-1')
    await expect(response.json()).resolves.toEqual({ ok: true })
  })

  it('does not reject on non-2xx status', async () => {
    requestMock.mockImplementation((options) => {
      options.success?.({
        data: new TextEncoder().encode('not found').buffer,
        statusCode: 404,
        header: {},
      } as WeapiMiniProgramRequestSuccessResult)
      return {
        abort: vi.fn(),
      } as unknown as WeapiMiniProgramRequestTask
    })

    const response = await fetch('https://example.com/not-found')

    expect(response.ok).toBe(false)
    expect(response.status).toBe(404)
    await expect(response.text()).resolves.toBe('not found')
  })

  it('rejects TypeError on request failure', async () => {
    requestMock.mockImplementation((options) => {
      options.fail?.({
        errMsg: 'request:fail timeout',
      })
      return {
        abort: vi.fn(),
      } as unknown as WeapiMiniProgramRequestTask
    })

    await expect(fetch('https://example.com/fail')).rejects.toMatchObject({
      name: 'TypeError',
      message: 'request:fail timeout',
    })
  })

  it('supports AbortSignal cancellation', async () => {
    const abortSpy = vi.fn()
    requestMock.mockImplementation(() => {
      return {
        abort: abortSpy,
      } as unknown as WeapiMiniProgramRequestTask
    })

    const controller = new AbortController()
    const pending = fetch('https://example.com/slow', {
      signal: controller.signal,
    })
    await vi.waitFor(() => {
      expect(requestMock).toHaveBeenCalledTimes(1)
    })
    controller.abort()

    await expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(abortSpy).toHaveBeenCalledTimes(1)
  })

  it('rejects without dispatching request when signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(fetch('https://example.com/aborted', {
      signal: controller.signal,
    })).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(requestMock).not.toHaveBeenCalled()
  })

  it('rejects GET body like standard fetch', async () => {
    await expect(fetch('https://example.com/get', {
      method: 'GET',
      body: 'x=1',
    })).rejects.toThrow('GET/HEAD request cannot have body')
    expect(requestMock).not.toHaveBeenCalled()
  })
})
