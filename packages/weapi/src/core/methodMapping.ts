import { WEAPI_MY_METHODS, WEAPI_TT_METHODS, WEAPI_WX_METHODS } from './apiCatalog'
import { isPlainObject } from './utils.ts'

export interface WeapiMethodMappingRule {
  target: string
  mapArgs?: (args: unknown[]) => unknown[]
  mapResult?: (result: any) => any
}

export type WeapiSupportLevel = 'native' | 'mapped' | 'fallback' | 'unsupported'

export interface ResolveMethodMappingOptions {
  allowFallback?: boolean
}

export interface WeapiResolvedMethodMapping {
  target: string
  source: 'explicit' | 'fallback' | 'identity'
  rule?: WeapiMethodMappingRule
}

export interface WeapiPlatformSupportMatrixItem {
  platform: string
  globalObject: string
  typeSource: string
  support: string
}

export interface WeapiMethodSupportMatrixItem {
  method: string
  description: string
  wxStrategy: string
  alipayStrategy: string
  douyinStrategy: string
  support: string
}

export interface WeapiMethodCompatibilityItem {
  method: string
  wxStrategy: string
  alipayTarget: string
  alipayStrategy: string
  alipaySupported: boolean
  alipaySupportLevel: WeapiSupportLevel
  alipaySemanticallyAligned: boolean
  douyinTarget: string
  douyinStrategy: string
  douyinSupported: boolean
  douyinSupportLevel: WeapiSupportLevel
  douyinSemanticallyAligned: boolean
  support: string
  semanticSupport: string
}

export interface WeapiApiCoveragePlatformItem {
  platform: string
  alias: string
  supportedApis: number
  semanticAlignedApis: number
  fallbackApis: number
  totalApis: number
  coverage: string
  semanticCoverage: string
}

export interface WeapiApiCoverageReport {
  totalApis: number
  fullyAlignedApis: number
  fullyAlignedCoverage: string
  fullySemanticallyAlignedApis: number
  fullySemanticallyAlignedCoverage: string
  platforms: readonly WeapiApiCoveragePlatformItem[]
}

const WEAPI_WX_METHOD_SET = new Set<string>(WEAPI_WX_METHODS)
const WEAPI_MY_METHOD_SET = new Set<string>(WEAPI_MY_METHODS)
const WEAPI_TT_METHOD_SET = new Set<string>(WEAPI_TT_METHODS)

const PLATFORM_METHOD_SET: Readonly<Record<'my' | 'tt', Set<string>>> = {
  my: WEAPI_MY_METHOD_SET,
  tt: WEAPI_TT_METHOD_SET,
}

const SYNTHETIC_SUPPORT_METHOD_SET: Readonly<Record<'my' | 'tt', Set<string>>> = {
  my: new Set([
    'addCard',
    'addFileToFavorites',
    'addPaymentPassFinish',
    'addPaymentPassGetCertificateData',
    'addPhoneCalendar',
    'addPhoneContact',
    'addPhoneRepeatCalendar',
    'addVideoToFavorites',
    'authorizeForMiniProgram',
    'authPrivateMessage',
    'bindEmployeeRelation',
    'canAddSecureElementPass',
    'canvasGetImageData',
    'canvasPutImageData',
    'checkDeviceSupportHevc',
    'checkEmployeeRelation',
    'checkIsAddedToMyMiniProgram',
    'checkIsOpenAccessibility',
    'checkIsPictureInPictureActive',
    'checkIsSoterEnrolledInDevice',
    'checkIsSupportSoterAuthentication',
    'openCard',
    'openChannelsActivity',
    'openChannelsEvent',
    'openChannelsLive',
    'openChannelsLiveNoticeInfo',
    'openChannelsUserProfile',
    'openChatTool',
    'openHKOfflinePayView',
    'openInquiriesTopic',
    'openOfficialAccountArticle',
    'openOfficialAccountChat',
    'openOfficialAccountProfile',
    'openPrivacyContract',
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
    'chooseInvoiceTitle',
    'chooseLicensePlate',
    'choosePoi',
    'closeBLEConnection',
    'createBLEConnection',
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
    'loadBuiltInFontFace',
    'notifyGroupMembers',
    'requestIdleCallback',
    'revokeBufferURL',
    'rewriteRoute',
    'seekBackgroundAudio',
    'setEnableDebug',
    'setInnerAudioOption',
    'openCustomerServiceChat',
    'createVKSession',
    'compressVideo',
    'openVideoEditor',
    'getShareInfo',
    'joinVoIPChat',
    'batchSetStorage',
    'batchGetStorage',
    'batchSetStorageSync',
    'batchGetStorageSync',
    'createCameraContext',
    'cancelIdleCallback',
    'nextTick',
    'getLogManager',
    'reportAnalytics',
    'onWindowResize',
    'offWindowResize',
  ]),
  tt: new Set([
    'addCard',
    'addFileToFavorites',
    'addPaymentPassFinish',
    'addPaymentPassGetCertificateData',
    'addPhoneCalendar',
    'addPhoneContact',
    'addPhoneRepeatCalendar',
    'addVideoToFavorites',
    'authorizeForMiniProgram',
    'authPrivateMessage',
    'bindEmployeeRelation',
    'canAddSecureElementPass',
    'canvasGetImageData',
    'canvasPutImageData',
    'checkDeviceSupportHevc',
    'checkEmployeeRelation',
    'checkIsAddedToMyMiniProgram',
    'checkIsOpenAccessibility',
    'checkIsPictureInPictureActive',
    'checkIsSoterEnrolledInDevice',
    'checkIsSupportSoterAuthentication',
    'openCard',
    'openChannelsActivity',
    'openChannelsEvent',
    'openChannelsLive',
    'openChannelsLiveNoticeInfo',
    'openChannelsUserProfile',
    'openChatTool',
    'openHKOfflinePayView',
    'openInquiriesTopic',
    'openOfficialAccountArticle',
    'openOfficialAccountChat',
    'openOfficialAccountProfile',
    'openPrivacyContract',
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
    'chooseInvoiceTitle',
    'chooseLicensePlate',
    'choosePoi',
    'closeBLEConnection',
    'createBLEConnection',
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
    'loadBuiltInFontFace',
    'notifyGroupMembers',
    'requestIdleCallback',
    'revokeBufferURL',
    'rewriteRoute',
    'seekBackgroundAudio',
    'setEnableDebug',
    'setInnerAudioOption',
    'showActionSheet',
    'openCustomerServiceChat',
    'createVKSession',
    'compressVideo',
    'openVideoEditor',
    'getShareInfo',
    'joinVoIPChat',
    'openDocument',
    'batchSetStorage',
    'batchGetStorage',
    'batchSetStorageSync',
    'batchGetStorageSync',
    'createCameraContext',
    'onMemoryWarning',
    'offMemoryWarning',
    'cancelIdleCallback',
    'nextTick',
    'getLogManager',
  ]),
}

export const WEAPI_PLATFORM_SUPPORT_MATRIX: readonly WeapiPlatformSupportMatrixItem[] = [
  {
    platform: '微信小程序',
    globalObject: '`wx`',
    typeSource: '`miniprogram-api-typings`',
    support: '✅ 全量',
  },
  {
    platform: '支付宝小程序',
    globalObject: '`my`',
    typeSource: '`@mini-types/alipay`',
    support: '✅ 全量',
  },
  {
    platform: '抖音小程序',
    globalObject: '`tt`',
    typeSource: '`@douyin-microapp/typings`',
    support: '✅ 全量',
  },
  {
    platform: '其他平台（swan/jd/xhs 等）',
    globalObject: '运行时宿主对象',
    typeSource: '运行时透传',
    support: '⚠️ 按宿主能力支持',
  },
]

export const WEAPI_METHOD_SUPPORT_MATRIX: readonly WeapiMethodSupportMatrixItem[] = [
  {
    method: 'showToast',
    description: '显示消息提示框。',
    wxStrategy: '直连 `wx.showToast`',
    alipayStrategy: '`title/icon` 映射到 `content/type` 后调用 `my.showToast`',
    douyinStrategy: '`icon=error` 映射为 `fail` 后调用 `tt.showToast`',
    support: '✅',
  },
  {
    method: 'showLoading',
    description: '显示 loading 提示框。',
    wxStrategy: '直连 `wx.showLoading`',
    alipayStrategy: '`title` 映射到 `content` 后调用 `my.showLoading`',
    douyinStrategy: '直连 `tt.showLoading`',
    support: '✅',
  },
  {
    method: 'showActionSheet',
    description: '显示操作菜单。',
    wxStrategy: '直连 `wx.showActionSheet`',
    alipayStrategy: '`itemList` ↔ `items`、`index` ↔ `tapIndex` 双向对齐',
    douyinStrategy: '优先直连 `tt.showActionSheet`；缺失时降级到 `tt.showModal` shim',
    support: '✅',
  },
  {
    method: 'showModal',
    description: '显示模态弹窗。',
    wxStrategy: '直连 `wx.showModal`',
    alipayStrategy: '调用 `my.confirm` 并对齐按钮字段与 `cancel` 结果',
    douyinStrategy: '直连 `tt.showModal`',
    support: '✅',
  },
  {
    method: 'chooseImage',
    description: '选择图片。',
    wxStrategy: '直连 `wx.chooseImage`',
    alipayStrategy: '返回值 `apFilePaths` 映射到 `tempFilePaths`',
    douyinStrategy: '`tempFilePaths` 字符串转数组，缺失时从 `tempFiles.path` 兜底',
    support: '✅',
  },
  {
    method: 'chooseMedia',
    description: '选择图片或视频。',
    wxStrategy: '直连 `wx.chooseMedia`',
    alipayStrategy: '映射到 `my.chooseImage`，并补齐 `tempFiles[].tempFilePath/fileType`',
    douyinStrategy: '直连 `tt.chooseMedia`，并补齐 `tempFiles[].tempFilePath/fileType`',
    support: '⚠️',
  },
  {
    method: 'chooseMessageFile',
    description: '选择会话文件。',
    wxStrategy: '直连 `wx.chooseMessageFile`',
    alipayStrategy: '映射到 `my.chooseImage`，并补齐 `tempFiles[].path/name`',
    douyinStrategy: '映射到 `tt.chooseImage`，并补齐 `tempFiles[].path/name`',
    support: '⚠️',
  },
  {
    method: 'getFuzzyLocation',
    description: '获取模糊地理位置。',
    wxStrategy: '直连 `wx.getFuzzyLocation`',
    alipayStrategy: '映射到 `my.getLocation`',
    douyinStrategy: '映射到 `tt.getLocation`',
    support: '⚠️',
  },
  {
    method: 'previewMedia',
    description: '预览图片和视频。',
    wxStrategy: '直连 `wx.previewMedia`',
    alipayStrategy: '映射到 `my.previewImage`，并将 `sources.url` 对齐到 `urls`',
    douyinStrategy: '映射到 `tt.previewImage`，并将 `sources.url` 对齐到 `urls`',
    support: '⚠️',
  },
  {
    method: 'createInterstitialAd',
    description: '创建插屏广告实例。',
    wxStrategy: '直连 `wx.createInterstitialAd`',
    alipayStrategy: '映射到 `my.createRewardedAd`，并对齐入参 `adUnitId`',
    douyinStrategy: '直连 `tt.createInterstitialAd`',
    support: '⚠️',
  },
  {
    method: 'createRewardedVideoAd',
    description: '创建激励视频广告实例。',
    wxStrategy: '直连 `wx.createRewardedVideoAd`',
    alipayStrategy: '映射到 `my.createRewardedAd`，并对齐入参 `adUnitId`',
    douyinStrategy: '映射到 `tt.createInterstitialAd`',
    support: '⚠️',
  },
  {
    method: 'createLivePlayerContext',
    description: '创建直播播放器上下文。',
    wxStrategy: '直连 `wx.createLivePlayerContext`',
    alipayStrategy: '映射到 `my.createVideoContext`',
    douyinStrategy: '直连 `tt.createLivePlayerContext`',
    support: '⚠️',
  },
  {
    method: 'createLivePusherContext',
    description: '创建直播推流上下文。',
    wxStrategy: '直连 `wx.createLivePusherContext`',
    alipayStrategy: '映射到 `my.createVideoContext`',
    douyinStrategy: '映射到 `tt.createVideoContext`',
    support: '⚠️',
  },
  {
    method: 'getVideoInfo',
    description: '获取视频详细信息。',
    wxStrategy: '直连 `wx.getVideoInfo`',
    alipayStrategy: '直连 `my.getVideoInfo`',
    douyinStrategy: '映射到 `tt.getFileInfo`，并将 `src` 对齐为 `filePath`',
    support: '⚠️',
  },
  {
    method: 'saveFile',
    description: '保存文件（跨端扩展，微信 typings 未声明同名 API）。',
    wxStrategy: '微信当前 typings 未声明同名 API，保留为跨端扩展能力',
    alipayStrategy: '请求参数 `tempFilePath` ↔ `apFilePath`、结果映射为 `savedFilePath`',
    douyinStrategy: '直连 `tt.saveFile`，并在缺失时用 `filePath` 兜底 `savedFilePath`',
    support: '⚠️',
  },
  {
    method: 'setClipboardData',
    description: '设置剪贴板内容。',
    wxStrategy: '直连 `wx.setClipboardData`',
    alipayStrategy: '转调 `my.setClipboard` 并映射 `data` → `text`',
    douyinStrategy: '直连 `tt.setClipboardData`',
    support: '✅',
  },
  {
    method: 'getClipboardData',
    description: '获取剪贴板内容。',
    wxStrategy: '直连 `wx.getClipboardData`',
    alipayStrategy: '转调 `my.getClipboard` 并映射 `text` → `data`',
    douyinStrategy: '直连 `tt.getClipboardData`',
    support: '✅',
  },
  {
    method: 'chooseAddress',
    description: '选择收货地址。',
    wxStrategy: '直连 `wx.chooseAddress`',
    alipayStrategy: '映射到 `my.getAddress`',
    douyinStrategy: '直连 `tt.chooseAddress`',
    support: '⚠️',
  },
  {
    method: 'createAudioContext',
    description: '创建音频上下文。',
    wxStrategy: '直连 `wx.createAudioContext`',
    alipayStrategy: '映射到 `my.createInnerAudioContext`',
    douyinStrategy: '映射到 `tt.createInnerAudioContext`',
    support: '⚠️',
  },
  {
    method: 'createWebAudioContext',
    description: '创建 WebAudio 上下文。',
    wxStrategy: '直连 `wx.createWebAudioContext`',
    alipayStrategy: '映射到 `my.createInnerAudioContext`',
    douyinStrategy: '映射到 `tt.createInnerAudioContext`',
    support: '⚠️',
  },
  {
    method: 'getSystemInfoAsync',
    description: '异步获取系统信息。',
    wxStrategy: '直连 `wx.getSystemInfoAsync`',
    alipayStrategy: '映射到 `my.getSystemInfo`',
    douyinStrategy: '映射到 `tt.getSystemInfo`',
    support: '✅',
  },
  {
    method: 'openAppAuthorizeSetting',
    description: '打开小程序授权设置页。',
    wxStrategy: '直连 `wx.openAppAuthorizeSetting`',
    alipayStrategy: '映射到 `my.openSetting`',
    douyinStrategy: '映射到 `tt.openSetting`',
    support: '⚠️',
  },
  {
    method: 'pluginLogin',
    description: '插件登录。',
    wxStrategy: '直连 `wx.pluginLogin`',
    alipayStrategy: '映射到 `my.getAuthCode`，并对齐返回 `code` 字段',
    douyinStrategy: '映射到 `tt.login`',
    support: '⚠️',
  },
  {
    method: 'login',
    description: '登录。',
    wxStrategy: '直连 `wx.login`',
    alipayStrategy: '映射到 `my.getAuthCode`，并对齐返回 `code` 字段',
    douyinStrategy: '直连 `tt.login`',
    support: '⚠️',
  },
  {
    method: 'authorize',
    description: '提前向用户发起授权请求。',
    wxStrategy: '直连 `wx.authorize`',
    alipayStrategy: '映射到 `my.getAuthCode`，并对齐 `scope` -> `scopes` 参数',
    douyinStrategy: '直连 `tt.authorize`',
    support: '⚠️',
  },
  {
    method: 'checkSession',
    description: '检查登录态是否过期。',
    wxStrategy: '直连 `wx.checkSession`',
    alipayStrategy: '映射到 `my.getAuthCode`，按成功结果对齐 `checkSession:ok`',
    douyinStrategy: '直连 `tt.checkSession`',
    support: '⚠️',
  },
  {
    method: 'requestSubscribeDeviceMessage',
    description: '请求订阅设备消息。',
    wxStrategy: '直连 `wx.requestSubscribeDeviceMessage`',
    alipayStrategy: '映射到 `my.requestSubscribeMessage`',
    douyinStrategy: '映射到 `tt.requestSubscribeMessage`',
    support: '⚠️',
  },
  {
    method: 'requestSubscribeEmployeeMessage',
    description: '请求订阅员工消息。',
    wxStrategy: '直连 `wx.requestSubscribeEmployeeMessage`',
    alipayStrategy: '映射到 `my.requestSubscribeMessage`',
    douyinStrategy: '映射到 `tt.requestSubscribeMessage`',
    support: '⚠️',
  },
  {
    method: 'restartMiniProgram',
    description: '重启小程序。',
    wxStrategy: '直连 `wx.restartMiniProgram`',
    alipayStrategy: '映射到 `my.reLaunch`',
    douyinStrategy: '映射到 `tt.reLaunch`',
    support: '⚠️',
  },
  {
    method: 'scanCode',
    description: '扫码。',
    wxStrategy: '直连 `wx.scanCode`',
    alipayStrategy: '映射到 `my.scan`',
    douyinStrategy: '直连 `tt.scanCode`',
    support: '✅',
  },
  {
    method: 'requestPayment',
    description: '发起支付。',
    wxStrategy: '直连 `wx.requestPayment`',
    alipayStrategy: '映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`',
    douyinStrategy: '映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`',
    support: '⚠️',
  },
  {
    method: 'requestOrderPayment',
    description: '发起订单支付。',
    wxStrategy: '直连 `wx.requestOrderPayment`',
    alipayStrategy: '映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`',
    douyinStrategy: '映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`',
    support: '⚠️',
  },
  {
    method: 'requestPluginPayment',
    description: '发起插件支付。',
    wxStrategy: '直连 `wx.requestPluginPayment`',
    alipayStrategy: '映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`',
    douyinStrategy: '映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`',
    support: '⚠️',
  },
  {
    method: 'requestVirtualPayment',
    description: '发起虚拟支付。',
    wxStrategy: '直连 `wx.requestVirtualPayment`',
    alipayStrategy: '映射到 `my.tradePay`，并将微信支付参数对齐到 `orderStr`',
    douyinStrategy: '映射到 `tt.pay`，并将微信支付参数对齐到 `orderInfo`',
    support: '⚠️',
  },
  {
    method: 'showShareImageMenu',
    description: '显示分享图片菜单。',
    wxStrategy: '直连 `wx.showShareImageMenu`',
    alipayStrategy: '映射到 `my.showSharePanel`',
    douyinStrategy: '映射到 `tt.showShareMenu`',
    support: '⚠️',
  },
  {
    method: 'updateShareMenu',
    description: '更新分享菜单配置。',
    wxStrategy: '直连 `wx.updateShareMenu`',
    alipayStrategy: '映射到 `my.showSharePanel`',
    douyinStrategy: '映射到 `tt.showShareMenu`',
    support: '⚠️',
  },
  {
    method: 'openEmbeddedMiniProgram',
    description: '打开嵌入式小程序。',
    wxStrategy: '直连 `wx.openEmbeddedMiniProgram`',
    alipayStrategy: '映射到 `my.navigateToMiniProgram`',
    douyinStrategy: '映射到 `tt.navigateToMiniProgram`',
    support: '⚠️',
  },
  {
    method: 'saveFileToDisk',
    description: '保存文件到磁盘。',
    wxStrategy: '直连 `wx.saveFileToDisk`',
    alipayStrategy: '直连 `my.saveFileToDisk`',
    douyinStrategy: '映射到 `tt.saveFile`',
    support: '⚠️',
  },
  {
    method: 'getEnterOptionsSync',
    description: '获取启动参数（同步）。',
    wxStrategy: '直连 `wx.getEnterOptionsSync`',
    alipayStrategy: '直连 `my.getEnterOptionsSync`',
    douyinStrategy: '映射到 `tt.getLaunchOptionsSync`',
    support: '⚠️',
  },
  {
    method: 'getSystemSetting',
    description: '获取系统设置。',
    wxStrategy: '直连 `wx.getSystemSetting`',
    alipayStrategy: '直连 `my.getSystemSetting`',
    douyinStrategy: '映射到 `tt.getSetting`',
    support: '⚠️',
  },
  {
    method: 'getUserProfile',
    description: '获取用户资料。',
    wxStrategy: '直连 `wx.getUserProfile`',
    alipayStrategy: '映射到 `my.getOpenUserInfo`',
    douyinStrategy: '直连 `tt.getUserProfile`',
    support: '⚠️',
  },
  {
    method: 'getUserInfo',
    description: '获取用户信息。',
    wxStrategy: '直连 `wx.getUserInfo`',
    alipayStrategy: '映射到 `my.getOpenUserInfo`',
    douyinStrategy: '直连 `tt.getUserInfo`',
    support: '⚠️',
  },
  {
    method: 'getAppAuthorizeSetting',
    description: '获取 App 授权设置。',
    wxStrategy: '直连 `wx.getAppAuthorizeSetting`',
    alipayStrategy: '直连 `my.getAppAuthorizeSetting`',
    douyinStrategy: '映射到 `tt.getSetting`',
    support: '⚠️',
  },
  {
    method: 'getAppBaseInfo',
    description: '获取 App 基础信息。',
    wxStrategy: '直连 `wx.getAppBaseInfo`',
    alipayStrategy: '直连 `my.getAppBaseInfo`',
    douyinStrategy: '映射到 `tt.getEnvInfoSync`',
    support: '⚠️',
  },
  {
    method: 'chooseVideo',
    description: '选择视频。',
    wxStrategy: '直连 `wx.chooseVideo`',
    alipayStrategy: '直连 `my.chooseVideo`',
    douyinStrategy: '映射到 `tt.chooseMedia`，固定 `mediaType=[video]` 并对齐返回结构',
    support: '⚠️',
  },
  {
    method: 'hideHomeButton',
    description: '隐藏返回首页按钮。',
    wxStrategy: '直连 `wx.hideHomeButton`',
    alipayStrategy: '映射到 `my.hideBackHome`',
    douyinStrategy: '直连 `tt.hideHomeButton`',
    support: '✅',
  },
  {
    method: 'getWindowInfo',
    description: '获取窗口信息。',
    wxStrategy: '直连 `wx.getWindowInfo`',
    alipayStrategy: '直连 `my.getWindowInfo`',
    douyinStrategy: '映射到 `tt.getSystemInfo`，并提取窗口字段',
    support: '⚠️',
  },
  {
    method: 'getDeviceInfo',
    description: '获取设备基础信息。',
    wxStrategy: '直连 `wx.getDeviceInfo`',
    alipayStrategy: '映射到 `my.getSystemInfo`，并提取设备字段',
    douyinStrategy: '映射到 `tt.getSystemInfo`，并提取设备字段',
    support: '⚠️',
  },
  {
    method: 'getAccountInfoSync',
    description: '同步获取当前账号信息。',
    wxStrategy: '直连 `wx.getAccountInfoSync`',
    alipayStrategy: '直连 `my.getAccountInfoSync`',
    douyinStrategy: '映射到 `tt.getEnvInfoSync`，并对齐账号字段结构',
    support: '⚠️',
  },
  {
    method: 'setBackgroundColor',
    description: '动态设置窗口背景色。',
    wxStrategy: '直连 `wx.setBackgroundColor`',
    alipayStrategy: '直连 `my.setBackgroundColor`',
    douyinStrategy: '映射到 `tt.setNavigationBarColor`，对齐 `backgroundColor/frontColor`',
    support: '⚠️',
  },
  {
    method: 'setBackgroundTextStyle',
    description: '动态设置下拉背景字体样式。',
    wxStrategy: '直连 `wx.setBackgroundTextStyle`',
    alipayStrategy: '直连 `my.setBackgroundTextStyle`',
    douyinStrategy: '映射到 `tt.setNavigationBarColor`，将 `textStyle` 对齐到 `frontColor`',
    support: '⚠️',
  },
  {
    method: 'getNetworkType',
    description: '获取网络类型。',
    wxStrategy: '直连 `wx.getNetworkType`',
    alipayStrategy: '直连 `my.getNetworkType`',
    douyinStrategy: '映射到 `tt.getSystemInfo`，兜底补齐 `networkType`',
    support: '⚠️',
  },
  {
    method: 'getBatteryInfo',
    description: '异步获取电量信息。',
    wxStrategy: '直连 `wx.getBatteryInfo`',
    alipayStrategy: '直连 `my.getBatteryInfo`',
    douyinStrategy: '映射到 `tt.getSystemInfo`，补齐 `level/isCharging`',
    support: '⚠️',
  },
  {
    method: 'getBatteryInfoSync',
    description: '同步获取电量信息。',
    wxStrategy: '直连 `wx.getBatteryInfoSync`',
    alipayStrategy: '直连 `my.getBatteryInfoSync`',
    douyinStrategy: '映射到 `tt.getSystemInfoSync`，补齐 `level/isCharging`',
    support: '⚠️',
  },
  {
    method: 'getLogManager',
    description: '获取日志管理器实例。',
    wxStrategy: '直连 `wx.getLogManager`',
    alipayStrategy: '使用内置日志 shim（对齐 `log/info/warn/error`）',
    douyinStrategy: '使用内置日志 shim（对齐 `log/info/warn/error`）',
    support: '⚠️',
  },
  {
    method: 'nextTick',
    description: '延迟到下一个 UI 更新时机执行回调。',
    wxStrategy: '直连 `wx.nextTick`',
    alipayStrategy: '使用内置 microtask shim 调度回调',
    douyinStrategy: '使用内置 microtask shim 调度回调',
    support: '⚠️',
  },
  {
    method: 'onWindowResize',
    description: '监听窗口尺寸变化事件。',
    wxStrategy: '直连 `wx.onWindowResize`',
    alipayStrategy: '使用内置 shim，通过 `my.onAppShow + my.getWindowInfo` 近似监听',
    douyinStrategy: '直连 `tt.onWindowResize`',
    support: '⚠️',
  },
  {
    method: 'offWindowResize',
    description: '取消监听窗口尺寸变化事件。',
    wxStrategy: '直连 `wx.offWindowResize`',
    alipayStrategy: '使用内置 shim，移除 `onWindowResize` 注册回调',
    douyinStrategy: '直连 `tt.offWindowResize`',
    support: '⚠️',
  },
  {
    method: 'reportAnalytics',
    description: '上报分析数据。',
    wxStrategy: '直连 `wx.reportAnalytics`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '直连 `tt.reportAnalytics`',
    support: '⚠️',
  },
  {
    method: 'openCustomerServiceChat',
    description: '打开客服会话。',
    wxStrategy: '直连 `wx.openCustomerServiceChat`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createVKSession',
    description: '创建视觉识别会话。',
    wxStrategy: '直连 `wx.createVKSession`',
    alipayStrategy: '使用内置 VKSession shim（对齐 `start/stop/destroy`）',
    douyinStrategy: '使用内置 VKSession shim（对齐 `start/stop/destroy`）',
    support: '⚠️',
  },
  {
    method: 'compressVideo',
    description: '压缩视频文件。',
    wxStrategy: '直连 `wx.compressVideo`',
    alipayStrategy: '使用内置 shim（回传原始文件路径）',
    douyinStrategy: '使用内置 shim（回传原始文件路径）',
    support: '⚠️',
  },
  {
    method: 'openVideoEditor',
    description: '打开视频编辑器。',
    wxStrategy: '直连 `wx.openVideoEditor`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getShareInfo',
    description: '获取转发详细信息。',
    wxStrategy: '直连 `wx.getShareInfo`',
    alipayStrategy: '使用内置 shim（补齐 `encryptedData/iv`）',
    douyinStrategy: '使用内置 shim（补齐 `encryptedData/iv`）',
    support: '⚠️',
  },
  {
    method: 'joinVoIPChat',
    description: '加入音视频通话。',
    wxStrategy: '直连 `wx.joinVoIPChat`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openDocument',
    description: '打开文档。',
    wxStrategy: '直连 `wx.openDocument`',
    alipayStrategy: '直连 `my.openDocument`',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'saveVideoToPhotosAlbum',
    description: '保存视频到系统相册。',
    wxStrategy: '直连 `wx.saveVideoToPhotosAlbum`',
    alipayStrategy: '直连 `my.saveVideoToPhotosAlbum`',
    douyinStrategy: '映射到 `tt.saveImageToPhotosAlbum`',
    support: '⚠️',
  },
  {
    method: 'batchSetStorage',
    description: '批量异步写入缓存。',
    wxStrategy: '直连 `wx.batchSetStorage`',
    alipayStrategy: '使用内置 shim，逐项转调 `my.setStorage`',
    douyinStrategy: '使用内置 shim，逐项转调 `tt.setStorage`',
    support: '⚠️',
  },
  {
    method: 'batchGetStorage',
    description: '批量异步读取缓存。',
    wxStrategy: '直连 `wx.batchGetStorage`',
    alipayStrategy: '使用内置 shim，逐项转调 `my.getStorage`',
    douyinStrategy: '使用内置 shim，逐项转调 `tt.getStorage`',
    support: '⚠️',
  },
  {
    method: 'batchSetStorageSync',
    description: '批量同步写入缓存。',
    wxStrategy: '直连 `wx.batchSetStorageSync`',
    alipayStrategy: '使用内置 shim，逐项转调 `my.setStorageSync`',
    douyinStrategy: '使用内置 shim，逐项转调 `tt.setStorageSync`',
    support: '⚠️',
  },
  {
    method: 'batchGetStorageSync',
    description: '批量同步读取缓存。',
    wxStrategy: '直连 `wx.batchGetStorageSync`',
    alipayStrategy: '使用内置 shim，逐项转调 `my.getStorageSync`',
    douyinStrategy: '使用内置 shim，逐项转调 `tt.getStorageSync`',
    support: '⚠️',
  },
  {
    method: 'createCameraContext',
    description: '创建相机上下文对象。',
    wxStrategy: '直连 `wx.createCameraContext`',
    alipayStrategy: '使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`）',
    douyinStrategy: '使用内置 CameraContext shim（对齐 `takePhoto/startRecord/stopRecord`）',
    support: '⚠️',
  },
  {
    method: 'offMemoryWarning',
    description: '取消内存不足告警监听。',
    wxStrategy: '直连 `wx.offMemoryWarning`',
    alipayStrategy: '直连 `my.offMemoryWarning`',
    douyinStrategy: '使用内置 shim，配合 `tt.onMemoryWarning` 实现监听解绑',
    support: '⚠️',
  },
  {
    method: 'cancelIdleCallback',
    description: '取消空闲回调。',
    wxStrategy: '直连 `wx.cancelIdleCallback`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'addCard',
    description: '添加微信卡券。',
    wxStrategy: '直连 `wx.addCard`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'addFileToFavorites',
    description: '添加文件到收藏。',
    wxStrategy: '直连 `wx.addFileToFavorites`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'addPaymentPassFinish',
    description: '添加支付 pass 完成回调。',
    wxStrategy: '直连 `wx.addPaymentPassFinish`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'addPaymentPassGetCertificateData',
    description: '添加支付 pass 证书数据回调。',
    wxStrategy: '直连 `wx.addPaymentPassGetCertificateData`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'addPhoneCalendar',
    description: '添加日历事件。',
    wxStrategy: '直连 `wx.addPhoneCalendar`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'addPhoneContact',
    description: '添加手机联系人。',
    wxStrategy: '直连 `wx.addPhoneContact`',
    alipayStrategy: '直连 `my.addPhoneContact`',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'addPhoneRepeatCalendar',
    description: '添加重复日历事件。',
    wxStrategy: '直连 `wx.addPhoneRepeatCalendar`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'addVideoToFavorites',
    description: '添加视频到收藏。',
    wxStrategy: '直连 `wx.addVideoToFavorites`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'authorizeForMiniProgram',
    description: '获取小程序授权码。',
    wxStrategy: '直连 `wx.authorizeForMiniProgram`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'authPrivateMessage',
    description: '校验私密消息。',
    wxStrategy: '直连 `wx.authPrivateMessage`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'bindEmployeeRelation',
    description: '绑定员工关系。',
    wxStrategy: '直连 `wx.bindEmployeeRelation`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'canAddSecureElementPass',
    description: '检测是否可添加安全元素卡片。',
    wxStrategy: '直连 `wx.canAddSecureElementPass`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'canvasGetImageData',
    description: '获取 canvas 区域像素数据。',
    wxStrategy: '直连 `wx.canvasGetImageData`',
    alipayStrategy: '使用内置 shim，返回空像素数据结构',
    douyinStrategy: '使用内置 shim，返回空像素数据结构',
    support: '⚠️',
  },
  {
    method: 'canvasPutImageData',
    description: '将像素数据绘制到 canvas。',
    wxStrategy: '直连 `wx.canvasPutImageData`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'checkDeviceSupportHevc',
    description: '检测设备是否支持 HEVC 解码。',
    wxStrategy: '直连 `wx.checkDeviceSupportHevc`',
    alipayStrategy: '使用内置 shim，返回默认不支持',
    douyinStrategy: '使用内置 shim，返回默认不支持',
    support: '⚠️',
  },
  {
    method: 'checkEmployeeRelation',
    description: '查询员工关系绑定状态。',
    wxStrategy: '直连 `wx.checkEmployeeRelation`',
    alipayStrategy: '使用内置 shim，返回未绑定',
    douyinStrategy: '使用内置 shim，返回未绑定',
    support: '⚠️',
  },
  {
    method: 'checkIsAddedToMyMiniProgram',
    description: '检测是否已添加到我的小程序。',
    wxStrategy: '直连 `wx.checkIsAddedToMyMiniProgram`',
    alipayStrategy: '使用内置 shim，返回未添加',
    douyinStrategy: '使用内置 shim，返回未添加',
    support: '⚠️',
  },
  {
    method: 'checkIsOpenAccessibility',
    description: '检测系统无障碍是否开启。',
    wxStrategy: '直连 `wx.checkIsOpenAccessibility`',
    alipayStrategy: '使用内置 shim，返回未开启',
    douyinStrategy: '使用内置 shim，返回未开启',
    support: '⚠️',
  },
  {
    method: 'checkIsPictureInPictureActive',
    description: '检测是否处于画中画状态。',
    wxStrategy: '直连 `wx.checkIsPictureInPictureActive`',
    alipayStrategy: '使用内置 shim，返回未激活',
    douyinStrategy: '使用内置 shim，返回未激活',
    support: '⚠️',
  },
  {
    method: 'checkIsSoterEnrolledInDevice',
    description: '检测设备是否录入 SOTER 信息。',
    wxStrategy: '直连 `wx.checkIsSoterEnrolledInDevice`',
    alipayStrategy: '使用内置 shim，返回未录入',
    douyinStrategy: '使用内置 shim，返回未录入',
    support: '⚠️',
  },
  {
    method: 'checkIsSupportSoterAuthentication',
    description: '检测设备是否支持 SOTER 生物认证。',
    wxStrategy: '直连 `wx.checkIsSupportSoterAuthentication`',
    alipayStrategy: '使用内置 shim，返回默认不支持',
    douyinStrategy: '使用内置 shim，返回默认不支持',
    support: '⚠️',
  },
  {
    method: 'openCard',
    description: '打开卡券详情。',
    wxStrategy: '直连 `wx.openCard`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openChannelsActivity',
    description: '打开视频号活动页。',
    wxStrategy: '直连 `wx.openChannelsActivity`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openChannelsEvent',
    description: '打开视频号活动详情。',
    wxStrategy: '直连 `wx.openChannelsEvent`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openChannelsLive',
    description: '打开视频号直播。',
    wxStrategy: '直连 `wx.openChannelsLive`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openChannelsLiveNoticeInfo',
    description: '打开视频号直播预告详情。',
    wxStrategy: '直连 `wx.openChannelsLiveNoticeInfo`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openChannelsUserProfile',
    description: '打开视频号用户主页。',
    wxStrategy: '直连 `wx.openChannelsUserProfile`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openChatTool',
    description: '打开客服工具页。',
    wxStrategy: '直连 `wx.openChatTool`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openHKOfflinePayView',
    description: '打开香港线下支付视图。',
    wxStrategy: '直连 `wx.openHKOfflinePayView`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openInquiriesTopic',
    description: '打开询价话题。',
    wxStrategy: '直连 `wx.openInquiriesTopic`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openOfficialAccountArticle',
    description: '打开公众号文章。',
    wxStrategy: '直连 `wx.openOfficialAccountArticle`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openOfficialAccountChat',
    description: '打开公众号会话。',
    wxStrategy: '直连 `wx.openOfficialAccountChat`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openOfficialAccountProfile',
    description: '打开公众号主页。',
    wxStrategy: '直连 `wx.openOfficialAccountProfile`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openPrivacyContract',
    description: '打开隐私协议页面。',
    wxStrategy: '直连 `wx.openPrivacyContract`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openSystemBluetoothSetting',
    description: '打开系统蓝牙设置页面。',
    wxStrategy: '直连 `wx.openSystemBluetoothSetting`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'reportEvent',
    description: '上报事件埋点。',
    wxStrategy: '直连 `wx.reportEvent`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'reportMonitor',
    description: '上报监控数据。',
    wxStrategy: '直连 `wx.reportMonitor`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'reportPerformance',
    description: '上报性能数据。',
    wxStrategy: '直连 `wx.reportPerformance`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openSingleStickerView',
    description: '打开单个表情贴纸详情。',
    wxStrategy: '直连 `wx.openSingleStickerView`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openStickerIPView',
    description: '打开表情 IP 页面。',
    wxStrategy: '直连 `wx.openStickerIPView`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openStickerSetView',
    description: '打开表情包详情页。',
    wxStrategy: '直连 `wx.openStickerSetView`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openStoreCouponDetail',
    description: '打开小店优惠券详情。',
    wxStrategy: '直连 `wx.openStoreCouponDetail`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'openStoreOrderDetail',
    description: '打开小店订单详情。',
    wxStrategy: '直连 `wx.openStoreOrderDetail`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'pauseBackgroundAudio',
    description: '暂停后台音频。',
    wxStrategy: '直连 `wx.pauseBackgroundAudio`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'pauseVoice',
    description: '暂停播放语音。',
    wxStrategy: '直连 `wx.pauseVoice`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'playBackgroundAudio',
    description: '播放后台音频。',
    wxStrategy: '直连 `wx.playBackgroundAudio`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'playVoice',
    description: '播放语音。',
    wxStrategy: '直连 `wx.playVoice`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'postMessageToReferrerMiniProgram',
    description: '向来源小程序发送消息。',
    wxStrategy: '直连 `wx.postMessageToReferrerMiniProgram`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'postMessageToReferrerPage',
    description: '向来源页面发送消息。',
    wxStrategy: '直连 `wx.postMessageToReferrerPage`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'preDownloadSubpackage',
    description: '预下载分包。',
    wxStrategy: '直连 `wx.preDownloadSubpackage`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'preloadAssets',
    description: '预加载资源。',
    wxStrategy: '直连 `wx.preloadAssets`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'preloadSkylineView',
    description: '预加载 Skyline 视图。',
    wxStrategy: '直连 `wx.preloadSkylineView`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'preloadWebview',
    description: '预加载 WebView 页面。',
    wxStrategy: '直连 `wx.preloadWebview`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'removeSecureElementPass',
    description: '移除安全元素卡片。',
    wxStrategy: '直连 `wx.removeSecureElementPass`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'chooseInvoiceTitle',
    description: '选择发票抬头。',
    wxStrategy: '直连 `wx.chooseInvoiceTitle`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'chooseLicensePlate',
    description: '选择车牌号。',
    wxStrategy: '直连 `wx.chooseLicensePlate`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'choosePoi',
    description: '选择兴趣点 POI。',
    wxStrategy: '直连 `wx.choosePoi`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'closeBLEConnection',
    description: '断开低功耗蓝牙连接。',
    wxStrategy: '直连 `wx.closeBLEConnection`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createBLEConnection',
    description: '创建低功耗蓝牙连接。',
    wxStrategy: '直连 `wx.createBLEConnection`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'cropImage',
    description: '裁剪图片。',
    wxStrategy: '直连 `wx.cropImage`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'editImage',
    description: '编辑图片。',
    wxStrategy: '直连 `wx.editImage`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'exitVoIPChat',
    description: '退出音视频通话。',
    wxStrategy: '直连 `wx.exitVoIPChat`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'faceDetect',
    description: '人脸检测。',
    wxStrategy: '直连 `wx.faceDetect`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getApiCategory',
    description: '获取 API 分类信息。',
    wxStrategy: '直连 `wx.getApiCategory`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getBackgroundFetchToken',
    description: '获取后台拉取 token。',
    wxStrategy: '直连 `wx.getBackgroundFetchToken`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getChannelsLiveInfo',
    description: '获取视频号直播信息。',
    wxStrategy: '直连 `wx.getChannelsLiveInfo`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getChannelsLiveNoticeInfo',
    description: '获取视频号直播预告信息。',
    wxStrategy: '直连 `wx.getChannelsLiveNoticeInfo`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getChannelsShareKey',
    description: '获取视频号分享 key。',
    wxStrategy: '直连 `wx.getChannelsShareKey`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getChatToolInfo',
    description: '获取客服工具信息。',
    wxStrategy: '直连 `wx.getChatToolInfo`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getCommonConfig',
    description: '获取通用配置。',
    wxStrategy: '直连 `wx.getCommonConfig`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getGroupEnterInfo',
    description: '获取群聊进入信息。',
    wxStrategy: '直连 `wx.getGroupEnterInfo`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getPrivacySetting',
    description: '获取隐私设置。',
    wxStrategy: '直连 `wx.getPrivacySetting`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'initFaceDetect',
    description: '初始化人脸检测。',
    wxStrategy: '直连 `wx.initFaceDetect`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'join1v1Chat',
    description: '发起 1v1 通话。',
    wxStrategy: '直连 `wx.join1v1Chat`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'shareAppMessageToGroup',
    description: '分享到群聊会话。',
    wxStrategy: '直连 `wx.shareAppMessageToGroup`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'shareEmojiToGroup',
    description: '分享到群聊表情。',
    wxStrategy: '直连 `wx.shareEmojiToGroup`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'shareFileMessage',
    description: '分享文件消息。',
    wxStrategy: '直连 `wx.shareFileMessage`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'shareFileToGroup',
    description: '分享文件到群。',
    wxStrategy: '直连 `wx.shareFileToGroup`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'shareImageToGroup',
    description: '分享图片到群。',
    wxStrategy: '直连 `wx.shareImageToGroup`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'shareToOfficialAccount',
    description: '分享至公众号。',
    wxStrategy: '直连 `wx.shareToOfficialAccount`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'shareToWeRun',
    description: '分享至微信运动。',
    wxStrategy: '直连 `wx.shareToWeRun`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'shareVideoMessage',
    description: '分享视频消息。',
    wxStrategy: '直连 `wx.shareVideoMessage`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'shareVideoToGroup',
    description: '分享视频到群。',
    wxStrategy: '直连 `wx.shareVideoToGroup`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'showRedPackage',
    description: '展示红包组件。',
    wxStrategy: '直连 `wx.showRedPackage`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'startDeviceMotionListening',
    description: '开始监听设备方向变化。',
    wxStrategy: '直连 `wx.startDeviceMotionListening`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'startHCE',
    description: '启动 HCE 功能。',
    wxStrategy: '直连 `wx.startHCE`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'startLocalServiceDiscovery',
    description: '开始本地服务发现。',
    wxStrategy: '直连 `wx.startLocalServiceDiscovery`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'startLocationUpdate',
    description: '开始持续定位。',
    wxStrategy: '直连 `wx.startLocationUpdate`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'startLocationUpdateBackground',
    description: '开始后台持续定位。',
    wxStrategy: '直连 `wx.startLocationUpdateBackground`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'startRecord',
    description: '开始录音。',
    wxStrategy: '直连 `wx.startRecord`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'startSoterAuthentication',
    description: '开始 SOTER 认证。',
    wxStrategy: '直连 `wx.startSoterAuthentication`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'stopBackgroundAudio',
    description: '停止后台音频。',
    wxStrategy: '直连 `wx.stopBackgroundAudio`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'stopDeviceMotionListening',
    description: '停止监听设备方向变化。',
    wxStrategy: '直连 `wx.stopDeviceMotionListening`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'stopFaceDetect',
    description: '停止人脸检测。',
    wxStrategy: '直连 `wx.stopFaceDetect`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'requestCommonPayment',
    description: '发起通用支付请求。',
    wxStrategy: '直连 `wx.requestCommonPayment`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'requestDeviceVoIP',
    description: '请求设备 VoIP 能力。',
    wxStrategy: '直连 `wx.requestDeviceVoIP`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'requestMerchantTransfer',
    description: '发起商家转账请求。',
    wxStrategy: '直连 `wx.requestMerchantTransfer`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'requirePrivacyAuthorize',
    description: '请求隐私授权。',
    wxStrategy: '直连 `wx.requirePrivacyAuthorize`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'reserveChannelsLive',
    description: '预约视频号直播。',
    wxStrategy: '直连 `wx.reserveChannelsLive`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'selectGroupMembers',
    description: '选择群成员。',
    wxStrategy: '直连 `wx.selectGroupMembers`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'sendHCEMessage',
    description: '发送 HCE 消息。',
    wxStrategy: '直连 `wx.sendHCEMessage`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'sendSms',
    description: '发送短信。',
    wxStrategy: '直连 `wx.sendSms`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'setBackgroundFetchToken',
    description: '设置后台拉取 token。',
    wxStrategy: '直连 `wx.setBackgroundFetchToken`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'setEnable1v1Chat',
    description: '设置 1v1 通话可用状态。',
    wxStrategy: '直连 `wx.setEnable1v1Chat`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'setTopBarText',
    description: '设置顶栏文本。',
    wxStrategy: '直连 `wx.setTopBarText`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'setWindowSize',
    description: '设置窗口尺寸。',
    wxStrategy: '直连 `wx.setWindowSize`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'stopHCE',
    description: '停止 HCE 功能。',
    wxStrategy: '直连 `wx.stopHCE`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'stopLocalServiceDiscovery',
    description: '停止本地服务发现。',
    wxStrategy: '直连 `wx.stopLocalServiceDiscovery`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'stopLocationUpdate',
    description: '停止持续定位。',
    wxStrategy: '直连 `wx.stopLocationUpdate`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'stopRecord',
    description: '停止录音。',
    wxStrategy: '直连 `wx.stopRecord`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'stopVoice',
    description: '停止播放语音。',
    wxStrategy: '直连 `wx.stopVoice`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'subscribeVoIPVideoMembers',
    description: '订阅 VoIP 视频成员变化。',
    wxStrategy: '直连 `wx.subscribeVoIPVideoMembers`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'updateVoIPChatMuteConfig',
    description: '更新 VoIP 静音配置。',
    wxStrategy: '直连 `wx.updateVoIPChatMuteConfig`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'updateWeChatApp',
    description: '拉起微信升级流程。',
    wxStrategy: '直连 `wx.updateWeChatApp`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getBackgroundAudioPlayerState',
    description: '获取后台音频播放状态。',
    wxStrategy: '直连 `wx.getBackgroundAudioPlayerState`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getDeviceBenchmarkInfo',
    description: '获取设备性能评估信息。',
    wxStrategy: '直连 `wx.getDeviceBenchmarkInfo`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getDeviceVoIPList',
    description: '获取设备 VoIP 列表。',
    wxStrategy: '直连 `wx.getDeviceVoIPList`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getHCEState',
    description: '获取 HCE 状态。',
    wxStrategy: '直连 `wx.getHCEState`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getInferenceEnvInfo',
    description: '获取推理环境信息。',
    wxStrategy: '直连 `wx.getInferenceEnvInfo`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getNFCAdapter',
    description: '获取 NFC 适配器。',
    wxStrategy: '直连 `wx.getNFCAdapter`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getPerformance',
    description: '获取性能对象。',
    wxStrategy: '直连 `wx.getPerformance`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getRandomValues',
    description: '获取随机值。',
    wxStrategy: '直连 `wx.getRandomValues`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getRealtimeLogManager',
    description: '获取实时日志管理器。',
    wxStrategy: '直连 `wx.getRealtimeLogManager`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getRendererUserAgent',
    description: '获取渲染层 UserAgent。',
    wxStrategy: '直连 `wx.getRendererUserAgent`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getScreenRecordingState',
    description: '获取录屏状态。',
    wxStrategy: '直连 `wx.getScreenRecordingState`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getSecureElementPasses',
    description: '获取安全元素卡片列表。',
    wxStrategy: '直连 `wx.getSecureElementPasses`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getSelectedTextRange',
    description: '获取已选中文本范围。',
    wxStrategy: '直连 `wx.getSelectedTextRange`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getShowSplashAdStatus',
    description: '获取开屏广告展示状态。',
    wxStrategy: '直连 `wx.getShowSplashAdStatus`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getSkylineInfo',
    description: '获取 Skyline 信息。',
    wxStrategy: '直连 `wx.getSkylineInfo`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getUserCryptoManager',
    description: '获取用户加密管理器。',
    wxStrategy: '直连 `wx.getUserCryptoManager`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getWeRunData',
    description: '获取微信运动数据。',
    wxStrategy: '直连 `wx.getWeRunData`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'getXrFrameSystem',
    description: '获取 XR 框架系统对象。',
    wxStrategy: '直连 `wx.getXrFrameSystem`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'isBluetoothDevicePaired',
    description: '判断蓝牙设备是否已配对。',
    wxStrategy: '直连 `wx.isBluetoothDevicePaired`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'isVKSupport',
    description: '判断是否支持视觉识别能力。',
    wxStrategy: '直连 `wx.isVKSupport`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createBLEPeripheralServer',
    description: '创建 BLE 外设服务实例。',
    wxStrategy: '直连 `wx.createBLEPeripheralServer`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createBufferURL',
    description: '创建缓冲区 URL。',
    wxStrategy: '直连 `wx.createBufferURL`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createCacheManager',
    description: '创建缓存管理器。',
    wxStrategy: '直连 `wx.createCacheManager`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createGlobalPayment',
    description: '创建全局支付对象。',
    wxStrategy: '直连 `wx.createGlobalPayment`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createInferenceSession',
    description: '创建推理会话。',
    wxStrategy: '直连 `wx.createInferenceSession`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createMediaAudioPlayer',
    description: '创建媒体音频播放器。',
    wxStrategy: '直连 `wx.createMediaAudioPlayer`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createMediaContainer',
    description: '创建媒体容器实例。',
    wxStrategy: '直连 `wx.createMediaContainer`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createMediaRecorder',
    description: '创建媒体录制器。',
    wxStrategy: '直连 `wx.createMediaRecorder`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createTCPSocket',
    description: '创建 TCP Socket。',
    wxStrategy: '直连 `wx.createTCPSocket`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createUDPSocket',
    description: '创建 UDP Socket。',
    wxStrategy: '直连 `wx.createUDPSocket`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'createVideoDecoder',
    description: '创建视频解码器。',
    wxStrategy: '直连 `wx.createVideoDecoder`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'loadBuiltInFontFace',
    description: '加载内置字体。',
    wxStrategy: '直连 `wx.loadBuiltInFontFace`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'notifyGroupMembers',
    description: '通知群成员。',
    wxStrategy: '直连 `wx.notifyGroupMembers`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'requestIdleCallback',
    description: '空闲时回调请求。',
    wxStrategy: '直连 `wx.requestIdleCallback`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'revokeBufferURL',
    description: '释放缓冲区 URL。',
    wxStrategy: '直连 `wx.revokeBufferURL`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'rewriteRoute',
    description: '重写路由规则。',
    wxStrategy: '直连 `wx.rewriteRoute`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'seekBackgroundAudio',
    description: '调整后台音频播放进度。',
    wxStrategy: '直连 `wx.seekBackgroundAudio`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'setEnableDebug',
    description: '设置调试开关。',
    wxStrategy: '直连 `wx.setEnableDebug`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
  {
    method: 'setInnerAudioOption',
    description: '设置内部音频选项。',
    wxStrategy: '直连 `wx.setInnerAudioOption`',
    alipayStrategy: '使用内置 no-op shim（保持调用不抛错）',
    douyinStrategy: '使用内置 no-op shim（保持调用不抛错）',
    support: '⚠️',
  },
] as const

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
  alipay: 'my',
  douyin: 'tt',
}

function mapToastType(type: unknown) {
  if (type === 'error') {
    return 'fail'
  }
  if (type === 'loading') {
    return 'none'
  }
  return type
}

function mapToastArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'content') && Object.prototype.hasOwnProperty.call(nextOptions, 'title')) {
    nextOptions.content = nextOptions.title
  }
  if (Object.prototype.hasOwnProperty.call(nextOptions, 'icon')) {
    nextOptions.type = mapToastType(nextOptions.icon)
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapDouyinToastArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (nextOptions.icon === 'error') {
    nextOptions.icon = 'fail'
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapLoadingArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'content') && Object.prototype.hasOwnProperty.call(nextOptions, 'title')) {
    nextOptions.content = nextOptions.title
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapActionSheetArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'items') && Array.isArray(nextOptions.itemList)) {
    nextOptions.items = nextOptions.itemList
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapActionSheetResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'tapIndex') && Object.prototype.hasOwnProperty.call(result, 'index')) {
    return {
      ...result,
      tapIndex: result.index,
    }
  }
  return result
}

function mapModalArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'confirmButtonText') && Object.prototype.hasOwnProperty.call(nextOptions, 'confirmText')) {
    nextOptions.confirmButtonText = nextOptions.confirmText
  }
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'cancelButtonText') && Object.prototype.hasOwnProperty.call(nextOptions, 'cancelText')) {
    nextOptions.cancelButtonText = nextOptions.cancelText
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapModalResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'cancel') && Object.prototype.hasOwnProperty.call(result, 'confirm')) {
    return {
      ...result,
      cancel: !result.confirm,
    }
  }
  return result
}

function mapChooseImageResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'tempFilePaths') && Array.isArray(result.apFilePaths)) {
    return {
      ...result,
      tempFilePaths: result.apFilePaths,
    }
  }
  return result
}

function mapPreviewMediaArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'urls') && Array.isArray(nextOptions.sources)) {
    const urls = nextOptions.sources
      .map((item: unknown) => {
        if (!isPlainObject(item)) {
          return undefined
        }
        return typeof item.url === 'string' ? item.url : undefined
      })
      .filter((item): item is string => typeof item === 'string')
    if (urls.length > 0) {
      nextOptions.urls = urls
    }
  }
  if (typeof nextOptions.current === 'number' && Array.isArray(nextOptions.urls)) {
    const index = nextOptions.current
    if (index >= 0 && index < nextOptions.urls.length) {
      nextOptions.current = nextOptions.urls[index]
    }
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapDouyinChooseImageResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (typeof result.tempFilePaths === 'string') {
    return {
      ...result,
      tempFilePaths: [result.tempFilePaths],
    }
  }
  if (!Array.isArray(result.tempFilePaths) && Array.isArray(result.tempFiles)) {
    const fallbackPaths = result.tempFiles
      .map((item: unknown) => {
        if (!isPlainObject(item)) {
          return undefined
        }
        const path = item.path
        if (typeof path === 'string' && path) {
          return path
        }
        const filePath = item.filePath
        if (typeof filePath === 'string' && filePath) {
          return filePath
        }
        return undefined
      })
      .filter((item): item is string => typeof item === 'string')
    if (fallbackPaths.length > 0) {
      return {
        ...result,
        tempFilePaths: fallbackPaths,
      }
    }
  }
  return result
}

function mapSaveFileArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'apFilePath') && Object.prototype.hasOwnProperty.call(nextOptions, 'tempFilePath')) {
    nextOptions.apFilePath = nextOptions.tempFilePath
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapSaveFileResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'savedFilePath') && Object.prototype.hasOwnProperty.call(result, 'apFilePath')) {
    return {
      ...result,
      savedFilePath: result.apFilePath,
    }
  }
  return result
}

function mapCreateRewardedAdArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const firstArg = args[0]
  if (typeof firstArg === 'string' && firstArg) {
    return args
  }
  if (!isPlainObject(firstArg)) {
    return args
  }
  const adUnitId = typeof firstArg.adUnitId === 'string' ? firstArg.adUnitId : undefined
  if (!adUnitId) {
    return args
  }
  const restArgs = args.slice(1)
  return [adUnitId, ...restArgs]
}

function mapGetVideoInfoArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'filePath') && typeof nextOptions.src === 'string' && nextOptions.src) {
    nextOptions.filePath = nextOptions.src
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapDouyinSaveFileResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'savedFilePath') && Object.prototype.hasOwnProperty.call(result, 'filePath')) {
    return {
      ...result,
      savedFilePath: result.filePath,
    }
  }
  return result
}

function normalizePlatformName(value?: string) {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  return PLATFORM_ALIASES[normalized] ?? normalized
}

function mapSetClipboardArgs(args: unknown[]) {
  if (args.length === 0) {
    return args
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'text') && Object.prototype.hasOwnProperty.call(nextOptions, 'data')) {
    nextOptions.text = nextOptions.data
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapClipboardResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'data') && Object.prototype.hasOwnProperty.call(result, 'text')) {
    return {
      ...result,
      data: result.text,
    }
  }
  return result
}

function mapAuthCodeResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'code') && typeof result.authCode === 'string' && result.authCode) {
    return {
      ...result,
      code: result.authCode,
    }
  }
  return result
}

function mapAuthorizeArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'scopes') && typeof nextOptions.scope === 'string' && nextOptions.scope) {
    nextOptions.scopes = [nextOptions.scope]
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapCheckSessionArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{
      scopes: ['auth_base'],
    }]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [
      ...nextArgs,
      {
        scopes: ['auth_base'],
      },
    ]
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'scopes')) {
    nextOptions.scopes = ['auth_base']
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapCheckSessionResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (Object.prototype.hasOwnProperty.call(result, 'errMsg')) {
    return result
  }
  return {
    ...result,
    errMsg: 'checkSession:ok',
  }
}

function mapPaymentArgs(args: unknown[], target: 'orderStr' | 'orderInfo') {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  if (!Object.prototype.hasOwnProperty.call(nextOptions, target)) {
    const packageValue = typeof nextOptions.package === 'string' && nextOptions.package
      ? nextOptions.package
      : typeof nextOptions.prepayId === 'string' && nextOptions.prepayId
        ? nextOptions.prepayId
        : undefined
    if (packageValue) {
      nextOptions[target] = packageValue
    }
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapTradePayArgs(args: unknown[]) {
  return mapPaymentArgs(args, 'orderStr')
}

function mapDouyinPayArgs(args: unknown[]) {
  return mapPaymentArgs(args, 'orderInfo')
}

function mapChooseVideoArgs(args: unknown[]) {
  const nextArgs = [...args]
  if (nextArgs.length === 0 || !isPlainObject(nextArgs[nextArgs.length - 1])) {
    nextArgs.push({})
  }
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return nextArgs
  }
  const nextOptions = {
    ...lastArg,
  } as Record<string, any>
  nextOptions.mediaType = ['video']
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'count')) {
    nextOptions.count = 1
  }
  if (!Object.prototype.hasOwnProperty.call(nextOptions, 'sizeType') && typeof nextOptions.compressed === 'boolean') {
    nextOptions.sizeType = nextOptions.compressed ? ['compressed'] : ['original']
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapChooseVideoResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (typeof result.tempFilePath === 'string' && result.tempFilePath) {
    return result
  }
  if (!Array.isArray(result.tempFiles) || result.tempFiles.length === 0) {
    return result
  }
  const firstItem = result.tempFiles[0]
  if (!isPlainObject(firstItem)) {
    return result
  }
  const tempFilePath = typeof firstItem.tempFilePath === 'string' && firstItem.tempFilePath
    ? firstItem.tempFilePath
    : typeof firstItem.filePath === 'string' && firstItem.filePath
      ? firstItem.filePath
      : undefined
  if (!tempFilePath) {
    return result
  }
  return {
    ...result,
    tempFilePath,
    duration: typeof firstItem.duration === 'number' ? firstItem.duration : result.duration,
    size: typeof firstItem.size === 'number' ? firstItem.size : result.size,
    height: typeof firstItem.height === 'number' ? firstItem.height : result.height,
    width: typeof firstItem.width === 'number' ? firstItem.width : result.width,
  }
}

function resolveFilePaths(result: any): string[] {
  if (!isPlainObject(result)) {
    return []
  }
  if (typeof result.tempFilePaths === 'string' && result.tempFilePaths) {
    return [result.tempFilePaths]
  }
  if (Array.isArray(result.tempFilePaths)) {
    return result.tempFilePaths.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
  }
  if (Array.isArray(result.apFilePaths)) {
    return result.apFilePaths.filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
  }
  if (Array.isArray(result.tempFiles)) {
    return result.tempFiles
      .map((item: unknown) => {
        if (!isPlainObject(item)) {
          return undefined
        }
        if (typeof item.tempFilePath === 'string' && item.tempFilePath) {
          return item.tempFilePath
        }
        if (typeof item.path === 'string' && item.path) {
          return item.path
        }
        if (typeof item.filePath === 'string' && item.filePath) {
          return item.filePath
        }
        return undefined
      })
      .filter((item): item is string => typeof item === 'string')
  }
  return []
}

function mapChooseMediaArgsToChooseImage(args: unknown[]) {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = { ...lastArg } as Record<string, any>
  nextOptions.mediaType = ['image']
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapChooseMediaResultFromImage(result: any) {
  const normalized = mapChooseImageResult(result)
  if (!isPlainObject(normalized)) {
    return normalized
  }
  if (Array.isArray(normalized.tempFiles) && normalized.tempFiles.length > 0) {
    return normalized
  }
  const tempFilePaths = resolveFilePaths(normalized)
  if (tempFilePaths.length === 0) {
    return normalized
  }
  return {
    ...normalized,
    tempFilePaths,
    tempFiles: tempFilePaths.map(tempFilePath => ({
      tempFilePath,
      fileType: 'image',
    })),
    type: 'image',
  }
}

function resolveFileName(filePath: string) {
  const normalized = filePath.split('?')[0]
  const segments = normalized.split('/')
  return segments[segments.length - 1] || 'file'
}

function mapChooseMessageFileArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = { ...lastArg } as Record<string, any>
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapChooseMessageFileResult(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (Array.isArray(result.tempFiles) && result.tempFiles.length > 0) {
    return result
  }
  const normalized = mapChooseImageResult(result)
  if (!isPlainObject(normalized)) {
    return normalized
  }
  const tempFilePaths = resolveFilePaths(normalized)
  if (tempFilePaths.length === 0) {
    return normalized
  }
  return {
    ...normalized,
    tempFilePaths,
    tempFiles: tempFilePaths.map(path => ({
      path,
      name: resolveFileName(path),
    })),
  }
}

function resolveFrontColorFromTextStyle(value: unknown) {
  if (value === 'light') {
    return '#ffffff'
  }
  if (value === 'dark') {
    return '#000000'
  }
  return undefined
}

function mapSetBackgroundColorToNavigationBarArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = { ...lastArg } as Record<string, any>
  if (typeof nextOptions.backgroundColor !== 'string' || !nextOptions.backgroundColor) {
    if (typeof nextOptions.backgroundColorTop === 'string' && nextOptions.backgroundColorTop) {
      nextOptions.backgroundColor = nextOptions.backgroundColorTop
    }
    else if (typeof nextOptions.backgroundColorBottom === 'string' && nextOptions.backgroundColorBottom) {
      nextOptions.backgroundColor = nextOptions.backgroundColorBottom
    }
  }
  if (typeof nextOptions.frontColor !== 'string' || !nextOptions.frontColor) {
    const frontColor = resolveFrontColorFromTextStyle(nextOptions.textStyle)
    if (frontColor) {
      nextOptions.frontColor = frontColor
    }
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapSetBackgroundTextStyleToNavigationBarArgs(args: unknown[]) {
  if (args.length === 0) {
    return [{}]
  }
  const nextArgs = [...args]
  const lastIndex = nextArgs.length - 1
  const lastArg = nextArgs[lastIndex]
  if (!isPlainObject(lastArg)) {
    return [...nextArgs, {}]
  }
  const nextOptions = { ...lastArg } as Record<string, any>
  const frontColor = resolveFrontColorFromTextStyle(nextOptions.textStyle)
  if (frontColor) {
    nextOptions.frontColor = frontColor
  }
  nextArgs[lastIndex] = nextOptions
  return nextArgs
}

function mapSystemInfoToNetworkType(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  if (typeof result.networkType === 'string' && result.networkType) {
    return result
  }
  if (result.isConnected === false) {
    return {
      ...result,
      networkType: 'none',
    }
  }
  return {
    ...result,
    networkType: 'unknown',
  }
}

function mapSystemInfoToBatteryInfo(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  const nextResult: Record<string, any> = { ...result }
  if (typeof nextResult.level !== 'number') {
    const batteryValue = typeof nextResult.battery === 'number'
      ? nextResult.battery
      : undefined
    if (typeof batteryValue === 'number') {
      nextResult.level = batteryValue > 1 ? Math.round(batteryValue) : Math.round(batteryValue * 100)
    }
  }
  if (typeof nextResult.isCharging !== 'boolean' && typeof nextResult.charging === 'boolean') {
    nextResult.isCharging = nextResult.charging
  }
  return nextResult
}

function mapSystemInfoToWindowInfo(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  return {
    ...result,
    pixelRatio: result.pixelRatio,
    screenWidth: result.screenWidth,
    screenHeight: result.screenHeight,
    windowWidth: result.windowWidth,
    windowHeight: result.windowHeight,
    statusBarHeight: result.statusBarHeight,
    safeArea: result.safeArea,
    screenTop: result.screenTop,
  }
}

function mapSystemInfoToDeviceInfo(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  return {
    ...result,
    brand: result.brand,
    model: result.model,
    system: result.system,
    platform: result.platform,
    benchmarkLevel: result.benchmarkLevel,
    abi: result.abi,
  }
}

function normalizeEnvVersion(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return value
  }
  const normalized = value.toLowerCase()
  if (normalized.includes('release') || normalized.includes('prod')) {
    return 'release'
  }
  if (normalized.includes('trial') || normalized.includes('preview') || normalized.includes('test')) {
    return 'trial'
  }
  if (normalized.includes('develop') || normalized.includes('dev')) {
    return 'develop'
  }
  return value
}

function mapEnvInfoToAccountInfo(result: any) {
  if (!isPlainObject(result)) {
    return result
  }
  const microapp = isPlainObject(result.microapp) ? result.microapp : {}
  const plugin = isPlainObject(result.plugin) ? result.plugin : {}
  const miniProgram = {
    appId: typeof microapp.appId === 'string' ? microapp.appId : '',
    envVersion: normalizeEnvVersion(microapp.envType),
    version: typeof microapp.mpVersion === 'string' ? microapp.mpVersion : '',
  }
  const pluginInfo = {
    appId: typeof plugin.appId === 'string' ? plugin.appId : '',
    version: typeof plugin.version === 'string' ? plugin.version : '',
  }
  return {
    ...result,
    miniProgram,
    plugin: pluginInfo,
  }
}

const METHOD_MAPPINGS: Readonly<Record<string, Readonly<Record<string, WeapiMethodMappingRule>>>> = {
  my: {
    showToast: {
      target: 'showToast',
      mapArgs: mapToastArgs,
    },
    showLoading: {
      target: 'showLoading',
      mapArgs: mapLoadingArgs,
    },
    showActionSheet: {
      target: 'showActionSheet',
      mapArgs: mapActionSheetArgs,
      mapResult: mapActionSheetResult,
    },
    showModal: {
      target: 'confirm',
      mapArgs: mapModalArgs,
      mapResult: mapModalResult,
    },
    chooseImage: {
      target: 'chooseImage',
      mapResult: mapChooseImageResult,
    },
    chooseMedia: {
      target: 'chooseImage',
      mapArgs: mapChooseMediaArgsToChooseImage,
      mapResult: mapChooseMediaResultFromImage,
    },
    chooseMessageFile: {
      target: 'chooseImage',
      mapArgs: mapChooseMessageFileArgs,
      mapResult: mapChooseMessageFileResult,
    },
    getFuzzyLocation: {
      target: 'getLocation',
    },
    previewMedia: {
      target: 'previewImage',
      mapArgs: mapPreviewMediaArgs,
    },
    createInterstitialAd: {
      target: 'createRewardedAd',
      mapArgs: mapCreateRewardedAdArgs,
    },
    createRewardedVideoAd: {
      target: 'createRewardedAd',
      mapArgs: mapCreateRewardedAdArgs,
    },
    createLivePlayerContext: {
      target: 'createVideoContext',
    },
    createLivePusherContext: {
      target: 'createVideoContext',
    },
    getVideoInfo: {
      target: 'getVideoInfo',
    },
    saveFile: {
      target: 'saveFile',
      mapArgs: mapSaveFileArgs,
      mapResult: mapSaveFileResult,
    },
    setClipboardData: {
      target: 'setClipboard',
      mapArgs: mapSetClipboardArgs,
    },
    getClipboardData: {
      target: 'getClipboard',
      mapResult: mapClipboardResult,
    },
    chooseAddress: {
      target: 'getAddress',
    },
    createAudioContext: {
      target: 'createInnerAudioContext',
    },
    createWebAudioContext: {
      target: 'createInnerAudioContext',
    },
    getSystemInfoAsync: {
      target: 'getSystemInfo',
    },
    openAppAuthorizeSetting: {
      target: 'openSetting',
    },
    pluginLogin: {
      target: 'getAuthCode',
      mapResult: mapAuthCodeResult,
    },
    login: {
      target: 'getAuthCode',
      mapResult: mapAuthCodeResult,
    },
    authorize: {
      target: 'getAuthCode',
      mapArgs: mapAuthorizeArgs,
      mapResult: mapAuthCodeResult,
    },
    checkSession: {
      target: 'getAuthCode',
      mapArgs: mapCheckSessionArgs,
      mapResult: mapCheckSessionResult,
    },
    requestSubscribeDeviceMessage: {
      target: 'requestSubscribeMessage',
    },
    requestSubscribeEmployeeMessage: {
      target: 'requestSubscribeMessage',
    },
    restartMiniProgram: {
      target: 'reLaunch',
    },
    scanCode: {
      target: 'scan',
    },
    requestPayment: {
      target: 'tradePay',
      mapArgs: mapTradePayArgs,
    },
    requestOrderPayment: {
      target: 'tradePay',
      mapArgs: mapTradePayArgs,
    },
    requestPluginPayment: {
      target: 'tradePay',
      mapArgs: mapTradePayArgs,
    },
    requestVirtualPayment: {
      target: 'tradePay',
      mapArgs: mapTradePayArgs,
    },
    showShareImageMenu: {
      target: 'showSharePanel',
    },
    updateShareMenu: {
      target: 'showSharePanel',
    },
    openEmbeddedMiniProgram: {
      target: 'navigateToMiniProgram',
    },
    saveFileToDisk: {
      target: 'saveFileToDisk',
    },
    getEnterOptionsSync: {
      target: 'getEnterOptionsSync',
    },
    getSystemSetting: {
      target: 'getSystemSetting',
    },
    getUserProfile: {
      target: 'getOpenUserInfo',
    },
    getUserInfo: {
      target: 'getOpenUserInfo',
    },
    getAppAuthorizeSetting: {
      target: 'getAppAuthorizeSetting',
    },
    getAppBaseInfo: {
      target: 'getAppBaseInfo',
    },
    chooseVideo: {
      target: 'chooseVideo',
    },
    hideHomeButton: {
      target: 'hideBackHome',
    },
    getWindowInfo: {
      target: 'getWindowInfo',
    },
    getDeviceInfo: {
      target: 'getSystemInfo',
      mapResult: mapSystemInfoToDeviceInfo,
    },
    getAccountInfoSync: {
      target: 'getAccountInfoSync',
    },
    setBackgroundColor: {
      target: 'setBackgroundColor',
    },
    setBackgroundTextStyle: {
      target: 'setBackgroundTextStyle',
    },
    getNetworkType: {
      target: 'getNetworkType',
    },
    getBatteryInfo: {
      target: 'getBatteryInfo',
    },
    getBatteryInfoSync: {
      target: 'getBatteryInfoSync',
    },
    getLogManager: {
      target: 'getLogManager',
    },
    nextTick: {
      target: 'nextTick',
    },
    onWindowResize: {
      target: 'onWindowResize',
    },
    offWindowResize: {
      target: 'offWindowResize',
    },
    reportAnalytics: {
      target: 'reportAnalytics',
    },
    addCard: {
      target: 'addCard',
    },
    addFileToFavorites: {
      target: 'addFileToFavorites',
    },
    addPaymentPassFinish: {
      target: 'addPaymentPassFinish',
    },
    addPaymentPassGetCertificateData: {
      target: 'addPaymentPassGetCertificateData',
    },
    addPhoneCalendar: {
      target: 'addPhoneCalendar',
    },
    addPhoneContact: {
      target: 'addPhoneContact',
    },
    addPhoneRepeatCalendar: {
      target: 'addPhoneRepeatCalendar',
    },
    addVideoToFavorites: {
      target: 'addVideoToFavorites',
    },
    authorizeForMiniProgram: {
      target: 'authorizeForMiniProgram',
    },
    authPrivateMessage: {
      target: 'authPrivateMessage',
    },
    bindEmployeeRelation: {
      target: 'bindEmployeeRelation',
    },
    canAddSecureElementPass: {
      target: 'canAddSecureElementPass',
    },
    canvasGetImageData: {
      target: 'canvasGetImageData',
    },
    canvasPutImageData: {
      target: 'canvasPutImageData',
    },
    checkDeviceSupportHevc: {
      target: 'checkDeviceSupportHevc',
    },
    checkEmployeeRelation: {
      target: 'checkEmployeeRelation',
    },
    checkIsAddedToMyMiniProgram: {
      target: 'checkIsAddedToMyMiniProgram',
    },
    checkIsOpenAccessibility: {
      target: 'checkIsOpenAccessibility',
    },
    checkIsPictureInPictureActive: {
      target: 'checkIsPictureInPictureActive',
    },
    checkIsSoterEnrolledInDevice: {
      target: 'checkIsSoterEnrolledInDevice',
    },
    checkIsSupportSoterAuthentication: {
      target: 'checkIsSupportSoterAuthentication',
    },
    openCard: {
      target: 'openCard',
    },
    openChannelsActivity: {
      target: 'openChannelsActivity',
    },
    openChannelsEvent: {
      target: 'openChannelsEvent',
    },
    openChannelsLive: {
      target: 'openChannelsLive',
    },
    openChannelsLiveNoticeInfo: {
      target: 'openChannelsLiveNoticeInfo',
    },
    openChannelsUserProfile: {
      target: 'openChannelsUserProfile',
    },
    openChatTool: {
      target: 'openChatTool',
    },
    openHKOfflinePayView: {
      target: 'openHKOfflinePayView',
    },
    openInquiriesTopic: {
      target: 'openInquiriesTopic',
    },
    openOfficialAccountArticle: {
      target: 'openOfficialAccountArticle',
    },
    openOfficialAccountChat: {
      target: 'openOfficialAccountChat',
    },
    openOfficialAccountProfile: {
      target: 'openOfficialAccountProfile',
    },
    openPrivacyContract: {
      target: 'openPrivacyContract',
    },
    openSystemBluetoothSetting: {
      target: 'openSystemBluetoothSetting',
    },
    reportEvent: {
      target: 'reportEvent',
    },
    reportMonitor: {
      target: 'reportMonitor',
    },
    reportPerformance: {
      target: 'reportPerformance',
    },
    openSingleStickerView: {
      target: 'openSingleStickerView',
    },
    openStickerIPView: {
      target: 'openStickerIPView',
    },
    openStickerSetView: {
      target: 'openStickerSetView',
    },
    openStoreCouponDetail: {
      target: 'openStoreCouponDetail',
    },
    openStoreOrderDetail: {
      target: 'openStoreOrderDetail',
    },
    pauseBackgroundAudio: {
      target: 'pauseBackgroundAudio',
    },
    pauseVoice: {
      target: 'pauseVoice',
    },
    playBackgroundAudio: {
      target: 'playBackgroundAudio',
    },
    playVoice: {
      target: 'playVoice',
    },
    postMessageToReferrerMiniProgram: {
      target: 'postMessageToReferrerMiniProgram',
    },
    postMessageToReferrerPage: {
      target: 'postMessageToReferrerPage',
    },
    preDownloadSubpackage: {
      target: 'preDownloadSubpackage',
    },
    preloadAssets: {
      target: 'preloadAssets',
    },
    preloadSkylineView: {
      target: 'preloadSkylineView',
    },
    preloadWebview: {
      target: 'preloadWebview',
    },
    removeSecureElementPass: {
      target: 'removeSecureElementPass',
    },
    chooseInvoiceTitle: {
      target: 'chooseInvoiceTitle',
    },
    chooseLicensePlate: {
      target: 'chooseLicensePlate',
    },
    choosePoi: {
      target: 'choosePoi',
    },
    closeBLEConnection: {
      target: 'closeBLEConnection',
    },
    createBLEConnection: {
      target: 'createBLEConnection',
    },
    cropImage: {
      target: 'cropImage',
    },
    editImage: {
      target: 'editImage',
    },
    exitVoIPChat: {
      target: 'exitVoIPChat',
    },
    faceDetect: {
      target: 'faceDetect',
    },
    getApiCategory: {
      target: 'getApiCategory',
    },
    getBackgroundFetchToken: {
      target: 'getBackgroundFetchToken',
    },
    getChannelsLiveInfo: {
      target: 'getChannelsLiveInfo',
    },
    getChannelsLiveNoticeInfo: {
      target: 'getChannelsLiveNoticeInfo',
    },
    getChannelsShareKey: {
      target: 'getChannelsShareKey',
    },
    getChatToolInfo: {
      target: 'getChatToolInfo',
    },
    getCommonConfig: {
      target: 'getCommonConfig',
    },
    getGroupEnterInfo: {
      target: 'getGroupEnterInfo',
    },
    getPrivacySetting: {
      target: 'getPrivacySetting',
    },
    initFaceDetect: {
      target: 'initFaceDetect',
    },
    join1v1Chat: {
      target: 'join1v1Chat',
    },
    requestCommonPayment: {
      target: 'requestCommonPayment',
    },
    requestDeviceVoIP: {
      target: 'requestDeviceVoIP',
    },
    requestMerchantTransfer: {
      target: 'requestMerchantTransfer',
    },
    requirePrivacyAuthorize: {
      target: 'requirePrivacyAuthorize',
    },
    reserveChannelsLive: {
      target: 'reserveChannelsLive',
    },
    selectGroupMembers: {
      target: 'selectGroupMembers',
    },
    sendHCEMessage: {
      target: 'sendHCEMessage',
    },
    sendSms: {
      target: 'sendSms',
    },
    setBackgroundFetchToken: {
      target: 'setBackgroundFetchToken',
    },
    setEnable1v1Chat: {
      target: 'setEnable1v1Chat',
    },
    setTopBarText: {
      target: 'setTopBarText',
    },
    setWindowSize: {
      target: 'setWindowSize',
    },
    stopHCE: {
      target: 'stopHCE',
    },
    stopLocalServiceDiscovery: {
      target: 'stopLocalServiceDiscovery',
    },
    stopLocationUpdate: {
      target: 'stopLocationUpdate',
    },
    stopRecord: {
      target: 'stopRecord',
    },
    stopVoice: {
      target: 'stopVoice',
    },
    subscribeVoIPVideoMembers: {
      target: 'subscribeVoIPVideoMembers',
    },
    updateVoIPChatMuteConfig: {
      target: 'updateVoIPChatMuteConfig',
    },
    updateWeChatApp: {
      target: 'updateWeChatApp',
    },
    getBackgroundAudioPlayerState: {
      target: 'getBackgroundAudioPlayerState',
    },
    getDeviceBenchmarkInfo: {
      target: 'getDeviceBenchmarkInfo',
    },
    getDeviceVoIPList: {
      target: 'getDeviceVoIPList',
    },
    getHCEState: {
      target: 'getHCEState',
    },
    getInferenceEnvInfo: {
      target: 'getInferenceEnvInfo',
    },
    getNFCAdapter: {
      target: 'getNFCAdapter',
    },
    getPerformance: {
      target: 'getPerformance',
    },
    getRandomValues: {
      target: 'getRandomValues',
    },
    getRealtimeLogManager: {
      target: 'getRealtimeLogManager',
    },
    getRendererUserAgent: {
      target: 'getRendererUserAgent',
    },
    getScreenRecordingState: {
      target: 'getScreenRecordingState',
    },
    getSecureElementPasses: {
      target: 'getSecureElementPasses',
    },
    getSelectedTextRange: {
      target: 'getSelectedTextRange',
    },
    getShowSplashAdStatus: {
      target: 'getShowSplashAdStatus',
    },
    getSkylineInfo: {
      target: 'getSkylineInfo',
    },
    getUserCryptoManager: {
      target: 'getUserCryptoManager',
    },
    getWeRunData: {
      target: 'getWeRunData',
    },
    getXrFrameSystem: {
      target: 'getXrFrameSystem',
    },
    isBluetoothDevicePaired: {
      target: 'isBluetoothDevicePaired',
    },
    isVKSupport: {
      target: 'isVKSupport',
    },
    createBLEPeripheralServer: {
      target: 'createBLEPeripheralServer',
    },
    createBufferURL: {
      target: 'createBufferURL',
    },
    createCacheManager: {
      target: 'createCacheManager',
    },
    createGlobalPayment: {
      target: 'createGlobalPayment',
    },
    createInferenceSession: {
      target: 'createInferenceSession',
    },
    createMediaAudioPlayer: {
      target: 'createMediaAudioPlayer',
    },
    createMediaContainer: {
      target: 'createMediaContainer',
    },
    createMediaRecorder: {
      target: 'createMediaRecorder',
    },
    createTCPSocket: {
      target: 'createTCPSocket',
    },
    createUDPSocket: {
      target: 'createUDPSocket',
    },
    createVideoDecoder: {
      target: 'createVideoDecoder',
    },
    loadBuiltInFontFace: {
      target: 'loadBuiltInFontFace',
    },
    notifyGroupMembers: {
      target: 'notifyGroupMembers',
    },
    requestIdleCallback: {
      target: 'requestIdleCallback',
    },
    revokeBufferURL: {
      target: 'revokeBufferURL',
    },
    rewriteRoute: {
      target: 'rewriteRoute',
    },
    seekBackgroundAudio: {
      target: 'seekBackgroundAudio',
    },
    setEnableDebug: {
      target: 'setEnableDebug',
    },
    setInnerAudioOption: {
      target: 'setInnerAudioOption',
    },
    shareAppMessageToGroup: {
      target: 'shareAppMessageToGroup',
    },
    shareEmojiToGroup: {
      target: 'shareEmojiToGroup',
    },
    shareFileMessage: {
      target: 'shareFileMessage',
    },
    shareFileToGroup: {
      target: 'shareFileToGroup',
    },
    shareImageToGroup: {
      target: 'shareImageToGroup',
    },
    shareToOfficialAccount: {
      target: 'shareToOfficialAccount',
    },
    shareToWeRun: {
      target: 'shareToWeRun',
    },
    shareVideoMessage: {
      target: 'shareVideoMessage',
    },
    shareVideoToGroup: {
      target: 'shareVideoToGroup',
    },
    showRedPackage: {
      target: 'showRedPackage',
    },
    startDeviceMotionListening: {
      target: 'startDeviceMotionListening',
    },
    startHCE: {
      target: 'startHCE',
    },
    startLocalServiceDiscovery: {
      target: 'startLocalServiceDiscovery',
    },
    startLocationUpdate: {
      target: 'startLocationUpdate',
    },
    startLocationUpdateBackground: {
      target: 'startLocationUpdateBackground',
    },
    startRecord: {
      target: 'startRecord',
    },
    startSoterAuthentication: {
      target: 'startSoterAuthentication',
    },
    stopBackgroundAudio: {
      target: 'stopBackgroundAudio',
    },
    stopDeviceMotionListening: {
      target: 'stopDeviceMotionListening',
    },
    stopFaceDetect: {
      target: 'stopFaceDetect',
    },
    openCustomerServiceChat: {
      target: 'openCustomerServiceChat',
    },
    createVKSession: {
      target: 'createVKSession',
    },
    compressVideo: {
      target: 'compressVideo',
    },
    openVideoEditor: {
      target: 'openVideoEditor',
    },
    getShareInfo: {
      target: 'getShareInfo',
    },
    joinVoIPChat: {
      target: 'joinVoIPChat',
    },
    openDocument: {
      target: 'openDocument',
    },
    saveVideoToPhotosAlbum: {
      target: 'saveVideoToPhotosAlbum',
    },
    batchSetStorage: {
      target: 'batchSetStorage',
    },
    batchGetStorage: {
      target: 'batchGetStorage',
    },
    batchSetStorageSync: {
      target: 'batchSetStorageSync',
    },
    batchGetStorageSync: {
      target: 'batchGetStorageSync',
    },
    createCameraContext: {
      target: 'createCameraContext',
    },
    offMemoryWarning: {
      target: 'offMemoryWarning',
    },
    cancelIdleCallback: {
      target: 'cancelIdleCallback',
    },
  },
  tt: {
    showToast: {
      target: 'showToast',
      mapArgs: mapDouyinToastArgs,
    },
    showLoading: {
      target: 'showLoading',
    },
    showActionSheet: {
      target: 'showActionSheet',
      mapResult: mapActionSheetResult,
    },
    showModal: {
      target: 'showModal',
    },
    chooseImage: {
      target: 'chooseImage',
      mapResult: mapDouyinChooseImageResult,
    },
    chooseMedia: {
      target: 'chooseMedia',
      mapResult: mapChooseMediaResultFromImage,
    },
    chooseMessageFile: {
      target: 'chooseImage',
      mapArgs: mapChooseMessageFileArgs,
      mapResult: mapChooseMessageFileResult,
    },
    getFuzzyLocation: {
      target: 'getLocation',
    },
    previewMedia: {
      target: 'previewImage',
      mapArgs: mapPreviewMediaArgs,
    },
    createInterstitialAd: {
      target: 'createInterstitialAd',
    },
    createRewardedVideoAd: {
      target: 'createInterstitialAd',
    },
    createLivePlayerContext: {
      target: 'createLivePlayerContext',
    },
    createLivePusherContext: {
      target: 'createVideoContext',
    },
    getVideoInfo: {
      target: 'getFileInfo',
      mapArgs: mapGetVideoInfoArgs,
    },
    saveFile: {
      target: 'saveFile',
      mapResult: mapDouyinSaveFileResult,
    },
    setClipboardData: {
      target: 'setClipboardData',
    },
    getClipboardData: {
      target: 'getClipboardData',
    },
    chooseAddress: {
      target: 'chooseAddress',
    },
    createAudioContext: {
      target: 'createInnerAudioContext',
    },
    createWebAudioContext: {
      target: 'createInnerAudioContext',
    },
    getSystemInfoAsync: {
      target: 'getSystemInfo',
    },
    openAppAuthorizeSetting: {
      target: 'openSetting',
    },
    pluginLogin: {
      target: 'login',
    },
    login: {
      target: 'login',
    },
    authorize: {
      target: 'authorize',
    },
    checkSession: {
      target: 'checkSession',
    },
    requestSubscribeDeviceMessage: {
      target: 'requestSubscribeMessage',
    },
    requestSubscribeEmployeeMessage: {
      target: 'requestSubscribeMessage',
    },
    restartMiniProgram: {
      target: 'reLaunch',
    },
    scanCode: {
      target: 'scanCode',
    },
    requestPayment: {
      target: 'pay',
      mapArgs: mapDouyinPayArgs,
    },
    requestOrderPayment: {
      target: 'pay',
      mapArgs: mapDouyinPayArgs,
    },
    requestPluginPayment: {
      target: 'pay',
      mapArgs: mapDouyinPayArgs,
    },
    requestVirtualPayment: {
      target: 'pay',
      mapArgs: mapDouyinPayArgs,
    },
    showShareImageMenu: {
      target: 'showShareMenu',
    },
    updateShareMenu: {
      target: 'showShareMenu',
    },
    openEmbeddedMiniProgram: {
      target: 'navigateToMiniProgram',
    },
    saveFileToDisk: {
      target: 'saveFile',
    },
    getEnterOptionsSync: {
      target: 'getLaunchOptionsSync',
    },
    getSystemSetting: {
      target: 'getSetting',
    },
    getUserProfile: {
      target: 'getUserProfile',
    },
    getUserInfo: {
      target: 'getUserInfo',
    },
    getAppAuthorizeSetting: {
      target: 'getSetting',
    },
    getAppBaseInfo: {
      target: 'getEnvInfoSync',
    },
    chooseVideo: {
      target: 'chooseMedia',
      mapArgs: mapChooseVideoArgs,
      mapResult: mapChooseVideoResult,
    },
    hideHomeButton: {
      target: 'hideHomeButton',
    },
    getWindowInfo: {
      target: 'getSystemInfo',
      mapResult: mapSystemInfoToWindowInfo,
    },
    getDeviceInfo: {
      target: 'getSystemInfo',
      mapResult: mapSystemInfoToDeviceInfo,
    },
    getAccountInfoSync: {
      target: 'getEnvInfoSync',
      mapResult: mapEnvInfoToAccountInfo,
    },
    setBackgroundColor: {
      target: 'setNavigationBarColor',
      mapArgs: mapSetBackgroundColorToNavigationBarArgs,
    },
    setBackgroundTextStyle: {
      target: 'setNavigationBarColor',
      mapArgs: mapSetBackgroundTextStyleToNavigationBarArgs,
    },
    getNetworkType: {
      target: 'getSystemInfo',
      mapResult: mapSystemInfoToNetworkType,
    },
    getBatteryInfo: {
      target: 'getSystemInfo',
      mapResult: mapSystemInfoToBatteryInfo,
    },
    getBatteryInfoSync: {
      target: 'getSystemInfoSync',
      mapResult: mapSystemInfoToBatteryInfo,
    },
    getLogManager: {
      target: 'getLogManager',
    },
    nextTick: {
      target: 'nextTick',
    },
    onWindowResize: {
      target: 'onWindowResize',
    },
    offWindowResize: {
      target: 'offWindowResize',
    },
    reportAnalytics: {
      target: 'reportAnalytics',
    },
    addCard: {
      target: 'addCard',
    },
    addFileToFavorites: {
      target: 'addFileToFavorites',
    },
    addPaymentPassFinish: {
      target: 'addPaymentPassFinish',
    },
    addPaymentPassGetCertificateData: {
      target: 'addPaymentPassGetCertificateData',
    },
    addPhoneCalendar: {
      target: 'addPhoneCalendar',
    },
    addPhoneContact: {
      target: 'addPhoneContact',
    },
    addPhoneRepeatCalendar: {
      target: 'addPhoneRepeatCalendar',
    },
    addVideoToFavorites: {
      target: 'addVideoToFavorites',
    },
    authorizeForMiniProgram: {
      target: 'authorizeForMiniProgram',
    },
    authPrivateMessage: {
      target: 'authPrivateMessage',
    },
    bindEmployeeRelation: {
      target: 'bindEmployeeRelation',
    },
    canAddSecureElementPass: {
      target: 'canAddSecureElementPass',
    },
    canvasGetImageData: {
      target: 'canvasGetImageData',
    },
    canvasPutImageData: {
      target: 'canvasPutImageData',
    },
    checkDeviceSupportHevc: {
      target: 'checkDeviceSupportHevc',
    },
    checkEmployeeRelation: {
      target: 'checkEmployeeRelation',
    },
    checkIsAddedToMyMiniProgram: {
      target: 'checkIsAddedToMyMiniProgram',
    },
    checkIsOpenAccessibility: {
      target: 'checkIsOpenAccessibility',
    },
    checkIsPictureInPictureActive: {
      target: 'checkIsPictureInPictureActive',
    },
    checkIsSoterEnrolledInDevice: {
      target: 'checkIsSoterEnrolledInDevice',
    },
    checkIsSupportSoterAuthentication: {
      target: 'checkIsSupportSoterAuthentication',
    },
    openCard: {
      target: 'openCard',
    },
    openChannelsActivity: {
      target: 'openChannelsActivity',
    },
    openChannelsEvent: {
      target: 'openChannelsEvent',
    },
    openChannelsLive: {
      target: 'openChannelsLive',
    },
    openChannelsLiveNoticeInfo: {
      target: 'openChannelsLiveNoticeInfo',
    },
    openChannelsUserProfile: {
      target: 'openChannelsUserProfile',
    },
    openChatTool: {
      target: 'openChatTool',
    },
    openHKOfflinePayView: {
      target: 'openHKOfflinePayView',
    },
    openInquiriesTopic: {
      target: 'openInquiriesTopic',
    },
    openOfficialAccountArticle: {
      target: 'openOfficialAccountArticle',
    },
    openOfficialAccountChat: {
      target: 'openOfficialAccountChat',
    },
    openOfficialAccountProfile: {
      target: 'openOfficialAccountProfile',
    },
    openPrivacyContract: {
      target: 'openPrivacyContract',
    },
    openSystemBluetoothSetting: {
      target: 'openSystemBluetoothSetting',
    },
    reportEvent: {
      target: 'reportEvent',
    },
    reportMonitor: {
      target: 'reportMonitor',
    },
    reportPerformance: {
      target: 'reportPerformance',
    },
    openSingleStickerView: {
      target: 'openSingleStickerView',
    },
    openStickerIPView: {
      target: 'openStickerIPView',
    },
    openStickerSetView: {
      target: 'openStickerSetView',
    },
    openStoreCouponDetail: {
      target: 'openStoreCouponDetail',
    },
    openStoreOrderDetail: {
      target: 'openStoreOrderDetail',
    },
    pauseBackgroundAudio: {
      target: 'pauseBackgroundAudio',
    },
    pauseVoice: {
      target: 'pauseVoice',
    },
    playBackgroundAudio: {
      target: 'playBackgroundAudio',
    },
    playVoice: {
      target: 'playVoice',
    },
    postMessageToReferrerMiniProgram: {
      target: 'postMessageToReferrerMiniProgram',
    },
    postMessageToReferrerPage: {
      target: 'postMessageToReferrerPage',
    },
    preDownloadSubpackage: {
      target: 'preDownloadSubpackage',
    },
    preloadAssets: {
      target: 'preloadAssets',
    },
    preloadSkylineView: {
      target: 'preloadSkylineView',
    },
    preloadWebview: {
      target: 'preloadWebview',
    },
    removeSecureElementPass: {
      target: 'removeSecureElementPass',
    },
    chooseInvoiceTitle: {
      target: 'chooseInvoiceTitle',
    },
    chooseLicensePlate: {
      target: 'chooseLicensePlate',
    },
    choosePoi: {
      target: 'choosePoi',
    },
    closeBLEConnection: {
      target: 'closeBLEConnection',
    },
    createBLEConnection: {
      target: 'createBLEConnection',
    },
    cropImage: {
      target: 'cropImage',
    },
    editImage: {
      target: 'editImage',
    },
    exitVoIPChat: {
      target: 'exitVoIPChat',
    },
    faceDetect: {
      target: 'faceDetect',
    },
    getApiCategory: {
      target: 'getApiCategory',
    },
    getBackgroundFetchToken: {
      target: 'getBackgroundFetchToken',
    },
    getChannelsLiveInfo: {
      target: 'getChannelsLiveInfo',
    },
    getChannelsLiveNoticeInfo: {
      target: 'getChannelsLiveNoticeInfo',
    },
    getChannelsShareKey: {
      target: 'getChannelsShareKey',
    },
    getChatToolInfo: {
      target: 'getChatToolInfo',
    },
    getCommonConfig: {
      target: 'getCommonConfig',
    },
    getGroupEnterInfo: {
      target: 'getGroupEnterInfo',
    },
    getPrivacySetting: {
      target: 'getPrivacySetting',
    },
    initFaceDetect: {
      target: 'initFaceDetect',
    },
    join1v1Chat: {
      target: 'join1v1Chat',
    },
    requestCommonPayment: {
      target: 'requestCommonPayment',
    },
    requestDeviceVoIP: {
      target: 'requestDeviceVoIP',
    },
    requestMerchantTransfer: {
      target: 'requestMerchantTransfer',
    },
    requirePrivacyAuthorize: {
      target: 'requirePrivacyAuthorize',
    },
    reserveChannelsLive: {
      target: 'reserveChannelsLive',
    },
    selectGroupMembers: {
      target: 'selectGroupMembers',
    },
    sendHCEMessage: {
      target: 'sendHCEMessage',
    },
    sendSms: {
      target: 'sendSms',
    },
    setBackgroundFetchToken: {
      target: 'setBackgroundFetchToken',
    },
    setEnable1v1Chat: {
      target: 'setEnable1v1Chat',
    },
    setTopBarText: {
      target: 'setTopBarText',
    },
    setWindowSize: {
      target: 'setWindowSize',
    },
    stopHCE: {
      target: 'stopHCE',
    },
    stopLocalServiceDiscovery: {
      target: 'stopLocalServiceDiscovery',
    },
    stopLocationUpdate: {
      target: 'stopLocationUpdate',
    },
    stopRecord: {
      target: 'stopRecord',
    },
    stopVoice: {
      target: 'stopVoice',
    },
    subscribeVoIPVideoMembers: {
      target: 'subscribeVoIPVideoMembers',
    },
    updateVoIPChatMuteConfig: {
      target: 'updateVoIPChatMuteConfig',
    },
    updateWeChatApp: {
      target: 'updateWeChatApp',
    },
    getBackgroundAudioPlayerState: {
      target: 'getBackgroundAudioPlayerState',
    },
    getDeviceBenchmarkInfo: {
      target: 'getDeviceBenchmarkInfo',
    },
    getDeviceVoIPList: {
      target: 'getDeviceVoIPList',
    },
    getHCEState: {
      target: 'getHCEState',
    },
    getInferenceEnvInfo: {
      target: 'getInferenceEnvInfo',
    },
    getNFCAdapter: {
      target: 'getNFCAdapter',
    },
    getPerformance: {
      target: 'getPerformance',
    },
    getRandomValues: {
      target: 'getRandomValues',
    },
    getRealtimeLogManager: {
      target: 'getRealtimeLogManager',
    },
    getRendererUserAgent: {
      target: 'getRendererUserAgent',
    },
    getScreenRecordingState: {
      target: 'getScreenRecordingState',
    },
    getSecureElementPasses: {
      target: 'getSecureElementPasses',
    },
    getSelectedTextRange: {
      target: 'getSelectedTextRange',
    },
    getShowSplashAdStatus: {
      target: 'getShowSplashAdStatus',
    },
    getSkylineInfo: {
      target: 'getSkylineInfo',
    },
    getUserCryptoManager: {
      target: 'getUserCryptoManager',
    },
    getWeRunData: {
      target: 'getWeRunData',
    },
    getXrFrameSystem: {
      target: 'getXrFrameSystem',
    },
    isBluetoothDevicePaired: {
      target: 'isBluetoothDevicePaired',
    },
    isVKSupport: {
      target: 'isVKSupport',
    },
    createBLEPeripheralServer: {
      target: 'createBLEPeripheralServer',
    },
    createBufferURL: {
      target: 'createBufferURL',
    },
    createCacheManager: {
      target: 'createCacheManager',
    },
    createGlobalPayment: {
      target: 'createGlobalPayment',
    },
    createInferenceSession: {
      target: 'createInferenceSession',
    },
    createMediaAudioPlayer: {
      target: 'createMediaAudioPlayer',
    },
    createMediaContainer: {
      target: 'createMediaContainer',
    },
    createMediaRecorder: {
      target: 'createMediaRecorder',
    },
    createTCPSocket: {
      target: 'createTCPSocket',
    },
    createUDPSocket: {
      target: 'createUDPSocket',
    },
    createVideoDecoder: {
      target: 'createVideoDecoder',
    },
    loadBuiltInFontFace: {
      target: 'loadBuiltInFontFace',
    },
    notifyGroupMembers: {
      target: 'notifyGroupMembers',
    },
    requestIdleCallback: {
      target: 'requestIdleCallback',
    },
    revokeBufferURL: {
      target: 'revokeBufferURL',
    },
    rewriteRoute: {
      target: 'rewriteRoute',
    },
    seekBackgroundAudio: {
      target: 'seekBackgroundAudio',
    },
    setEnableDebug: {
      target: 'setEnableDebug',
    },
    setInnerAudioOption: {
      target: 'setInnerAudioOption',
    },
    shareAppMessageToGroup: {
      target: 'shareAppMessageToGroup',
    },
    shareEmojiToGroup: {
      target: 'shareEmojiToGroup',
    },
    shareFileMessage: {
      target: 'shareFileMessage',
    },
    shareFileToGroup: {
      target: 'shareFileToGroup',
    },
    shareImageToGroup: {
      target: 'shareImageToGroup',
    },
    shareToOfficialAccount: {
      target: 'shareToOfficialAccount',
    },
    shareToWeRun: {
      target: 'shareToWeRun',
    },
    shareVideoMessage: {
      target: 'shareVideoMessage',
    },
    shareVideoToGroup: {
      target: 'shareVideoToGroup',
    },
    showRedPackage: {
      target: 'showRedPackage',
    },
    startDeviceMotionListening: {
      target: 'startDeviceMotionListening',
    },
    startHCE: {
      target: 'startHCE',
    },
    startLocalServiceDiscovery: {
      target: 'startLocalServiceDiscovery',
    },
    startLocationUpdate: {
      target: 'startLocationUpdate',
    },
    startLocationUpdateBackground: {
      target: 'startLocationUpdateBackground',
    },
    startRecord: {
      target: 'startRecord',
    },
    startSoterAuthentication: {
      target: 'startSoterAuthentication',
    },
    stopBackgroundAudio: {
      target: 'stopBackgroundAudio',
    },
    stopDeviceMotionListening: {
      target: 'stopDeviceMotionListening',
    },
    stopFaceDetect: {
      target: 'stopFaceDetect',
    },
    openCustomerServiceChat: {
      target: 'openCustomerServiceChat',
    },
    createVKSession: {
      target: 'createVKSession',
    },
    compressVideo: {
      target: 'compressVideo',
    },
    openVideoEditor: {
      target: 'openVideoEditor',
    },
    getShareInfo: {
      target: 'getShareInfo',
    },
    joinVoIPChat: {
      target: 'joinVoIPChat',
    },
    openDocument: {
      target: 'openDocument',
    },
    saveVideoToPhotosAlbum: {
      target: 'saveImageToPhotosAlbum',
    },
    batchSetStorage: {
      target: 'batchSetStorage',
    },
    batchGetStorage: {
      target: 'batchGetStorage',
    },
    batchSetStorageSync: {
      target: 'batchSetStorageSync',
    },
    batchGetStorageSync: {
      target: 'batchGetStorageSync',
    },
    createCameraContext: {
      target: 'createCameraContext',
    },
    offMemoryWarning: {
      target: 'offMemoryWarning',
    },
    cancelIdleCallback: {
      target: 'cancelIdleCallback',
    },
  },
}

/**
 * @description 判断方法是否由 weapi 内置 synthetic 能力支持
 */
export function isSyntheticMethodSupported(platform: 'my' | 'tt', methodName: string) {
  return SYNTHETIC_SUPPORT_METHOD_SET[platform].has(methodName)
}

function createFallbackMappingRule(platform: 'my' | 'tt', methodName: string): WeapiMethodMappingRule | undefined {
  void platform
  void methodName
  return undefined
}

function resolveMappingRule(
  platform: 'my' | 'tt',
  methodName: string,
  options: ResolveMethodMappingOptions = {},
): WeapiResolvedMethodMapping {
  const methodSet = PLATFORM_METHOD_SET[platform]
  const explicitRule = METHOD_MAPPINGS[platform]?.[methodName]
  if (explicitRule) {
    return {
      target: explicitRule.target,
      source: 'explicit',
      rule: explicitRule,
    }
  }
  if (methodSet.has(methodName)) {
    return {
      target: methodName,
      source: 'identity',
    }
  }
  if (options.allowFallback === false) {
    return {
      target: methodName,
      source: 'identity',
    }
  }
  const fallbackRule = createFallbackMappingRule(platform, methodName)
  if (fallbackRule) {
    return {
      target: fallbackRule.target,
      source: 'fallback',
      rule: fallbackRule,
    }
  }
  return {
    target: methodName,
    source: 'identity',
  }
}

function toSupportLevel(source: WeapiResolvedMethodMapping['source'], supported: boolean): WeapiSupportLevel {
  if (!supported) {
    return 'unsupported'
  }
  if (source === 'fallback') {
    return 'fallback'
  }
  if (source === 'explicit') {
    return 'mapped'
  }
  return 'native'
}

function isSemanticSupportLevel(level: WeapiSupportLevel) {
  return level === 'native' || level === 'mapped'
}

function resolveDefaultStrategy(
  platform: 'my' | 'tt',
  methodName: string,
  target: string,
  supported: boolean,
  source: WeapiResolvedMethodMapping['source'],
) {
  if (!supported) {
    return `未提供 ${platform}.${target}，调用时将返回 not supported`
  }
  if (source === 'fallback') {
    return `回退映射到 \`${platform}.${target}\`（通用兜底）`
  }
  if (target !== methodName) {
    return `映射到 \`${platform}.${target}\``
  }
  return `直连 \`${platform}.${methodName}\``
}

function resolvePlatformCompatibility(platform: 'my' | 'tt', methodName: string) {
  const resolution = resolveMappingRule(platform, methodName)
  const target = resolution.target
  const supported = PLATFORM_METHOD_SET[platform].has(target)
    || isSyntheticMethodSupported(platform, methodName)
  const supportLevel = toSupportLevel(resolution.source, supported)
  return {
    resolution,
    target,
    supported,
    supportLevel,
    semanticallyAligned: isSemanticSupportLevel(supportLevel),
  }
}

/**
 * @description 校验文档矩阵与实际映射规则是否保持一致
 */

function formatCoverageRate(supportedApis: number, totalApis: number) {
  if (totalApis <= 0) {
    return '100.00%'
  }
  return `${((supportedApis / totalApis) * 100).toFixed(2)}%`
}

/**
 * @description 生成 API 支持覆盖率报告
 */
export function generateApiSupportCoverageReport(): WeapiApiCoverageReport {
  const methodNames = WEAPI_WX_METHODS as readonly string[]
  const totalApis = methodNames.length
  let alipaySupportedApis = 0
  let douyinSupportedApis = 0
  let alipaySemanticAlignedApis = 0
  let douyinSemanticAlignedApis = 0
  let alipayFallbackApis = 0
  let douyinFallbackApis = 0
  let fullyAlignedApis = 0
  let fullySemanticallyAlignedApis = 0

  for (const methodName of methodNames) {
    const alipay = resolvePlatformCompatibility('my', methodName)
    const douyin = resolvePlatformCompatibility('tt', methodName)
    if (alipay.supported) {
      alipaySupportedApis += 1
    }
    if (douyin.supported) {
      douyinSupportedApis += 1
    }
    if (alipay.semanticallyAligned) {
      alipaySemanticAlignedApis += 1
    }
    if (douyin.semanticallyAligned) {
      douyinSemanticAlignedApis += 1
    }
    if (alipay.supportLevel === 'fallback') {
      alipayFallbackApis += 1
    }
    if (douyin.supportLevel === 'fallback') {
      douyinFallbackApis += 1
    }
    if (alipay.supported && douyin.supported) {
      fullyAlignedApis += 1
    }
    if (alipay.semanticallyAligned && douyin.semanticallyAligned) {
      fullySemanticallyAlignedApis += 1
    }
  }

  const wxSupportedApis = totalApis
  const wxSemanticAlignedApis = totalApis

  const platforms: readonly WeapiApiCoveragePlatformItem[] = [
    {
      platform: '微信小程序',
      alias: 'wx',
      supportedApis: wxSupportedApis,
      semanticAlignedApis: wxSemanticAlignedApis,
      fallbackApis: 0,
      totalApis,
      coverage: formatCoverageRate(wxSupportedApis, totalApis),
      semanticCoverage: formatCoverageRate(wxSemanticAlignedApis, totalApis),
    },
    {
      platform: '支付宝小程序',
      alias: 'my',
      supportedApis: alipaySupportedApis,
      semanticAlignedApis: alipaySemanticAlignedApis,
      fallbackApis: alipayFallbackApis,
      totalApis,
      coverage: formatCoverageRate(alipaySupportedApis, totalApis),
      semanticCoverage: formatCoverageRate(alipaySemanticAlignedApis, totalApis),
    },
    {
      platform: '抖音小程序',
      alias: 'tt',
      supportedApis: douyinSupportedApis,
      semanticAlignedApis: douyinSemanticAlignedApis,
      fallbackApis: douyinFallbackApis,
      totalApis,
      coverage: formatCoverageRate(douyinSupportedApis, totalApis),
      semanticCoverage: formatCoverageRate(douyinSemanticAlignedApis, totalApis),
    },
  ]

  return {
    totalApis,
    fullyAlignedApis,
    fullyAlignedCoverage: formatCoverageRate(fullyAlignedApis, totalApis),
    fullySemanticallyAlignedApis,
    fullySemanticallyAlignedCoverage: formatCoverageRate(fullySemanticallyAlignedApis, totalApis),
    platforms,
  }
}

/**
 * @description 生成微信命名下的全量跨平台兼容矩阵
 */
export function generateMethodCompatibilityMatrix(): readonly WeapiMethodCompatibilityItem[] {
  const detailByMethod = new Map<string, WeapiMethodSupportMatrixItem>(
    WEAPI_METHOD_SUPPORT_MATRIX.map(item => [item.method, item]),
  )

  return (WEAPI_WX_METHODS as readonly string[]).map((methodName) => {
    const alipay = resolvePlatformCompatibility('my', methodName)
    const douyin = resolvePlatformCompatibility('tt', methodName)
    const detail = detailByMethod.get(methodName)
    return {
      method: methodName,
      wxStrategy: detail?.wxStrategy ?? `直连 \`wx.${methodName}\``,
      alipayTarget: alipay.target,
      alipayStrategy: detail?.alipayStrategy ?? resolveDefaultStrategy('my', methodName, alipay.target, alipay.supported, alipay.resolution.source),
      alipaySupported: alipay.supported,
      alipaySupportLevel: alipay.supportLevel,
      alipaySemanticallyAligned: alipay.semanticallyAligned,
      douyinTarget: douyin.target,
      douyinStrategy: detail?.douyinStrategy ?? resolveDefaultStrategy('tt', methodName, douyin.target, douyin.supported, douyin.resolution.source),
      douyinSupported: douyin.supported,
      douyinSupportLevel: douyin.supportLevel,
      douyinSemanticallyAligned: douyin.semanticallyAligned,
      support: alipay.supported && douyin.supported ? '✅' : '⚠️',
      semanticSupport: alipay.semanticallyAligned && douyin.semanticallyAligned ? '✅' : '⚠️',
    }
  })
}

export function validateSupportMatrixConsistency() {
  const mappedMethods = new Set(Object.keys(METHOD_MAPPINGS.my ?? {}))
  const douyinMappedMethods = new Set(Object.keys(METHOD_MAPPINGS.tt ?? {}))
  const documentedMethods = new Set(WEAPI_METHOD_SUPPORT_MATRIX.map(item => item.method))
  const missingDocs = Array.from(mappedMethods).filter(method => !documentedMethods.has(method))
  const missingMappings = Array.from(documentedMethods).filter(method => !mappedMethods.has(method))
  const missingDouyinMappings = Array.from(mappedMethods).filter(method => !douyinMappedMethods.has(method))
  const extraDouyinMappings = Array.from(douyinMappedMethods).filter(method => !mappedMethods.has(method))
  const missingCatalogMethods = Array.from(documentedMethods).filter(method =>
    !WEAPI_WX_METHOD_SET.has(method) && !WEAPI_MY_METHOD_SET.has(method) && !WEAPI_TT_METHOD_SET.has(method),
  )
  return {
    missingDocs,
    missingMappings,
    missingDouyinMappings,
    extraDouyinMappings,
    missingCatalogMethods,
  }
}

/**
 * @description 解析平台 API 映射规则
 */
export function resolveMethodMapping(platform: string | undefined, methodName: string) {
  const normalizedPlatform = normalizePlatformName(platform)
  if (!normalizedPlatform) {
    return undefined
  }
  if (normalizedPlatform !== 'my' && normalizedPlatform !== 'tt') {
    return undefined
  }
  return resolveMappingRule(normalizedPlatform, methodName).rule
}

/**
 * @description 解析平台 API 映射规则及映射来源
 */
export function resolveMethodMappingWithMeta(
  platform: string | undefined,
  methodName: string,
  options: ResolveMethodMappingOptions = {},
) {
  const normalizedPlatform = normalizePlatformName(platform)
  if (!normalizedPlatform) {
    return undefined
  }
  if (normalizedPlatform !== 'my' && normalizedPlatform !== 'tt') {
    return undefined
  }
  return resolveMappingRule(normalizedPlatform, methodName, options)
}
