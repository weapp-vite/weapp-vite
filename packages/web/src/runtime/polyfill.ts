import type { ButtonFormConfig } from './button'
import type { ComponentOptions, ComponentPublicInstance } from './component'
import type { NavigationBarMetrics } from './navigationBar'
import type { TemplateRenderer } from './template'
import { slugify } from '../shared/slugify'
import { ensureButtonDefined, setButtonFormConfig } from './button'
import { defineComponent } from './component'
import { setRuntimeExecutionMode } from './execution'
import { ensureNavigationBarDefined, setNavigationBarMetrics } from './navigationBar'
import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
  normalizeDuration,
  scheduleMicrotask,
} from './polyfill/async'
import {
  buildAuthSettingSnapshot,
  buildUserProfilePayload,
  generateLoginCode,
  normalizeAuthScope,
  resolveAuthorizeDecision,
  resolveCheckSessionState,
  resolveUserProfileDecision,
  syncOpenAppAuthorizeSettingPreset,
  syncOpenSettingPreset,
} from './polyfill/auth'
import {
  normalizeChooseFileExtensions,
  normalizeChooseMessageFile,
  normalizeChooseMessageFileCount,
  normalizeChooseMessageFileType,
  pickChooseFileFiles,
  pickChooseMessageFiles,
} from './polyfill/filePicker'
import {
  normalizeFilePath,
  readFileSyncInternal,
  resolveOpenDocumentUrl,
  resolveSaveFilePath,
  resolveUploadFileBlob,
  resolveUploadFileName,
  saveMemoryFile,
  WEB_USER_DATA_PATH,
  writeFileSyncInternal,
} from './polyfill/files'
import {
  readClipboardData,
  resolveScanCodeResult,
  writeClipboardData,
} from './polyfill/interaction'
import {
  normalizePreviewMediaSources,
  openTargetInNewWindow,
  readOpenVideoEditorPreset,
  triggerDownload,
} from './polyfill/mediaActions'
import {
  inferImageTypeFromPath,
  inferVideoTypeFromPath,
  normalizeVideoInfoNumber,
  readPresetCompressVideo,
  readPresetVideoInfo,
} from './polyfill/mediaInfo'
import {
  normalizeChooseImageCount,
  normalizeChooseImageFile,
  normalizeChooseMediaCount,
  normalizeChooseMediaFile,
  normalizeChooseMediaTypes,
  pickChooseImageFiles,
  pickChooseMediaFiles,
} from './polyfill/mediaPicker'
import {
  compressImageByCanvas,
  normalizeChooseVideoFile,
  normalizeCompressImageQuality,
  pickChooseVideoFile,
} from './polyfill/mediaProcess'
import {
  buildRequestBody,
  buildRequestUrl,
  collectResponseHeaders,
  createBlobObjectUrl,
  getRuntimeFetch,
  normalizeRequestHeaders,
  normalizeRequestMethod,
  parseRequestResponseData,
  stripUploadContentType,
} from './polyfill/network'
import {
  clearStorageSyncInternal,
  getStorageInfoSyncInternal,
  getStorageSyncInternal,
  hasStorageKey,
  normalizeStorageKey,
  removeStorageSyncInternal,
  setStorageSyncInternal,
} from './polyfill/storage'
import {
  buildMenuButtonRect,
  buildWindowInfoSnapshot,
  readDeviceMemorySize,
  readSystemInfoSnapshot,
  resolveAccountAppId,
  resolveDeviceOrientation,
  resolveRuntimeTheme,
} from './polyfill/system'
import {
  getGlobalDialogHandlers,
  getLoadingElement,
  getToastElement,
  hideToastElement,
  resolveActionSheetSelection,
  resolveToastPrefix,
  setLoadingVisible,
  setToastVisible,
} from './polyfill/ui'
import { setupRpx } from './rpx'
import { emitRuntimeWarning, setRuntimeWarningOptions } from './warning'

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

type SubscribeMessageDecision = 'accept' | 'reject' | 'ban' | 'filter'

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
  if (typeof callback !== 'function') {
    return
  }
  scheduleMicrotask(() => callback())
}

export function startPullDownRefresh(options?: WxAsyncOptions<WxBaseResult>) {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'startPullDownRefresh:ok' }))
}

export function stopPullDownRefresh(options?: WxAsyncOptions<WxBaseResult>) {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'stopPullDownRefresh:ok' }))
}

export function hideKeyboard(options?: WxAsyncOptions<WxBaseResult>) {
  const activeElement = (typeof document !== 'undefined'
    ? (document as { activeElement?: { blur?: () => void } }).activeElement
    : undefined)
  if (activeElement && typeof activeElement.blur === 'function') {
    activeElement.blur()
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'hideKeyboard:ok' }))
}

export function loadSubPackage(options?: LoadSubPackageOptions) {
  const name = resolveSubPackageName(options)
  if (!name) {
    const failure = callWxAsyncFailure(options, 'loadSubPackage:fail invalid name')
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'loadSubPackage:ok' }))
}

export function preloadSubpackage(options?: PreloadSubpackageOptions) {
  const name = resolveSubPackageName(options)
  if (!name) {
    const failure = callWxAsyncFailure(options, 'preloadSubpackage:fail invalid name')
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'preloadSubpackage:ok' }))
}

function resolveScrollTop(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }
  return Math.max(0, value)
}

function setWindowScrollTop(top: number) {
  if (typeof window === 'undefined') {
    return
  }
  const runtimeWindow = window as Window & {
    scrollTo?: (x: number, y: number) => void
  }
  if (typeof runtimeWindow.scrollTo !== 'function') {
    return
  }
  runtimeWindow.scrollTo(0, top)
}

export function pageScrollTo(options?: PageScrollToOptions) {
  const targetTop = resolveScrollTop(options?.scrollTop)
  const duration = normalizeDuration(options?.duration, 300)
  const run = () => setWindowScrollTop(targetTop)

  if (duration <= 0) {
    run()
    return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'pageScrollTo:ok' }))
  }

  return new Promise<WxBaseResult>((resolve) => {
    setTimeout(() => {
      run()
      resolve(callWxAsyncSuccess(options, { errMsg: 'pageScrollTo:ok' }))
    }, duration)
  })
}

type SelectorTargetDescriptor
  = | { type: 'node', selector: string, multiple: boolean }
    | { type: 'viewport' }

type SelectorQueryTask
  = | {
    type: 'boundingClientRect'
    target: SelectorTargetDescriptor
    callback?: SelectorQueryNodeCallback
  }
  | {
    type: 'scrollOffset'
    target: SelectorTargetDescriptor
    callback?: SelectorQueryNodeCallback
  }
  | {
    type: 'fields'
    target: SelectorTargetDescriptor
    fields: SelectorQueryNodeFields
    callback?: SelectorQueryNodeCallback
  }
  | {
    type: 'node'
    target: SelectorTargetDescriptor
    callback?: SelectorQueryNodeCallback
  }

function isQueryRoot(value: unknown): value is ParentNode {
  if (!value || typeof value !== 'object') {
    return false
  }
  const target = value as {
    querySelector?: (selector: string) => unknown
    querySelectorAll?: (selector: string) => ArrayLike<unknown>
  }
  return typeof target.querySelector === 'function' && typeof target.querySelectorAll === 'function'
}

function resolveQueryRoot(scope: unknown): ParentNode | undefined {
  const scoped = scope as {
    renderRoot?: unknown
    shadowRoot?: unknown
    $el?: unknown
  } | undefined
  if (isQueryRoot(scoped?.renderRoot)) {
    return scoped?.renderRoot
  }
  if (isQueryRoot(scoped?.shadowRoot)) {
    return scoped?.shadowRoot
  }
  if (isQueryRoot(scoped?.$el)) {
    return scoped?.$el
  }
  if (isQueryRoot(scope)) {
    return scope
  }
  if (typeof document !== 'undefined' && isQueryRoot(document)) {
    return document
  }
  return undefined
}

function resolveViewportTarget() {
  if (typeof window !== 'undefined') {
    return window
  }
  return undefined
}

function resolveQueryTargets(scope: unknown, target: SelectorTargetDescriptor): unknown[] {
  if (target.type === 'viewport') {
    const viewport = resolveViewportTarget()
    return viewport ? [viewport] : []
  }
  const root = resolveQueryRoot(scope)
  if (!root || !target.selector) {
    return []
  }
  if (target.multiple) {
    return Array.from(root.querySelectorAll(target.selector))
  }
  const node = root.querySelector(target.selector)
  return node ? [node] : []
}

function normalizeRectValue(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }
  return value
}

function getViewportRect() {
  const runtimeWindow = typeof window !== 'undefined' ? window : undefined
  const width = normalizeRectValue(runtimeWindow?.innerWidth)
  const height = normalizeRectValue(runtimeWindow?.innerHeight)
  return {
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
  }
}

function readNodeRect(node: unknown) {
  if (!node) {
    return null
  }
  if ((typeof window !== 'undefined' && node === window) || node === globalThis) {
    return getViewportRect()
  }
  const target = node as {
    getBoundingClientRect?: () => {
      left?: number
      top?: number
      right?: number
      bottom?: number
      width?: number
      height?: number
    }
  }
  if (typeof target.getBoundingClientRect !== 'function') {
    return null
  }
  const rect = target.getBoundingClientRect()
  const left = normalizeRectValue(rect.left)
  const top = normalizeRectValue(rect.top)
  const width = normalizeRectValue(rect.width)
  const height = normalizeRectValue(rect.height)
  const right = rect.right == null ? left + width : normalizeRectValue(rect.right)
  const bottom = rect.bottom == null ? top + height : normalizeRectValue(rect.bottom)
  return { left, top, right, bottom, width, height }
}

function readNodeScrollOffset(node: unknown) {
  if ((typeof window !== 'undefined' && node === window) || node === globalThis) {
    const runtimeWindow = (typeof window !== 'undefined'
      ? (window as unknown as Record<string, unknown>)
      : (globalThis as Record<string, unknown>))
    return {
      scrollLeft: normalizeRectValue(
        (runtimeWindow.pageXOffset as number | undefined) ?? (runtimeWindow.scrollX as number | undefined),
      ),
      scrollTop: normalizeRectValue(
        (runtimeWindow.pageYOffset as number | undefined) ?? (runtimeWindow.scrollY as number | undefined),
      ),
    }
  }
  const target = node as {
    scrollLeft?: number
    scrollTop?: number
  }
  return {
    scrollLeft: normalizeRectValue(target?.scrollLeft),
    scrollTop: normalizeRectValue(target?.scrollTop),
  }
}

function readNodeFields(node: unknown, fields: SelectorQueryNodeFields) {
  if (!node) {
    return null
  }
  const result: Record<string, any> = {}
  const element = node as HTMLElement

  if (fields.id) {
    const elementWithId = element as { id?: string, getAttribute?: (name: string) => string | null }
    result.id = elementWithId.id ?? elementWithId.getAttribute?.('id') ?? ''
  }
  if (fields.dataset) {
    result.dataset = { ...(element.dataset ?? {}) }
  }
  if (fields.rect || fields.size) {
    const rect = readNodeRect(node)
    if (rect) {
      if (fields.rect) {
        result.left = rect.left
        result.top = rect.top
        result.right = rect.right
        result.bottom = rect.bottom
      }
      if (fields.size) {
        result.width = rect.width
        result.height = rect.height
      }
    }
  }
  if (fields.scrollOffset) {
    Object.assign(result, readNodeScrollOffset(node))
  }
  if (fields.properties?.length) {
    for (const key of fields.properties) {
      result[key] = (node as Record<string, unknown>)[key]
    }
  }
  if (fields.computedStyle?.length && typeof getComputedStyle === 'function' && node instanceof HTMLElement) {
    const style = getComputedStyle(node)
    for (const key of fields.computedStyle) {
      result[key] = style.getPropertyValue(key)
    }
  }
  if (fields.node) {
    result.node = node
  }
  if (fields.context) {
    result.context = node
  }
  return result
}

function mapQueryResult(target: SelectorTargetDescriptor, items: unknown[], mapper: (node: unknown) => any) {
  if (target.type === 'node' && target.multiple) {
    return items.map(item => mapper(item))
  }
  const first = items[0]
  if (!first) {
    return null
  }
  return mapper(first)
}

function runQueryTask(scope: unknown, task: SelectorQueryTask) {
  const targets = resolveQueryTargets(scope, task.target)
  if (task.type === 'boundingClientRect') {
    return mapQueryResult(task.target, targets, node => readNodeRect(node))
  }
  if (task.type === 'scrollOffset') {
    return mapQueryResult(task.target, targets, node => readNodeScrollOffset(node))
  }
  if (task.type === 'fields') {
    return mapQueryResult(task.target, targets, node => readNodeFields(node, task.fields))
  }
  return mapQueryResult(task.target, targets, node => ({ node }))
}

function createNodesRef(
  tasks: SelectorQueryTask[],
  queryApi: SelectorQuery,
  target: SelectorTargetDescriptor,
): SelectorQueryNodesRef {
  return {
    boundingClientRect(callback?: SelectorQueryNodeCallback) {
      tasks.push({ type: 'boundingClientRect', target, callback })
      return queryApi
    },
    scrollOffset(callback?: SelectorQueryNodeCallback) {
      tasks.push({ type: 'scrollOffset', target, callback })
      return queryApi
    },
    fields(fields: SelectorQueryNodeFields, callback?: SelectorQueryNodeCallback) {
      tasks.push({ type: 'fields', target, fields, callback })
      return queryApi
    },
    node(callback?: SelectorQueryNodeCallback) {
      tasks.push({ type: 'node', target, callback })
      return queryApi
    },
  }
}

export function createSelectorQuery(): SelectorQuery {
  let scope: unknown
  const tasks: SelectorQueryTask[] = []

  const queryApi: SelectorQuery = {
    in(context?: unknown) {
      scope = context
      return queryApi
    },
    select(selector: string) {
      return createNodesRef(tasks, queryApi, { type: 'node', selector, multiple: false })
    },
    selectAll(selector: string) {
      return createNodesRef(tasks, queryApi, { type: 'node', selector, multiple: true })
    },
    selectViewport() {
      return createNodesRef(tasks, queryApi, { type: 'viewport' })
    },
    exec(callback?: (result: any[]) => void) {
      const result = tasks.map((task) => {
        const value = runQueryTask(scope, task)
        task.callback?.(value)
        return value
      })
      callback?.(result)
      tasks.length = 0
      return queryApi
    },
  }

  return queryApi
}

function normalizeCanvasNumber(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }
  return value
}

function resolveCanvasById(canvasId: string) {
  if (typeof document === 'undefined') {
    return undefined
  }
  const runtimeDocument = document as Document & {
    querySelectorAll?: (selector: string) => ArrayLike<Element>
    body?: {
      querySelectorAll?: (selector: string) => ArrayLike<Element>
    }
  }
  const normalized = canvasId.trim()
  if (!normalized) {
    return undefined
  }
  const canvasList = runtimeDocument.querySelectorAll?.('canvas')
    ?? runtimeDocument.body?.querySelectorAll?.('canvas')
    ?? []
  for (const candidate of Array.from(canvasList)) {
    const canvas = candidate as HTMLCanvasElement
    if (!canvas) {
      continue
    }
    if ((canvas as { id?: string }).id === normalized) {
      return canvas
    }
    if (typeof canvas.getAttribute === 'function' && canvas.getAttribute('canvas-id') === normalized) {
      return canvas
    }
  }
  return undefined
}

function createCanvasCommandQueue(canvasId: string) {
  const commands: Array<(ctx: CanvasRenderingContext2D) => void> = []

  const pushCommand = (command: (ctx: CanvasRenderingContext2D) => void) => {
    commands.push(command)
  }

  const draw: CanvasContext['draw'] = (reserveOrCallback?: boolean | (() => void), callback?: () => void) => {
    const reserve = typeof reserveOrCallback === 'boolean' ? reserveOrCallback : false
    const done = typeof reserveOrCallback === 'function' ? reserveOrCallback : callback
    const canvas = resolveCanvasById(canvasId)
    const context = canvas?.getContext?.('2d') as CanvasRenderingContext2D | null | undefined
    if (!context) {
      commands.length = 0
      done?.()
      return
    }
    if (!reserve) {
      context.clearRect(0, 0, normalizeCanvasNumber(canvas?.width), normalizeCanvasNumber(canvas?.height))
    }
    for (const command of commands) {
      command(context)
    }
    commands.length = 0
    done?.()
  }

  const api: CanvasContext = {
    setFillStyle(color: string) {
      pushCommand((ctx) => {
        ctx.fillStyle = color
      })
    },
    setStrokeStyle(color: string) {
      pushCommand((ctx) => {
        ctx.strokeStyle = color
      })
    },
    setLineWidth(width: number) {
      pushCommand((ctx) => {
        ctx.lineWidth = normalizeCanvasNumber(width)
      })
    },
    setFontSize(size: number) {
      pushCommand((ctx) => {
        const normalized = Math.max(1, normalizeCanvasNumber(size))
        ctx.font = `${normalized}px sans-serif`
      })
    },
    fillRect(x: number, y: number, width: number, height: number) {
      pushCommand((ctx) => {
        ctx.fillRect(
          normalizeCanvasNumber(x),
          normalizeCanvasNumber(y),
          normalizeCanvasNumber(width),
          normalizeCanvasNumber(height),
        )
      })
    },
    strokeRect(x: number, y: number, width: number, height: number) {
      pushCommand((ctx) => {
        ctx.strokeRect(
          normalizeCanvasNumber(x),
          normalizeCanvasNumber(y),
          normalizeCanvasNumber(width),
          normalizeCanvasNumber(height),
        )
      })
    },
    clearRect(x: number, y: number, width: number, height: number) {
      pushCommand((ctx) => {
        ctx.clearRect(
          normalizeCanvasNumber(x),
          normalizeCanvasNumber(y),
          normalizeCanvasNumber(width),
          normalizeCanvasNumber(height),
        )
      })
    },
    fillText(text: string, x: number, y: number, maxWidth?: number) {
      pushCommand((ctx) => {
        const normalizedText = String(text ?? '')
        const normalizedX = normalizeCanvasNumber(x)
        const normalizedY = normalizeCanvasNumber(y)
        if (typeof maxWidth === 'number' && Number.isFinite(maxWidth)) {
          ctx.fillText(normalizedText, normalizedX, normalizedY, normalizeCanvasNumber(maxWidth))
          return
        }
        ctx.fillText(normalizedText, normalizedX, normalizedY)
      })
    },
    beginPath() {
      pushCommand(ctx => ctx.beginPath())
    },
    closePath() {
      pushCommand(ctx => ctx.closePath())
    },
    moveTo(x: number, y: number) {
      pushCommand((ctx) => {
        ctx.moveTo(normalizeCanvasNumber(x), normalizeCanvasNumber(y))
      })
    },
    lineTo(x: number, y: number) {
      pushCommand((ctx) => {
        ctx.lineTo(normalizeCanvasNumber(x), normalizeCanvasNumber(y))
      })
    },
    stroke() {
      pushCommand(ctx => ctx.stroke())
    },
    draw,
  }
  return api
}

export function createCanvasContext(canvasId: string) {
  return createCanvasCommandQueue(String(canvasId ?? ''))
}

function resolveVideoElementById(videoId: string) {
  if (typeof document === 'undefined') {
    return undefined
  }
  const normalized = String(videoId ?? '').trim()
  if (!normalized) {
    return undefined
  }
  const fromId = document.getElementById(normalized)
  if (fromId && 'play' in fromId && 'pause' in fromId) {
    return fromId as unknown as HTMLVideoElement
  }
  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(normalized)
    : normalized.replace(/"/g, '\\"')
  const fromQuery = document.querySelector(`video#${escaped}`)
  if (fromQuery && 'play' in fromQuery && 'pause' in fromQuery) {
    return fromQuery as HTMLVideoElement
  }
  return undefined
}

export function createVideoContext(videoId: string): VideoContext {
  const getVideo = () => resolveVideoElementById(videoId)
  return {
    play() {
      getVideo()?.play?.()
    },
    pause() {
      getVideo()?.pause?.()
    },
    stop() {
      const video = getVideo()
      if (!video) {
        return
      }
      video.pause?.()
      try {
        video.currentTime = 0
      }
      catch {
        // ignore browsers that block currentTime mutation
      }
    },
    seek(position: number) {
      if (!Number.isFinite(position)) {
        return
      }
      const video = getVideo()
      if (!video) {
        return
      }
      try {
        video.currentTime = Math.max(0, position)
      }
      catch {
        // ignore browsers that block currentTime mutation
      }
    },
    playbackRate(rate: number) {
      if (!Number.isFinite(rate) || rate <= 0) {
        return
      }
      const video = getVideo()
      if (!video) {
        return
      }
      try {
        video.playbackRate = rate
      }
      catch {
        // ignore unsupported playbackRate mutation
      }
    },
    requestFullScreen() {
      const video = getVideo() as (HTMLVideoElement & { requestFullscreen?: () => Promise<void> | void }) | undefined
      video?.requestFullscreen?.()
    },
    exitFullScreen() {
      const runtimeDocument = document as { exitFullscreen?: () => Promise<void> | void }
      runtimeDocument.exitFullscreen?.()
    },
  }
}

function getCurrentPagesInternal() {
  return navigationHistory
    .map(entry => entry.instance)
    .filter((instance): instance is ComponentPublicInstance => Boolean(instance))
}

function getAppInstance() {
  return appInstance
}

function cloneLaunchOptions(options: AppLaunchOptions): AppLaunchOptions {
  return {
    path: options.path,
    scene: options.scene,
    query: { ...options.query },
    referrerInfo: { ...options.referrerInfo },
  }
}

function resolveFallbackLaunchOptions(): AppLaunchOptions {
  const entry = navigationHistory[navigationHistory.length - 1] ?? navigationHistory[0]
  if (!entry) {
    return {
      path: '',
      scene: 0,
      query: {},
      referrerInfo: {},
    }
  }
  return {
    path: entry.id,
    scene: 0,
    query: { ...entry.query },
    referrerInfo: {},
  }
}

export function getLaunchOptionsSync(): AppLaunchOptions {
  if (lastLaunchOptions) {
    return cloneLaunchOptions(lastLaunchOptions)
  }
  return resolveFallbackLaunchOptions()
}

export function getEnterOptionsSync(): AppLaunchOptions {
  return getLaunchOptionsSync()
}

function getActiveNavigationBar() {
  const pages = getCurrentPagesInternal()
  const current = pages[pages.length - 1]
  if (!current) {
    return undefined
  }
  const renderRoot = (current as { renderRoot?: ShadowRoot }).renderRoot
    ?? current.shadowRoot
    ?? current
  if (!renderRoot || typeof (renderRoot as ParentNode).querySelector !== 'function') {
    return undefined
  }
  return (renderRoot as ParentNode).querySelector('weapp-navigation-bar') as HTMLElement | null
}

let toastHideTimer: ReturnType<typeof setTimeout> | undefined

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
const networkStatusCallbacks = new Set<NetworkStatusChangeCallback>()
let networkStatusBridgeBound = false
const windowResizeCallbacks = new Set<WindowResizeCallback>()
let windowResizeBridgeBound = false
let cachedBatteryInfo: BatteryInfo = {
  level: 100,
  isCharging: false,
}
const webAuthorizeState = new Map<string, AppAuthorizeStatus>()
for (const scope of WEB_SUPPORTED_AUTH_SCOPES) {
  webAuthorizeState.set(scope, 'not determined')
}
const cloudRuntimeState: {
  env: string
  traceUser: boolean
} = {
  env: '',
  traceUser: false,
}

function warnNavigationBarMissing(action: string) {
  emitRuntimeWarning(`[@weapp-vite/web] ${action} 需要默认导航栏支持，但当前页面未渲染 weapp-navigation-bar。`, {
    key: 'navigation-bar-missing',
    context: 'runtime:navigation',
  })
}

export function setNavigationBarTitle(options: { title: string }) {
  const bar = getActiveNavigationBar()
  if (!bar) {
    warnNavigationBarMissing('wx.setNavigationBarTitle')
    return Promise.resolve()
  }
  if (options?.title !== undefined) {
    bar.setAttribute('title', options.title)
  }
  return Promise.resolve()
}

export function setNavigationBarColor(options: {
  frontColor?: string
  backgroundColor?: string
  animation?: { duration?: number, timingFunction?: string }
}) {
  const bar = getActiveNavigationBar()
  if (!bar) {
    warnNavigationBarMissing('wx.setNavigationBarColor')
    return Promise.resolve()
  }
  if (options?.frontColor) {
    bar.setAttribute('front-color', options.frontColor)
  }
  if (options?.backgroundColor) {
    bar.setAttribute('background-color', options.backgroundColor)
  }
  if (options?.animation) {
    const duration = typeof options.animation.duration === 'number'
      ? `${options.animation.duration}ms`
      : undefined
    const easing = options.animation.timingFunction
    if (duration) {
      bar.style.setProperty('--weapp-nav-transition-duration', duration)
    }
    if (easing) {
      bar.style.setProperty('--weapp-nav-transition-easing', easing)
    }
  }
  return Promise.resolve()
}

export function showNavigationBarLoading() {
  const bar = getActiveNavigationBar()
  if (!bar) {
    warnNavigationBarMissing('wx.showNavigationBarLoading')
    return Promise.resolve()
  }
  bar.setAttribute('loading', 'true')
  return Promise.resolve()
}

export function hideNavigationBarLoading() {
  const bar = getActiveNavigationBar()
  if (!bar) {
    warnNavigationBarMissing('wx.hideNavigationBarLoading')
    return Promise.resolve()
  }
  bar.removeAttribute('loading')
  return Promise.resolve()
}

function normalizeBackgroundColorValue(color: unknown) {
  if (typeof color !== 'string') {
    return ''
  }
  return color.trim()
}

export function setBackgroundColor(options?: SetBackgroundColorOptions) {
  const backgroundColor = normalizeBackgroundColorValue(options?.backgroundColor)
  const backgroundColorTop = normalizeBackgroundColorValue(options?.backgroundColorTop)
  const backgroundColorBottom = normalizeBackgroundColorValue(options?.backgroundColorBottom)
  const runtimeDocument = typeof document !== 'undefined' ? document : undefined
  const rootElement = runtimeDocument?.documentElement
  const body = runtimeDocument?.body

  if (body && backgroundColor) {
    body.style.backgroundColor = backgroundColor
  }
  if (rootElement && backgroundColorTop && backgroundColorBottom) {
    rootElement.style.setProperty(
      '--weapp-web-background-gradient',
      `linear-gradient(${backgroundColorTop}, ${backgroundColorBottom})`,
    )
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'setBackgroundColor:ok' }))
}

export function setBackgroundTextStyle(options?: SetBackgroundTextStyleOptions) {
  const textStyle = options?.textStyle
  if (textStyle !== undefined && textStyle !== 'dark' && textStyle !== 'light') {
    const failure = callWxAsyncFailure(options, 'setBackgroundTextStyle:fail invalid textStyle')
    return Promise.reject(failure)
  }
  if (typeof document !== 'undefined' && document.documentElement && textStyle) {
    document.documentElement.setAttribute('data-weapp-background-text-style', textStyle)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'setBackgroundTextStyle:ok' }))
}

function normalizeSubPackageName(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function resolveSubPackageName(options?: LoadSubPackageOptions | PreloadSubpackageOptions) {
  return normalizeSubPackageName(options?.name) || normalizeSubPackageName(options?.root)
}

interface UpdateManagerPreset {
  hasUpdate: boolean
  ready: boolean
  failed: boolean
}

function normalizeUpdateManagerPreset(value: unknown): UpdateManagerPreset {
  if (typeof value === 'boolean') {
    return {
      hasUpdate: value,
      ready: value,
      failed: false,
    }
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (!normalized || normalized === 'none' || normalized === 'false') {
      return {
        hasUpdate: false,
        ready: false,
        failed: false,
      }
    }
    if (normalized === 'fail' || normalized === 'failed' || normalized === 'error') {
      return {
        hasUpdate: true,
        ready: false,
        failed: true,
      }
    }
    return {
      hasUpdate: true,
      ready: true,
      failed: false,
    }
  }
  if (value && typeof value === 'object') {
    const payload = value as {
      hasUpdate?: unknown
      ready?: unknown
      updateReady?: unknown
      failed?: unknown
      fail?: unknown
    }
    const failed = Boolean(payload.failed ?? payload.fail)
    const ready = failed ? false : Boolean(payload.ready ?? payload.updateReady)
    const hasUpdate = payload.hasUpdate == null ? (ready || failed) : Boolean(payload.hasUpdate)
    return {
      hasUpdate,
      ready: hasUpdate && ready,
      failed: hasUpdate && failed,
    }
  }
  return {
    hasUpdate: false,
    ready: false,
    failed: false,
  }
}

function resolveUpdateManagerPreset() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebUpdateManager
  if (typeof preset === 'function') {
    return normalizeUpdateManagerPreset((preset as () => unknown)())
  }
  return normalizeUpdateManagerPreset(preset)
}

function getRuntimeConsole() {
  const runtimeGlobal = globalThis as { console?: Console }
  return runtimeGlobal.console
}

export function setStorageSync(key: string, data: any) {
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) {
    throw new TypeError('setStorageSync:fail invalid key')
  }
  setStorageSyncInternal(normalizedKey, data)
}

export function getStorageSync(key: string) {
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) {
    throw new TypeError('getStorageSync:fail invalid key')
  }
  return getStorageSyncInternal(normalizedKey)
}

export function removeStorageSync(key: string) {
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) {
    throw new TypeError('removeStorageSync:fail invalid key')
  }
  removeStorageSyncInternal(normalizedKey)
}

export function clearStorageSync() {
  clearStorageSyncInternal()
}

export function getStorageInfoSync(): StorageInfoResult {
  return getStorageInfoSyncInternal()
}

export function setStorage(options?: SetStorageOptions) {
  const key = normalizeStorageKey(options?.key)
  if (!key) {
    const failure = callWxAsyncFailure(options, 'setStorage:fail invalid key')
    return Promise.reject(failure)
  }
  try {
    setStorageSync(key, options?.data)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `setStorage:fail ${message}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'setStorage:ok' }))
}

export function getStorage(options?: GetStorageOptions) {
  const key = normalizeStorageKey(options?.key)
  if (!key) {
    const failure = callWxAsyncFailure(options, 'getStorage:fail invalid key')
    return Promise.reject(failure)
  }
  if (!hasStorageKey(key)) {
    const failure = callWxAsyncFailure(options, `getStorage:fail data not found for key ${key}`)
    return Promise.reject(failure)
  }
  const data = getStorageSync(key)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'getStorage:ok', data }))
}

export function removeStorage(options?: RemoveStorageOptions) {
  const key = normalizeStorageKey(options?.key)
  if (!key) {
    const failure = callWxAsyncFailure(options, 'removeStorage:fail invalid key')
    return Promise.reject(failure)
  }
  try {
    removeStorageSync(key)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `removeStorage:fail ${message}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'removeStorage:ok' }))
}

export function clearStorage(options?: WxAsyncOptions<WxBaseResult>) {
  clearStorageSync()
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'clearStorage:ok' }))
}

export function getStorageInfo(options?: WxAsyncOptions<StorageInfoResult>) {
  return Promise.resolve(callWxAsyncSuccess(options, {
    ...getStorageInfoSync(),
    errMsg: 'getStorageInfo:ok',
  }))
}

const fileSystemManagerBridge: FileSystemManager = {
  writeFile(options?: FileWriteOptions) {
    const filePath = normalizeFilePath(options?.filePath)
    if (!filePath) {
      callWxAsyncFailure(options, 'writeFile:fail invalid filePath')
      return
    }
    try {
      writeFileSyncInternal(filePath, options?.data ?? '')
      callWxAsyncSuccess(options, { errMsg: 'writeFile:ok' })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      callWxAsyncFailure(options, `writeFile:fail ${message}`)
    }
  },
  readFile(options?: FileReadOptions) {
    const filePath = normalizeFilePath(options?.filePath)
    if (!filePath) {
      callWxAsyncFailure(options, 'readFile:fail invalid filePath')
      return
    }
    try {
      const data = readFileSyncInternal(filePath, options?.encoding)
      callWxAsyncSuccess(options, { errMsg: 'readFile:ok', data })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      callWxAsyncFailure(options, `readFile:fail ${message}`)
    }
  },
  writeFileSync(filePath: string, data: string | ArrayBuffer | ArrayBufferView, _encoding?: string) {
    writeFileSyncInternal(filePath, data)
  },
  readFileSync(filePath: string, encoding?: string) {
    return readFileSyncInternal(filePath, encoding)
  },
}

export function getFileSystemManager() {
  return fileSystemManagerBridge
}

function resolveWorkerPath(path: unknown) {
  const normalized = typeof path === 'string' ? path.trim() : ''
  if (!normalized) {
    throw new TypeError('createWorker:fail invalid scriptPath')
  }
  try {
    const runtimeLocation = (typeof location !== 'undefined' ? location : undefined) as { href?: string } | undefined
    const base = runtimeLocation?.href
    if (base) {
      return new URL(normalized, base).toString()
    }
  }
  catch {
    // fallback to raw path
  }
  return normalized
}

export function createWorker(path: string): WorkerBridge {
  const WorkerCtor = (globalThis as { Worker?: typeof Worker }).Worker
  if (typeof WorkerCtor !== 'function') {
    throw new TypeError('createWorker:fail Worker is unavailable')
  }
  const scriptPath = resolveWorkerPath(path)

  let nativeWorker: Worker
  try {
    nativeWorker = new WorkerCtor(scriptPath)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new TypeError(`createWorker:fail ${message}`)
  }

  const messageCallbacks = new Set<WorkerMessageCallback>()
  const errorCallbacks = new Set<WorkerErrorCallback>()

  const handleMessage = (event: MessageEvent<unknown>) => {
    for (const callback of messageCallbacks) {
      callback({ data: event?.data })
    }
  }
  const handleError = (event: ErrorEvent) => {
    const payload = {
      message: event?.message ?? 'unknown error',
      filename: event?.filename,
      lineno: event?.lineno,
      colno: event?.colno,
    }
    for (const callback of errorCallbacks) {
      callback(payload)
    }
  }

  if (typeof nativeWorker.addEventListener === 'function') {
    nativeWorker.addEventListener('message', handleMessage as EventListener)
    nativeWorker.addEventListener('error', handleError as EventListener)
  }
  else {
    nativeWorker.onmessage = handleMessage as ((this: AbstractWorker, ev: MessageEvent) => any)
    nativeWorker.onerror = handleError as ((this: AbstractWorker, ev: ErrorEvent) => any)
  }

  return {
    postMessage(data: unknown) {
      nativeWorker.postMessage(data)
    },
    terminate() {
      nativeWorker.terminate()
      messageCallbacks.clear()
      errorCallbacks.clear()
    },
    onMessage(callback: WorkerMessageCallback) {
      if (typeof callback === 'function') {
        messageCallbacks.add(callback)
      }
    },
    offMessage(callback?: WorkerMessageCallback) {
      if (typeof callback !== 'function') {
        messageCallbacks.clear()
        return
      }
      messageCallbacks.delete(callback)
    },
    onError(callback: WorkerErrorCallback) {
      if (typeof callback === 'function') {
        errorCallbacks.add(callback)
      }
    },
    offError(callback?: WorkerErrorCallback) {
      if (typeof callback !== 'function') {
        errorCallbacks.clear()
        return
      }
      errorCallbacks.delete(callback)
    },
  }
}

export function createVKSession(_options?: Record<string, unknown>): VkSession {
  let destroyed = false
  const listeners = new Map<string, Set<(payload: unknown) => void>>()

  const ensureAvailable = (action: string) => {
    if (destroyed) {
      throw new TypeError(`createVKSession:fail session is destroyed (${action})`)
    }
  }

  return {
    start() {
      try {
        ensureAvailable('start')
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return Promise.reject(new TypeError(message))
      }
      return Promise.resolve({ errMsg: 'vkSession.start:ok' })
    },
    stop() {
      try {
        ensureAvailable('stop')
      }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return Promise.reject(new TypeError(message))
      }
      return Promise.resolve({ errMsg: 'vkSession.stop:ok' })
    },
    destroy() {
      destroyed = true
      listeners.clear()
    },
    on(eventName: string, callback: (payload: unknown) => void) {
      if (typeof eventName !== 'string' || typeof callback !== 'function') {
        return
      }
      const key = eventName.trim()
      if (!key) {
        return
      }
      const list = listeners.get(key) ?? new Set<(payload: unknown) => void>()
      list.add(callback)
      listeners.set(key, list)
    },
    off(eventName?: string, callback?: (payload: unknown) => void) {
      if (typeof eventName !== 'string' || !eventName.trim()) {
        listeners.clear()
        return
      }
      const list = listeners.get(eventName.trim())
      if (!list) {
        return
      }
      if (typeof callback !== 'function') {
        listeners.delete(eventName.trim())
        return
      }
      list.delete(callback)
      if (list.size === 0) {
        listeners.delete(eventName.trim())
      }
    },
  }
}

export async function request(options?: RequestOptions) {
  const url = options?.url?.trim() ?? ''
  if (!url) {
    const failure = callWxAsyncFailure(options, 'request:fail invalid url')
    return Promise.reject(failure)
  }
  const runtimeFetch = getRuntimeFetch()
  if (!runtimeFetch) {
    const failure = callWxAsyncFailure(options, 'request:fail fetch is unavailable')
    return Promise.reject(failure)
  }

  const method = normalizeRequestMethod(options?.method)
  const headers = normalizeRequestHeaders(options?.header)
  const requestUrl = buildRequestUrl(url, method, options?.data)
  const body = buildRequestBody(method, options?.data, headers)
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined
  const timeout = typeof options?.timeout === 'number' && options.timeout > 0 ? options.timeout : 0
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined

  try {
    if (timeout && controller) {
      timeoutTimer = setTimeout(() => controller.abort(), timeout)
    }
    const response = await runtimeFetch(requestUrl, {
      method,
      headers,
      body,
      signal: controller?.signal,
    })
    const responseData = await parseRequestResponseData(response, options)
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    const result = callWxAsyncSuccess(options, {
      errMsg: 'request:ok',
      data: responseData,
      statusCode: response.status,
      header: responseHeaders,
    })
    return result
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `request:fail ${message}`)
    return Promise.reject(failure)
  }
  finally {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
    }
  }
}

export async function downloadFile(options?: DownloadFileOptions) {
  const url = options?.url?.trim() ?? ''
  if (!url) {
    const failure = callWxAsyncFailure(options, 'downloadFile:fail invalid url')
    return Promise.reject(failure)
  }
  const runtimeFetch = getRuntimeFetch()
  if (!runtimeFetch) {
    const failure = callWxAsyncFailure(options, 'downloadFile:fail fetch is unavailable')
    return Promise.reject(failure)
  }

  const headers = normalizeRequestHeaders(options?.header)
  const controller = typeof AbortController === 'function' ? new AbortController() : undefined
  const timeout = typeof options?.timeout === 'number' && options.timeout > 0 ? options.timeout : 0
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined

  try {
    if (timeout && controller) {
      timeoutTimer = setTimeout(() => controller.abort(), timeout)
    }
    const response = await runtimeFetch(url, {
      method: 'GET',
      headers,
      signal: controller?.signal,
    })
    const blob = await response.blob()
    const tempFilePath = createBlobObjectUrl(blob) || url
    return callWxAsyncSuccess(options, {
      errMsg: 'downloadFile:ok',
      tempFilePath,
      statusCode: response.status,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `downloadFile:fail ${message}`)
    return Promise.reject(failure)
  }
  finally {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
    }
  }
}

export async function uploadFile(options?: UploadFileOptions) {
  const url = options?.url?.trim() ?? ''
  if (!url) {
    const failure = callWxAsyncFailure(options, 'uploadFile:fail invalid url')
    return Promise.reject(failure)
  }
  const filePath = normalizeFilePath(options?.filePath)
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'uploadFile:fail invalid filePath')
    return Promise.reject(failure)
  }
  const runtimeFetch = getRuntimeFetch()
  if (!runtimeFetch) {
    const failure = callWxAsyncFailure(options, 'uploadFile:fail fetch is unavailable')
    return Promise.reject(failure)
  }
  const FormDataCtor = (globalThis as { FormData?: typeof FormData }).FormData
  if (typeof FormDataCtor !== 'function') {
    const failure = callWxAsyncFailure(options, 'uploadFile:fail FormData is unavailable')
    return Promise.reject(failure)
  }

  const headers = stripUploadContentType(normalizeRequestHeaders(options?.header))
  const formData = new FormDataCtor()
  for (const [key, value] of Object.entries(options?.formData ?? {})) {
    formData.append(key, value == null ? '' : String(value))
  }
  const blob = await resolveUploadFileBlob(filePath, runtimeFetch)
  formData.append(options?.name?.trim() || 'file', blob, resolveUploadFileName(filePath))

  const controller = typeof AbortController === 'function' ? new AbortController() : undefined
  const timeout = typeof options?.timeout === 'number' && options.timeout > 0 ? options.timeout : 0
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined

  try {
    if (timeout && controller) {
      timeoutTimer = setTimeout(() => controller.abort(), timeout)
    }
    const response = await runtimeFetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller?.signal,
    })
    const data = await response.text()
    return callWxAsyncSuccess(options, {
      errMsg: 'uploadFile:ok',
      data,
      statusCode: response.status,
      header: collectResponseHeaders(response),
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `uploadFile:fail ${message}`)
    return Promise.reject(failure)
  }
  finally {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer)
    }
  }
}

function resolveVibrateDuration(type: VibrateShortOptions['type']) {
  if (type === 'heavy') {
    return 30
  }
  if (type === 'medium') {
    return 20
  }
  return 15
}

export function vibrateShort(options?: VibrateShortOptions) {
  const runtimeNavigator = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & {
    vibrate?: (pattern: number | number[]) => boolean
  }) | undefined
  if (!runtimeNavigator || typeof runtimeNavigator.vibrate !== 'function') {
    const failure = callWxAsyncFailure(options, 'vibrateShort:fail vibrate is unavailable')
    return Promise.reject(failure)
  }
  try {
    runtimeNavigator.vibrate(resolveVibrateDuration(options?.type))
    return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'vibrateShort:ok' }))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `vibrateShort:fail ${message}`)
    return Promise.reject(failure)
  }
}

function normalizeBatteryLevel(level: unknown) {
  if (typeof level !== 'number' || Number.isNaN(level)) {
    return 100
  }
  const value = Math.round(level * 100)
  return Math.min(100, Math.max(0, value))
}

async function readRuntimeBatteryInfo() {
  const runtimeNavigator = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & {
    getBattery?: () => Promise<{ charging?: boolean, level?: number }>
  }) | undefined
  if (runtimeNavigator && typeof runtimeNavigator.getBattery === 'function') {
    const battery = await runtimeNavigator.getBattery()
    const nextInfo: BatteryInfo = {
      level: normalizeBatteryLevel(battery?.level),
      isCharging: Boolean(battery?.charging),
    }
    cachedBatteryInfo = nextInfo
    return nextInfo
  }
  return cachedBatteryInfo
}

export function getBatteryInfoSync(): BatteryInfo {
  void readRuntimeBatteryInfo().catch(() => {})
  return {
    ...cachedBatteryInfo,
  }
}

export async function getBatteryInfo(options?: WxAsyncOptions<GetBatteryInfoSuccessResult>) {
  try {
    const batteryInfo = await readRuntimeBatteryInfo()
    return callWxAsyncSuccess(options, {
      errMsg: 'getBatteryInfo:ok',
      ...batteryInfo,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `getBatteryInfo:fail ${message}`)
    return Promise.reject(failure)
  }
}

function normalizeGeoNumber(value: unknown, fallback = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }
  return value
}

export function getLocation(options?: GetLocationOptions) {
  const runtimeNavigator = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & {
    geolocation?: {
      getCurrentPosition?: (
        success: (position: {
          coords: {
            latitude?: number
            longitude?: number
            speed?: number | null
            accuracy?: number
            altitude?: number | null
            altitudeAccuracy?: number | null
          }
        }) => void,
        error?: (err: { message?: string }) => void,
        opts?: {
          enableHighAccuracy?: boolean
          timeout?: number
        },
      ) => void
    }
  }) | undefined
  const geolocation = runtimeNavigator?.geolocation
  if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
    const failure = callWxAsyncFailure(options, 'getLocation:fail geolocation is unavailable')
    return Promise.reject(failure)
  }

  const timeout = typeof options?.highAccuracyExpireTime === 'number' && options.highAccuracyExpireTime > 0
    ? options.highAccuracyExpireTime
    : undefined

  return new Promise<GetLocationSuccessResult>((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        const coords = position.coords ?? {}
        const accuracy = normalizeGeoNumber(coords.accuracy, 0)
        const result = callWxAsyncSuccess(options, {
          errMsg: 'getLocation:ok',
          latitude: normalizeGeoNumber(coords.latitude, 0),
          longitude: normalizeGeoNumber(coords.longitude, 0),
          speed: normalizeGeoNumber(coords.speed, -1),
          accuracy,
          altitude: normalizeGeoNumber(coords.altitude, 0),
          verticalAccuracy: normalizeGeoNumber(coords.altitudeAccuracy, 0),
          horizontalAccuracy: accuracy,
        })
        resolve(result)
      },
      (error) => {
        const message = error?.message ?? 'unknown error'
        const failure = callWxAsyncFailure(options, `getLocation:fail ${message}`)
        reject(failure)
      },
      {
        enableHighAccuracy: Boolean(options?.isHighAccuracy || options?.altitude),
        timeout,
      },
    )
  })
}

function normalizeFuzzyCoordinate(value: number) {
  return Number(value.toFixed(2))
}

function readPresetFuzzyLocation() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebFuzzyLocation
  if (!preset || typeof preset !== 'object') {
    return null
  }
  const value = preset as Record<string, unknown>
  const latitude = Number(value.latitude)
  const longitude = Number(value.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return {
    latitude: normalizeFuzzyCoordinate(latitude),
    longitude: normalizeFuzzyCoordinate(longitude),
    accuracy: Math.max(1000, normalizeGeoNumber(value.accuracy, 1000)),
  }
}

export async function getFuzzyLocation(options?: GetFuzzyLocationOptions) {
  const preset = readPresetFuzzyLocation()
  if (preset) {
    return callWxAsyncSuccess(options, {
      errMsg: 'getFuzzyLocation:ok',
      ...preset,
    })
  }
  try {
    const location = await getLocation()
    return callWxAsyncSuccess(options, {
      errMsg: 'getFuzzyLocation:ok',
      latitude: normalizeFuzzyCoordinate(location.latitude),
      longitude: normalizeFuzzyCoordinate(location.longitude),
      accuracy: Math.max(1000, normalizeGeoNumber(location.accuracy, 1000)),
    })
  }
  catch (error) {
    const message = typeof (error as { errMsg?: unknown })?.errMsg === 'string'
      ? (error as { errMsg: string }).errMsg
      : error instanceof Error
        ? error.message
        : String(error)
    const failure = callWxAsyncFailure(options, `getFuzzyLocation:fail ${message}`)
    return Promise.reject(failure)
  }
}

export function getSetting(options?: GetSettingOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'getSetting:ok',
    authSetting: buildAuthSettingSnapshot(webAuthorizeState),
  }))
}

export function authorize(options?: AuthorizeOptions) {
  const scope = normalizeAuthScope(options?.scope)
  if (!scope) {
    const failure = callWxAsyncFailure(options, 'authorize:fail invalid scope')
    return Promise.reject(failure)
  }
  if (!WEB_SUPPORTED_AUTH_SCOPES.has(scope)) {
    const failure = callWxAsyncFailure(options, 'authorize:fail unsupported scope')
    return Promise.reject(failure)
  }
  const decision = resolveAuthorizeDecision(scope)
  webAuthorizeState.set(scope, decision)
  if (decision !== 'authorized') {
    const reason = decision === 'denied' ? 'auth deny' : 'auth canceled'
    const failure = callWxAsyncFailure(options, `authorize:fail ${reason}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'authorize:ok' }))
}

export function openSetting(options?: OpenSettingOptions) {
  syncOpenSettingPreset(webAuthorizeState, WEB_SUPPORTED_AUTH_SCOPES)
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'openSetting:ok',
    authSetting: buildAuthSettingSnapshot(webAuthorizeState),
  }))
}

export function openAppAuthorizeSetting(options?: OpenAppAuthorizeSettingOptions) {
  syncOpenAppAuthorizeSettingPreset(webAuthorizeState, APP_AUTHORIZE_SCOPE_MAP)
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'openAppAuthorizeSetting:ok',
    ...getAppAuthorizeSetting(),
  }))
}

function getNavigatorConnection() {
  const runtimeNavigator = typeof navigator !== 'undefined'
    ? (navigator as Navigator & {
        connection?: {
          effectiveType?: string
          type?: string
          addEventListener?: (type: string, listener: () => void) => void
          removeEventListener?: (type: string, listener: () => void) => void
        }
        mozConnection?: {
          effectiveType?: string
          type?: string
          addEventListener?: (type: string, listener: () => void) => void
          removeEventListener?: (type: string, listener: () => void) => void
        }
        webkitConnection?: {
          effectiveType?: string
          type?: string
          addEventListener?: (type: string, listener: () => void) => void
          removeEventListener?: (type: string, listener: () => void) => void
        }
      })
    : undefined
  return runtimeNavigator?.connection ?? runtimeNavigator?.mozConnection ?? runtimeNavigator?.webkitConnection
}

function resolveNetworkType(connection: ReturnType<typeof getNavigatorConnection>, isConnected: boolean): NetworkType {
  if (!isConnected) {
    return 'none'
  }
  const type = connection?.type?.toLowerCase() ?? ''
  const effectiveType = connection?.effectiveType?.toLowerCase() ?? ''

  if (type.includes('wifi') || type.includes('ethernet')) {
    return 'wifi'
  }
  if (effectiveType.includes('5g')) {
    return '5g'
  }
  if (effectiveType.includes('4g')) {
    return '4g'
  }
  if (effectiveType.includes('3g')) {
    return '3g'
  }
  if (effectiveType.includes('2g') || effectiveType.includes('slow-2g')) {
    return '2g'
  }
  if (type.includes('cellular')) {
    return 'unknown'
  }
  return 'unknown'
}

function readNetworkStatus(): NetworkStatusResult {
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  const isConnected = typeof runtimeNavigator?.onLine === 'boolean' ? runtimeNavigator.onLine : true
  const connection = getNavigatorConnection()
  return {
    isConnected,
    networkType: resolveNetworkType(connection, isConnected),
  }
}

function notifyNetworkStatusChange() {
  if (networkStatusCallbacks.size === 0) {
    return
  }
  const status = readNetworkStatus()
  for (const callback of networkStatusCallbacks) {
    callback(status)
  }
}

function bindNetworkStatusBridge() {
  if (networkStatusBridgeBound) {
    return
  }
  networkStatusBridgeBound = true
  const runtimeTarget = globalThis as {
    addEventListener?: (type: string, listener: () => void) => void
  }
  runtimeTarget.addEventListener?.('online', notifyNetworkStatusChange)
  runtimeTarget.addEventListener?.('offline', notifyNetworkStatusChange)
  const connection = getNavigatorConnection()
  connection?.addEventListener?.('change', notifyNetworkStatusChange)
}

export function getNetworkType(options?: GetNetworkTypeOptions) {
  const status = readNetworkStatus()
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'getNetworkType:ok',
    ...status,
  }))
}

export function onNetworkStatusChange(callback: NetworkStatusChangeCallback) {
  if (typeof callback !== 'function') {
    return
  }
  bindNetworkStatusBridge()
  networkStatusCallbacks.add(callback)
}

export function offNetworkStatusChange(callback?: NetworkStatusChangeCallback) {
  if (typeof callback !== 'function') {
    networkStatusCallbacks.clear()
    return
  }
  networkStatusCallbacks.delete(callback)
}

function readWindowResizeResult(): WindowResizeResult {
  const windowInfo = getWindowInfo()
  return {
    size: {
      windowWidth: windowInfo.windowWidth,
      windowHeight: windowInfo.windowHeight,
    },
    windowWidth: windowInfo.windowWidth,
    windowHeight: windowInfo.windowHeight,
  }
}

function notifyWindowResize() {
  if (windowResizeCallbacks.size === 0) {
    return
  }
  const result = readWindowResizeResult()
  for (const callback of windowResizeCallbacks) {
    callback(result)
  }
}

function bindWindowResizeBridge() {
  if (windowResizeBridgeBound) {
    return
  }
  windowResizeBridgeBound = true
  const runtimeTarget = (typeof window !== 'undefined'
    ? window
    : globalThis) as {
    addEventListener?: (type: string, listener: () => void) => void
  }
  runtimeTarget.addEventListener?.('resize', notifyWindowResize)
}

export function onWindowResize(callback: WindowResizeCallback) {
  if (typeof callback !== 'function') {
    return
  }
  bindWindowResizeBridge()
  windowResizeCallbacks.add(callback)
}

export function offWindowResize(callback?: WindowResizeCallback) {
  if (typeof callback !== 'function') {
    windowResizeCallbacks.clear()
    return
  }
  windowResizeCallbacks.delete(callback)
}

export function canIUse(schema: string) {
  const normalized = String(schema ?? '').trim().replace(/^wx\./, '')
  if (!normalized) {
    return false
  }
  const path = normalized.split(/[.[\]]/g).filter(Boolean)
  if (!path.length) {
    return false
  }
  let cursor: unknown = globalTarget.wx as Record<string, unknown> | undefined
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object') {
      return false
    }
    cursor = (cursor as Record<string, unknown>)[segment]
  }
  return typeof cursor === 'function' || (typeof cursor === 'object' && cursor !== null)
}

export function showToast(options?: ShowToastOptions) {
  const toast = getToastElement()
  const content = `${resolveToastPrefix(options?.icon)}${options?.title ?? ''}`.trim()
  if (toast) {
    toast.textContent = content
    setToastVisible(toast, true)
    if (toastHideTimer) {
      clearTimeout(toastHideTimer)
    }
    const duration = normalizeDuration(options?.duration, 1500)
    toastHideTimer = setTimeout(() => {
      hideToastElement()
      toastHideTimer = undefined
    }, duration)
  }
  const result = callWxAsyncSuccess(options, { errMsg: 'showToast:ok' })
  return Promise.resolve(result)
}

export function showLoading(options?: ShowLoadingOptions) {
  const loading = getLoadingElement()
  if (loading) {
    setLoadingVisible(
      loading,
      true,
      options?.title?.trim() || '加载中',
      Boolean(options?.mask),
    )
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'showLoading:ok' }))
}

export function hideLoading(options?: WxAsyncOptions<WxBaseResult>) {
  const loading = getLoadingElement()
  if (loading) {
    setLoadingVisible(loading, false, loading.textContent ?? '', false)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'hideLoading:ok' }))
}

export function showShareMenu(options?: ShareMenuOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'showShareMenu:ok' }))
}

export function updateShareMenu(options?: ShareMenuOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'updateShareMenu:ok' }))
}

export function openCustomerServiceChat(options?: OpenCustomerServiceChatOptions) {
  const url = options?.url?.trim() ?? ''
  if (url && typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    catch {
      // ignore browser popup restrictions
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'openCustomerServiceChat:ok' }))
}

export function makePhoneCall(options?: MakePhoneCallOptions) {
  const phoneNumber = typeof options?.phoneNumber === 'string' ? options.phoneNumber.trim() : ''
  if (!phoneNumber) {
    const failure = callWxAsyncFailure(options, 'makePhoneCall:fail invalid phoneNumber')
    return Promise.reject(failure)
  }
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      window.open(`tel:${encodeURIComponent(phoneNumber)}`, '_self')
    }
    catch {
      // ignore browser restrictions and keep API-level success semantics
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'makePhoneCall:ok' }))
}

function readPresetChooseLocation() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebChooseLocation
  if (!preset || typeof preset !== 'object') {
    return null
  }
  const value = preset as Record<string, unknown>
  const latitude = Number(value.latitude)
  const longitude = Number(value.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }
  return {
    name: typeof value.name === 'string' ? value.name : '',
    address: typeof value.address === 'string' ? value.address : '',
    latitude,
    longitude,
  }
}

function readPresetChooseAddress() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebChooseAddress
  if (!preset || typeof preset !== 'object') {
    return null
  }
  const value = preset as Record<string, unknown>
  return {
    userName: typeof value.userName === 'string' ? value.userName : '',
    postalCode: typeof value.postalCode === 'string' ? value.postalCode : '',
    provinceName: typeof value.provinceName === 'string' ? value.provinceName : '',
    cityName: typeof value.cityName === 'string' ? value.cityName : '',
    countyName: typeof value.countyName === 'string' ? value.countyName : '',
    detailInfo: typeof value.detailInfo === 'string' ? value.detailInfo : '',
    nationalCode: typeof value.nationalCode === 'string' ? value.nationalCode : '',
    telNumber: typeof value.telNumber === 'string' ? value.telNumber : '',
  }
}

export function chooseAddress(options?: ChooseAddressOptions) {
  const preset = readPresetChooseAddress()
  if (preset) {
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'chooseAddress:ok',
      ...preset,
    }))
  }
  const { prompt } = getGlobalDialogHandlers()
  if (typeof prompt === 'function') {
    const input = prompt('请输入地址（格式：省,市,区,详细地址,姓名,电话）', '')
    if (input == null) {
      const failure = callWxAsyncFailure(options, 'chooseAddress:fail cancel')
      return Promise.reject(failure)
    }
    const [provinceName = '', cityName = '', countyName = '', detailInfo = '', userName = '', telNumber = '']
      = String(input).split(/[，,]/).map(item => item.trim())
    if (!provinceName || !cityName || !countyName || !detailInfo) {
      const failure = callWxAsyncFailure(options, 'chooseAddress:fail invalid input')
      return Promise.reject(failure)
    }
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'chooseAddress:ok',
      userName,
      postalCode: '',
      provinceName,
      cityName,
      countyName,
      detailInfo,
      nationalCode: '',
      telNumber,
    }))
  }
  const failure = callWxAsyncFailure(options, 'chooseAddress:fail address picker is unavailable')
  return Promise.reject(failure)
}

export function chooseLocation(options?: ChooseLocationOptions) {
  const preset = readPresetChooseLocation()
  if (preset) {
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'chooseLocation:ok',
      ...preset,
    }))
  }
  const { prompt } = getGlobalDialogHandlers()
  if (typeof prompt === 'function') {
    const input = prompt('请输入坐标（格式：latitude,longitude）', '')
    if (input == null) {
      const failure = callWxAsyncFailure(options, 'chooseLocation:fail cancel')
      return Promise.reject(failure)
    }
    const [latText = '', lonText = ''] = String(input).split(',').map(item => item.trim())
    const latitude = Number(latText)
    const longitude = Number(lonText)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      const failure = callWxAsyncFailure(options, 'chooseLocation:fail invalid latitude/longitude')
      return Promise.reject(failure)
    }
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'chooseLocation:ok',
      name: '',
      address: '',
      latitude,
      longitude,
    }))
  }
  const failure = callWxAsyncFailure(options, 'chooseLocation:fail location picker is unavailable')
  return Promise.reject(failure)
}

export function openLocation(options?: OpenLocationOptions) {
  const latitude = options?.latitude
  const longitude = options?.longitude
  if (typeof latitude !== 'number' || Number.isNaN(latitude) || typeof longitude !== 'number' || Number.isNaN(longitude)) {
    const failure = callWxAsyncFailure(options, 'openLocation:fail invalid latitude/longitude')
    return Promise.reject(failure)
  }
  const query = `${latitude},${longitude}`
  const target = `https://maps.google.com/?q=${encodeURIComponent(query)}`
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      window.open(target, '_blank', 'noopener,noreferrer')
    }
    catch {
      // ignore browser restrictions and keep API-level success semantics
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'openLocation:ok' }))
}

export function getImageInfo(options?: GetImageInfoOptions) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'getImageInfo:fail invalid src')
    return Promise.reject(failure)
  }

  const ImageCtor = (globalThis as { Image?: typeof Image }).Image
  if (typeof ImageCtor !== 'function') {
    const failure = callWxAsyncFailure(options, 'getImageInfo:fail Image is unavailable')
    return Promise.reject(failure)
  }

  return new Promise<GetImageInfoSuccessResult>((resolve, reject) => {
    const image = new ImageCtor()
    image.onload = () => {
      const width = Number((image as { naturalWidth?: number }).naturalWidth ?? image.width ?? 0)
      const height = Number((image as { naturalHeight?: number }).naturalHeight ?? image.height ?? 0)
      resolve(callWxAsyncSuccess(options, {
        errMsg: 'getImageInfo:ok',
        width: Number.isFinite(width) ? width : 0,
        height: Number.isFinite(height) ? height : 0,
        path: src,
        type: inferImageTypeFromPath(src),
        orientation: 'up',
      }))
    }
    image.onerror = () => {
      const failure = callWxAsyncFailure(options, 'getImageInfo:fail image load error')
      reject(failure)
    }
    image.src = src
  })
}

export function getVideoInfo(options?: GetVideoInfoOptions) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'getVideoInfo:fail invalid src')
    return Promise.reject(failure)
  }
  const preset = readPresetVideoInfo(src)
  if (preset) {
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'getVideoInfo:ok',
      ...preset,
    }))
  }
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const failure = callWxAsyncFailure(options, 'getVideoInfo:fail video element is unavailable')
    return Promise.reject(failure)
  }
  const video = document.createElement('video') as HTMLVideoElement
  if (!video || typeof video.addEventListener !== 'function') {
    const failure = callWxAsyncFailure(options, 'getVideoInfo:fail video element is unavailable')
    return Promise.reject(failure)
  }
  return new Promise<GetVideoInfoSuccessResult>((resolve, reject) => {
    const cleanup = () => {
      if (typeof video.removeEventListener === 'function') {
        video.removeEventListener('loadedmetadata', onLoadedMetadata)
        video.removeEventListener('error', onError)
      }
    }
    const onLoadedMetadata = () => {
      cleanup()
      resolve(callWxAsyncSuccess(options, {
        errMsg: 'getVideoInfo:ok',
        size: 0,
        duration: normalizeVideoInfoNumber(video.duration),
        width: normalizeVideoInfoNumber((video as { videoWidth?: number }).videoWidth),
        height: normalizeVideoInfoNumber((video as { videoHeight?: number }).videoHeight),
        fps: 0,
        bitrate: 0,
        type: inferVideoTypeFromPath(src),
        orientation: 'up',
      }))
    }
    const onError = () => {
      cleanup()
      const failure = callWxAsyncFailure(options, 'getVideoInfo:fail video load error')
      reject(failure)
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.src = src
    video.load?.()
  })
}

export function showTabBar(options?: TabBarOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'showTabBar:ok' }))
}

export function hideTabBar(options?: TabBarOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'hideTabBar:ok' }))
}

export function requestPayment(options?: RequestPaymentOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'requestPayment:ok' }))
}

function normalizeSubscribeDecision(value: unknown): SubscribeMessageDecision {
  if (value === 'accept' || value === 'reject' || value === 'ban' || value === 'filter') {
    return value
  }
  return 'accept'
}

function resolveSubscribeDecisionMap(tmplIds: string[]) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebRequestSubscribeMessage
  const presetValue = typeof preset === 'function'
    ? (preset as (ids: string[]) => unknown)(tmplIds)
    : preset
  if (presetValue && typeof presetValue === 'object') {
    const output: Record<string, SubscribeMessageDecision> = {}
    const source = presetValue as Record<string, unknown>
    for (const tmplId of tmplIds) {
      output[tmplId] = normalizeSubscribeDecision(source[tmplId])
    }
    return output
  }
  const sharedDecision = normalizeSubscribeDecision(presetValue)
  return tmplIds.reduce<Record<string, SubscribeMessageDecision>>((result, tmplId) => {
    result[tmplId] = sharedDecision
    return result
  }, {})
}

export function requestSubscribeMessage(options?: RequestSubscribeMessageOptions) {
  const tmplIds = Array.isArray(options?.tmplIds)
    ? options.tmplIds
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
    : []
  if (tmplIds.length === 0) {
    const failure = callWxAsyncFailure(options, 'requestSubscribeMessage:fail invalid tmplIds')
    return Promise.reject(failure)
  }
  const decisionMap = resolveSubscribeDecisionMap(tmplIds)
  const result = tmplIds.reduce<RequestSubscribeMessageSuccessResult>((payload, tmplId) => {
    payload[tmplId] = decisionMap[tmplId]
    return payload
  }, { errMsg: 'requestSubscribeMessage:ok' })
  return Promise.resolve(callWxAsyncSuccess(options, result))
}

function createCloudRequestId() {
  return `web_cloud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const cloudBridge: CloudBridge = {
  init(options?: CloudInitOptions) {
    cloudRuntimeState.env = typeof options?.env === 'string' ? options.env : ''
    cloudRuntimeState.traceUser = Boolean(options?.traceUser)
  },
  callFunction(options?: CloudCallFunctionOptions) {
    const name = typeof options?.name === 'string' ? options.name.trim() : ''
    if (!name) {
      const failure = callWxAsyncFailure(options, 'cloud.callFunction:fail invalid function name')
      return Promise.reject(failure)
    }
    const result = callWxAsyncSuccess(options, {
      errMsg: 'cloud.callFunction:ok',
      result: {
        name,
        data: { ...(options?.data ?? {}) },
        env: cloudRuntimeState.env,
        traceUser: cloudRuntimeState.traceUser,
        mock: true,
      },
      requestID: createCloudRequestId(),
    })
    return Promise.resolve(result)
  },
}

function createAdError(errMsg: string): AdError {
  return {
    errMsg,
    errCode: -1,
  }
}

function normalizeAdUnitId(options?: AdBaseOptions) {
  if (typeof options?.adUnitId !== 'string') {
    return ''
  }
  return options.adUnitId.trim()
}

function createRewardedVideoAdImpl(options?: AdBaseOptions): RewardedVideoAd {
  let loaded = false
  let destroyed = false
  const loadCallbacks = new Set<() => void>()
  const errorCallbacks = new Set<(error: AdError) => void>()
  const closeCallbacks = new Set<(result: RewardedVideoAdCloseResult) => void>()
  const adUnitId = normalizeAdUnitId(options)

  const emitError = (error: AdError) => {
    for (const callback of errorCallbacks) {
      callback(error)
    }
  }

  const fail = (message: string) => {
    const error = createAdError(message)
    emitError(error)
    return Promise.reject(error)
  }

  return {
    load() {
      if (destroyed) {
        return fail('RewardedVideoAd.load:fail ad is destroyed')
      }
      if (!adUnitId) {
        return fail('RewardedVideoAd.load:fail invalid adUnitId')
      }
      loaded = true
      for (const callback of loadCallbacks) {
        callback()
      }
      return Promise.resolve({ errMsg: 'RewardedVideoAd.load:ok' })
    },
    show() {
      if (destroyed) {
        return fail('RewardedVideoAd.show:fail ad is destroyed')
      }
      if (!loaded) {
        return this.load().then(() => this.show())
      }
      const result: RewardedVideoAdCloseResult = { isEnded: true }
      for (const callback of closeCallbacks) {
        callback(result)
      }
      return Promise.resolve({ errMsg: 'RewardedVideoAd.show:ok' })
    },
    destroy() {
      destroyed = true
      loadCallbacks.clear()
      errorCallbacks.clear()
      closeCallbacks.clear()
    },
    onLoad(callback: () => void) {
      if (typeof callback === 'function') {
        loadCallbacks.add(callback)
      }
    },
    offLoad(callback?: () => void) {
      if (typeof callback !== 'function') {
        loadCallbacks.clear()
        return
      }
      loadCallbacks.delete(callback)
    },
    onError(callback: (error: AdError) => void) {
      if (typeof callback === 'function') {
        errorCallbacks.add(callback)
      }
    },
    offError(callback?: (error: AdError) => void) {
      if (typeof callback !== 'function') {
        errorCallbacks.clear()
        return
      }
      errorCallbacks.delete(callback)
    },
    onClose(callback: (result: RewardedVideoAdCloseResult) => void) {
      if (typeof callback === 'function') {
        closeCallbacks.add(callback)
      }
    },
    offClose(callback?: (result: RewardedVideoAdCloseResult) => void) {
      if (typeof callback !== 'function') {
        closeCallbacks.clear()
        return
      }
      closeCallbacks.delete(callback)
    },
  }
}

function createInterstitialAdImpl(options?: AdBaseOptions): InterstitialAd {
  let loaded = false
  let destroyed = false
  const loadCallbacks = new Set<() => void>()
  const errorCallbacks = new Set<(error: AdError) => void>()
  const closeCallbacks = new Set<() => void>()
  const adUnitId = normalizeAdUnitId(options)

  const emitError = (error: AdError) => {
    for (const callback of errorCallbacks) {
      callback(error)
    }
  }

  const fail = (message: string) => {
    const error = createAdError(message)
    emitError(error)
    return Promise.reject(error)
  }

  return {
    load() {
      if (destroyed) {
        return fail('InterstitialAd.load:fail ad is destroyed')
      }
      if (!adUnitId) {
        return fail('InterstitialAd.load:fail invalid adUnitId')
      }
      loaded = true
      for (const callback of loadCallbacks) {
        callback()
      }
      return Promise.resolve({ errMsg: 'InterstitialAd.load:ok' })
    },
    show() {
      if (destroyed) {
        return fail('InterstitialAd.show:fail ad is destroyed')
      }
      if (!loaded) {
        return this.load().then(() => this.show())
      }
      for (const callback of closeCallbacks) {
        callback()
      }
      return Promise.resolve({ errMsg: 'InterstitialAd.show:ok' })
    },
    destroy() {
      destroyed = true
      loadCallbacks.clear()
      errorCallbacks.clear()
      closeCallbacks.clear()
    },
    onLoad(callback: () => void) {
      if (typeof callback === 'function') {
        loadCallbacks.add(callback)
      }
    },
    offLoad(callback?: () => void) {
      if (typeof callback !== 'function') {
        loadCallbacks.clear()
        return
      }
      loadCallbacks.delete(callback)
    },
    onError(callback: (error: AdError) => void) {
      if (typeof callback === 'function') {
        errorCallbacks.add(callback)
      }
    },
    offError(callback?: (error: AdError) => void) {
      if (typeof callback !== 'function') {
        errorCallbacks.clear()
        return
      }
      errorCallbacks.delete(callback)
    },
    onClose(callback: () => void) {
      if (typeof callback === 'function') {
        closeCallbacks.add(callback)
      }
    },
    offClose(callback?: () => void) {
      if (typeof callback !== 'function') {
        closeCallbacks.clear()
        return
      }
      closeCallbacks.delete(callback)
    },
  }
}

export function createRewardedVideoAd(options?: AdBaseOptions) {
  return createRewardedVideoAdImpl(options)
}

export function createInterstitialAd(options?: AdBaseOptions) {
  return createInterstitialAdImpl(options)
}

function readExtConfigValue() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const value = runtimeGlobal.__weappViteWebExtConfig
  if (value && typeof value === 'object') {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

export function getExtConfigSync() {
  return readExtConfigValue()
}

export function getExtConfig(options?: GetExtConfigOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'getExtConfig:ok',
    extConfig: getExtConfigSync(),
  }))
}

export function getUpdateManager(): UpdateManager {
  return {
    applyUpdate() {},
    onCheckForUpdate(callback) {
      if (typeof callback !== 'function') {
        return
      }
      const preset = resolveUpdateManagerPreset()
      scheduleMicrotask(() => callback({ hasUpdate: preset.hasUpdate }))
    },
    onUpdateReady(callback) {
      if (typeof callback !== 'function') {
        return
      }
      const preset = resolveUpdateManagerPreset()
      if (!preset.hasUpdate || !preset.ready) {
        return
      }
      scheduleMicrotask(() => callback())
    },
    onUpdateFailed(callback) {
      if (typeof callback !== 'function') {
        return
      }
      const preset = resolveUpdateManagerPreset()
      if (!preset.hasUpdate || !preset.failed) {
        return
      }
      scheduleMicrotask(() => callback())
    },
  }
}

export function getLogManager(options?: LogManagerOptions): LogManager {
  const level = options?.level === 0 ? 0 : 1
  const runtimeConsole = getRuntimeConsole()
  const invokeConsole = (method: 'debug' | 'info' | 'log' | 'warn', args: unknown[]) => {
    const handler = runtimeConsole?.[method]
    if (typeof handler === 'function') {
      handler.apply(runtimeConsole, args)
    }
  }
  return {
    debug(...args: unknown[]) {
      if (level > 0) {
        return
      }
      invokeConsole('debug', args)
    },
    info(...args: unknown[]) {
      invokeConsole('info', args)
    },
    log(...args: unknown[]) {
      invokeConsole('log', args)
    },
    warn(...args: unknown[]) {
      invokeConsole('warn', args)
    },
  }
}

export function reportAnalytics(eventName: string, data?: Record<string, unknown>) {
  const runtimeGlobal = globalThis as {
    __weappViteWebAnalyticsEvents?: Array<{
      eventName: string
      data: Record<string, unknown>
      timestamp: number
    }>
  }
  runtimeGlobal.__weappViteWebAnalyticsEvents ??= []
  runtimeGlobal.__weappViteWebAnalyticsEvents.push({
    eventName: String(eventName ?? ''),
    data: { ...(data ?? {}) },
    timestamp: Date.now(),
  })
}

export function showModal(options?: ShowModalOptions) {
  const title = options?.title?.trim() ?? ''
  const content = options?.content?.trim() ?? ''
  const message = [title, content].filter(Boolean).join('\n\n') || ' '
  const showCancel = options?.showCancel !== false
  const { confirm, alert } = getGlobalDialogHandlers()

  let confirmed = true
  if (showCancel) {
    if (typeof confirm === 'function') {
      confirmed = confirm(message)
    }
  }
  else if (typeof alert === 'function') {
    alert(message)
  }

  const result: ShowModalSuccessResult = {
    errMsg: 'showModal:ok',
    confirm: confirmed,
    cancel: !confirmed,
  }
  return Promise.resolve(callWxAsyncSuccess(options, result))
}

export function showActionSheet(options?: ShowActionSheetOptions) {
  const itemList = Array.isArray(options?.itemList)
    ? options.itemList.map(item => String(item ?? '').trim()).filter(Boolean)
    : []
  if (!itemList.length) {
    const failure = callWxAsyncFailure(options, 'showActionSheet:fail invalid itemList')
    return Promise.reject(failure)
  }
  const tapIndex = resolveActionSheetSelection(itemList)
  if (tapIndex === null) {
    const failure = callWxAsyncFailure(options, 'showActionSheet:fail cancel')
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'showActionSheet:ok',
    tapIndex,
  }))
}

export async function chooseImage(options?: ChooseImageOptions) {
  const count = normalizeChooseImageCount(options?.count)
  try {
    const files = await pickChooseImageFiles(count)
    const tempFiles = files.map(file => normalizeChooseImageFile(file))
    const tempFilePaths = tempFiles.map(item => item.path)
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseImage:ok',
      tempFilePaths,
      tempFiles,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseImage:fail ${message}`)
    return Promise.reject(failure)
  }
}

export async function chooseMedia(options?: ChooseMediaOptions) {
  const count = normalizeChooseMediaCount(options?.count)
  const types = normalizeChooseMediaTypes(options?.mediaType)
  try {
    const files = await pickChooseMediaFiles(count, types)
    const tempFiles = files.map(file => normalizeChooseMediaFile(file))
    const defaultType: ChooseMediaType = types.has('video') && !types.has('image') ? 'video' : 'image'
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseMedia:ok',
      type: tempFiles[0]?.fileType ?? defaultType,
      tempFiles,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseMedia:fail ${message}`)
    return Promise.reject(failure)
  }
}

export async function compressImage(options?: CompressImageOptions) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'compressImage:fail invalid src')
    return Promise.reject(failure)
  }
  const quality = normalizeCompressImageQuality(options?.quality)
  try {
    const tempFilePath = await compressImageByCanvas(src, quality)
    return callWxAsyncSuccess(options, {
      errMsg: 'compressImage:ok',
      tempFilePath,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `compressImage:fail ${message}`)
    return Promise.reject(failure)
  }
}

export function compressVideo(options?: CompressVideoOptions) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'compressVideo:fail invalid src')
    return Promise.reject(failure)
  }
  const preset = readPresetCompressVideo(src)
  const result = preset ?? {
    tempFilePath: src,
    size: 0,
    duration: 0,
    width: 0,
    height: 0,
    bitrate: 0,
    fps: 0,
  }
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'compressVideo:ok',
    ...result,
  }))
}

export async function chooseVideo(options?: ChooseVideoOptions) {
  try {
    const file = await pickChooseVideoFile()
    if (!file) {
      throw new TypeError('no file selected')
    }
    const normalized = normalizeChooseVideoFile(file)
    if (!normalized) {
      throw new TypeError('selected file is not a video')
    }
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseVideo:ok',
      ...normalized,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseVideo:fail ${message}`)
    return Promise.reject(failure)
  }
}

export async function chooseMessageFile(options?: ChooseMessageFileOptions) {
  const count = normalizeChooseMessageFileCount(options?.count)
  const type = normalizeChooseMessageFileType(options?.type)
  try {
    const files = await pickChooseMessageFiles(count, type)
    const tempFiles = files.map(file => normalizeChooseMessageFile(file))
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseMessageFile:ok',
      tempFiles,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseMessageFile:fail ${message}`)
    return Promise.reject(failure)
  }
}

export async function chooseFile(options?: ChooseFileOptions) {
  const count = normalizeChooseMessageFileCount(options?.count)
  const type = normalizeChooseMessageFileType(options?.type)
  const extensions = normalizeChooseFileExtensions(options?.extension)
  try {
    const files = await pickChooseFileFiles(count, type, extensions)
    const tempFiles = files.map(file => normalizeChooseMessageFile(file))
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseFile:ok',
      tempFiles,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseFile:fail ${message}`)
    return Promise.reject(failure)
  }
}

export function previewImage(options?: PreviewImageOptions) {
  const urls = Array.isArray(options?.urls)
    ? options.urls.map(url => String(url).trim()).filter(Boolean)
    : []
  if (!urls.length) {
    const failure = callWxAsyncFailure(options, 'previewImage:fail invalid urls')
    return Promise.reject(failure)
  }
  const current = typeof options?.current === 'string' && options.current.trim()
    ? options.current.trim()
    : urls[0]
  const target = urls.includes(current) ? current : urls[0]
  openTargetInNewWindow(target)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'previewImage:ok' }))
}

export function previewMedia(options?: PreviewMediaOptions) {
  const sources = normalizePreviewMediaSources(options?.sources)
  if (!sources.length) {
    const failure = callWxAsyncFailure(options, 'previewMedia:fail invalid sources')
    return Promise.reject(failure)
  }
  const current = typeof options?.current === 'number' && Number.isFinite(options.current)
    ? Math.max(0, Math.floor(options.current))
    : 0
  const target = sources[current]?.url ?? sources[0].url
  openTargetInNewWindow(target)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'previewMedia:ok' }))
}

export function openVideoEditor(options?: OpenVideoEditorOptions) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'openVideoEditor:fail invalid src')
    return Promise.reject(failure)
  }
  const tempFilePath = readOpenVideoEditorPreset(src) || src
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'openVideoEditor:ok',
    tempFilePath,
  }))
}

export function saveImageToPhotosAlbum(options?: SaveImageToPhotosAlbumOptions) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'saveImageToPhotosAlbum:fail invalid filePath')
    return Promise.reject(failure)
  }
  triggerDownload(filePath)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'saveImageToPhotosAlbum:ok' }))
}

export function saveVideoToPhotosAlbum(options?: SaveVideoToPhotosAlbumOptions) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'saveVideoToPhotosAlbum:fail invalid filePath')
    return Promise.reject(failure)
  }
  triggerDownload(filePath)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'saveVideoToPhotosAlbum:ok' }))
}

export function saveFile(options?: SaveFileOptions) {
  const tempFilePath = typeof options?.tempFilePath === 'string' ? options.tempFilePath.trim() : ''
  if (!tempFilePath) {
    const failure = callWxAsyncFailure(options, 'saveFile:fail invalid tempFilePath')
    return Promise.reject(failure)
  }
  const savedFilePath = resolveSaveFilePath(tempFilePath, options?.filePath)
  saveMemoryFile(tempFilePath, savedFilePath)
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'saveFile:ok',
    savedFilePath,
  }))
}

export function saveFileToDisk(options?: SaveFileToDiskOptions) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'saveFileToDisk:fail invalid filePath')
    return Promise.reject(failure)
  }
  const fileName = typeof options?.fileName === 'string' ? options.fileName.trim() : ''
  triggerDownload(filePath, fileName)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'saveFileToDisk:ok' }))
}

export function openDocument(options?: OpenDocumentOptions) {
  const filePath = normalizeFilePath(options?.filePath)
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'openDocument:fail invalid filePath')
    return Promise.reject(failure)
  }
  const target = resolveOpenDocumentUrl(filePath)
  if (!target) {
    const failure = callWxAsyncFailure(options, 'openDocument:fail document url is unavailable')
    return Promise.reject(failure)
  }
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      window.open(target, '_blank', 'noopener,noreferrer')
    }
    catch {
      // ignore browser popup restrictions and keep API-level success semantics
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'openDocument:ok' }))
}

export function scanCode(options?: ScanCodeOptions) {
  const { prompt } = getGlobalDialogHandlers()
  const resultText = resolveScanCodeResult(prompt)
  if (resultText == null) {
    const failure = callWxAsyncFailure(options, 'scanCode:fail cancel')
    return Promise.reject(failure)
  }
  const result = callWxAsyncSuccess(options, {
    errMsg: 'scanCode:ok',
    result: resultText,
    scanType: 'QR_CODE',
    charSet: 'utf-8',
    path: resultText,
    rawData: resultText,
  })
  return Promise.resolve(result)
}

export async function setClipboardData(options?: SetClipboardDataOptions) {
  const data = String(options?.data ?? '')
  try {
    await writeClipboardData(data)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `setClipboardData:fail ${message}`)
    return Promise.reject(failure)
  }
  return callWxAsyncSuccess(options, { errMsg: 'setClipboardData:ok' })
}

export async function getClipboardData(options?: GetClipboardDataOptions) {
  try {
    const data = await readClipboardData()
    return callWxAsyncSuccess(options, { errMsg: 'getClipboardData:ok', data })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `getClipboardData:fail ${message}`)
    return Promise.reject(failure)
  }
}

export function getSystemInfoSync(): SystemInfo {
  return readSystemInfoSnapshot()
}

export function getSystemInfo(options?: GetSystemInfoOptions) {
  try {
    const info = getSystemInfoSync()
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'getSystemInfo:ok',
      ...info,
    }))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `getSystemInfo:fail ${message}`)
    return Promise.reject(failure)
  }
}

export function getWindowInfo(): WindowInfo {
  return buildWindowInfoSnapshot(getSystemInfoSync())
}

export function getDeviceInfo(): DeviceInfo {
  const systemInfo = getSystemInfoSync()
  return {
    brand: systemInfo.brand,
    model: systemInfo.model,
    system: systemInfo.system,
    platform: systemInfo.platform,
    memorySize: readDeviceMemorySize(),
    benchmarkLevel: -1,
    abi: 'web',
    deviceOrientation: resolveDeviceOrientation(),
  }
}

export function getSystemSetting(): SystemSetting {
  const locationAuthorized = webAuthorizeState.get('scope.userLocation') === 'authorized'
  return {
    bluetoothEnabled: false,
    wifiEnabled: true,
    locationEnabled: locationAuthorized,
    locationReducedAccuracy: false,
    deviceOrientation: resolveDeviceOrientation(),
  }
}

export function getAppAuthorizeSetting(): AppAuthorizeSetting {
  const resolveStatus = (scope: string): AppAuthorizeStatus => webAuthorizeState.get(scope) ?? 'not determined'
  return {
    albumAuthorized: resolveStatus('scope.writePhotosAlbum'),
    bluetoothAuthorized: 'not determined',
    cameraAuthorized: resolveStatus('scope.camera'),
    locationAuthorized: resolveStatus('scope.userLocation'),
    microphoneAuthorized: resolveStatus('scope.record'),
    notificationAuthorized: 'not determined',
    phoneCalendarAuthorized: 'not determined',
  }
}

export function login(options?: LoginOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'login:ok',
    code: generateLoginCode(),
  }))
}

export function checkSession(options?: CheckSessionOptions) {
  if (!resolveCheckSessionState()) {
    const failure = callWxAsyncFailure(options, 'checkSession:fail session expired')
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'checkSession:ok' }))
}

export function getUserInfo(options?: GetUserInfoOptions) {
  if (webAuthorizeState.get('scope.userInfo') === 'denied') {
    const failure = callWxAsyncFailure(options, 'getUserInfo:fail auth deny')
    return Promise.reject(failure)
  }
  webAuthorizeState.set('scope.userInfo', 'authorized')
  return Promise.resolve(callWxAsyncSuccess(options, buildUserProfilePayload('getUserInfo:ok', options?.lang)))
}

export function getUserProfile(options?: GetUserProfileOptions) {
  const desc = typeof options?.desc === 'string' ? options.desc.trim() : ''
  if (!desc) {
    const failure = callWxAsyncFailure(options, 'getUserProfile:fail invalid desc')
    return Promise.reject(failure)
  }
  const decision = resolveUserProfileDecision()
  webAuthorizeState.set('scope.userInfo', decision)
  if (decision !== 'authorized') {
    const reason = decision === 'denied' ? 'auth deny' : 'auth canceled'
    const failure = callWxAsyncFailure(options, `getUserProfile:fail ${reason}`)
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, buildUserProfilePayload('getUserProfile:ok', options?.lang)))
}

export function getAccountInfoSync(): AccountInfoSync {
  const appId = resolveAccountAppId()
  return {
    miniProgram: {
      appId,
      envVersion: 'develop',
      version: '0.0.0-web',
    },
    plugin: {},
  }
}

export function getAppBaseInfo(): AppBaseInfo {
  const systemInfo = getSystemInfoSync()
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  return {
    SDKVersion: 'web',
    language: runtimeNavigator?.language ?? 'en',
    version: runtimeNavigator?.appVersion ?? runtimeNavigator?.userAgent ?? 'web',
    platform: systemInfo.platform,
    enableDebug: false,
    theme: resolveRuntimeTheme(),
  }
}

export function getMenuButtonBoundingClientRect(): MenuButtonBoundingClientRect {
  const { windowWidth, statusBarHeight } = getSystemInfoSync()
  return buildMenuButtonRect(windowWidth, statusBarHeight)
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
