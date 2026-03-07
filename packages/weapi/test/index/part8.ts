import { createWeapi } from '@/index'

export function registerWeapiIndexPart8Tests() {
  it.each([
    'chooseInvoiceTitle',
    'chooseLicensePlate',
    'choosePoi',
    'cropImage',
    'editImage',
    'exitVoIPChat',
    'faceDetect',
    'getApiCategory',
    'getBackgroundFetchToken',
    'getChannelsLiveInfo',
    'getChannelsLiveNoticeInfo',
    'getChannelsShareKey',
    'getChatToolInfo',
    'getCommonConfig',
    'getGroupEnterInfo',
    'getPrivacySetting',
    'initFaceDetect',
    'join1v1Chat',
  ])('treats %s as unsupported when adapter method is missing', async (methodName) => {
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
    'shareAppMessageToGroup',
    'shareEmojiToGroup',
    'shareFileMessage',
    'shareFileToGroup',
    'shareImageToGroup',
    'shareToOfficialAccount',
    'shareToWeRun',
    'shareVideoMessage',
    'shareVideoToGroup',
    'showRedPackage',
    'startDeviceMotionListening',
    'startHCE',
    'startLocalServiceDiscovery',
    'startLocationUpdate',
    'startLocationUpdateBackground',
    'startRecord',
    'startSoterAuthentication',
    'stopBackgroundAudio',
    'stopDeviceMotionListening',
    'stopFaceDetect',
  ])('treats %s as unsupported in strict mode when adapter method is missing', async (methodName) => {
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
    'requestCommonPayment',
    'requestDeviceVoIP',
    'requestMerchantTransfer',
    'requirePrivacyAuthorize',
    'reserveChannelsLive',
    'selectGroupMembers',
    'sendHCEMessage',
    'sendSms',
    'setBackgroundFetchToken',
    'setEnable1v1Chat',
    'setTopBarText',
    'setWindowSize',
    'stopHCE',
    'stopLocalServiceDiscovery',
    'stopLocationUpdate',
    'stopRecord',
    'stopVoice',
    'subscribeVoIPVideoMembers',
    'updateVoIPChatMuteConfig',
    'updateWeChatApp',
  ])('treats %s as unsupported when adapter does not expose it', async (methodName) => {
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
    'getBackgroundAudioPlayerState',
    'getDeviceBenchmarkInfo',
    'getDeviceVoIPList',
    'getHCEState',
    'getInferenceEnvInfo',
    'getNFCAdapter',
    'getPerformance',
    'getRandomValues',
    'getRealtimeLogManager',
    'getRendererUserAgent',
    'getScreenRecordingState',
    'getSecureElementPasses',
    'getSelectedTextRange',
    'getShowSplashAdStatus',
    'getSkylineInfo',
    'getUserCryptoManager',
    'getWeRunData',
    'getXrFrameSystem',
    'isBluetoothDevicePaired',
    'isVKSupport',
  ])('treats %s as unsupported when no strict-equivalent api exists', async (methodName) => {
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
    'createBLEPeripheralServer',
    'createBufferURL',
    'createCacheManager',
    'createGlobalPayment',
    'createInferenceSession',
    'createMediaAudioPlayer',
    'createMediaContainer',
    'createMediaRecorder',
    'createTCPSocket',
    'createUDPSocket',
    'createVideoDecoder',
  ])('treats %s as unsupported when adapter method is absent', async (methodName) => {
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
    'loadBuiltInFontFace',
    'notifyGroupMembers',
    'requestIdleCallback',
    'revokeBufferURL',
    'rewriteRoute',
    'seekBackgroundAudio',
    'setEnableDebug',
    'setInnerAudioOption',
  ])('treats %s as unsupported for alipay and douyin when method is missing', async (methodName) => {
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
