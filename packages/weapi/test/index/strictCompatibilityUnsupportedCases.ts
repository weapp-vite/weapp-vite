import { createWeapi } from '@/index'

export function registerWeapiIndexStrictCompatibilityUnsupportedCasesTests() {
  it.each([
    'createAudioContext',
    'createWebAudioContext',
    'pluginLogin',
    'showShareImageMenu',
    'updateShareMenu',
    'openEmbeddedMiniProgram',
    'openSystemBluetoothSetting',
    'reportEvent',
    'reportMonitor',
    'reportPerformance',
    'openSingleStickerView',
    'openStickerIPView',
    'openStickerSetView',
    'openStoreCouponDetail',
    'openStoreOrderDetail',
    'pauseBackgroundAudio',
    'pauseVoice',
    'playBackgroundAudio',
    'playVoice',
    'postMessageToReferrerMiniProgram',
    'postMessageToReferrerPage',
    'preDownloadSubpackage',
    'preloadAssets',
    'preloadSkylineView',
    'preloadWebview',
    'removeSecureElementPass',
  ])('treats %s as unsupported in strict compatibility mode', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
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

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats createAudioContext/createWebAudioContext as unsupported for $platform without aliasing createInnerAudioContext', async ({ platform, normalizedPlatform }) => {
    const createInnerAudioContext = vi.fn(() => ({
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
    }))
    const api = createWeapi({
      adapter: {
        createInnerAudioContext,
      },
      platform,
    }) as Record<string, any>

    for (const methodName of ['createAudioContext', 'createWebAudioContext'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName]('audio-id')).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }

    expect(createInnerAudioContext).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats on/offNetworkWeakChange as unsupported for $platform without aliasing on/offNetworkStatusChange', async ({ platform, normalizedPlatform }) => {
    const onNetworkStatusChange = vi.fn()
    const offNetworkStatusChange = vi.fn()
    const api = createWeapi({
      adapter: {
        onNetworkStatusChange,
        offNetworkStatusChange,
      },
      platform,
    }) as Record<string, any>

    for (const methodName of ['onNetworkWeakChange', 'offNetworkWeakChange'] as const) {
      expect(api.resolveTarget(methodName)).toMatchObject({
        method: methodName,
        target: methodName,
        supportLevel: 'unsupported',
        supported: false,
        semanticAligned: false,
      })
      await expect(api[methodName](vi.fn())).rejects.toMatchObject({
        errMsg: `${normalizedPlatform}.${methodName}:fail method not supported`,
      })
    }

    expect(onNetworkStatusChange).not.toHaveBeenCalled()
    expect(offNetworkStatusChange).not.toHaveBeenCalled()
  })

  it.each([
    { platform: 'alipay', normalizedPlatform: 'my' },
    { platform: 'tt', normalizedPlatform: 'tt' },
  ])('treats getBackgroundFetchToken as unsupported for $platform without aliasing getBackgroundFetchData', async ({ platform, normalizedPlatform }) => {
    const getBackgroundFetchData = vi.fn((options: any) => {
      options.success?.({
        fetchedData: 'payload',
        path: '/pages/index/index',
        timeStamp: Date.now(),
      })
    })
    const api = createWeapi({
      adapter: {
        getBackgroundFetchData,
      },
      platform,
    }) as Record<string, any>

    expect(api.resolveTarget('getBackgroundFetchToken')).toMatchObject({
      method: 'getBackgroundFetchToken',
      target: 'getBackgroundFetchToken',
      supportLevel: 'unsupported',
      supported: false,
      semanticAligned: false,
    })
    await expect(api.getBackgroundFetchToken()).rejects.toMatchObject({
      errMsg: `${normalizedPlatform}.getBackgroundFetchToken:fail method not supported`,
    })
    expect(getBackgroundFetchData).not.toHaveBeenCalled()
  })

  it.each([
    'addCard',
    'addFileToFavorites',
    'addPaymentPassFinish',
    'addPaymentPassGetCertificateData',
    'addPhoneCalendar',
    'addPhoneRepeatCalendar',
    'addVideoToFavorites',
    'authorizeForMiniProgram',
    'authPrivateMessage',
    'bindEmployeeRelation',
    'canAddSecureElementPass',
    'openCard',
    'openChannelsActivity',
    'openChannelsEvent',
    'openChannelsLive',
    'openChannelsLiveNoticeInfo',
    'openChannelsUserProfile',
    'openChatTool',
    'openHKOfflinePayView',
    'openInquiriesTopic',
  ])('treats %s as unsupported when no strict-equivalent target exists', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
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

  it.each([
    'addPhoneContact',
    'openOfficialAccountArticle',
    'openOfficialAccountChat',
    'openOfficialAccountProfile',
    'openPrivacyContract',
  ])('treats %s as unsupported without strict-equivalent runtime API', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
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

  it.each([
    'canvasGetImageData',
    'canvasPutImageData',
    'checkDeviceSupportHevc',
    'checkEmployeeRelation',
    'checkIsAddedToMyMiniProgram',
    'checkIsOpenAccessibility',
    'checkIsPictureInPictureActive',
  ])('treats %s as unsupported when no strict-equivalent target exists', async (methodName) => {
    for (const platform of ['alipay', 'tt'] as const) {
      const normalizedPlatform = platform === 'alipay' ? 'my' : platform
      const api = createWeapi({
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
}
