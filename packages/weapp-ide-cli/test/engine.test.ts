import fs from 'node:fs/promises'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pollWechatIdeEngineBuildResultByHttpMock = vi.hoisted(() => vi.fn())
const startWechatIdeEngineBuildByHttpMock = vi.hoisted(() => vi.fn())

vi.mock('../src/cli/http', () => ({
  pollWechatIdeEngineBuildResultByHttp: pollWechatIdeEngineBuildResultByHttpMock,
  startWechatIdeEngineBuildByHttp: startWechatIdeEngineBuildByHttpMock,
}))

describe('runWechatIdeEngineBuildByHttp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    startWechatIdeEngineBuildByHttpMock.mockReset()
    pollWechatIdeEngineBuildResultByHttpMock.mockReset()
    startWechatIdeEngineBuildByHttpMock.mockResolvedValue({ body: 'OK' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts engine build and waits until done', async () => {
    pollWechatIdeEngineBuildResultByHttpMock
      .mockResolvedValueOnce({
        body: '{"status":"OPEN_PROJECT"}',
        done: false,
        failed: false,
        status: 'OPEN_PROJECT',
      })
      .mockResolvedValueOnce({
        body: '{"status":"END","msg":"done"}',
        done: true,
        failed: false,
        msg: 'done',
        status: 'END',
      })
    const { runWechatIdeEngineBuildByHttp } = await import('../src/cli/engine')

    const pending = runWechatIdeEngineBuildByHttp('/workspace/demo-app')
    await vi.advanceTimersByTimeAsync(1000)
    const result = await pending

    expect(startWechatIdeEngineBuildByHttpMock).toHaveBeenCalledWith('/workspace/demo-app', {})
    expect(pollWechatIdeEngineBuildResultByHttpMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      body: '{"status":"END","msg":"done"}',
      done: true,
      failed: false,
      msg: 'done',
      status: 'END',
    })
  })

  it('throws when engine build reports failure', async () => {
    pollWechatIdeEngineBuildResultByHttpMock.mockResolvedValueOnce({
      body: '{"status":"ERROR","msg":"bad build"}',
      done: false,
      failed: true,
      msg: 'bad build',
      status: 'ERROR',
    })
    const { runWechatIdeEngineBuildByHttp } = await import('../src/cli/engine')

    await expect(runWechatIdeEngineBuildByHttp('/workspace/demo-app')).rejects.toMatchObject({
      code: 'WECHAT_DEVTOOLS_ENGINE_BUILD_FAILED',
      message: 'bad build',
    })
  })

  it('writes engine build progress log when logPath is provided', async () => {
    pollWechatIdeEngineBuildResultByHttpMock
      .mockResolvedValueOnce({
        body: '{"status":"OPEN_PROJECT","msg":"opening"}',
        done: false,
        failed: false,
        msg: 'opening',
        status: 'OPEN_PROJECT',
      })
      .mockResolvedValueOnce({
        body: '{"status":"END","msg":"done"}',
        done: true,
        failed: false,
        msg: 'done',
        status: 'END',
      })
    const writeFileSpy = vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined)
    const mkdirSpy = vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined)
    const rmSpy = vi.spyOn(fs, 'rm').mockResolvedValue(undefined)
    const statSpy = vi.spyOn(fs, 'stat').mockRejectedValue(new Error('missing'))
    const { runWechatIdeEngineBuild } = await import('../src/cli/engine')

    const pending = runWechatIdeEngineBuild('/workspace/demo-app', {
      logPath: '/workspace/logs/engine.log',
    })
    await vi.advanceTimersByTimeAsync(1000)
    await pending

    expect(statSpy).toHaveBeenCalledWith('/workspace/logs/engine.log')
    expect(mkdirSpy).toHaveBeenCalledWith('/workspace/logs', { recursive: true })
    expect(writeFileSpy).toHaveBeenCalledWith(
      '/workspace/logs/engine.log',
      'opening\ndone',
      'utf8',
    )
    expect(rmSpy).not.toHaveBeenCalled()
  })
})
