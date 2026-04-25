import fs from 'node:fs/promises'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const pollWechatIdeEngineBuildResultByHttpMock = vi.hoisted(() => vi.fn())
const startWechatIdeEngineBuildByHttpMock = vi.hoisted(() => vi.fn())
const execaMock = vi.hoisted(() => vi.fn())
const resolveCliPathMock = vi.hoisted(() => vi.fn())

vi.mock('execa', () => ({
  execa: execaMock,
}))

vi.mock('../src/cli/http', () => ({
  pollWechatIdeEngineBuildResultByHttp: pollWechatIdeEngineBuildResultByHttpMock,
  startWechatIdeEngineBuildByHttp: startWechatIdeEngineBuildByHttpMock,
}))

vi.mock('../src/cli/resolver', () => ({
  resolveCliPath: resolveCliPathMock,
}))

describe('runWechatIdeEngineBuildByHttp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    startWechatIdeEngineBuildByHttpMock.mockReset()
    pollWechatIdeEngineBuildResultByHttpMock.mockReset()
    execaMock.mockReset()
    resolveCliPathMock.mockReset()
    startWechatIdeEngineBuildByHttpMock.mockResolvedValue({ body: 'OK' })
    resolveCliPathMock.mockResolvedValue({ cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli' })
    execaMock.mockResolvedValue({
      exitCode: 0,
      stderr: '',
      stdout: '',
    })
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

    const expectedLogPath = path.resolve('/workspace/logs/engine.log')
    expect(statSpy).toHaveBeenCalledWith(expectedLogPath)
    expect(mkdirSpy).toHaveBeenCalledWith(path.dirname(expectedLogPath), { recursive: true })
    expect(writeFileSpy).toHaveBeenCalledWith(
      expectedLogPath,
      'opening\ndone',
      'utf8',
    )
    expect(rmSpy).not.toHaveBeenCalled()
  })

  it('falls back to official cli when http engine build endpoint is unavailable', async () => {
    startWechatIdeEngineBuildByHttpMock.mockRejectedValueOnce(new Error('Cannot GET /engine/build'))
    const { runWechatIdeEngineBuild } = await import('../src/cli/engine')

    await runWechatIdeEngineBuild('/workspace/demo-app')

    expect(execaMock).toHaveBeenCalledWith(
      '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
      ['engine', 'build', path.resolve('/workspace/demo-app')],
      {
        reject: false,
        timeout: 120_000,
      },
    )
  })

  it('accepts cli engine build when devtools opens project but exits non-zero', async () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    startWechatIdeEngineBuildByHttpMock.mockRejectedValueOnce(new Error('Cannot GET /engine/build'))
    execaMock.mockResolvedValueOnce({
      exitCode: 1,
      stderr: '打开项目中\n✔ 打开项目成功\n✖ 打开项目中',
      stdout: '',
    })
    const { runWechatIdeEngineBuild } = await import('../src/cli/engine')

    await expect(runWechatIdeEngineBuild('/workspace/demo-app')).resolves.toBeUndefined()
  })
})
