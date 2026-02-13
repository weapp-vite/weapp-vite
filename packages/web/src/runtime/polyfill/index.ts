import type {
  AccountInfoSync,
  AdBaseOptions,
  AppAuthorizeSetting,
  AppAuthorizeStatus,
  AppBaseInfo,
  AuthorizeOptions,
  BatteryInfo,
  CanvasContext,
  CheckSessionOptions,
  CloudBridge,
  DeviceInfo,
  DownloadFileOptions,
  FileSystemManager,
  GetBatteryInfoSuccessResult,
  GetExtConfigOptions,
  GetFuzzyLocationOptions,
  GetLocationOptions,
  GetNetworkTypeOptions,
  GetSettingOptions,
  GetStorageOptions,
  GetSystemInfoOptions,
  GetUserInfoOptions,
  GetUserProfileOptions,
  InterstitialAd,
  LoadSubPackageOptions,
  LoginOptions,
  LogManager,
  LogManagerOptions,
  MenuButtonBoundingClientRect,
  NavigateToMiniProgramOptions,
  NetworkStatusChangeCallback,
  OpenAppAuthorizeSettingOptions,
  OpenSettingOptions,
  PageScrollToOptions,
  PreloadSubpackageOptions,
  RemoveStorageOptions,
  RequestOptions,
  RewardedVideoAd,
  SelectorQuery,
  SetBackgroundColorOptions,
  SetBackgroundTextStyleOptions,
  SetStorageOptions,
  StorageInfoResult,
  SystemInfo,
  SystemSetting,
  UpdateManager,
  UploadFileOptions,
  VibrateShortOptions,
  VideoContext,
  VkSession,
  WindowInfo,
  WindowResizeCallback,
  WorkerBridge,
  WxAsyncOptions,
  WxBaseResult,
} from './types'
import { emitRuntimeWarning } from '../warning'
import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  authorizeBridge,
  checkSessionBridge,
  getAppAuthorizeSettingBridge,
  getSettingBridge,
  getSystemSettingBridge,
  getUserInfoBridge,
  getUserProfileBridge,
  loginBridge,
  openAppAuthorizeSettingBridge,
  openSettingBridge,
} from './authApi'
import {
  setBackgroundColorBridge,
  setBackgroundTextStyleBridge,
} from './background'
import { createCanvasContextBridge } from './canvasContext'
import { createCloudBridge } from './cloud'
import {
  getBatteryInfoBridge,
  getBatteryInfoSyncBridge,
  vibrateShortBridge,
} from './deviceApi'
import { WEB_USER_DATA_PATH } from './files'
import {
  getFuzzyLocationBridge,
  getLocationBridge,
} from './locationApi'
import {
  getNetworkTypeBridge,
} from './menuApi'
import { createNavigationBarRuntimeBridge } from './navigationBarRuntime'
import {
  downloadFileByFetchBridge,
  requestByFetchBridge,
  uploadFileByFetchBridge,
} from './network'
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
  offNetworkStatusChangeBridge,
  offWindowResizeBridge,
  onNetworkStatusChangeBridge,
  onWindowResizeBridge,
} from './runtimeCapabilityApi'
import {
  clearStorageSyncBridge,
  createFileSystemManagerBridgeApi,
  createVKSessionBridgeApi,
  createWorkerBridgeApi,
  getStorageInfoSyncBridge,
  getStorageSyncBridge,
  removeStorageSyncBridge,
  setStorageSyncBridge,
} from './runtimeInfra'
import {
  hideKeyboardBridge,
  loadSubPackageBridge,
  nextTickBridge,
  pageScrollToBridge,
  preloadSubpackageBridge,
  startPullDownRefreshBridge,
  stopPullDownRefreshBridge,
} from './runtimeOps'
import { createSelectorQueryBridge } from './selectorQuery'
import {
  clearStorageBridge,
  getStorageBridge,
  getStorageInfoBridge,
  removeStorageBridge,
  setStorageBridge,
} from './storageAsync'
import {
  resolveDeviceOrientation,
} from './system'
import {
  getAccountInfoSyncBridge,
  getAppBaseInfoBridge,
  getDeviceInfoBridge,
  getMenuButtonBoundingClientRectBridge,
  getSystemInfoBridge,
  getSystemInfoSyncBridge,
  getWindowInfoBridge,
} from './systemApi'
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

import { createVideoContextBridge } from './videoContext'

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

export function navigateToMiniProgram(options?: NavigateToMiniProgramOptions) {
  const appId = options?.appId?.trim() ?? ''
  if (!appId) {
    const failure = callWxAsyncFailure(options, 'navigateToMiniProgram:fail invalid appId')
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'navigateToMiniProgram:ok' }))
}

export function exitMiniProgram(options?: WxAsyncOptions<WxBaseResult>) {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'exitMiniProgram:ok' }))
}

export function nextTick(callback?: () => void) {
  return nextTickBridge(callback)
}

export function startPullDownRefresh(options?: WxAsyncOptions<WxBaseResult>) {
  return startPullDownRefreshBridge(options)
}

export function stopPullDownRefresh(options?: WxAsyncOptions<WxBaseResult>) {
  return stopPullDownRefreshBridge(options)
}

export function hideKeyboard(options?: WxAsyncOptions<WxBaseResult>) {
  return hideKeyboardBridge(options)
}

export function loadSubPackage(options?: LoadSubPackageOptions) {
  return loadSubPackageBridge(options)
}

export function preloadSubpackage(options?: PreloadSubpackageOptions) {
  return preloadSubpackageBridge(options)
}

export function pageScrollTo(options?: PageScrollToOptions) {
  return pageScrollToBridge(options)
}

export function createSelectorQuery(): SelectorQuery {
  return createSelectorQueryBridge()
}

export function createCanvasContext(canvasId: string): CanvasContext {
  return createCanvasContextBridge(canvasId)
}

export function createVideoContext(videoId: string): VideoContext {
  return createVideoContextBridge(videoId)
}

const WEB_SUPPORTED_AUTH_SCOPES = new Set([
  'scope.userInfo',
  'scope.userLocation',
  'scope.userLocationBackground',
  'scope.address',
  'scope.invoiceTitle',
  'scope.invoice',
  'scope.werun',
  'scope.record',
  'scope.writePhotosAlbum',
  'scope.camera',
])
const APP_AUTHORIZE_SCOPE_MAP: Partial<Record<keyof AppAuthorizeSetting, string>> = {
  albumAuthorized: 'scope.writePhotosAlbum',
  cameraAuthorized: 'scope.camera',
  locationAuthorized: 'scope.userLocation',
  microphoneAuthorized: 'scope.record',
}
const webAuthorizeState = new Map<string, AppAuthorizeStatus>()
for (const scope of WEB_SUPPORTED_AUTH_SCOPES) {
  webAuthorizeState.set(scope, 'not determined')
}

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

export function setStorageSync(key: string, data: any) {
  return setStorageSyncBridge(key, data)
}

export function getStorageSync(key: string) {
  return getStorageSyncBridge(key)
}

export function removeStorageSync(key: string) {
  return removeStorageSyncBridge(key)
}

export function clearStorageSync() {
  return clearStorageSyncBridge()
}

export function getStorageInfoSync(): StorageInfoResult {
  return getStorageInfoSyncBridge() as StorageInfoResult
}

export function setStorage(options?: SetStorageOptions) {
  return setStorageBridge(options)
}

export function getStorage(options?: GetStorageOptions) {
  return getStorageBridge(options)
}

export function removeStorage(options?: RemoveStorageOptions) {
  return removeStorageBridge(options)
}

export function clearStorage(options?: WxAsyncOptions<WxBaseResult>) {
  return clearStorageBridge(options)
}

export function getStorageInfo(options?: WxAsyncOptions<StorageInfoResult>) {
  return getStorageInfoBridge(options)
}

const fileSystemManagerBridge: FileSystemManager = createFileSystemManagerBridgeApi(
  (options: any, result: any) => callWxAsyncSuccess(
    options as unknown as WxAsyncOptions<WxBaseResult> | undefined,
    result as WxBaseResult,
  ),
  (options: any, errMsg: any) => callWxAsyncFailure(
    options as unknown as WxAsyncOptions<WxBaseResult> | undefined,
    errMsg,
  ),
) as FileSystemManager

export function getFileSystemManager() {
  return fileSystemManagerBridge
}

export function createWorker(path: string): WorkerBridge {
  return createWorkerBridgeApi(path) as WorkerBridge
}

export function createVKSession(_options?: Record<string, unknown>): VkSession {
  return createVKSessionBridgeApi() as VkSession
}

export async function request(options?: RequestOptions) {
  return requestByFetchBridge(options)
}

export async function downloadFile(options?: DownloadFileOptions) {
  return downloadFileByFetchBridge(options)
}

export async function uploadFile(options?: UploadFileOptions) {
  return uploadFileByFetchBridge(options)
}

export function vibrateShort(options?: VibrateShortOptions) {
  return vibrateShortBridge(options)
}

export function getBatteryInfoSync(): BatteryInfo {
  return getBatteryInfoSyncBridge()
}

export async function getBatteryInfo(options?: WxAsyncOptions<GetBatteryInfoSuccessResult>) {
  return getBatteryInfoBridge(options)
}

export function getLocation(options?: GetLocationOptions) {
  return getLocationBridge(options)
}

export async function getFuzzyLocation(options?: GetFuzzyLocationOptions) {
  return getFuzzyLocationBridge(options)
}

export function getSetting(options?: GetSettingOptions) {
  return getSettingBridge(options, webAuthorizeState)
}

export function authorize(options?: AuthorizeOptions) {
  return authorizeBridge(options, webAuthorizeState, WEB_SUPPORTED_AUTH_SCOPES)
}

export function openSetting(options?: OpenSettingOptions) {
  return openSettingBridge(options, webAuthorizeState, WEB_SUPPORTED_AUTH_SCOPES)
}

export function openAppAuthorizeSetting(options?: OpenAppAuthorizeSettingOptions) {
  return openAppAuthorizeSettingBridge(
    options,
    webAuthorizeState,
    APP_AUTHORIZE_SCOPE_MAP as Record<string, string>,
    getAppAuthorizeSetting,
  )
}

export function getNetworkType(options?: GetNetworkTypeOptions) {
  return getNetworkTypeBridge(options)
}

export function onNetworkStatusChange(callback: NetworkStatusChangeCallback) {
  return onNetworkStatusChangeBridge(callback)
}

export function offNetworkStatusChange(callback?: NetworkStatusChangeCallback) {
  return offNetworkStatusChangeBridge(callback)
}

export function onWindowResize(callback: WindowResizeCallback) {
  return onWindowResizeBridge(callback, getWindowInfo)
}

export function offWindowResize(callback?: WindowResizeCallback) {
  return offWindowResizeBridge(callback)
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

export function getSystemInfoSync(): SystemInfo {
  return getSystemInfoSyncBridge()
}

export function getSystemInfo(options?: GetSystemInfoOptions) {
  return getSystemInfoBridge(options)
}

export function getWindowInfo(): WindowInfo {
  return getWindowInfoBridge()
}

export function getDeviceInfo(): DeviceInfo {
  return getDeviceInfoBridge() as DeviceInfo
}

export function getSystemSetting(): SystemSetting {
  return getSystemSettingBridge(webAuthorizeState, resolveDeviceOrientation)
}

export function getAppAuthorizeSetting(): AppAuthorizeSetting {
  return getAppAuthorizeSettingBridge(webAuthorizeState) as AppAuthorizeSetting
}

export function login(options?: LoginOptions) {
  return loginBridge(options)
}

export function checkSession(options?: CheckSessionOptions) {
  return checkSessionBridge(options)
}

export function getUserInfo(options?: GetUserInfoOptions) {
  return getUserInfoBridge(options, webAuthorizeState)
}

export function getUserProfile(options?: GetUserProfileOptions) {
  return getUserProfileBridge(options, webAuthorizeState)
}

export function getAccountInfoSync(): AccountInfoSync {
  return getAccountInfoSyncBridge() as AccountInfoSync
}

export function getAppBaseInfo(): AppBaseInfo {
  return getAppBaseInfoBridge() as AppBaseInfo
}

export function getMenuButtonBoundingClientRect(): MenuButtonBoundingClientRect {
  return getMenuButtonBoundingClientRectBridge() as MenuButtonBoundingClientRect
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
