import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const start = vi.hoisted(() => vi.fn())
const poll = vi.hoisted(() => vi.fn())
const resolveCli = vi.hoisted(() => vi.fn())
const execa = vi.hoisted(() => vi.fn())
vi.mock('../src/cli/http', () => ({ startWechatIdeEngineBuildByHttp: start, pollWechatIdeEngineBuildResultByHttp: poll }))
vi.mock('../src/cli/resolver', () => ({ resolveCliPath: resolveCli }))
vi.mock('execa', () => ({ execa }))

describe('engine cancellation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    start.mockReset().mockResolvedValue({ body: 'OK' })
    poll.mockReset().mockResolvedValue({ body: 'END', done: true, failed: false })
    resolveCli.mockReset().mockResolvedValue({ cliPath: 'wechat-cli' })
    execa.mockReset().mockResolvedValue({ exitCode: 0 })
  })
  afterEach(() => vi.useRealTimers())

  it('does not start an already cancelled engine build', async () => {
    const { runWechatIdeEngineBuild } = await import('../src/cli/engine')
    const reason = new Error('cancelled')
    await expect(runWechatIdeEngineBuild('fixture', { signal: AbortSignal.abort(reason) })).rejects.toBe(reason)
    expect(start).not.toHaveBeenCalled()
    expect(poll).not.toHaveBeenCalled()
    expect(execa).not.toHaveBeenCalled()
  })

  it('does not poll after cancellation during start', async () => {
    const { runWechatIdeEngineBuildByHttp } = await import('../src/cli/engine')
    const controller = new AbortController()
    const reason = new Error('start cancelled')
    start.mockImplementationOnce(async () => {
      controller.abort(reason)
      return { body: 'OK' }
    })
    await expect(runWechatIdeEngineBuildByHttp('fixture', { signal: controller.signal })).rejects.toBe(reason)
    expect(poll).not.toHaveBeenCalled()
  })

  it('interrupts the polling pause without making another request', async () => {
    const { runWechatIdeEngineBuildByHttp } = await import('../src/cli/engine')
    poll.mockResolvedValue({ body: 'BUILDING', done: false, failed: false })
    const controller = new AbortController()
    const reason = new Error('pause cancelled')
    const pending = runWechatIdeEngineBuildByHttp('fixture', { signal: controller.signal, pollIntervalMs: 1000 })
    const assertion = expect(pending).rejects.toBe(reason)
    await vi.advanceTimersByTimeAsync(0)
    controller.abort(reason)
    await vi.advanceTimersByTimeAsync(1000)
    expect(poll).toHaveBeenCalledTimes(1)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not mistake cancellation for a missing endpoint and start fallback', async () => {
    const { runWechatIdeEngineBuild } = await import('../src/cli/engine')
    const controller = new AbortController()
    const reason = new Error('Cannot GET /engine/build')
    start.mockImplementationOnce(async () => {
      controller.abort(reason)
      throw reason
    })
    await expect(runWechatIdeEngineBuild('fixture', { signal: controller.signal })).rejects.toBe(reason)
    expect(resolveCli).not.toHaveBeenCalled()
    expect(execa).not.toHaveBeenCalled()
  })

  it('does not launch fallback after cancellation during CLI resolution', async () => {
    const { runWechatIdeEngineBuild } = await import('../src/cli/engine')
    const controller = new AbortController()
    const reason = new Error('CLI cancelled')
    start.mockRejectedValueOnce(new Error('Cannot GET /engine/build'))
    resolveCli.mockImplementationOnce(async () => {
      controller.abort(reason)
      return { cliPath: 'wechat-cli' }
    })
    await expect(runWechatIdeEngineBuild('fixture', { signal: controller.signal })).rejects.toBe(reason)
    expect(execa).not.toHaveBeenCalled()
  })

  it.each(['poll', 'progress'] as const)('rejects success after cancellation during %s', async (stage) => {
    const { runWechatIdeEngineBuildByHttp } = await import('../src/cli/engine')
    const controller = new AbortController()
    const reason = new Error('poll cancelled')
    const onProgress = vi.fn(() => {
      controller.abort(reason)
    })
    if (stage === 'poll') {
      poll.mockImplementationOnce(async () => {
        controller.abort(reason)
        return { body: 'END', done: true, failed: false }
      })
    }
    await expect(runWechatIdeEngineBuildByHttp('fixture', { signal: controller.signal, onProgress })).rejects.toBe(reason)
    expect(onProgress).toHaveBeenCalledTimes(stage === 'poll' ? 0 : 1)
    expect(poll).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['resolve', 'reject'] as const)('cancels CLI fallback and waits until the process settles by %s', async (outcome) => {
    const { runWechatIdeEngineBuild } = await import('../src/cli/engine')
    const controller = new AbortController()
    const reason = new Error('subprocess cancelled')
    const process = Promise.withResolvers<{ exitCode: number }>()
    start.mockRejectedValueOnce(new Error('Cannot GET /engine/build'))
    execa.mockReturnValueOnce(process.promise)
    let settled = false
    const pending = runWechatIdeEngineBuild('fixture', { signal: controller.signal, overallTimeoutMs: 4000 })
    const assertion = expect(pending).rejects.toBe(reason)
    void pending.then(() => {
      settled = true
    }, () => {
      settled = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(execa.mock.calls[0]![2]).toEqual({ cancelSignal: controller.signal, killDescendants: true, reject: false, timeout: 4000 })
    controller.abort(reason)
    await Promise.resolve()
    expect(settled).toBe(false)
    if (outcome === 'resolve') {
      process.resolve({ exitCode: 0 })
    }
    else {
      process.reject(new Error('process killed'))
    }
    await assertion
  })
})
