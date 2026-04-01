import { beforeEach, describe, expect, it, vi } from 'vitest'

const wevuFetchMock = vi.hoisted(() => vi.fn())

vi.mock('wevu/fetch', () => ({
  fetch: wevuFetchMock,
}))

describe('request globals runtime', () => {
  beforeEach(() => {
    wevuFetchMock.mockReset()
    delete (globalThis as Record<string, any>).fetch
    delete (globalThis as Record<string, any>).Headers
    delete (globalThis as Record<string, any>).Request
    delete (globalThis as Record<string, any>).Response
    delete (globalThis as Record<string, any>).AbortController
    delete (globalThis as Record<string, any>).AbortSignal
    delete (globalThis as Record<string, any>).XMLHttpRequest
  })

  it('installs missing globals without overwriting existing ones', async () => {
    const existingFetch = vi.fn()
    ;(globalThis as Record<string, any>).fetch = existingFetch

    const { installRequestGlobals } = await import('./requestGlobals')
    installRequestGlobals()

    expect(globalThis.fetch).toBe(existingFetch)
    expect(typeof globalThis.XMLHttpRequest).toBe('function')
    expect(typeof globalThis.AbortController).toBe('function')
    expect(typeof globalThis.Headers).toBe('function')
  })

  it('supports axios-style xhr requests through the injected fetch bridge', async () => {
    wevuFetchMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      url: 'https://example.com/data',
      headers: new Map([['content-type', 'application/json']]),
      text: vi.fn(async () => '{"ok":true}'),
      arrayBuffer: vi.fn(async () => new ArrayBuffer(0)),
    })

    const { installRequestGlobals } = await import('./requestGlobals')
    installRequestGlobals()

    const xhr = new globalThis.XMLHttpRequest()
    xhr.open('GET', 'https://example.com/data')
    xhr.responseType = 'json'
    await xhr.send()

    expect(wevuFetchMock).toHaveBeenCalledWith('https://example.com/data', expect.objectContaining({
      method: 'GET',
    }))
    expect(xhr.status).toBe(200)
    expect(xhr.response).toEqual({ ok: true })
    expect(xhr.readyState).toBe(xhr.DONE)
    expect(xhr.getResponseHeader('content-type')).toBe('application/json')
  })
})
