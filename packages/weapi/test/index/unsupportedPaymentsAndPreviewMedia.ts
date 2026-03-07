import { createTestWeapi } from '../helpers/createTestWeapi'

export function registerWeapiIndexUnsupportedPaymentsAndPreviewMediaTests() {
  it('treats scanCode as unsupported for alipay without strict-equivalent api', async () => {
    const scan = vi.fn()
    const api = createTestWeapi({
      adapter: {
        scan,
      },
      platform: 'alipay',
    }) as Record<string, any>

    expect(api.resolveTarget('scanCode')).toMatchObject({
      method: 'scanCode',
      target: 'scanCode',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.scanCode()).rejects.toMatchObject({
      errMsg: 'my.scanCode:fail method not supported',
    })
    expect(scan).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats showShareImageMenu as unsupported for $platform without strict-equivalent api', async ({ platform, normalizedPlatform }) => {
    const showShareMenu = vi.fn()
    const api = createTestWeapi({
      adapter: {
        showShareMenu,
      },
      platform,
    }) as Record<string, any>

    expect(api.resolveTarget('showShareImageMenu')).toMatchObject({
      method: 'showShareImageMenu',
      target: 'showShareImageMenu',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.showShareImageMenu({
      path: '/tmp/share.jpg',
    })).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.showShareImageMenu:fail method not supported`,
    })
    expect(showShareMenu).not.toHaveBeenCalled()
  })

  it('treats openChannelsUserProfile as unsupported for douyin without strict-equivalent api', async () => {
    const openAwemeUserProfile = vi.fn()
    const api = createTestWeapi({
      adapter: {
        openAwemeUserProfile,
      },
      platform: 'tt',
    }) as Record<string, any>

    expect(api.resolveTarget('openChannelsUserProfile')).toMatchObject({
      method: 'openChannelsUserProfile',
      target: 'openChannelsUserProfile',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.openChannelsUserProfile({
      finderUserName: 'demo',
    })).rejects.toMatchObject({
      errMsg: 'tt.openChannelsUserProfile:fail method not supported',
    })
    expect(openAwemeUserProfile).not.toHaveBeenCalled()
  })

  it('treats requestPayment family as unsupported for alipay', async () => {
    const tradePay = vi.fn()
    const api = createTestWeapi({
      adapter: {
        tradePay,
      },
      platform: 'alipay',
    })

    for (const methodName of ['requestPayment', 'requestOrderPayment', 'requestPluginPayment', 'requestVirtualPayment'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({ package: 'prepay=1' })).rejects.toMatchObject({
        errMsg: `my.${methodName}:fail method not supported`,
      })
    }

    expect(tradePay).not.toHaveBeenCalled()
  })

  it('treats requestPayment family as unsupported for douyin', async () => {
    const pay = vi.fn()
    const api = createTestWeapi({
      adapter: {
        pay,
      },
      platform: 'tt',
    })

    for (const methodName of ['requestPayment', 'requestOrderPayment', 'requestPluginPayment', 'requestVirtualPayment'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({ package: 'order-info-1' })).rejects.toMatchObject({
        errMsg: `tt.${methodName}:fail method not supported`,
      })
    }

    expect(pay).not.toHaveBeenCalled()
  })

  it.each([
    'requestPayment',
    'requestOrderPayment',
    'requestPluginPayment',
    'requestVirtualPayment',
  ])('treats %s as unsupported in strict compatibility mode', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createTestWeapi({
        adapter: {},
        platform,
      }) as Record<string, any>
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]({ package: 'test' })).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it('treats previewMedia as unsupported for alipay without strict-equivalent api', async () => {
    const previewImage = vi.fn((options: any) => {
      options.success?.({ errMsg: 'previewImage:ok' })
    })
    const api = createTestWeapi({
      adapter: {
        previewImage,
      },
      platform: 'alipay',
    })

    expect(api.resolveTarget('previewMedia')).toMatchObject({
      method: 'previewMedia',
      target: 'previewMedia',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.previewMedia({
      sources: [
        { url: 'https://example.com/a.jpg', type: 'image' },
        { url: 'https://example.com/b.jpg', type: 'image' },
      ],
      current: 1,
    } as any)).rejects.toMatchObject({
      errMsg: 'my.previewMedia:fail method not supported',
    })
    expect(previewImage).not.toHaveBeenCalled()
  })
}
