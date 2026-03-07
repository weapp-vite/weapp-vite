import { createTestWeapi } from '../helpers/createTestWeapi'

export function registerWeapiIndexDouyinBaseInfoAndRewardedAdGuardsTests() {
  it('treats getAppBaseInfo/getAccountInfoSync as unsupported for douyin without strict-equivalent api', async () => {
    const getEnvInfoSync = vi.fn()
    const api = createTestWeapi({
      adapter: {
        getEnvInfoSync,
      },
      platform: 'tt',
    })

    for (const methodName of ['getAppBaseInfo', 'getAccountInfoSync'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]()).rejects.toMatchObject({
        errMsg: `tt.${methodName}:fail method not supported`,
      })
    }
    expect(getEnvInfoSync).not.toHaveBeenCalled()
  })

  it('treats getEnterOptionsSync as unsupported for douyin without strict-equivalent api', async () => {
    const getLaunchOptionsSync = vi.fn(() => ({
      path: 'pages/index/index',
      query: {},
      scene: 1001,
    }))
    const api = createTestWeapi({
      adapter: {
        getLaunchOptionsSync,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('getEnterOptionsSync')).toMatchObject({
      method: 'getEnterOptionsSync',
      target: 'getEnterOptionsSync',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getEnterOptionsSync()).rejects.toMatchObject({
      errMsg: 'tt.getEnterOptionsSync:fail method not supported',
    })
    expect(getLaunchOptionsSync).not.toHaveBeenCalled()
  })

  it('treats previewMedia as unsupported for douyin without strict-equivalent api', async () => {
    const previewImage = vi.fn((options: any) => {
      options.success?.({ errMsg: 'previewImage:ok' })
    })
    const api = createTestWeapi({
      adapter: {
        previewImage,
      },
      platform: 'tt',
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
        { url: 'https://example.com/c.jpg', type: 'image' },
      ],
      current: 0,
    } as any)).rejects.toMatchObject({
      errMsg: 'tt.previewMedia:fail method not supported',
    })
    expect(previewImage).not.toHaveBeenCalled()
  })

  it('treats getVideoInfo as unsupported for douyin without strict-equivalent api', async () => {
    const getFileInfo = vi.fn((options: any) => {
      options.success?.({ size: 1024 })
    })
    const api = createTestWeapi({
      adapter: {
        getFileInfo,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('getVideoInfo')).toMatchObject({
      method: 'getVideoInfo',
      target: 'getVideoInfo',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getVideoInfo({ src: '/tmp/demo.mp4' } as any)).rejects.toMatchObject({
      errMsg: 'tt.getVideoInfo:fail method not supported',
    })
    expect(getFileInfo).not.toHaveBeenCalled()
  })

  it('treats saveFileToDisk as unsupported for douyin without strict-equivalent api', async () => {
    const saveFile = vi.fn((options: any) => {
      options.success?.({ savedFilePath: '/tmp/tt-saved.txt' })
    })
    const api = createTestWeapi({
      adapter: {
        saveFile,
      },
      platform: 'tt',
    })

    expect(api.resolveTarget('saveFileToDisk')).toMatchObject({
      method: 'saveFileToDisk',
      target: 'saveFileToDisk',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.saveFileToDisk({ filePath: '/tmp/tt-temp.txt' } as any)).rejects.toMatchObject({
      errMsg: 'tt.saveFileToDisk:fail method not supported',
    })
    expect(saveFile).not.toHaveBeenCalled()
  })

  it('treats getSystemSetting/getAppAuthorizeSetting as unsupported for douyin without strict-equivalent api', async () => {
    const getSetting = vi.fn((options: any) => {
      options.success?.({ authSetting: { 'scope.userInfo': true } })
    })
    const api = createTestWeapi({
      adapter: {
        getSetting,
      },
      platform: 'tt',
    })

    for (const methodName of ['getSystemSetting', 'getAppAuthorizeSetting'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]()).rejects.toMatchObject({
        errMsg: `tt.${methodName}:fail method not supported`,
      })
    }
    expect(getSetting).not.toHaveBeenCalled()
  })

  it('maps interstitial and live-player context apis for douyin', async () => {
    const createInterstitialAd = vi.fn(() => ({ show: vi.fn() }))
    const createLivePlayerContext = vi.fn(() => ({ play: vi.fn() }))
    const createVideoContext = vi.fn(() => ({ play: vi.fn() }))
    const api = createTestWeapi({
      adapter: {
        createInterstitialAd,
        createLivePlayerContext,
        createVideoContext,
      },
      platform: 'tt',
    }) as Record<string, any>

    api.createInterstitialAd({ adUnitId: 'tt-ad-1' })
    api.createLivePlayerContext('tt-live-player')

    expect(createInterstitialAd).toHaveBeenNthCalledWith(1, expect.objectContaining({ adUnitId: 'tt-ad-1' }))
    expect(createLivePlayerContext).toHaveBeenNthCalledWith(1, 'tt-live-player', expect.any(Object))
    expect(createVideoContext).not.toHaveBeenCalled()

    expect(api.resolveTarget('createLivePusherContext')).toMatchObject({
      method: 'createLivePusherContext',
      target: 'createLivePusherContext',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createLivePusherContext('tt-live-pusher' as any)).rejects.toMatchObject({
      errMsg: 'tt.createLivePusherContext:fail method not supported',
    })
  })

  it('treats createRewardedVideoAd as unsupported for douyin without strict-equivalent api', async () => {
    const createInterstitialAd = vi.fn(() => ({ show: vi.fn() }))
    const api = createTestWeapi({
      adapter: {
        createInterstitialAd,
      },
      platform: 'tt',
    })
    expect(api.resolveTarget('createRewardedVideoAd')).toMatchObject({
      method: 'createRewardedVideoAd',
      target: 'createRewardedVideoAd',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.createRewardedVideoAd({ adUnitId: 'tt-ad-2' } as any)).rejects.toMatchObject({
      errMsg: 'tt.createRewardedVideoAd:fail method not supported',
    })
    expect(createInterstitialAd).not.toHaveBeenCalled()
  })
}
