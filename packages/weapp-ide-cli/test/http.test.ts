import { beforeEach, describe, expect, it, vi } from 'vitest'

const detectWechatDevtoolsServicePortMock = vi.hoisted(() => vi.fn())

vi.mock('../src/cli/wechatDevtoolsSettings', () => ({
  detectWechatDevtoolsServicePort: detectWechatDevtoolsServicePortMock,
}))

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
    detectWechatDevtoolsServicePortMock.mockResolvedValue({
      detectedSecurityCount: 1,
      servicePort: 9527,
      servicePortEnabled: true,
      touchedInstanceCount: 1,
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: async () => 'OK',
    }))
  })

  it('opens project by service port http api', async () => {
    const { openWechatIdeProjectByHttp } = await import('../src/cli/http')

    await openWechatIdeProjectByHttp('/workspace/demo-app')

    expectFetchRequest(0, `http://127.0.0.1:9527/open?projectpath=${encodeURIComponent('/workspace/demo-app')}`)
  })

  it('resets fileutils by service port http api', async () => {
    const { resetWechatIdeFileUtilsByHttp } = await import('../src/cli/http')

    await resetWechatIdeFileUtilsByHttp('/workspace/demo-app')

    expectFetchRequest(0, `http://127.0.0.1:9527/v2/resetfileutils?project=${encodeURIComponent('/workspace/demo-app')}`)
  })

  it('starts engine build by service port http api', async () => {
    const { startWechatIdeEngineBuildByHttp } = await import('../src/cli/http')

    const result = await startWechatIdeEngineBuildByHttp('/workspace/demo-app')

    expect(result).toEqual({ body: 'OK' })
    expectFetchRequest(0, `http://127.0.0.1:9527/engine/build?projectpath=${encodeURIComponent('/workspace/demo-app')}`)
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
})
