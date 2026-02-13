import type { ButtonFormConfig } from '../button'
import type { ComponentOptions, ComponentPublicInstance } from '../component'
import type { NavigationBarMetrics } from '../navigationBar'
import type { TemplateRenderer } from '../template'
import { slugify } from '../../shared/slugify'
import { ensureButtonDefined, setButtonFormConfig } from '../button'
import { defineComponent } from '../component'
import { setRuntimeExecutionMode } from '../execution'
import { ensureNavigationBarDefined, setNavigationBarMetrics } from '../navigationBar'
import { setupRpx } from '../rpx'
import { emitRuntimeWarning, setRuntimeWarningOptions } from '../warning'
import {
  cloneLaunchOptions,
  resolveCurrentPages,
  resolveFallbackLaunchOptions,
} from './appState'
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

interface RegisterMeta {
  id: string
  template?: TemplateRenderer
  style?: string
}

interface PageHooks {
  onLoad?: (this: ComponentPublicInstance, query: Record<string, string>) => void
  onReady?: (this: ComponentPublicInstance) => void
  onShow?: (this: ComponentPublicInstance) => void
  onHide?: (this: ComponentPublicInstance) => void
  onUnload?: (this: ComponentPublicInstance) => void
}

interface PageRecord {
  tag: string
  hooks: PageHooks
  instances: Set<ComponentPublicInstance>
}

interface ComponentRecord {
  tag: string
}

type MethodHandler = (this: ComponentPublicInstance, ...args: unknown[]) => unknown

interface PageStackEntry {
  id: string
  query: Record<string, string>
  instance?: ComponentPublicInstance
}

interface RouteMeta {
  id: string
  query: Record<string, string>
  entry: PageStackEntry
}

const ROUTE_META_SYMBOL = Symbol('@weapp-vite/web:route-meta')
const PAGE_STATE_SYMBOL = Symbol('@weapp-vite/web:page-state')

interface RouteMetaCarrier {
  [ROUTE_META_SYMBOL]?: RouteMeta
}

interface PageStateCarrier {
  [PAGE_STATE_SYMBOL]?: PageInstanceState
}

type ComponentPageLifetimeType = 'show' | 'hide' | 'resize'

interface PageLifetimeAwareComponent extends HTMLElement {
  __weappInvokePageLifetime?: (type: ComponentPageLifetimeType) => void
  renderRoot?: ShadowRoot | HTMLElement
}

interface AppLifecycleHooks {
  onLaunch?: (this: AppRuntime, options: AppLaunchOptions) => void
  onShow?: (this: AppRuntime, options: AppLaunchOptions) => void
}

type AppRuntime = Record<string, unknown> & Partial<AppLifecycleHooks> & {
  globalData?: Record<string, unknown>
}

interface AppLaunchOptions {
  path: string
  scene: number
  query: Record<string, string>
  referrerInfo: Record<string, unknown>
}

interface WxBaseResult {
  errMsg: string
}

interface WxAsyncOptions<SuccessResult extends WxBaseResult> {
  success?: (result: SuccessResult) => void
  fail?: (result: WxBaseResult) => void
  complete?: (result: SuccessResult | WxBaseResult) => void
}

interface ShowToastOptions extends WxAsyncOptions<WxBaseResult> {
  title?: string
  icon?: 'success' | 'error' | 'none'
  duration?: number
}

interface SetClipboardDataOptions extends WxAsyncOptions<WxBaseResult> {
  data?: string
}

interface GetClipboardDataSuccessResult extends WxBaseResult {
  data: string
}

interface GetClipboardDataOptions extends WxAsyncOptions<GetClipboardDataSuccessResult> {}

interface SetStorageOptions extends WxAsyncOptions<WxBaseResult> {
  key?: string
  data?: any
}

interface GetStorageSuccessResult extends WxBaseResult {
  data: any
}

interface GetStorageOptions extends WxAsyncOptions<GetStorageSuccessResult> {
  key?: string
}

interface RemoveStorageOptions extends WxAsyncOptions<WxBaseResult> {
  key?: string
}

interface StorageInfoResult extends WxBaseResult {
  keys: string[]
  currentSize: number
  limitSize: number
}

interface FileReadResult extends WxBaseResult {
  data: string | ArrayBuffer
}

interface FileWriteOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
  data?: string | ArrayBuffer | ArrayBufferView
  encoding?: string
}

interface FileReadOptions extends WxAsyncOptions<FileReadResult> {
  filePath?: string
  encoding?: string
}

interface FileSystemManager {
  writeFile: (options?: FileWriteOptions) => void
  readFile: (options?: FileReadOptions) => void
  writeFileSync: (filePath: string, data: string | ArrayBuffer | ArrayBufferView, encoding?: string) => void
  readFileSync: (filePath: string, encoding?: string) => string | ArrayBuffer
}

type WorkerMessageCallback = (result: { data: unknown }) => void
type WorkerErrorCallback = (result: { message: string, filename?: string, lineno?: number, colno?: number }) => void

interface WorkerBridge {
  postMessage: (data: unknown) => void
  terminate: () => void
  onMessage: (callback: WorkerMessageCallback) => void
  offMessage: (callback?: WorkerMessageCallback) => void
  onError: (callback: WorkerErrorCallback) => void
  offError: (callback?: WorkerErrorCallback) => void
}

interface RequestSuccessResult extends WxBaseResult {
  data: any
  statusCode: number
  header: Record<string, string>
}

interface RequestOptions extends WxAsyncOptions<RequestSuccessResult> {
  url?: string
  method?: string
  data?: any
  header?: Record<string, string>
  timeout?: number
  dataType?: 'json' | 'text'
  responseType?: 'text' | 'arraybuffer'
}

interface DownloadFileSuccessResult extends WxBaseResult {
  tempFilePath: string
  statusCode: number
}

interface DownloadFileOptions extends WxAsyncOptions<DownloadFileSuccessResult> {
  url?: string
  header?: Record<string, string>
  timeout?: number
}

interface UploadFileSuccessResult extends WxBaseResult {
  data: string
  statusCode: number
  header: Record<string, string>
}

interface UploadFileOptions extends WxAsyncOptions<UploadFileSuccessResult> {
  url?: string
  filePath?: string
  name?: string
  header?: Record<string, string>
  formData?: Record<string, unknown>
  timeout?: number
}

interface PreviewImageOptions extends WxAsyncOptions<WxBaseResult> {
  current?: string
  urls?: string[]
}

interface ChooseImageTempFile {
  path: string
  size: number
  type: string
  name: string
}

interface ChooseImageSuccessResult extends WxBaseResult {
  tempFilePaths: string[]
  tempFiles: ChooseImageTempFile[]
}

interface ChooseImageOptions extends WxAsyncOptions<ChooseImageSuccessResult> {
  count?: number
  sizeType?: Array<'original' | 'compressed'>
  sourceType?: Array<'album' | 'camera'>
}

interface AuthSettingResult {
  authSetting: Record<string, boolean>
}

interface GetSettingSuccessResult extends WxBaseResult, AuthSettingResult {}

interface GetSettingOptions extends WxAsyncOptions<GetSettingSuccessResult> {}

interface AuthorizeOptions extends WxAsyncOptions<WxBaseResult> {
  scope?: string
}

interface OpenSettingSuccessResult extends WxBaseResult, AuthSettingResult {}

interface OpenSettingOptions extends WxAsyncOptions<OpenSettingSuccessResult> {}

type ChooseMediaType = 'image' | 'video'

interface ChooseMediaTempFile {
  tempFilePath: string
  size: number
  fileType: ChooseMediaType
  thumbTempFilePath?: string
  width: number
  height: number
  duration: number
}

interface ChooseMediaSuccessResult extends WxBaseResult {
  type: ChooseMediaType
  tempFiles: ChooseMediaTempFile[]
}

interface ChooseMediaOptions extends WxAsyncOptions<ChooseMediaSuccessResult> {
  count?: number
  mediaType?: Array<'image' | 'video' | 'mix'>
  sourceType?: Array<'album' | 'camera'>
  maxDuration?: number
  sizeType?: Array<'original' | 'compressed'>
  camera?: 'back' | 'front'
}

interface CompressImageSuccessResult extends WxBaseResult {
  tempFilePath: string
}

interface CompressImageOptions extends WxAsyncOptions<CompressImageSuccessResult> {
  src?: string
  quality?: number
  compressedWidth?: number
  compressedHeight?: number
}

interface ChooseVideoSuccessResult extends WxBaseResult {
  tempFilePath: string
  duration: number
  size: number
  height: number
  width: number
}

interface ChooseVideoOptions extends WxAsyncOptions<ChooseVideoSuccessResult> {
  sourceType?: Array<'album' | 'camera'>
  compressed?: boolean
  maxDuration?: number
  camera?: 'back' | 'front'
}

interface GetVideoInfoSuccessResult extends WxBaseResult {
  size: number
  duration: number
  width: number
  height: number
  fps: number
  bitrate: number
  type: string
  orientation: 'up'
}

interface GetVideoInfoOptions extends WxAsyncOptions<GetVideoInfoSuccessResult> {
  src?: string
}

interface CompressVideoSuccessResult extends WxBaseResult {
  tempFilePath: string
  size: number
  duration: number
  width: number
  height: number
  bitrate: number
  fps: number
}

interface CompressVideoOptions extends WxAsyncOptions<CompressVideoSuccessResult> {
  src?: string
  quality?: 'low' | 'medium' | 'high'
  bitrate?: number
}

interface MediaPreviewSource {
  url: string
  type?: 'image' | 'video'
  poster?: string
}

interface PreviewMediaOptions extends WxAsyncOptions<WxBaseResult> {
  sources?: MediaPreviewSource[]
  current?: number
}

interface SaveVideoToPhotosAlbumOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
}

interface ChooseFileSuccessResult extends WxBaseResult {
  tempFiles: ChooseMessageFileTempFile[]
}

interface ChooseFileOptions extends WxAsyncOptions<ChooseFileSuccessResult> {
  count?: number
  type?: 'all' | 'video' | 'image' | 'file'
  extension?: string[]
}

interface OpenVideoEditorSuccessResult extends WxBaseResult {
  tempFilePath: string
}

interface OpenVideoEditorOptions extends WxAsyncOptions<OpenVideoEditorSuccessResult> {
  src?: string
}

interface SaveFileSuccessResult extends WxBaseResult {
  savedFilePath: string
}

interface SaveFileOptions extends WxAsyncOptions<SaveFileSuccessResult> {
  tempFilePath?: string
  filePath?: string
}

interface SaveFileToDiskOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
  fileName?: string
}

interface ChooseMessageFileTempFile {
  path: string
  size: number
  type: string
  name: string
  time: number
}

interface ChooseMessageFileSuccessResult extends WxBaseResult {
  tempFiles: ChooseMessageFileTempFile[]
}

interface ChooseMessageFileOptions extends WxAsyncOptions<ChooseMessageFileSuccessResult> {
  count?: number
  type?: 'all' | 'video' | 'image' | 'file'
}

interface SaveImageToPhotosAlbumOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
}

interface ScanCodeSuccessResult extends WxBaseResult {
  result: string
  scanType: string
  charSet: string
  path: string
  rawData: string
}

interface ScanCodeOptions extends WxAsyncOptions<ScanCodeSuccessResult> {
  onlyFromCamera?: boolean
  scanType?: string[]
}

interface GetLocationSuccessResult extends WxBaseResult {
  latitude: number
  longitude: number
  speed: number
  accuracy: number
  altitude: number
  verticalAccuracy: number
  horizontalAccuracy: number
}

interface GetLocationOptions extends WxAsyncOptions<GetLocationSuccessResult> {
  type?: 'wgs84' | 'gcj02'
  altitude?: boolean
  isHighAccuracy?: boolean
  highAccuracyExpireTime?: number
}

interface GetFuzzyLocationSuccessResult extends WxBaseResult {
  latitude: number
  longitude: number
  accuracy: number
}

interface GetFuzzyLocationOptions extends WxAsyncOptions<GetFuzzyLocationSuccessResult> {}

type NetworkType = 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none'

interface NetworkStatusResult {
  isConnected: boolean
  networkType: NetworkType
}

interface GetNetworkTypeSuccessResult extends WxBaseResult, NetworkStatusResult {}

interface GetNetworkTypeOptions extends WxAsyncOptions<GetNetworkTypeSuccessResult> {}

type NetworkStatusChangeCallback = (result: NetworkStatusResult) => void

interface WindowResizeResult {
  size: {
    windowWidth: number
    windowHeight: number
  }
  windowWidth: number
  windowHeight: number
}

type WindowResizeCallback = (result: WindowResizeResult) => void

interface ShowLoadingOptions extends WxAsyncOptions<WxBaseResult> {
  title?: string
  mask?: boolean
}

interface SetBackgroundColorOptions extends WxAsyncOptions<WxBaseResult> {
  backgroundColor?: string
  backgroundColorTop?: string
  backgroundColorBottom?: string
}

interface SetBackgroundTextStyleOptions extends WxAsyncOptions<WxBaseResult> {
  textStyle?: 'dark' | 'light'
}

interface ShareMenuOptions extends WxAsyncOptions<WxBaseResult> {
  withShareTicket?: boolean
  menus?: string[]
}

interface NavigateToMiniProgramOptions extends WxAsyncOptions<WxBaseResult> {
  appId?: string
  path?: string
  extraData?: Record<string, any>
  envVersion?: 'develop' | 'trial' | 'release'
}

interface LoadSubPackageOptions extends WxAsyncOptions<WxBaseResult> {
  name?: string
  root?: string
}

interface PreloadSubpackageOptions extends WxAsyncOptions<WxBaseResult> {
  name?: string
  root?: string
}

interface UpdateManagerCheckResult {
  hasUpdate: boolean
}

interface UpdateManager {
  applyUpdate: () => void
  onCheckForUpdate: (callback: (result: UpdateManagerCheckResult) => void) => void
  onUpdateReady: (callback: () => void) => void
  onUpdateFailed: (callback: () => void) => void
}

interface LogManagerOptions {
  level?: 0 | 1
}

interface LogManager {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
}

interface ChooseLocationSuccessResult extends WxBaseResult {
  name: string
  address: string
  latitude: number
  longitude: number
}

interface ChooseLocationOptions extends WxAsyncOptions<ChooseLocationSuccessResult> {}

interface ChooseAddressSuccessResult extends WxBaseResult {
  userName: string
  postalCode: string
  provinceName: string
  cityName: string
  countyName: string
  detailInfo: string
  nationalCode: string
  telNumber: string
}

interface ChooseAddressOptions extends WxAsyncOptions<ChooseAddressSuccessResult> {}

interface GetImageInfoSuccessResult extends WxBaseResult {
  width: number
  height: number
  path: string
  type: string
  orientation: 'up'
}

interface GetImageInfoOptions extends WxAsyncOptions<GetImageInfoSuccessResult> {
  src?: string
}

interface MakePhoneCallOptions extends WxAsyncOptions<WxBaseResult> {
  phoneNumber?: string
}

interface OpenLocationOptions extends WxAsyncOptions<WxBaseResult> {
  latitude?: number
  longitude?: number
  scale?: number
  name?: string
  address?: string
}

interface TabBarOptions extends WxAsyncOptions<WxBaseResult> {
  animation?: boolean
}

interface OpenCustomerServiceChatOptions extends WxAsyncOptions<WxBaseResult> {
  corpId?: string
  extInfo?: Record<string, any>
  url?: string
}

interface RequestPaymentOptions extends WxAsyncOptions<WxBaseResult> {
  timeStamp?: string
  nonceStr?: string
  package?: string
  signType?: string
  paySign?: string
}

interface RequestSubscribeMessageSuccessResult extends WxBaseResult {
  [tmplId: string]: string
}

interface RequestSubscribeMessageOptions extends WxAsyncOptions<RequestSubscribeMessageSuccessResult> {
  tmplIds?: string[]
}

interface CloudInitOptions {
  env?: string
  traceUser?: boolean
}

interface CloudCallFunctionSuccessResult extends WxBaseResult {
  result: Record<string, unknown>
  requestID: string
}

interface CloudCallFunctionOptions extends WxAsyncOptions<CloudCallFunctionSuccessResult> {
  name?: string
  data?: Record<string, unknown>
  config?: Record<string, unknown>
}

interface CloudBridge {
  init: (options?: CloudInitOptions) => void
  callFunction: (options?: CloudCallFunctionOptions) => Promise<CloudCallFunctionSuccessResult>
}

interface VibrateShortOptions extends WxAsyncOptions<WxBaseResult> {
  type?: 'heavy' | 'medium' | 'light'
}

interface BatteryInfo {
  level: number
  isCharging: boolean
}

interface GetBatteryInfoSuccessResult extends WxBaseResult, BatteryInfo {}

interface GetExtConfigSuccessResult extends WxBaseResult {
  extConfig: Record<string, any>
}

interface GetExtConfigOptions extends WxAsyncOptions<GetExtConfigSuccessResult> {}

interface ShowModalSuccessResult extends WxBaseResult {
  confirm: boolean
  cancel: boolean
}

interface ShowModalOptions extends WxAsyncOptions<ShowModalSuccessResult> {
  title?: string
  content?: string
  showCancel?: boolean
  confirmText?: string
  cancelText?: string
}

interface ShowActionSheetSuccessResult extends WxBaseResult {
  tapIndex: number
}

interface ShowActionSheetOptions extends WxAsyncOptions<ShowActionSheetSuccessResult> {
  itemList?: string[]
  itemColor?: string
  alertText?: string
}

interface OpenDocumentOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
  fileType?: string
  showMenu?: boolean
}

interface PageScrollToOptions extends WxAsyncOptions<WxBaseResult> {
  scrollTop?: number
  duration?: number
}

interface SelectorQueryNodeFields {
  id?: boolean
  dataset?: boolean
  rect?: boolean
  size?: boolean
  scrollOffset?: boolean
  properties?: string[]
  computedStyle?: string[]
  context?: boolean
  node?: boolean
}

type SelectorQueryNodeCallback = (result: any) => void

interface SelectorQuery {
  in: (context?: unknown) => SelectorQuery
  select: (selector: string) => SelectorQueryNodesRef
  selectAll: (selector: string) => SelectorQueryNodesRef
  selectViewport: () => SelectorQueryNodesRef
  exec: (callback?: (result: any[]) => void) => SelectorQuery
}

interface SelectorQueryNodesRef {
  boundingClientRect: (callback?: SelectorQueryNodeCallback) => SelectorQuery
  scrollOffset: (callback?: SelectorQueryNodeCallback) => SelectorQuery
  fields: (fields: SelectorQueryNodeFields, callback?: SelectorQueryNodeCallback) => SelectorQuery
  node: (callback?: SelectorQueryNodeCallback) => SelectorQuery
}

interface CanvasContext {
  setFillStyle: (color: string) => void
  setStrokeStyle: (color: string) => void
  setLineWidth: (width: number) => void
  setFontSize: (size: number) => void
  fillRect: (x: number, y: number, width: number, height: number) => void
  strokeRect: (x: number, y: number, width: number, height: number) => void
  clearRect: (x: number, y: number, width: number, height: number) => void
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void
  beginPath: () => void
  closePath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  stroke: () => void
  draw: (reserve?: boolean | (() => void), callback?: () => void) => void
}

interface VideoContext {
  play: () => void
  pause: () => void
  stop: () => void
  seek: (position: number) => void
  playbackRate: (rate: number) => void
  requestFullScreen: () => void
  exitFullScreen: () => void
}

interface AdBaseOptions {
  adUnitId?: string
}

interface AdError {
  errMsg: string
  errCode: number
}

interface AdLoadResult {
  errMsg: string
}

interface AdShowResult {
  errMsg: string
}

interface RewardedVideoAdCloseResult {
  isEnded: boolean
}

interface RewardedVideoAd {
  load: () => Promise<AdLoadResult>
  show: () => Promise<AdShowResult>
  destroy: () => void
  onLoad: (callback: () => void) => void
  offLoad: (callback?: () => void) => void
  onError: (callback: (error: AdError) => void) => void
  offError: (callback?: (error: AdError) => void) => void
  onClose: (callback: (result: RewardedVideoAdCloseResult) => void) => void
  offClose: (callback?: (result: RewardedVideoAdCloseResult) => void) => void
}

interface InterstitialAd {
  load: () => Promise<AdLoadResult>
  show: () => Promise<AdShowResult>
  destroy: () => void
  onLoad: (callback: () => void) => void
  offLoad: (callback?: () => void) => void
  onError: (callback: (error: AdError) => void) => void
  offError: (callback?: (error: AdError) => void) => void
  onClose: (callback: () => void) => void
  offClose: (callback?: () => void) => void
}

interface VkSession {
  start: () => Promise<WxBaseResult>
  stop: () => Promise<WxBaseResult>
  destroy: () => void
  on: (eventName: string, callback: (payload: unknown) => void) => void
  off: (eventName?: string, callback?: (payload: unknown) => void) => void
}

interface SystemInfo {
  brand: string
  model: string
  pixelRatio: number
  screenWidth: number
  screenHeight: number
  windowWidth: number
  windowHeight: number
  statusBarHeight: number
  language: string
  version: string
  system: string
  platform: string
}

interface AppBaseInfo {
  SDKVersion: string
  language: string
  version: string
  platform: string
  enableDebug: boolean
  theme: 'light' | 'dark'
}

interface MenuButtonBoundingClientRect {
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}

interface WindowInfo {
  pixelRatio: number
  screenWidth: number
  screenHeight: number
  windowWidth: number
  windowHeight: number
  statusBarHeight: number
  screenTop: number
  safeArea: {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }
}

interface DeviceInfo {
  brand: string
  model: string
  system: string
  platform: string
  memorySize: number
  benchmarkLevel: number
  abi: string
  deviceOrientation: 'portrait' | 'landscape'
}

interface SystemSetting {
  bluetoothEnabled: boolean
  wifiEnabled: boolean
  locationEnabled: boolean
  locationReducedAccuracy: boolean
  deviceOrientation: 'portrait' | 'landscape'
}

type AppAuthorizeStatus = 'authorized' | 'denied' | 'not determined'

interface AppAuthorizeSetting {
  albumAuthorized: AppAuthorizeStatus
  bluetoothAuthorized: AppAuthorizeStatus
  cameraAuthorized: AppAuthorizeStatus
  locationAuthorized: AppAuthorizeStatus
  microphoneAuthorized: AppAuthorizeStatus
  notificationAuthorized: AppAuthorizeStatus
  phoneCalendarAuthorized: AppAuthorizeStatus
}

interface OpenAppAuthorizeSettingSuccessResult extends WxBaseResult, AppAuthorizeSetting {}

interface OpenAppAuthorizeSettingOptions extends WxAsyncOptions<OpenAppAuthorizeSettingSuccessResult> {}

interface LoginSuccessResult extends WxBaseResult {
  code: string
}

interface LoginOptions extends WxAsyncOptions<LoginSuccessResult> {
  timeout?: number
}

interface CheckSessionOptions extends WxAsyncOptions<WxBaseResult> {}

interface UserInfo {
  nickName: string
  avatarUrl: string
  gender: 0 | 1 | 2
  country: string
  province: string
  city: string
  language: string
}

interface UserProfileSuccessResult extends WxBaseResult {
  userInfo: UserInfo
  rawData: string
  signature: string
  encryptedData: string
  iv: string
}

interface GetUserInfoOptions extends WxAsyncOptions<UserProfileSuccessResult> {
  lang?: 'en' | 'zh_CN' | 'zh_TW'
}

interface GetUserProfileOptions extends WxAsyncOptions<UserProfileSuccessResult> {
  desc?: string
  lang?: 'en' | 'zh_CN' | 'zh_TW'
}

interface AccountInfoSync {
  miniProgram: {
    appId: string
    envVersion: 'develop' | 'trial' | 'release'
    version: string
  }
  plugin: Record<string, unknown>
}

interface GetSystemInfoSuccessResult extends WxBaseResult, SystemInfo {}

interface GetSystemInfoOptions extends WxAsyncOptions<GetSystemInfoSuccessResult> {}

const pageRegistry = new Map<string, PageRecord>()
const componentRegistry = new Map<string, ComponentRecord>()
const navigationHistory: PageStackEntry[] = []
let pageOrder: string[] = []
// eslint-disable-next-line ts/no-unused-vars
let activeEntry: PageStackEntry | undefined
let appInstance: AppRuntime | undefined
let appLaunched = false
let lastLaunchOptions: AppLaunchOptions | undefined
let pageResizeBridgeBound = false

const PAGE_LIFECYCLE_KEYS = new Set(['onLoad', 'onReady', 'onShow', 'onHide', 'onUnload'])
const RESERVED_PAGE_METHOD_KEYS = new Set([
  'data',
  'methods',
  'lifetimes',
  'properties',
  'behaviors',
  'options',
  'observers',
  'mixins',
  ...PAGE_LIFECYCLE_KEYS,
])
const RESERVED_COMPONENT_METHOD_KEYS = new Set([
  'data',
  'methods',
  'lifetimes',
  'pageLifetimes',
  'properties',
  'behaviors',
  'options',
  'observers',
  'mixins',
])

function ensureDocumentReady(callback: () => void) {
  if (typeof document === 'undefined') {
    return
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => callback(), { once: true })
    return
  }
  callback()
}

function ensureContainer(): HTMLElement | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  return (document.querySelector('#app') as HTMLElement | null) ?? document.body
}

function cloneLifetimes(source?: ComponentOptions['lifetimes']): ComponentOptions['lifetimes'] {
  if (!source) {
    return undefined
  }
  return {
    ...source,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isMethodHandler(value: unknown): value is MethodHandler {
  return typeof value === 'function'
}

function normalizeMethodBag(
  source: Record<string, unknown> | undefined,
  reserved: Set<string>,
) {
  const methods: Record<string, MethodHandler> = {}
  const sourceMethods = isRecord(source?.methods) ? source?.methods : undefined

  if (sourceMethods) {
    for (const [key, value] of Object.entries(sourceMethods)) {
      if (isMethodHandler(value)) {
        methods[key] = value
      }
    }
  }

  if (source) {
    for (const [key, value] of Object.entries(source)) {
      if (reserved.has(key)) {
        continue
      }
      if (isMethodHandler(value) && methods[key] === undefined) {
        methods[key] = value
      }
    }
  }
  return methods
}

type PageRawOptions = ComponentOptions & PageHooks & Record<string, unknown>
type ComponentRawOptions = ComponentOptions & Record<string, unknown>

function normalizePageOptions(raw: PageRawOptions | undefined): { component: ComponentOptions, hooks: PageHooks } {
  const component = { ...(raw ?? {}) } as ComponentOptions
  component.methods = normalizeMethodBag(raw as Record<string, unknown> | undefined, RESERVED_PAGE_METHOD_KEYS) as ComponentOptions['methods']
  if (raw?.lifetimes) {
    component.lifetimes = cloneLifetimes(raw.lifetimes)
  }
  const hooks: PageHooks = {}
  if (typeof raw?.onLoad === 'function') {
    hooks.onLoad = raw.onLoad as PageHooks['onLoad']
  }
  if (typeof raw?.onReady === 'function') {
    hooks.onReady = raw.onReady as PageHooks['onReady']
  }
  if (typeof raw?.onShow === 'function') {
    hooks.onShow = raw.onShow as PageHooks['onShow']
  }
  if (typeof raw?.onHide === 'function') {
    hooks.onHide = raw.onHide as PageHooks['onHide']
  }
  if (typeof raw?.onUnload === 'function') {
    hooks.onUnload = raw.onUnload as PageHooks['onUnload']
  }
  return { component, hooks }
}

function normalizeComponentOptions(raw: ComponentRawOptions | undefined): ComponentOptions {
  const component = { ...(raw ?? {}) } as ComponentOptions
  component.methods = normalizeMethodBag(raw as Record<string, unknown> | undefined, RESERVED_COMPONENT_METHOD_KEYS) as ComponentOptions['methods']
  if (raw?.lifetimes) {
    component.lifetimes = cloneLifetimes(raw.lifetimes)
  }
  return component
}

function getRouteMeta(instance: ComponentPublicInstance): RouteMeta | undefined {
  return (instance as RouteMetaCarrier)[ROUTE_META_SYMBOL]
}

interface PageInstanceState {
  loaded: boolean
}

function getPageState(instance: ComponentPublicInstance): PageInstanceState {
  const target = instance as PageStateCarrier
  target[PAGE_STATE_SYMBOL] ??= { loaded: false }
  return target[PAGE_STATE_SYMBOL]!
}

function walkElementsDeep(root: ParentNode, collector: Set<HTMLElement>) {
  const nodes = Array.from((root as ParentNode & { childNodes?: ArrayLike<unknown> }).childNodes ?? [])
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) {
      continue
    }
    collector.add(node)
    walkElementsDeep(node, collector)
    if (node.shadowRoot) {
      walkElementsDeep(node.shadowRoot, collector)
    }
  }
}

function dispatchPageLifetimeToComponents(
  page: ComponentPublicInstance,
  type: ComponentPageLifetimeType,
) {
  const host = page as ComponentPublicInstance & {
    renderRoot?: ShadowRoot | HTMLElement
    shadowRoot?: ShadowRoot | null
  }
  const root = host.renderRoot ?? host.shadowRoot ?? host
  if (!root || typeof root.querySelectorAll !== 'function') {
    return
  }
  const elements = new Set<HTMLElement>()
  walkElementsDeep(root, elements)
  for (const element of elements) {
    const component = element as PageLifetimeAwareComponent
    if (typeof component.__weappInvokePageLifetime === 'function') {
      component.__weappInvokePageLifetime(type)
    }
  }
}

function bindPageResizeBridge() {
  if (pageResizeBridgeBound || typeof window === 'undefined') {
    return
  }
  if (typeof window.addEventListener !== 'function') {
    return
  }
  pageResizeBridgeBound = true
  window.addEventListener('resize', () => {
    const pages = getCurrentPagesInternal()
    const current = pages[pages.length - 1]
    if (!current) {
      return
    }
    dispatchPageLifetimeToComponents(current, 'resize')
  })
}

function ensureAppLaunched(entry: PageStackEntry) {
  if (!appInstance || appLaunched) {
    return
  }
  const launchOptions: AppLaunchOptions = {
    path: entry.id,
    scene: 0,
    query: entry.query,
    referrerInfo: {},
  }
  lastLaunchOptions = {
    path: launchOptions.path,
    scene: launchOptions.scene,
    query: { ...launchOptions.query },
    referrerInfo: { ...launchOptions.referrerInfo },
  }
  if (typeof appInstance.onLaunch === 'function') {
    appInstance.onLaunch(launchOptions)
  }
  if (typeof appInstance.onShow === 'function') {
    appInstance.onShow(launchOptions)
  }
  appLaunched = true
}

function mountEntry(entry: PageStackEntry) {
  const record = pageRegistry.get(entry.id)
  if (!record) {
    return
  }
  ensureDocumentReady(() => {
    const container = ensureContainer()
    if (!container) {
      return
    }
    while (container.childNodes.length) {
      container.removeChild(container.childNodes[0]!)
    }
    const element = document.createElement(record.tag) as HTMLElement & ComponentPublicInstance & RouteMetaCarrier
    element[ROUTE_META_SYMBOL] = {
      id: entry.id,
      query: entry.query,
      entry,
    }
    container.append(element)
    activeEntry = entry
    ensureAppLaunched(entry)
  })
}

function pushEntry(id: string, query: Record<string, string>) {
  if (!pageRegistry.has(id)) {
    return
  }
  const entry: PageStackEntry = { id, query }
  navigationHistory.push(entry)
  mountEntry(entry)
}

function replaceEntry(id: string, query: Record<string, string>) {
  if (!pageRegistry.has(id)) {
    return
  }
  const entry: PageStackEntry = { id, query }
  if (navigationHistory.length) {
    navigationHistory[navigationHistory.length - 1] = entry
  }
  else {
    navigationHistory.push(entry)
  }
  mountEntry(entry)
}

function relaunchEntry(id: string, query: Record<string, string>) {
  navigationHistory.length = 0
  pushEntry(id, query)
}

const PAGE_TEMPLATE_EXTENSIONS = ['.wxml', '.axml', '.swan', '.ttml', '.qml', '.ksml', '.xhsml', '.html']

function stripTemplateExtension(id: string) {
  const lowered = id.toLowerCase()
  for (const ext of PAGE_TEMPLATE_EXTENSIONS) {
    if (lowered.endsWith(ext)) {
      return id.slice(0, -ext.length)
    }
  }
  return id
}

function parsePageId(raw: string) {
  const normalized = raw.replace(/^\//, '')
  return stripTemplateExtension(normalized)
}

function parsePageUrl(url: string) {
  const [path, search = ''] = url.split('?')
  const query: Record<string, string> = {}
  if (search) {
    const params = new URLSearchParams(search)
    for (const [key, value] of params.entries()) {
      query[key] = value
    }
  }
  return {
    id: parsePageId(path || ''),
    query,
  }
}

function augmentPageComponentOptions(component: ComponentOptions, record: PageRecord) {
  const lifetimes = component.lifetimes ?? {}
  const originalCreated = lifetimes?.created
  const originalAttached = lifetimes?.attached
  const originalReady = lifetimes?.ready
  const originalDetached = lifetimes?.detached

  const enhanced: ComponentOptions = {
    ...component,
    lifetimes: {
      ...lifetimes,
      created(this: ComponentPublicInstance) {
        originalCreated?.call(this)
        getPageState(this)
        record.instances.add(this)
      },
      attached(this: ComponentPublicInstance) {
        originalAttached?.call(this)
        const meta = getRouteMeta(this)
        if (meta?.entry) {
          meta.entry.instance = this
        }
        const state = getPageState(this)
        if (!state.loaded) {
          record.hooks.onLoad?.call(this, meta?.query ?? {})
          state.loaded = true
        }
        record.hooks.onShow?.call(this)
      },
      ready(this: ComponentPublicInstance) {
        originalReady?.call(this)
        record.hooks.onReady?.call(this)
        dispatchPageLifetimeToComponents(this, 'show')
      },
      detached(this: ComponentPublicInstance) {
        originalDetached?.call(this)
        const meta = getRouteMeta(this)
        if (meta?.entry) {
          meta.entry.instance = undefined
        }
        dispatchPageLifetimeToComponents(this, 'hide')
        record.hooks.onHide?.call(this)
        record.hooks.onUnload?.call(this)
        const state = getPageState(this)
        state.loaded = false
        record.instances.delete(this)
      },
    },
  }

  return enhanced
}

export function initializePageRoutes(
  ids: string[],
  options?: {
    rpx?: { designWidth?: number, varName?: string }
    navigationBar?: NavigationBarMetrics
    form?: ButtonFormConfig
    runtime?: {
      executionMode?: 'compat' | 'safe' | 'strict'
      warnings?: {
        level?: 'off' | 'warn' | 'error'
        dedupe?: boolean
      }
    }
  },
) {
  setRuntimeExecutionMode(options?.runtime?.executionMode)
  setRuntimeWarningOptions(options?.runtime?.warnings)
  pageOrder = Array.from(new Set(ids))
  if (!pageOrder.length) {
    return
  }
  bindPageResizeBridge()
  if (options?.rpx) {
    setupRpx(options.rpx)
  }
  if (options?.navigationBar) {
    setNavigationBarMetrics(options.navigationBar)
  }
  if (options?.form) {
    setButtonFormConfig(options.form)
  }
  if (!navigationHistory.length) {
    pushEntry(pageOrder[0], {})
  }
}

export function registerPage<T extends PageRawOptions | undefined>(options: T, meta: RegisterMeta): T {
  ensureButtonDefined()
  ensureNavigationBarDefined()
  const tag = slugify(meta.id, 'wv-page')
  const template = meta.template ?? (() => '')
  const normalized = normalizePageOptions(options)
  const existing = pageRegistry.get(meta.id)
  if (existing) {
    existing.hooks = normalized.hooks
    const component = augmentPageComponentOptions(normalized.component, existing)
    defineComponent(tag, {
      template,
      style: meta.style,
      component,
    })
    return options
  }
  const record: PageRecord = {
    tag,
    hooks: normalized.hooks,
    instances: new Set(),
  }
  const component = augmentPageComponentOptions(normalized.component, record)
  defineComponent(tag, {
    template,
    style: meta.style,
    component,
  })
  pageRegistry.set(meta.id, record)
  return options
}

export function registerComponent<T extends ComponentRawOptions | undefined>(options: T, meta: RegisterMeta): T {
  ensureButtonDefined()
  const tag = slugify(meta.id, 'wv-component')
  const template = meta.template ?? (() => '')
  const component = normalizeComponentOptions(options)
  if (componentRegistry.has(meta.id)) {
    defineComponent(tag, {
      template,
      style: meta.style,
      component,
    })
    return options
  }
  defineComponent(tag, {
    template,
    style: meta.style,
    component,
  })
  componentRegistry.set(meta.id, { tag })
  return options
}

export function registerApp<T extends AppRuntime | undefined>(options: T, _meta?: RegisterMeta): T {
  const resolved = (options ?? {}) as AppRuntime
  if (appInstance) {
    const currentGlobal = appInstance.globalData
    Object.assign(appInstance, resolved)
    if (isRecord(currentGlobal)) {
      appInstance.globalData = currentGlobal
    }
    else if (!isRecord(appInstance.globalData)) {
      appInstance.globalData = {}
    }
    return options
  }
  appInstance = resolved
  appLaunched = false
  lastLaunchOptions = undefined
  if (!isRecord(appInstance.globalData)) {
    appInstance.globalData = {}
  }
  return options
}

export function navigateTo(options: { url: string }) {
  if (!options?.url) {
    return Promise.resolve()
  }
  const { id, query } = parsePageUrl(options.url)
  pushEntry(id, query)
  return Promise.resolve()
}

export function redirectTo(options: { url: string }) {
  if (!options?.url) {
    return Promise.resolve()
  }
  const { id, query } = parsePageUrl(options.url)
  replaceEntry(id, query)
  return Promise.resolve()
}

export function reLaunch(options: { url: string }) {
  if (!options?.url) {
    return Promise.resolve()
  }
  const { id, query } = parsePageUrl(options.url)
  relaunchEntry(id, query)
  return Promise.resolve()
}

export function switchTab(options: { url: string }) {
  return redirectTo(options)
}

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

export function navigateBack(options?: { delta?: number }) {
  if (navigationHistory.length <= 1) {
    return Promise.resolve()
  }
  const delta = Math.max(1, options?.delta ?? 1)
  const targetIndex = Math.max(0, navigationHistory.length - 1 - delta)
  const target = navigationHistory[targetIndex]
  navigationHistory.length = targetIndex
  pushEntry(target.id, target.query)
  return Promise.resolve()
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

function getCurrentPagesInternal() {
  return resolveCurrentPages<ComponentPublicInstance>(navigationHistory)
}

function getAppInstance() {
  return appInstance
}

export function getLaunchOptionsSync(): AppLaunchOptions {
  if (lastLaunchOptions) {
    return cloneLaunchOptions(lastLaunchOptions)
  }
  return resolveFallbackLaunchOptions(navigationHistory)
}

export function getEnterOptionsSync(): AppLaunchOptions {
  return getLaunchOptionsSync()
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
