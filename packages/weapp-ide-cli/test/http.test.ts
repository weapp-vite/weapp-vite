import { beforeEach, describe, expect, it, vi } from 'vitest'

const detectWechatDevtoolsServicePortMock = vi.hoisted(() => vi.fn())

vi.mock('../src/cli/wechatDevtoolsSettings', () => ({
  detectWechatDevtoolsServicePort: detectWechatDevtoolsServicePortMock,
}))

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

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'http://127.0.0.1:9527/open?projectpath=%2Fworkspace%2Fdemo-app',
      }),
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('resets fileutils by service port http api', async () => {
    const { resetWechatIdeFileUtilsByHttp } = await import('../src/cli/http')

    await resetWechatIdeFileUtilsByHttp('/workspace/demo-app')

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'http://127.0.0.1:9527/v2/resetfileutils?project=%2Fworkspace%2Fdemo-app',
      }),
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })

  it('starts engine build by service port http api', async () => {
    const { startWechatIdeEngineBuildByHttp } = await import('../src/cli/http')

    const result = await startWechatIdeEngineBuildByHttp('/workspace/demo-app')

    expect(result).toEqual({ body: 'OK' })
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'http://127.0.0.1:9527/engine/build?projectpath=%2Fworkspace%2Fdemo-app',
      }),
      expect.objectContaining({
        method: 'GET',
      }),
    )
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
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        href: 'http://127.0.0.1:9527/engine/buildResult/',
      }),
      expect.objectContaining({
        method: 'GET',
      }),
    )
  })
})
