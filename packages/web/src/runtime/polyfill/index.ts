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
  ChooseAddressOptions,
  ChooseFileOptions,
  ChooseImageOptions,
  ChooseLocationOptions,
  ChooseMediaOptions,
  ChooseMessageFileOptions,
  ChooseVideoOptions,
  CloudBridge,
  CompressImageOptions,
  CompressVideoOptions,
  DeviceInfo,
  DownloadFileOptions,
  FileSystemManager,
  GetBatteryInfoSuccessResult,
  GetClipboardDataOptions,
  GetExtConfigOptions,
  GetFuzzyLocationOptions,
  GetImageInfoOptions,
  GetLocationOptions,
  GetNetworkTypeOptions,
  GetSettingOptions,
  GetStorageOptions,
  GetSystemInfoOptions,
  GetUserInfoOptions,
  GetUserProfileOptions,
  GetVideoInfoOptions,
  InterstitialAd,
  LoadSubPackageOptions,
  LoginOptions,
  LogManager,
  LogManagerOptions,
  MakePhoneCallOptions,
  MenuButtonBoundingClientRect,
  NavigateToMiniProgramOptions,
  NetworkStatusChangeCallback,
  OpenAppAuthorizeSettingOptions,
  OpenCustomerServiceChatOptions,
  OpenDocumentOptions,
  OpenLocationOptions,
  OpenSettingOptions,
  OpenVideoEditorOptions,
  PageScrollToOptions,
  PreloadSubpackageOptions,
  PreviewImageOptions,
  PreviewMediaOptions,
  RemoveStorageOptions,
  RequestOptions,
  RequestPaymentOptions,
  RequestSubscribeMessageOptions,
  RequestSubscribeMessageSuccessResult,
  RewardedVideoAd,
  SaveFileOptions,
  SaveFileToDiskOptions,
  SaveImageToPhotosAlbumOptions,
  SaveVideoToPhotosAlbumOptions,
  ScanCodeOptions,
  SelectorQuery,
  SetBackgroundColorOptions,
  SetBackgroundTextStyleOptions,
  SetClipboardDataOptions,
  SetStorageOptions,
  ShareMenuOptions,
  ShowActionSheetOptions,
  ShowLoadingOptions,
  ShowModalOptions,
  ShowToastOptions,
  StorageInfoResult,
  SystemInfo,
  SystemSetting,
  TabBarOptions,
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
  getClipboardDataBridge,
  openCustomerServiceChatBridge,
  scanCodeBridge,
  setClipboardDataBridge,
} from './interactionApi'
import {
  chooseAddressBridge,
  chooseLocationBridge,
  getFuzzyLocationBridge,
  getLocationBridge,
  makePhoneCallBridge,
  openLocationBridge,
} from './locationApi'
import {
  chooseFileBridge,
  chooseImageBridge,
  chooseMediaBridge,
  chooseMessageFileBridge,
  chooseVideoBridge,
  compressImageBridge,
  compressVideoBridge,
  getImageInfoBridge,
  getVideoInfoBridge,
  openDocumentBridge,
  openVideoEditorBridge,
  previewImageBridge,
  previewMediaBridge,
  saveFileBridge,
  saveFileToDiskBridge,
  saveImageToPhotosAlbumBridge,
  saveVideoToPhotosAlbumBridge,
} from './mediaApi'
import {
  getNetworkTypeBridge,
  hideTabBarBridge,
  requestPaymentBridge,
  requestSubscribeMessageBridge,
  showActionSheetBridge,
  showModalBridge,
  showShareMenuBridge,
  showTabBarBridge,
  updateShareMenuBridge,
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
  hideLoadingBridge,
  showLoadingBridge,
  showToastBridge,
} from './uiFeedback'

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

export function showToast(options?: ShowToastOptions) {
  return showToastBridge(options)
}

export function showLoading(options?: ShowLoadingOptions) {
  return showLoadingBridge(options)
}

export function hideLoading(options?: WxAsyncOptions<WxBaseResult>) {
  return hideLoadingBridge(options)
}

export function showShareMenu(options?: ShareMenuOptions) {
  return showShareMenuBridge(options)
}

export function updateShareMenu(options?: ShareMenuOptions) {
  return updateShareMenuBridge(options)
}

export function openCustomerServiceChat(options?: OpenCustomerServiceChatOptions) {
  return openCustomerServiceChatBridge(options)
}

export function makePhoneCall(options?: MakePhoneCallOptions) {
  return makePhoneCallBridge(options)
}

export function chooseAddress(options?: ChooseAddressOptions) {
  return chooseAddressBridge(options)
}

export function chooseLocation(options?: ChooseLocationOptions) {
  return chooseLocationBridge(options)
}

export function openLocation(options?: OpenLocationOptions) {
  return openLocationBridge(options)
}

export function getImageInfo(options?: GetImageInfoOptions) {
  return getImageInfoBridge(options)
}

export function getVideoInfo(options?: GetVideoInfoOptions) {
  return getVideoInfoBridge(options)
}

export function showTabBar(options?: TabBarOptions) {
  return showTabBarBridge(options)
}

export function hideTabBar(options?: TabBarOptions) {
  return hideTabBarBridge(options)
}

export function requestPayment(options?: RequestPaymentOptions) {
  return requestPaymentBridge(options)
}

export function requestSubscribeMessage(options?: RequestSubscribeMessageOptions): Promise<RequestSubscribeMessageSuccessResult> {
  return requestSubscribeMessageBridge(options)
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

export function showModal(options?: ShowModalOptions) {
  return showModalBridge(options)
}

export function showActionSheet(options?: ShowActionSheetOptions) {
  return showActionSheetBridge(options)
}

export async function chooseImage(options?: ChooseImageOptions) {
  return chooseImageBridge(options)
}

export async function chooseMedia(options?: ChooseMediaOptions) {
  return chooseMediaBridge(options)
}

export async function compressImage(options?: CompressImageOptions) {
  return compressImageBridge(options)
}

export function compressVideo(options?: CompressVideoOptions) {
  return compressVideoBridge(options)
}

export async function chooseVideo(options?: ChooseVideoOptions) {
  return chooseVideoBridge(options)
}

export async function chooseMessageFile(options?: ChooseMessageFileOptions) {
  return chooseMessageFileBridge(options)
}

export async function chooseFile(options?: ChooseFileOptions) {
  return chooseFileBridge(options)
}

export function previewImage(options?: PreviewImageOptions) {
  return previewImageBridge(options)
}

export function previewMedia(options?: PreviewMediaOptions) {
  return previewMediaBridge(options)
}

export function openVideoEditor(options?: OpenVideoEditorOptions) {
  return openVideoEditorBridge(options)
}

export function saveImageToPhotosAlbum(options?: SaveImageToPhotosAlbumOptions) {
  return saveImageToPhotosAlbumBridge(options)
}

export function saveVideoToPhotosAlbum(options?: SaveVideoToPhotosAlbumOptions) {
  return saveVideoToPhotosAlbumBridge(options)
}

export function saveFile(options?: SaveFileOptions) {
  return saveFileBridge(options)
}

export function saveFileToDisk(options?: SaveFileToDiskOptions) {
  return saveFileToDiskBridge(options)
}

export function openDocument(options?: OpenDocumentOptions) {
  return openDocumentBridge(options)
}

export function scanCode(options?: ScanCodeOptions) {
  return scanCodeBridge(options)
}

export async function setClipboardData(options?: SetClipboardDataOptions) {
  return setClipboardDataBridge(options)
}

export async function getClipboardData(options?: GetClipboardDataOptions) {
  return getClipboardDataBridge(options)
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
