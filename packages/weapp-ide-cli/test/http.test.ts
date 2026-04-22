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
})
