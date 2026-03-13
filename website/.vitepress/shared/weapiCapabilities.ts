export interface WeapiCapabilityGroup {
  key: string
  label: string
}

export const WEAPI_CAPABILITY_GROUPS: WeapiCapabilityGroup[] = [
  { key: 'base', label: '基础' },
  { key: 'route', label: '路由' },
  { key: 'navigate', label: '跳转' },
  { key: 'chattool', label: '聊天工具' },
  { key: 'share', label: '转发' },
  { key: 'ui', label: '界面' },
  { key: 'network', label: '网络' },
  { key: 'payment', label: '支付' },
  { key: 'storage', label: '数据缓存' },
  { key: 'data-analysis', label: '数据分析' },
  { key: 'canvas', label: '画布' },
  { key: 'media', label: '媒体' },
  { key: 'location', label: '位置' },
  { key: 'file', label: '文件' },
  { key: 'open-api', label: '开放接口' },
  { key: 'device', label: '设备' },
  { key: 'ai', label: 'AI' },
  { key: 'worker', label: 'Worker' },
  { key: 'wxml', label: 'WXML' },
  { key: 'ext', label: '第三方平台' },
  { key: 'ad', label: '广告' },
  { key: 'xr-frame', label: 'XR-FRAME' },
] as const

const ROUTE_METHODS = new Set(['switchTab', 'rewriteRoute', 'reLaunch', 'redirectTo', 'navigateTo', 'navigateBack', 'router'])
const NAVIGATE_METHODS = new Set([
  'restartMiniProgram',
  'openOfficialAccountProfile',
  'openOfficialAccountChat',
  'openOfficialAccountArticle',
  'openInquiriesTopic',
  'openEmbeddedMiniProgram',
  'onEmbeddedMiniProgramHeightChange',
  'offEmbeddedMiniProgramHeightChange',
  'navigateToMiniProgram',
  'navigateBackMiniProgram',
  'exitMiniProgram',
])
const CHATTOOL_METHODS = new Set([
  'shareVideoToGroup',
  'shareImageToGroup',
  'shareFileToGroup',
  'shareEmojiToGroup',
  'shareAppMessageToGroup',
  'selectGroupMembers',
  'openChatTool',
  'notifyGroupMembers',
  'getChatToolInfo',
])
const SHARE_METHODS = new Set([
  'updateShareMenu',
  'showShareMenu',
  'showShareImageMenu',
  'shareVideoMessage',
  'shareToOfficialAccount',
  'shareFileMessage',
  'onCopyUrl',
  'offCopyUrl',
  'hideShareMenu',
  'getShareInfo',
  'authPrivateMessage',
])
const UI_METHODS = new Set([
  'showToast',
  'showModal',
  'showLoading',
  'showActionSheet',
  'hideToast',
  'hideLoading',
  'enableAlertBeforeUnload',
  'disableAlertBeforeUnload',
  'showNavigationBarLoading',
  'setNavigationBarTitle',
  'setNavigationBarColor',
  'hideNavigationBarLoading',
  'hideHomeButton',
  'setBackgroundTextStyle',
  'setBackgroundColor',
  'showTabBarRedDot',
  'showTabBar',
  'setTabBarStyle',
  'setTabBarItem',
  'setTabBarBadge',
  'removeTabBarBadge',
  'hideTabBarRedDot',
  'hideTabBar',
  'loadFontFace',
  'loadBuiltInFontFace',
  'stopPullDownRefresh',
  'startPullDownRefresh',
  'pageScrollTo',
  'createAnimation',
  'setTopBarText',
  'nextTick',
  'onUserTriggerTranslation',
  'onUserOffTranslation',
  'onMenuButtonBoundingClientRectWeightChange',
  'offUserTriggerTranslation',
  'offUserOffTranslation',
  'offMenuButtonBoundingClientRectWeightChange',
  'getMenuButtonBoundingClientRect',
  'setWindowSize',
  'onWindowStateChange',
  'onWindowResize',
  'onParallelStateChange',
  'offWindowStateChange',
  'offWindowResize',
  'offParallelStateChange',
  'checkIsPictureInPictureActive',
  'worklet',
])
const NETWORK_METHODS = new Set([
  'request',
  'downloadFile',
  'uploadFile',
  'connectSocket',
  'sendSocketMessage',
  'closeSocket',
  'onSocketOpen',
  'onSocketMessage',
  'onSocketError',
  'onSocketClose',
  'offSocketOpen',
  'offSocketMessage',
  'offSocketError',
  'offSocketClose',
  'sendHCEMessage',
  'startLocalServiceDiscovery',
  'stopLocalServiceDiscovery',
  'onLocalServiceFound',
  'onLocalServiceLost',
  'onLocalServiceResolveFail',
  'onLocalServiceDiscoveryStop',
  'offLocalServiceFound',
  'offLocalServiceLost',
  'offLocalServiceResolveFail',
  'offLocalServiceDiscoveryStop',
  'createTCPSocket',
  'createUDPSocket',
])
const PAYMENT_METHODS = new Set([
  'requestVirtualPayment',
  'requestPluginPayment',
  'requestPayment',
  'requestOrderPayment',
  'requestMerchantTransfer',
  'requestCommonPayment',
  'openHKOfflinePayView',
  'createGlobalPayment',
])
const STORAGE_METHODS = new Set([
  'setStorageSync',
  'setStorage',
  'removeStorageSync',
  'removeStorage',
  'getStorageSync',
  'getStorageInfoSync',
  'getStorageInfo',
  'getStorage',
  'clearStorageSync',
  'clearStorage',
  'batchSetStorage',
  'batchGetStorage',
  'batchSetStorageSync',
  'batchGetStorageSync',
  'createBufferURL',
  'revokeBufferURL',
  'createCacheManager',
])
const DATA_ANALYSIS_METHODS = new Set([
  'reportMonitor',
  'reportEvent',
  'reportAnalytics',
  'getExptInfoSync',
  'getCommonConfig',
])
const CANVAS_METHODS = new Set([
  'createOffscreenCanvas',
  'createCanvasContext',
  'canvasToTempFilePath',
  'canvasPutImageData',
  'canvasGetImageData',
])
const LOCATION_METHODS = new Set([
  'stopLocationUpdate',
  'startLocationUpdateBackground',
  'startLocationUpdate',
  'openLocation',
  'onLocationChangeError',
  'onLocationChange',
  'offLocationChangeError',
  'offLocationChange',
  'getLocation',
  'getFuzzyLocation',
  'chooseLocation',
  'choosePoi',
])
const FILE_METHODS = new Set([
  'saveFileToDisk',
  'openDocument',
  'getFileSystemManager',
  'saveFile',
  'getFileInfo',
  'getSavedFileInfo',
  'getSavedFileList',
  'removeSavedFile',
  'chooseMessageFile',
  'unzip',
  'openVideoEditor',
])
const OPEN_API_METHODS = new Set([
  'pluginLogin',
  'login',
  'checkSession',
  'getAccountInfoSync',
  'getUserProfile',
  'getUserInfo',
  'authorizeForMiniProgram',
  'authorize',
  'requestSubscribeDeviceMessage',
  'requestSubscribeEmployeeMessage',
  'chooseAddress',
  'chooseInvoice',
  'chooseInvoiceTitle',
  'chooseLicensePlate',
  'requestFacialVerify',
  'checkIsSupportFacialRecognition',
  'addCard',
  'openCard',
  'addFileToFavorites',
  'addVideoToFavorites',
  'openStoreOrderDetail',
  'openStoreCouponDetail',
  'requestMerchantTransfer',
  'getGroupEnterInfo',
  'bindEmployeeRelation',
  'checkEmployeeRelation',
  'checkIsAddedToMyMiniProgram',
  'openChannelsUserProfile',
  'openChannelsLiveNoticeInfo',
  'openChannelsLive',
  'openChannelsEvent',
  'openChannelsActivity',
  'getChannelsShareKey',
  'getChannelsLiveNoticeInfo',
  'getChannelsLiveInfo',
  'reserveChannelsLive',
  'requestDeviceVoIP',
  'getDeviceVoIPList',
  'requirePrivacyAuthorize',
  'openPrivacyContract',
  'onNeedPrivacyAuthorization',
  'getPrivacySetting',
  'openCustomerServiceChat',
  'openStickerSetView',
  'openStickerIPView',
  'openSingleStickerView',
  'requestPluginPayment',
  'requestVirtualPayment',
  'requestCommonPayment',
  'sendHCEMessage',
])
const AI_METHODS = new Set([
  'getInferenceEnvInfo',
  'createInferenceSession',
  'isVKSupport',
  'createVKSession',
  'stopFaceDetect',
  'initFaceDetect',
  'faceDetect',
])
const DEVICE_PATTERNS = [
  /Bluetooth|BLE|Beacon|Wifi|HCE|NFC|Battery|Clipboard|Compass|Gyroscope|Accelerometer|DeviceMotion|Screen|Keyboard|Vibrate|Memory|Phone|Sms|Contact|Calendar/,
  /scanCode/i,
  /getNetworkType/i,
  /getLocalIPAddress/i,
  /getRandomValues/i,
  /checkIsOpenAccessibility/i,
]
const MEDIA_PATTERNS = [
  /Audio|Video|Voice|Camera|Recorder|Map|Live|Media|Image/,
  /^chooseImage$/,
  /^chooseMedia$/,
  /^chooseVideo$/,
  /^previewMedia$/,
  /^compressImage$/,
  /^compressVideo$/,
  /^cropImage$/,
  /^editImage$/,
]

export function resolveWeapiCapability(method: string) {
  if (ROUTE_METHODS.has(method)) {
    return 'route'
  }
  if (NAVIGATE_METHODS.has(method)) {
    return 'navigate'
  }
  if (CHATTOOL_METHODS.has(method)) {
    return 'chattool'
  }
  if (SHARE_METHODS.has(method)) {
    return 'share'
  }
  if (UI_METHODS.has(method)) {
    return 'ui'
  }
  if (NETWORK_METHODS.has(method)) {
    return 'network'
  }
  if (PAYMENT_METHODS.has(method)) {
    return 'payment'
  }
  if (STORAGE_METHODS.has(method)) {
    return 'storage'
  }
  if (DATA_ANALYSIS_METHODS.has(method)) {
    return 'data-analysis'
  }
  if (CANVAS_METHODS.has(method)) {
    return 'canvas'
  }
  if (LOCATION_METHODS.has(method)) {
    return 'location'
  }
  if (FILE_METHODS.has(method)) {
    return 'file'
  }
  if (OPEN_API_METHODS.has(method)) {
    return 'open-api'
  }
  if (AI_METHODS.has(method)) {
    return 'ai'
  }
  if (method === 'createWorker') {
    return 'worker'
  }
  if (method === 'createSelectorQuery' || method === 'createIntersectionObserver' || method === 'createMediaQueryObserver') {
    return 'wxml'
  }
  if (method === 'getExtConfig' || method === 'getExtConfigSync') {
    return 'ext'
  }
  if (method === 'getShowSplashAdStatus' || method === 'createRewardedVideoAd' || method === 'createInterstitialAd') {
    return 'ad'
  }
  if (method === 'getXrFrameSystem') {
    return 'xr-frame'
  }
  if (MEDIA_PATTERNS.some(pattern => pattern.test(method))) {
    return 'media'
  }
  if (DEVICE_PATTERNS.some(pattern => pattern.test(method))) {
    return 'device'
  }
  return 'base'
}

export function matchWeapiCapability(method: string, capability?: string) {
  if (!capability) {
    return true
  }
  return resolveWeapiCapability(method) === capability
}
