import { installWebHostGlobals } from './hostGlobals'

installWebHostGlobals()

export type { WebTabBarConfig, WebTabBarItem } from './appShell/tabBar'
export { ensureButtonDefined, setButtonFormConfig } from './button'
export type { ButtonFormConfig } from './button'
export { defineComponent } from './component'
export { getRuntimeExecutionMode, setRuntimeExecutionMode } from './execution'
export {
  getRuntimeClipboard,
  getRuntimeDialogs,
  getRuntimeFetch,
  getRuntimeStorage,
  getWebRuntimeHost,
  openRuntimeUrl,
  resetWebRuntimeHost,
  setWebRuntimeHost,
} from './host'
export type { WebRuntimeClipboard, WebRuntimeDialogs, WebRuntimeHost, WebRuntimeStorage } from './host'
export { installWebHostGlobals } from './hostGlobals'
export {
  createInputEventDetail,
  createScrollEventDetail,
  createSwitchEventDetail,
  createTextareaLineChangeDetail,
  createVideoProgressDetail,
  createVideoTimeUpdateDetail,
  ensureNativeComponentsDefined,
  resolveImageModeStyle,
  resolveVideoObjectFit,
} from './nativeComponents'
export { setNavigationBarMetrics } from './navigationBar'
export type { NavigationBarMetrics } from './navigationBar'
export {
  authorize,
  canIUse,
  checkSession,
  chooseAddress,
  chooseFile,
  chooseImage,
  chooseLocation,
  chooseMedia,
  chooseMessageFile,
  chooseVideo,
  clearStorage,
  clearStorageSync,
  compressImage,
  compressVideo,
  createCanvasContext,
  createInterstitialAd,
  createRewardedVideoAd,
  createSelectorQuery,
  createVideoContext,
  createVKSession,
  createWorker,
  downloadFile,
  exitMiniProgram,
  getAccountInfoSync,
  getAppAuthorizeSetting,
  getAppBaseInfo,
  getBatteryInfo,
  getBatteryInfoSync,
  getClipboardData,
  getDeviceInfo,
  getEnterOptionsSync,
  getExtConfig,
  getExtConfigSync,
  getFileSystemManager,
  getFuzzyLocation,
  getImageInfo,
  getLaunchOptionsSync,
  getLocation,
  getLogManager,
  getMenuButtonBoundingClientRect,
  getNetworkType,
  getSetting,
  getStorage,
  getStorageInfo,
  getStorageInfoSync,
  getStorageSync,
  getSystemInfo,
  getSystemInfoSync,
  getSystemSetting,
  getUpdateManager,
  getUserInfo,
  getUserProfile,
  getVideoInfo,
  getWindowInfo,
  hideKeyboard,
  hideLoading,
  hideNavigationBarLoading,
  hideTabBar,
  hideTabBarRedDot,
  initializePageRoutes,
  loadSubPackage,
  login,
  makePhoneCall,
  navigateBack,
  navigateTo,
  navigateToMiniProgram,
  nextTick,
  offNetworkStatusChange,
  offWindowResize,
  onNetworkStatusChange,
  onWindowResize,
  openAppAuthorizeSetting,
  openCustomerServiceChat,
  openDocument,
  openLocation,
  openSetting,
  openVideoEditor,
  pageScrollTo,
  preloadSubpackage,
  previewImage,
  previewMedia,
  redirectTo,
  registerApp,
  registerComponent,
  registerPage,
  reLaunch,
  removeStorage,
  removeStorageSync,
  removeTabBarBadge,
  reportAnalytics,
  request,
  requestPayment,
  requestSubscribeMessage,
  saveFile,
  saveFileToDisk,
  saveImageToPhotosAlbum,
  saveVideoToPhotosAlbum,
  scanCode,
  setBackgroundColor,
  setBackgroundTextStyle,
  setClipboardData,
  setNavigationBarColor,
  setNavigationBarTitle,
  setStorage,
  setStorageSync,
  setTabBarBadge,
  setTabBarItem,
  setTabBarStyle,
  showActionSheet,
  showLoading,
  showModal,
  showNavigationBarLoading,
  showShareMenu,
  showTabBar,
  showTabBarRedDot,
  showToast,
  startPullDownRefresh,
  stopPullDownRefresh,
  switchTab,
  updateShareMenu,
  uploadFile,
  vibrateShort,
} from './polyfill'
export {
  disposeWebRouting,
  getWebRoutingConfig,
  resolveWebRoutingConfig,
} from './polyfill/routeRuntime/history'
export type {
  ResolvedWebRoutingConfig,
  WebRouteHistoryState,
  WebRouteTarget,
  WebRoutingConfig,
  WebRoutingMode,
} from './polyfill/routeRuntime/history'
export { createRenderContext } from './renderContext'
export type { RenderContext } from './renderContext'
export { setupRpx } from './rpx'
export type { RpxConfig } from './rpx'
export {
  configureWebSeo,
  resetWebDocumentHead,
  setupWebResourceHints,
  syncWebDocumentHead,
  updateWebDocumentTitle,
} from './seo'
export type { WebPageHead, WebResourceHint, WebResourceHintRelation, WebResourceHintsConfig, WebSeoConfig } from './seo'
export { injectStyle, removeStyle } from './style'
export { createTemplate, renderTemplate } from './template'
export type { TemplateRenderer, TemplateScope } from './template'
export { getWebViewportWidth, resolveWebViewportConfig, setupWebViewport } from './viewport'
export type { ResolvedWebViewportConfig, WebViewportConfig } from './viewport'
export { setRuntimeWarningOptions } from './warning'
export type { RuntimeWarningLevel, RuntimeWarningOptions } from './warning'
export { installWebModuleRegistration, registerWebWevuApp, registerWebWevuComponent } from './wevu'
export * from 'wevu/internal-runtime'
