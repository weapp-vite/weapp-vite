import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const detectPort = vi.hoisted(() => vi.fn())
vi.mock('../src/cli/wechatDevtoolsSettings', () => ({ detectWechatDevtoolsServicePort: detectPort }))
vi.mock('../src/cli/wechatDevtoolsRuntimePort', () => ({ getRuntimeWechatDevtoolsServicePort: () => undefined }))

describe('HTTP cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    detectPort.mockReset().mockResolvedValue({ servicePort: 9420 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => 'OK' }))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('does not detect a port or send requests when already cancelled', async () => {
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    const reason = new Error('launch stopped')
    await expect(openWechatIdeProjectByHttp('fixture', { signal: AbortSignal.abort(reason) })).rejects.toBe(reason)
    expect(detectPort).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'] as const)('does not send requests after cancelled port detection %s', async (outcome) => {
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    const detection = Promise.withResolvers<{ servicePort: number }>()
    detectPort.mockReturnValueOnce(detection.promise)
    const controller = new AbortController()
    const reason = new Error('port detection cancelled')
    const pending = openWechatIdeProjectByHttp('fixture', { signal: controller.signal })
    const assertion = expect(pending).rejects.toBe(reason)
    controller.abort(reason)
    if (outcome === 'resolve') {
      detection.resolve({ servicePort: 9420 })
    }
    else {
      detection.reject(new Error('detection failed'))
    }
    await assertion
    expect(fetch).not.toHaveBeenCalled()
  })

  it('cancels fetch with the original reason and waits for transport settlement', async () => {
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    const transport = Promise.withResolvers<Response>()
    vi.mocked(fetch).mockReturnValueOnce(transport.promise)
    const controller = new AbortController()
    const reason = new DOMException('launch stopped', 'AbortError')
    let settled = false
    const pending = openWechatIdeProjectByHttp('fixture', { signal: controller.signal })
    const assertion = expect(pending).rejects.toBe(reason)
    void pending.then(() => {
      settled = true
    }, () => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(0)
    const signal = vi.mocked(fetch).mock.calls[0]![1]!.signal!
    controller.abort(reason)
    await Promise.resolve()
    expect(signal.aborted).toBe(true)
    expect(signal.reason).toBe(reason)
    expect(settled).toBe(false)
    transport.reject(new TypeError('transport aborted'))
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains the HTTP timeout when no external cancellation occurs', async () => {
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    vi.mocked(fetch).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true })
    }))
    const assertion = expect(openWechatIdeProjectByHttp('fixture', { timeoutMs: 25 })).rejects.toMatchObject({
      code: 'WECHAT_DEVTOOLS_HTTP_TIMEOUT',
    })
    await vi.advanceTimersByTimeAsync(25)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rejects a response body that completes after external cancellation', async () => {
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    const body = Promise.withResolvers<string>()
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, text: () => body.promise } as Response)
    const controller = new AbortController()
    const reason = 'body cancelled'
    const assertion = expect(openWechatIdeProjectByHttp('fixture', { signal: controller.signal })).rejects.toBe(reason)
    await vi.advanceTimersByTimeAsync(0)
    controller.abort(reason)
    body.resolve('OK')
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
})
