import { createTestWeapi } from '../helpers/createTestWeapi'

export function registerWeapiIndexRewardedAdAndCoreUnsupportedCapabilitiesTests() {
  it('maps rewarded ad api to strict-equivalent alipay target and keeps live contexts unsupported', async () => {
    const rewardedAd = {
      load: vi.fn(),
      show: vi.fn(),
      destroy: vi.fn(),
      onClose: vi.fn(),
      offClose: vi.fn(),
    }
    const createRewardedAd = vi.fn(() => rewardedAd)
    const createVideoContext = vi.fn(() => ({ play: vi.fn() }))
    const api = createTestWeapi({
      adapter: {
        createRewardedAd,
        createVideoContext,
      },
      platform: 'alipay',
    }) as Record<string, any>

    expect(api.resolveTarget('createRewardedVideoAd')).toMatchObject({
      method: 'createRewardedVideoAd',
      target: 'createRewardedAd',
      supportLevel: 'mapped',
      supported: true,
      semanticAligned: true,
    })
    const rewarded = api.createRewardedVideoAd({ adUnitId: 'adunit-2' } as any)
    rewarded.load()
    rewarded.show({ from: 'test' })
    rewarded.destroy()
    expect(createRewardedAd).toHaveBeenCalledWith('adunit-2')
    expect(rewardedAd.load).toHaveBeenCalledWith({
      adUnitId: 'adunit-2',
    })
    expect(rewardedAd.show).toHaveBeenCalledWith({
      adUnitId: 'adunit-2',
      from: 'test',
    })
    expect(rewardedAd.destroy).toHaveBeenCalledWith({
      adUnitId: 'adunit-2',
    })

    await expect(api.createRewardedVideoAd({
      adUnitId: 'adunit-2',
      multiton: true,
    } as any)).rejects.toMatchObject({
      errMsg: 'my.createRewardedVideoAd:fail method not supported',
    })
    expect(createVideoContext).not.toHaveBeenCalled()

    expect(api.resolveTarget('createInterstitialAd')).toMatchObject({
      method: 'createInterstitialAd',
      target: 'createInterstitialAd',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createInterstitialAd({ adUnitId: 'adunit-1' })).rejects.toMatchObject({
      errMsg: 'my.createInterstitialAd:fail method not supported',
    })
    expect(api.resolveTarget('createLivePlayerContext')).toMatchObject({
      method: 'createLivePlayerContext',
      target: 'createLivePlayerContext',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('createLivePusherContext')).toMatchObject({
      method: 'createLivePusherContext',
      target: 'createLivePusherContext',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createLivePlayerContext('live-player' as any)).rejects.toMatchObject({
      errMsg: 'my.createLivePlayerContext:fail method not supported',
    })
    await expect(api.createLivePusherContext('live-pusher' as any)).rejects.toMatchObject({
      errMsg: 'my.createLivePusherContext:fail method not supported',
    })
  })

  it('normalizes platform alias for createWeapi', () => {
    const api = createTestWeapi({
      adapter: {},
      platform: 'douyin',
    })
    expect(api.platform).toBe('tt')
  })

  it.each([
    'nextTick',
    'getLogManager',
    'createVKSession',
  ])('treats %s as unsupported without strict-equivalent runtime API', async (methodName) => {
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
      await expect(api[methodName]({})).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }
  })

  it('treats reportAnalytics as unsupported for alipay when method is missing', async () => {
    const api = createTestWeapi({
      adapter: {},
      platform: 'alipay',
    })

    expect(api.resolveTarget('reportAnalytics')).toMatchObject({
      method: 'reportAnalytics',
      target: 'reportAnalytics',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.reportAnalytics('event_name', { from: 'test' } as any)).rejects.toMatchObject({
      errMsg: 'my.reportAnalytics:fail method not supported',
    })
  })

  it('treats onWindowResize/offWindowResize as unsupported for alipay when method is missing', async () => {
    const api = createTestWeapi({
      adapter: {},
      platform: 'alipay',
    })

    expect(api.resolveTarget('onWindowResize')).toMatchObject({
      method: 'onWindowResize',
      target: 'onWindowResize',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('offWindowResize')).toMatchObject({
      method: 'offWindowResize',
      target: 'offWindowResize',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.onWindowResize(vi.fn() as any)).rejects.toMatchObject({
      errMsg: 'my.onWindowResize:fail method not supported',
    })
    await expect(api.offWindowResize(vi.fn() as any)).rejects.toMatchObject({
      errMsg: 'my.offWindowResize:fail method not supported',
    })
  })

  it.each([
    { platform: 'alipay' },
    { platform: 'tt' },
  ])('treats openCustomerServiceChat as unsupported for $platform', async ({ platform }) => {
    const normalizedPlatform = platform === 'alipay' ? 'my' : platform
    const api = createTestWeapi({
      adapter: {},
      platform,
    })
    expect(api.resolveTarget('openCustomerServiceChat')).toMatchObject({
      method: 'openCustomerServiceChat',
      target: 'openCustomerServiceChat',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.openCustomerServiceChat({} as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.openCustomerServiceChat:fail method not supported`,
    })
  })

  it.each([
    { platform: 'alipay' },
    { platform: 'tt' },
  ])('treats compressVideo/openVideoEditor/getShareInfo/joinVoIPChat as unsupported for $platform', async ({ platform }) => {
    const normalizedPlatform = platform === 'alipay' ? 'my' : platform
    const api = createTestWeapi({
      adapter: {},
      platform,
    })
    expect(api.resolveTarget('compressVideo')).toMatchObject({
      method: 'compressVideo',
      target: 'compressVideo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('getShareInfo')).toMatchObject({
      method: 'getShareInfo',
      target: 'getShareInfo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('openVideoEditor')).toMatchObject({
      method: 'openVideoEditor',
      target: 'openVideoEditor',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    expect(api.resolveTarget('joinVoIPChat')).toMatchObject({
      method: 'joinVoIPChat',
      target: 'joinVoIPChat',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.compressVideo({ src: '/tmp/demo.mp4' } as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.compressVideo:fail method not supported`,
    })
    await expect(api.getShareInfo({} as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.getShareInfo:fail method not supported`,
    })
    await expect(api.openVideoEditor({} as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.openVideoEditor:fail method not supported`,
    })
    await expect(api.joinVoIPChat({} as any)).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.joinVoIPChat:fail method not supported`,
    })
  })
}
