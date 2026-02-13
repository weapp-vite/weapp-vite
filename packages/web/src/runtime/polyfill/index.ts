import type {
  AdBaseOptions,
  CloudBridge,
  GetExtConfigOptions,
  InterstitialAd,
  LogManager,
  LogManagerOptions,
  RewardedVideoAd,
  SetBackgroundColorOptions,
  SetBackgroundTextStyleOptions,
  UpdateManager,
  WxAsyncOptions,
  WxBaseResult,
} from './types'
import { emitRuntimeWarning } from '../warning'
import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  setBackgroundColorBridge,
  setBackgroundTextStyleBridge,
} from './background'
import { createCloudBridge } from './cloud'
import {
  authorize,
  checkSession,
  getAccountInfoSync,
  getAppAuthorizeSetting,
  getAppBaseInfo,
  getBatteryInfo,
  getBatteryInfoSync,
  getDeviceInfo,
  getFuzzyLocation,
  getLocation,
  getMenuButtonBoundingClientRect,
  getNetworkType,
  getSetting,
  getSystemInfo,
  getSystemInfoSync,
  getSystemSetting,
  getUserInfo,
  getUserProfile,
  getWindowInfo,
  login,
  offNetworkStatusChange,
  offWindowResize,
  onNetworkStatusChange,
  onWindowResize,
  openAppAuthorizeSetting,
  openSetting,
  vibrateShort,
} from './deviceAuthSystemApi'
import { WEB_USER_DATA_PATH } from './files'
import { createNavigationBarRuntimeBridge } from './navigationBarRuntime'
import {
  createInterstitialAdBridge,
  createRewardedVideoAdBridge,
  getExtConfigBridge,
  getExtConfigSyncBridge,
  getLogManagerBridge,
  getUpdateManagerBridge,
  reportAnalyticsBridge,
} from './platformApi'
import {
  getAppInstance,
  getCurrentPagesInternal,
  getEnterOptionsSync,
  getLaunchOptionsSync,
  navigateBack,
  navigateTo,
  redirectTo,
  reLaunch,
  switchTab,
} from './routeRuntime'
import {
  canIUseBridge,
} from './runtimeCapabilityApi'
import {
  clearStorage,
  clearStorageSync,
  createCanvasContext,
  createSelectorQuery,
  createVideoContext,
  createVKSession,
  createWorker,
  downloadFile,
  exitMiniProgram,
  getFileSystemManager,
  getStorage,
  getStorageInfo,
  getStorageInfoSync,
  getStorageSync,
  hideKeyboard,
  loadSubPackage,
  navigateToMiniProgram,
  nextTick,
  pageScrollTo,
  preloadSubpackage,
  removeStorage,
  removeStorageSync,
  request,
  setStorage,
  setStorageSync,
  startPullDownRefresh,
  stopPullDownRefresh,
  uploadFile,
} from './runtimeDataApi'
import {
  chooseAddress,
  chooseFile,
  chooseImage,
  chooseLocation,
  chooseMedia,
  chooseMessageFile,
  chooseVideo,
  compressImage,
  compressVideo,
  getClipboardData,
  getImageInfo,
  getVideoInfo,
  hideLoading,
  hideTabBar,
  makePhoneCall,
  openCustomerServiceChat,
  openDocument,
  openLocation,
  openVideoEditor,
  previewImage,
  previewMedia,
  requestPayment,
  requestSubscribeMessage,
  saveFile,
  saveFileToDisk,
  saveImageToPhotosAlbum,
  saveVideoToPhotosAlbum,
  scanCode,
  setClipboardData,
  showActionSheet,
  showLoading,
  showModal,
  showShareMenu,
  showTabBar,
  showToast,
  updateShareMenu,
} from './uiMediaApi'

export {
  authorize,
  checkSession,
  getAccountInfoSync,
  getAppAuthorizeSetting,
  getAppBaseInfo,
  getBatteryInfo,
  getBatteryInfoSync,
  getDeviceInfo,
  getFuzzyLocation,
  getLocation,
  getMenuButtonBoundingClientRect,
  getNetworkType,
  getSetting,
  getSystemInfo,
  getSystemInfoSync,
  getSystemSetting,
  getUserInfo,
  getUserProfile,
  getWindowInfo,
  login,
  offNetworkStatusChange,
  offWindowResize,
  onNetworkStatusChange,
  onWindowResize,
  openAppAuthorizeSetting,
  openSetting,
  vibrateShort,
} from './deviceAuthSystemApi'

export {
  getEnterOptionsSync,
  getLaunchOptionsSync,
  initializePageRoutes,
  navigateBack,
  navigateTo,
  redirectTo,
  registerApp,
  registerComponent,
  registerPage,
  reLaunch,
  switchTab,
} from './routeRuntime'

export {
  clearStorage,
  clearStorageSync,
  createCanvasContext,
  createSelectorQuery,
  createVideoContext,
  createVKSession,
  createWorker,
  downloadFile,
  exitMiniProgram,
  getFileSystemManager,
  getStorage,
  getStorageInfo,
  getStorageInfoSync,
  getStorageSync,
  hideKeyboard,
  loadSubPackage,
  navigateToMiniProgram,
  nextTick,
  pageScrollTo,
  preloadSubpackage,
  removeStorage,
  removeStorageSync,
  request,
  setStorage,
  setStorageSync,
  startPullDownRefresh,
  stopPullDownRefresh,
  uploadFile,
} from './runtimeDataApi'

export {
  chooseAddress,
  chooseFile,
  chooseImage,
  chooseLocation,
  chooseMedia,
  chooseMessageFile,
  chooseVideo,
  compressImage,
  compressVideo,
  getClipboardData,
  getImageInfo,
  getVideoInfo,
  hideLoading,
  hideTabBar,
  makePhoneCall,
  openCustomerServiceChat,
  openDocument,
  openLocation,
  openVideoEditor,
  previewImage,
  previewMedia,
  requestPayment,
  requestSubscribeMessage,
  saveFile,
  saveFileToDisk,
  saveImageToPhotosAlbum,
  saveVideoToPhotosAlbum,
  scanCode,
  setClipboardData,
  showActionSheet,
  showLoading,
  showModal,
  showShareMenu,
  showTabBar,
  showToast,
  updateShareMenu,
} from './uiMediaApi'

const navigationBarRuntimeBridge = createNavigationBarRuntimeBridge(
  () => getCurrentPagesInternal() as Array<HTMLElement & { renderRoot?: ShadowRoot | HTMLElement }>,
  emitRuntimeWarning,
)

export function setNavigationBarTitle(options: { title: string }) {
  return navigationBarRuntimeBridge.setNavigationBarTitle(options)
}

export function setNavigationBarColor(options: {
  frontColor?: string
  backgroundColor?: string
  animation?: { duration?: number, timingFunction?: string }
}) {
  return navigationBarRuntimeBridge.setNavigationBarColor(options)
}

export function showNavigationBarLoading() {
  return navigationBarRuntimeBridge.showNavigationBarLoading()
}

export function hideNavigationBarLoading() {
  return navigationBarRuntimeBridge.hideNavigationBarLoading()
}

export function setBackgroundColor(options?: SetBackgroundColorOptions) {
  return setBackgroundColorBridge(options)
}

export function setBackgroundTextStyle(options?: SetBackgroundTextStyleOptions) {
  return setBackgroundTextStyleBridge(options)
}

export function canIUse(schema: string) {
  return canIUseBridge(globalTarget.wx as Record<string, unknown> | undefined, schema)
}

const cloudBridge: CloudBridge = createCloudBridge(
  (options, result) => callWxAsyncSuccess(
    options as unknown as WxAsyncOptions<WxBaseResult> | undefined,
    result as WxBaseResult,
  ),
  (options, errMsg) => callWxAsyncFailure(
    options as unknown as WxAsyncOptions<WxBaseResult> | undefined,
    errMsg,
  ),
) as CloudBridge

export function createRewardedVideoAd(options?: AdBaseOptions): RewardedVideoAd {
  return createRewardedVideoAdBridge(options)
}

export function createInterstitialAd(options?: AdBaseOptions): InterstitialAd {
  return createInterstitialAdBridge(options)
}

export function getExtConfigSync() {
  return getExtConfigSyncBridge()
}

export function getExtConfig(options?: GetExtConfigOptions) {
  return getExtConfigBridge(options)
}

export function getUpdateManager(): UpdateManager {
  return getUpdateManagerBridge()
}

export function getLogManager(options?: LogManagerOptions): LogManager {
  return getLogManagerBridge(options)
}

export function reportAnalytics(eventName: string, data?: Record<string, unknown>) {
  reportAnalyticsBridge(eventName, data)
}

const globalTarget = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {}

if (globalTarget) {
  const wxBridge = (globalTarget.wx as Record<string, unknown> | undefined) ?? {}
  Object.assign(wxBridge, {
    navigateTo,
    navigateBack,
    redirectTo,
    switchTab,
    reLaunch,
    navigateToMiniProgram,
    exitMiniProgram,
    getLaunchOptionsSync,
    getEnterOptionsSync,
    nextTick,
    startPullDownRefresh,
    stopPullDownRefresh,
    hideKeyboard,
    loadSubPackage,
    preloadSubpackage,
    pageScrollTo,
    createCanvasContext,
    createVideoContext,
    createWorker,
    createVKSession,
    createSelectorQuery,
    setNavigationBarTitle,
    setNavigationBarColor,
    setBackgroundColor,
    setBackgroundTextStyle,
    showNavigationBarLoading,
    hideNavigationBarLoading,
    showLoading,
    hideLoading,
    showShareMenu,
    updateShareMenu,
    openCustomerServiceChat,
    chooseAddress,
    chooseLocation,
    getImageInfo,
    getVideoInfo,
    makePhoneCall,
    openLocation,
    showTabBar,
    hideTabBar,
    showModal,
    showActionSheet,
    openDocument,
    createRewardedVideoAd,
    createInterstitialAd,
    vibrateShort,
    login,
    checkSession,
    getUserInfo,
    getUserProfile,
    getAccountInfoSync,
    chooseImage,
    chooseMedia,
    chooseVideo,
    chooseMessageFile,
    chooseFile,
    compressImage,
    compressVideo,
    previewImage,
    previewMedia,
    openVideoEditor,
    saveImageToPhotosAlbum,
    saveVideoToPhotosAlbum,
    saveFile,
    saveFileToDisk,
    scanCode,
    showToast,
    setClipboardData,
    getClipboardData,
    getNetworkType,
    getLocation,
    getFuzzyLocation,
    getSetting,
    onNetworkStatusChange,
    offNetworkStatusChange,
    onWindowResize,
    offWindowResize,
    setStorage,
    setStorageSync,
    getStorage,
    getStorageSync,
    getStorageInfo,
    getStorageInfoSync,
    getFileSystemManager,
    removeStorage,
    removeStorageSync,
    clearStorage,
    clearStorageSync,
    getExtConfigSync,
    getExtConfig,
    getUpdateManager,
    getLogManager,
    authorize,
    openSetting,
    openAppAuthorizeSetting,
    requestSubscribeMessage,
    requestPayment,
    request,
    uploadFile,
    downloadFile,
    reportAnalytics,
    getBatteryInfo,
    getBatteryInfoSync,
    canIUse,
    getDeviceInfo,
    getSystemSetting,
    getAppAuthorizeSetting,
    getAppBaseInfo,
    getMenuButtonBoundingClientRect,
    getWindowInfo,
    getSystemInfo,
    getSystemInfoSync,
    cloud: cloudBridge,
  })
  const wxEnv = (wxBridge.env as Record<string, unknown> | undefined) ?? {}
  if (typeof wxEnv.USER_DATA_PATH !== 'string' || !wxEnv.USER_DATA_PATH.trim()) {
    wxEnv.USER_DATA_PATH = WEB_USER_DATA_PATH
  }
  wxBridge.env = wxEnv
  globalTarget.wx = wxBridge
  if (typeof globalTarget.getApp !== 'function') {
    globalTarget.getApp = getAppInstance
  }
  if (typeof globalTarget.getCurrentPages !== 'function') {
    globalTarget.getCurrentPages = getCurrentPagesInternal
  }
}
