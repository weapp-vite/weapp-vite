import { beforeEach, describe, expect, it, vi } from 'vitest'

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
})
