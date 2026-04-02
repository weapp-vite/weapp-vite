import {
  generateMethodCompatibilityMatrix,
  validateSupportMatrixConsistency,
  WEAPI_METHOD_SUPPORT_MATRIX,
  WEAPI_PLATFORM_SUPPORT_MATRIX,
} from '@/core/methodMapping'
import { collectRenamedMappings, STRICT_RENAMED_ALLOWLIST } from '@/core/strictAliasPolicy'

interface ExpectedMappingItem {
  method: string
  my: string
  tt: string
  mySupported?: boolean
  ttSupported?: boolean
}

export function registerWeapiIndexAliasPolicyAndMatrixConsistencyTests() {
  it('keeps top high-frequency alias mappings in sync', () => {
    const expectedMappings: readonly ExpectedMappingItem[] = [
      { method: 'chooseAddress', my: 'chooseAddress', tt: 'chooseAddress', mySupported: false },
      { method: 'createAudioContext', my: 'createAudioContext', tt: 'createAudioContext', mySupported: false, ttSupported: false },
      { method: 'createWebAudioContext', my: 'createWebAudioContext', tt: 'createWebAudioContext', mySupported: false, ttSupported: false },
      { method: 'getSystemInfoAsync', my: 'getSystemInfo', tt: 'getSystemInfo' },
      { method: 'openAppAuthorizeSetting', my: 'openAppAuthorizeSetting', tt: 'openAppAuthorizeSetting', mySupported: false, ttSupported: false },
      { method: 'pluginLogin', my: 'pluginLogin', tt: 'pluginLogin', mySupported: false, ttSupported: false },
      { method: 'login', my: 'login', tt: 'login', mySupported: false },
      { method: 'authorize', my: 'authorize', tt: 'authorize', mySupported: false },
      { method: 'checkSession', my: 'checkSession', tt: 'checkSession', mySupported: false },
      { method: 'requestSubscribeDeviceMessage', my: 'requestSubscribeDeviceMessage', tt: 'requestSubscribeDeviceMessage', mySupported: false, ttSupported: false },
      { method: 'requestSubscribeEmployeeMessage', my: 'requestSubscribeEmployeeMessage', tt: 'requestSubscribeEmployeeMessage', mySupported: false, ttSupported: false },
      { method: 'restartMiniProgram', my: 'restartMiniProgram', tt: 'restartMiniProgram', mySupported: false, ttSupported: false },
      { method: 'scanCode', my: 'scanCode', tt: 'scanCode', mySupported: false },
      { method: 'requestPayment', my: 'requestPayment', tt: 'requestPayment', mySupported: false, ttSupported: false },
      { method: 'requestOrderPayment', my: 'requestOrderPayment', tt: 'requestOrderPayment', mySupported: false, ttSupported: false },
      { method: 'requestPluginPayment', my: 'requestPluginPayment', tt: 'requestPluginPayment', mySupported: false, ttSupported: false },
      { method: 'requestVirtualPayment', my: 'requestVirtualPayment', tt: 'requestVirtualPayment', mySupported: false, ttSupported: false },
      { method: 'previewMedia', my: 'previewMedia', tt: 'previewMedia', mySupported: false, ttSupported: false },
      { method: 'createInterstitialAd', my: 'createInterstitialAd', tt: 'createInterstitialAd', mySupported: false },
      { method: 'createRewardedVideoAd', my: 'createRewardedAd', tt: 'createRewardedVideoAd' },
      { method: 'createLivePlayerContext', my: 'createLivePlayerContext', tt: 'createLivePlayerContext', mySupported: false },
      { method: 'createLivePusherContext', my: 'createLivePusherContext', tt: 'createLivePusherContext', mySupported: false, ttSupported: false },
      { method: 'getVideoInfo', my: 'getVideoInfo', tt: 'getVideoInfo', ttSupported: false },
      { method: 'showShareImageMenu', my: 'showShareImageMenu', tt: 'showShareImageMenu', mySupported: false, ttSupported: false },
      { method: 'updateShareMenu', my: 'updateShareMenu', tt: 'updateShareMenu', mySupported: false, ttSupported: false },
      { method: 'openEmbeddedMiniProgram', my: 'openEmbeddedMiniProgram', tt: 'openEmbeddedMiniProgram', mySupported: false, ttSupported: false },
      { method: 'saveFileToDisk', my: 'saveFileToDisk', tt: 'saveFileToDisk', ttSupported: false },
      { method: 'getEnterOptionsSync', my: 'getEnterOptionsSync', tt: 'getEnterOptionsSync', ttSupported: false },
      { method: 'getSystemSetting', my: 'getSystemSetting', tt: 'getSystemSetting', ttSupported: false },
      { method: 'getUserProfile', my: 'getUserProfile', tt: 'getUserProfile', mySupported: false },
      { method: 'getUserInfo', my: 'getUserInfo', tt: 'getUserInfo', mySupported: false },
      { method: 'getAppAuthorizeSetting', my: 'getAppAuthorizeSetting', tt: 'getAppAuthorizeSetting', ttSupported: false },
      { method: 'getAppBaseInfo', my: 'getAppBaseInfo', tt: 'getAppBaseInfo', ttSupported: false },
      { method: 'chooseVideo', my: 'chooseVideo', tt: 'chooseVideo', ttSupported: false },
      { method: 'chooseMedia', my: 'chooseMedia', tt: 'chooseMedia', mySupported: false },
      { method: 'chooseMessageFile', my: 'chooseMessageFile', tt: 'chooseMessageFile', mySupported: false, ttSupported: false },
      { method: 'getFuzzyLocation', my: 'getFuzzyLocation', tt: 'getFuzzyLocation', mySupported: false, ttSupported: false },
      { method: 'createBLEConnection', my: 'connectBLEDevice', tt: 'createBLEConnection', ttSupported: false },
      { method: 'closeBLEConnection', my: 'disconnectBLEDevice', tt: 'closeBLEConnection', ttSupported: false },
      { method: 'hideHomeButton', my: 'hideBackHome', tt: 'hideHomeButton' },
      { method: 'getWindowInfo', my: 'getWindowInfo', tt: 'getWindowInfo', ttSupported: false },
      { method: 'getDeviceInfo', my: 'getDeviceInfo', tt: 'getDeviceInfo', mySupported: false, ttSupported: false },
      { method: 'getAccountInfoSync', my: 'getAccountInfoSync', tt: 'getAccountInfoSync', ttSupported: false },
      { method: 'getLogManager', my: 'getLogManager', tt: 'getLogManager', mySupported: false, ttSupported: false },
      { method: 'nextTick', my: 'nextTick', tt: 'nextTick', mySupported: false, ttSupported: false },
      { method: 'onWindowResize', my: 'onWindowResize', tt: 'onWindowResize', mySupported: false },
      { method: 'offWindowResize', my: 'offWindowResize', tt: 'offWindowResize', mySupported: false },
      { method: 'reportAnalytics', my: 'reportAnalytics', tt: 'reportAnalytics', mySupported: false },
      { method: 'setBackgroundColor', my: 'setBackgroundColor', tt: 'setBackgroundColor', ttSupported: false },
      { method: 'setBackgroundTextStyle', my: 'setBackgroundTextStyle', tt: 'setBackgroundTextStyle', ttSupported: false },
      { method: 'getNetworkType', my: 'getNetworkType', tt: 'getNetworkType', ttSupported: false },
      { method: 'getBatteryInfo', my: 'getBatteryInfo', tt: 'getBatteryInfo', ttSupported: false },
      { method: 'getBatteryInfoSync', my: 'getBatteryInfoSync', tt: 'getBatteryInfoSync', ttSupported: false },
      { method: 'saveVideoToPhotosAlbum', my: 'saveVideoToPhotosAlbum', tt: 'saveVideoToPhotosAlbum', ttSupported: false },
      { method: 'batchSetStorage', my: 'batchSetStorage', tt: 'batchSetStorage', mySupported: false, ttSupported: false },
      { method: 'batchGetStorage', my: 'batchGetStorage', tt: 'batchGetStorage', mySupported: false, ttSupported: false },
      { method: 'batchSetStorageSync', my: 'batchSetStorageSync', tt: 'batchSetStorageSync', mySupported: false, ttSupported: false },
      { method: 'batchGetStorageSync', my: 'batchGetStorageSync', tt: 'batchGetStorageSync', mySupported: false, ttSupported: false },
      { method: 'createCameraContext', my: 'createCameraContext', tt: 'createCameraContext', mySupported: false, ttSupported: false },
      { method: 'offMemoryWarning', my: 'offMemoryWarning', tt: 'offMemoryWarning', ttSupported: false },
      { method: 'cancelIdleCallback', my: 'cancelIdleCallback', tt: 'cancelIdleCallback', mySupported: false, ttSupported: false },
    ]

    for (const item of expectedMappings) {
      expect(generateMethodCompatibilityMatrix().find(mapping => mapping.method === item.method)).toMatchObject({
        method: item.method,
        alipayTarget: item.my,
        douyinTarget: item.tt,
        alipaySupported: item.mySupported ?? true,
        douyinSupported: item.ttSupported ?? true,
      })
    }
  })

  it('keeps renamed targets on strict-equivalent allowlists', () => {
    const compatibilityMatrix = generateMethodCompatibilityMatrix()
    const alipayRenamedTargets = collectRenamedMappings(compatibilityMatrix, 'my')
    const douyinRenamedTargets = collectRenamedMappings(compatibilityMatrix, 'tt')

    expect(alipayRenamedTargets).toEqual(STRICT_RENAMED_ALLOWLIST.my)
    expect(douyinRenamedTargets).toEqual(STRICT_RENAMED_ALLOWLIST.tt)

    for (const item of compatibilityMatrix) {
      if (item.alipayTarget !== item.method) {
        expect(item.alipaySupportLevel).toBe('mapped')
        expect(item.alipaySemanticallyAligned).toBe(true)
      }
      if (item.douyinTarget !== item.method) {
        expect(item.douyinSupportLevel).toBe('mapped')
        expect(item.douyinSemanticallyAligned).toBe(true)
      }
    }
  })

  it('keeps fallback mappings disabled on my and tt', () => {
    const compatibilityMatrix = generateMethodCompatibilityMatrix()
    const fallbackMappings = compatibilityMatrix.filter(
      item => item.alipaySupportLevel === 'fallback' || item.douyinSupportLevel === 'fallback',
    )

    expect(fallbackMappings).toEqual([])
  })

  it('keeps support matrix data in sync with mappings', () => {
    const {
      extraDouyinMappings,
      missingCatalogMethods,
      missingDocs,
      missingDouyinMappings,
      missingMappings,
    } = validateSupportMatrixConsistency()
    expect(missingDocs).toEqual([])
    expect(missingMappings).toEqual([])
    expect(missingDouyinMappings).toEqual([])
    expect(extraDouyinMappings).toEqual([])
    expect(missingCatalogMethods).toEqual([])
    expect(WEAPI_PLATFORM_SUPPORT_MATRIX.map(item => item.platform)).toEqual([
      '微信小程序',
      '支付宝小程序',
      '抖音小程序',
      '其他平台（swan/jd/xhs 等）',
    ])
    const methodNames = WEAPI_METHOD_SUPPORT_MATRIX.map(item => item.method)
    const uniqueMethodNames = new Set(methodNames)
    expect(uniqueMethodNames.size).toBe(methodNames.length)
    expect(methodNames).toEqual(expect.arrayContaining([
      'showToast',
      'showLoading',
      'showActionSheet',
      'showModal',
      'chooseImage',
      'chooseMedia',
      'chooseMessageFile',
      'getFuzzyLocation',
      'saveFile',
      'setClipboardData',
      'getClipboardData',
      'chooseAddress',
      'createAudioContext',
      'createWebAudioContext',
      'getSystemInfoAsync',
      'openAppAuthorizeSetting',
      'pluginLogin',
      'requestSubscribeDeviceMessage',
      'requestSubscribeEmployeeMessage',
      'restartMiniProgram',
      'scanCode',
      'showShareImageMenu',
      'updateShareMenu',
      'openEmbeddedMiniProgram',
      'saveFileToDisk',
      'getEnterOptionsSync',
      'getSystemSetting',
      'getUserProfile',
      'getUserInfo',
      'getAppAuthorizeSetting',
      'getAppBaseInfo',
      'login',
      'chooseVideo',
      'hideHomeButton',
      'getWindowInfo',
      'getDeviceInfo',
      'getAccountInfoSync',
      'getLogManager',
      'nextTick',
      'onWindowResize',
      'offWindowResize',
      'reportAnalytics',
      'setBackgroundColor',
      'setBackgroundTextStyle',
      'getNetworkType',
      'getBatteryInfo',
      'getBatteryInfoSync',
      'saveVideoToPhotosAlbum',
      'batchSetStorage',
      'batchGetStorage',
      'batchSetStorageSync',
      'batchGetStorageSync',
      'createCameraContext',
      'offMemoryWarning',
      'cancelIdleCallback',
      'onBLEConnectionStateChange',
      'offBLEConnectionStateChange',
    ]))
  })
}
