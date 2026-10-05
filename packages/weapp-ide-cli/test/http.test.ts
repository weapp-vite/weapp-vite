import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@weapp-vite/devtools-runtime', () => ({ withMachineE2ELease: async (run: () => Promise<unknown>) => await run() }))

const detectWechatDevtoolsServicePortMock = vi.hoisted(() => vi.fn())
const getRuntimeWechatDevtoolsServicePortMock = vi.hoisted(() => vi.fn())
const assertPort = vi.hoisted(() => vi.fn())
const ensureManagedProject = vi.hoisted(() => vi.fn())
const selectedTarget = vi.hoisted(() => ({ cliPath: 'selected-cli', appPath: 'selected-app', profileDir: 'selected-profile', installationId: 'selected' }))

vi.mock('../src/devtoolsTarget', () => ({
  resolveWechatDevtoolsTarget: async () => selectedTarget,
  assertWechatDevtoolsPort: assertPort,
}))

vi.mock('../src/cli/wechatDevtoolsSettings', () => ({
  detectWechatDevtoolsServicePort: detectWechatDevtoolsServicePortMock,
}))

vi.mock('../src/cli/wechatDevtoolsRuntimePort', () => ({
  getRuntimeWechatDevtoolsServicePort: getRuntimeWechatDevtoolsServicePortMock,
}))

vi.mock('../src/cli/managedProjectGate', () => ({ ensureManagedWechatProject: ensureManagedProject }))

function expectFetchRequest(callIndex: number, expectedUrl: string) {
  const [request, init] = (fetch as any).mock.calls[callIndex] ?? []
  expect(String(request)).toBe(expectedUrl)
  expect(init).toEqual(expect.objectContaining({
    method: 'GET',
  }))
}

describe('wechat devtools http helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    detectWechatDevtoolsServicePortMock.mockReset()
    getRuntimeWechatDevtoolsServicePortMock.mockReset()
    assertPort.mockReset().mockResolvedValue(undefined)
    ensureManagedProject.mockReset().mockResolvedValue(undefined)
    detectWechatDevtoolsServicePortMock.mockResolvedValue({
      detectedSecurityCount: 1,
      servicePort: 9527,
      servicePortEnabled: true,
      touchedInstanceCount: 1,
    })
    getRuntimeWechatDevtoolsServicePortMock.mockReturnValue(undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'OK',
    }))
  })

  it('opens project by service port http api', async () => {
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    const projectPath = path.resolve('/workspace/demo-app')

    await openWechatIdeProjectByHttp('/workspace/demo-app')

    expectFetchRequest(0, `http://127.0.0.1:9527/v2/open?project=${encodeURIComponent(projectPath)}`)
    expect(detectWechatDevtoolsServicePortMock).toHaveBeenCalledWith({ target: selectedTarget })
    expect(assertPort).toHaveBeenCalledWith(selectedTarget, 9527, expect.any(Object))
  })

  it.each(['openWechatIdeProjectByHttp', 'startWechatIdeEngineBuildByHttp'] as const)('requires a confirmed managed project before %s can send HTTP', async (helper) => {
    const failure = new Error('Managed project ownership unresolved')
    ensureManagedProject.mockRejectedValue(failure)
    const http = await import('../src/cli/http')
    await expect(http[helper]('fixtures/project')).rejects.toBe(failure)
    expect(ensureManagedProject).toHaveBeenCalledExactlyOnceWith(selectedTarget, path.resolve('fixtures/project'), { signal: undefined })
    expect(fetch).not.toHaveBeenCalled()
    expect(detectWechatDevtoolsServicePortMock).not.toHaveBeenCalled()
  })

  it.each([['/v2/open', 'project'], ['/engine/build', 'projectpath']])('also gates direct HTTP requests to %s', async (endpoint, parameter) => {
    const { requestWechatDevtoolsHttp } = await import('../src/cli/http')
    const failure = new Error('missing project receipt')
    ensureManagedProject.mockRejectedValue(failure)
    await expect(requestWechatDevtoolsHttp(endpoint!, { [parameter!]: 'fixtures/project' })).rejects.toBe(failure)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('waits for the project receipt before HTTP can open a window', async () => {
    const events: string[] = []
    ensureManagedProject.mockImplementation(async () => {
      events.push('project-confirmed')
    })
    vi.mocked(fetch).mockImplementation(async () => {
      events.push('http-open')
      return new Response('OK')
    })
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    await openWechatIdeProjectByHttp('fixtures/project')
    expect(events).toEqual(['project-confirmed', 'http-open'])
  })

  it.each(['fixtures/demo app', 'fixtures/中文应用', 'fixtures/中文 应用 100% & #'])('sends only the declared project parameter with one encoding: %s', async (fixturePath) => {
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    await openWechatIdeProjectByHttp(fixturePath)
    const request = new URL(String(vi.mocked(fetch).mock.calls[0]![0]))
    expect(request.pathname).toBe('/v2/open')
    expect([...request.searchParams.keys()]).toEqual(['project'])
    expect(request.searchParams.get('project')).toBe(path.resolve(fixturePath))
  })

  it.each(['"project-window"', '42', 'OK'])('preserves the public response body without assuming a window id type: %s', async (body) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body))
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    await expect(openWechatIdeProjectByHttp('fixtures/demo-app')).resolves.toBe(body)
  })

  it.each(['', ' \r\n ', '{}', '{ \n }'])('does not confirm project opening from an empty successful response: %j', async (body) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body))
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    await expect(openWechatIdeProjectByHttp('fixtures/demo-app')).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_HTTP_OPEN_UNCONFIRMED' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('prefers runtime service port captured from current cli open output', async () => {
    getRuntimeWechatDevtoolsServicePortMock.mockReturnValue(44650)
    const { resetWechatIdeFileUtilsByHttp } = await import('../src/cli/http')
    const projectPath = path.resolve('/workspace/demo-app')

    await resetWechatIdeFileUtilsByHttp('/workspace/demo-app')

    expect(detectWechatDevtoolsServicePortMock).not.toHaveBeenCalled()
    expect(getRuntimeWechatDevtoolsServicePortMock).toHaveBeenCalledWith(selectedTarget)
    expectFetchRequest(0, `http://127.0.0.1:44650/v2/resetfileutils?project=${encodeURIComponent(projectPath)}`)
  })

  it('resets fileutils by service port http api', async () => {
    const { resetWechatIdeFileUtilsByHttp } = await import('../src/cli/http')
    const projectPath = path.resolve('/workspace/demo-app')

    await resetWechatIdeFileUtilsByHttp('/workspace/demo-app')

    expectFetchRequest(0, `http://127.0.0.1:9527/v2/resetfileutils?project=${encodeURIComponent(projectPath)}`)
  })

  it('starts engine build by service port http api', async () => {
    const { startWechatIdeEngineBuildByHttp } = await import('../src/cli/http')
    const projectPath = path.resolve('/workspace/demo-app')

    const result = await startWechatIdeEngineBuildByHttp('/workspace/demo-app')

    expect(result).toEqual({ body: 'OK' })
    expectFetchRequest(0, `http://127.0.0.1:9527/engine/build?projectpath=${encodeURIComponent(projectPath)}`)
  })

  it('parses engine build result from service port http api', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        msg: '构建成功',
        status: 'END',
      }),
    }))
    const { pollWechatIdeEngineBuildResultByHttp } = await import('../src/cli/http')

    const result = await pollWechatIdeEngineBuildResultByHttp()

    expect(result).toEqual({
      body: '{"msg":"构建成功","status":"END"}',
      done: true,
      failed: false,
      msg: '构建成功',
      status: 'END',
    })
    expectFetchRequest(0, 'http://127.0.0.1:9527/engine/buildResult/')
  })

  it('rejects an explicit port owned by another installation without sending a request', async () => {
    const error = Object.assign(new Error('wrong installation'), { code: 'WECHAT_DEVTOOLS_HOST_IDENTITY_MISMATCH' })
    assertPort.mockRejectedValueOnce(error)
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    await expect(openWechatIdeProjectByHttp('fixture', { port: 22002, target: selectedTarget })).rejects.toBe(error)
    expect(assertPort).toHaveBeenCalledWith(selectedTarget, 22002, expect.any(Object))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not guess a default port when the selected installation has no port', async () => {
    detectWechatDevtoolsServicePortMock.mockResolvedValueOnce({ touchedInstanceCount: 0, detectedSecurityCount: 0 })
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    await expect(openWechatIdeProjectByHttp('fixture')).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_SERVICE_PORT_UNKNOWN' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 65536])('rejects an explicit invalid port without falling back: %s', async (port) => {
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')
    await expect(openWechatIdeProjectByHttp('fixture', { port, target: selectedTarget })).rejects.toMatchObject({ code: 'WECHAT_DEVTOOLS_INVALID_PORT' })
    expect(getRuntimeWechatDevtoolsServicePortMock).not.toHaveBeenCalled()
    expect(detectWechatDevtoolsServicePortMock).not.toHaveBeenCalled()
    expect(assertPort).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
})
