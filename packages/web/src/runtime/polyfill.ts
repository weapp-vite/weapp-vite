import type { ButtonFormConfig } from './button'
import type { ComponentOptions, ComponentPublicInstance } from './component'
import type { NavigationBarMetrics } from './navigationBar'
import type { TemplateRenderer } from './template'
import { slugify } from '../shared/slugify'
import { ensureButtonDefined, setButtonFormConfig } from './button'
import { defineComponent } from './component'
import { setRuntimeExecutionMode } from './execution'
import { ensureNavigationBarDefined, setNavigationBarMetrics } from './navigationBar'
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

const TOAST_ID = '__weapp_vite_web_toast__'
const TOAST_SELECTOR = `#${TOAST_ID}`
const LOADING_ID = '__weapp_vite_web_loading__'
const LOADING_SELECTOR = `#${LOADING_ID}`
const WEB_STORAGE_PREFIX = '__weapp_vite_web_storage__:'
const WEB_USER_DATA_PATH = '/__weapp_vite_web_user_data__'
const memoryStorage = new Map<string, any>()
const memoryFileStorage = new Map<string, {
  kind: 'text' | 'binary'
  text?: string
  bytes?: ArrayBuffer
}>()
const WEB_STORAGE_LIMIT_SIZE_KB = 10240
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

function callWxAsyncSuccess<SuccessResult extends WxBaseResult>(
  options: WxAsyncOptions<SuccessResult> | undefined,
  result: SuccessResult,
) {
  options?.success?.(result)
  options?.complete?.(result)
  return result
}

function callWxAsyncFailure<SuccessResult extends WxBaseResult>(
  options: WxAsyncOptions<SuccessResult> | undefined,
  errMsg: string,
) {
  const result: WxBaseResult = { errMsg }
  options?.fail?.(result)
  options?.complete?.(result)
  return result
}

function normalizeDuration(duration: number | undefined, fallback: number) {
  if (typeof duration !== 'number' || Number.isNaN(duration)) {
    return fallback
  }
  return Math.max(0, duration)
}

function scheduleMicrotask(task: () => void) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(task)
    return
  }
  Promise.resolve()
    .then(task)
    .catch((error) => {
      setTimeout(() => {
        throw error
      }, 0)
    })
}

function normalizeStorageKey(key: unknown) {
  if (typeof key !== 'string') {
    return ''
  }
  return key.trim()
}

function getRuntimeStorage() {
  if (typeof localStorage === 'undefined') {
    return undefined
  }
  return localStorage
}

function storageKeyWithPrefix(key: string) {
  return `${WEB_STORAGE_PREFIX}${key}`
}

function encodeStorageValue(value: any) {
  if (value === undefined) {
    return JSON.stringify({ type: 'undefined' })
  }
  return JSON.stringify({ type: 'json', value })
}

function decodeStorageValue(value: string) {
  try {
    const parsed = JSON.parse(value) as { type?: string, value?: any }
    if (parsed?.type === 'undefined') {
      return undefined
    }
    if (parsed?.type === 'json') {
      return parsed.value
    }
    return parsed
  }
  catch {
    return value
  }
}

function hasStorageKey(key: string) {
  if (memoryStorage.has(key)) {
    return true
  }
  const storage = getRuntimeStorage()
  if (!storage) {
    return false
  }
  return storage.getItem(storageKeyWithPrefix(key)) !== null
}

function listStorageKeys() {
  const keySet = new Set<string>(memoryStorage.keys())
  const storage = getRuntimeStorage()
  if (!storage) {
    return Array.from(keySet)
  }
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(WEB_STORAGE_PREFIX)) {
      keySet.add(key.slice(WEB_STORAGE_PREFIX.length))
    }
  }
  return Array.from(keySet)
}

export function setStorageSync(key: string, data: any) {
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) {
    throw new TypeError('setStorageSync:fail invalid key')
  }
  memoryStorage.set(normalizedKey, data)
  const storage = getRuntimeStorage()
  if (storage) {
    storage.setItem(storageKeyWithPrefix(normalizedKey), encodeStorageValue(data))
  }
}

export function getStorageSync(key: string) {
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) {
    throw new TypeError('getStorageSync:fail invalid key')
  }
  if (memoryStorage.has(normalizedKey)) {
    return memoryStorage.get(normalizedKey)
  }
  const storage = getRuntimeStorage()
  if (!storage) {
    return ''
  }
  const raw = storage.getItem(storageKeyWithPrefix(normalizedKey))
  if (raw == null) {
    return ''
  }
  const decoded = decodeStorageValue(raw)
  memoryStorage.set(normalizedKey, decoded)
  return decoded
}

export function removeStorageSync(key: string) {
  const normalizedKey = normalizeStorageKey(key)
  if (!normalizedKey) {
    throw new TypeError('removeStorageSync:fail invalid key')
  }
  memoryStorage.delete(normalizedKey)
  const storage = getRuntimeStorage()
  if (storage) {
    storage.removeItem(storageKeyWithPrefix(normalizedKey))
  }
}

export function clearStorageSync() {
  memoryStorage.clear()
  const storage = getRuntimeStorage()
  if (!storage) {
    return
  }
  const removeKeys: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(WEB_STORAGE_PREFIX)) {
      removeKeys.push(key)
    }
  }
  for (const key of removeKeys) {
    storage.removeItem(key)
  }
}

function calculateStorageCurrentSize(keys: string[]) {
  let bytes = 0
  for (const key of keys) {
    const value = getStorageSync(key)
    const encoded = encodeStorageValue(value)
    bytes += encoded.length
  }
  return Math.ceil(bytes / 1024)
}

export function getStorageInfoSync(): StorageInfoResult {
  const keys = listStorageKeys()
  return {
    errMsg: 'getStorageInfoSync:ok',
    keys,
    currentSize: calculateStorageCurrentSize(keys),
    limitSize: WEB_STORAGE_LIMIT_SIZE_KB,
  }
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

function normalizeFilePath(filePath: unknown) {
  if (typeof filePath !== 'string') {
    return ''
  }
  return filePath.trim()
}

function normalizeFileEncoding(encoding?: string) {
  if (typeof encoding !== 'string') {
    return ''
  }
  return encoding.trim().toLowerCase()
}

function cloneArrayBuffer(buffer: ArrayBuffer) {
  return buffer.slice(0)
}

function toArrayBuffer(data: ArrayBuffer | ArrayBufferView) {
  if (data instanceof ArrayBuffer) {
    return cloneArrayBuffer(data)
  }
  const view = data as ArrayBufferView
  return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice().buffer
}

function decodeArrayBufferToText(buffer: ArrayBuffer, encoding?: string) {
  if (typeof TextDecoder === 'function') {
    try {
      return new TextDecoder(encoding || 'utf-8').decode(new Uint8Array(buffer))
    }
    catch {
      return new TextDecoder().decode(new Uint8Array(buffer))
    }
  }
  return Array.from(new Uint8Array(buffer))
    .map(byte => String.fromCharCode(byte))
    .join('')
}

function writeFileSyncInternal(
  filePath: string,
  data: string | ArrayBuffer | ArrayBufferView,
) {
  const normalizedPath = normalizeFilePath(filePath)
  if (!normalizedPath) {
    throw new TypeError('writeFileSync:fail invalid filePath')
  }
  if (typeof data === 'string') {
    memoryFileStorage.set(normalizedPath, {
      kind: 'text',
      text: data,
    })
    return
  }
  memoryFileStorage.set(normalizedPath, {
    kind: 'binary',
    bytes: toArrayBuffer(data),
  })
}

function readFileSyncInternal(filePath: string, encoding?: string) {
  const normalizedPath = normalizeFilePath(filePath)
  if (!normalizedPath) {
    throw new TypeError('readFileSync:fail invalid filePath')
  }
  const record = memoryFileStorage.get(normalizedPath)
  if (!record) {
    throw new TypeError(`readFileSync:fail no such file ${normalizedPath}`)
  }
  const normalizedEncoding = normalizeFileEncoding(encoding)
  if (record.kind === 'text') {
    return record.text ?? ''
  }
  const bytes = record.bytes ? cloneArrayBuffer(record.bytes) : new ArrayBuffer(0)
  if (normalizedEncoding) {
    return decodeArrayBufferToText(bytes, normalizedEncoding)
  }
  return bytes
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

function getRuntimeFetch() {
  const runtime = globalThis as Record<string, unknown>
  const maybeFetch = runtime.fetch
  if (typeof maybeFetch === 'function') {
    return maybeFetch as typeof fetch
  }
  return undefined
}

function normalizeRequestMethod(method?: string) {
  return (method || 'GET').toUpperCase()
}

function normalizeRequestHeaders(header?: Record<string, string>) {
  if (!header) {
    return {}
  }
  return { ...header }
}

function buildRequestUrl(url: string, method: string, data: unknown) {
  if (method !== 'GET' || data == null) {
    return url
  }
  if (typeof data === 'string') {
    if (!data) {
      return url
    }
    return `${url}${url.includes('?') ? '&' : '?'}${data}`
  }
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    const query = data.toString()
    if (!query) {
      return url
    }
    return `${url}${url.includes('?') ? '&' : '?'}${query}`
  }
  if (typeof data === 'object') {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      query.append(key, value == null ? '' : String(value))
    }
    const queryText = query.toString()
    if (!queryText) {
      return url
    }
    return `${url}${url.includes('?') ? '&' : '?'}${queryText}`
  }
  return url
}

function buildRequestBody(
  method: string,
  data: unknown,
  headers: Record<string, string>,
) {
  if (method === 'GET' || data == null) {
    return undefined
  }
  if (typeof data === 'string') {
    return data
  }
  if (typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams) {
    return data
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return data
  }
  const contentTypeKey = Object.keys(headers).find(key => key.toLowerCase() === 'content-type')
  const contentType = contentTypeKey ? headers[contentTypeKey] : ''
  if (contentType && !contentType.includes('application/json')) {
    return String(data)
  }
  if (!contentTypeKey) {
    headers['content-type'] = 'application/json'
  }
  return JSON.stringify(data)
}

async function parseRequestResponseData(
  response: Response,
  options?: RequestOptions,
) {
  if (options?.responseType === 'arraybuffer') {
    return response.arrayBuffer()
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (options?.dataType === 'text') {
    return response.text()
  }
  if (options?.dataType === 'json' || contentType.includes('application/json')) {
    return response.json()
  }
  return response.text()
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

function createBlobObjectUrl(blob: Blob) {
  const runtimeUrl = (globalThis as {
    URL?: {
      createObjectURL?: (value: Blob) => string
    }
  }).URL
  if (runtimeUrl && typeof runtimeUrl.createObjectURL === 'function') {
    return runtimeUrl.createObjectURL(blob)
  }
  return ''
}

function collectResponseHeaders(response: {
  headers: {
    forEach: (callback: (value: string, key: string) => void) => void
  }
}) {
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })
  return headers
}

function stripUploadContentType(headers: Record<string, string>) {
  const normalized = { ...headers }
  for (const key of Object.keys(normalized)) {
    if (key.toLowerCase() === 'content-type') {
      delete normalized[key]
    }
  }
  return normalized
}

function resolveUploadFileName(filePath: string) {
  const normalized = filePath.split(/[?#]/)[0] ?? ''
  const segments = normalized.split('/')
  return segments[segments.length - 1] || 'file'
}

async function resolveUploadFileBlob(
  filePath: string,
  runtimeFetch: typeof fetch | undefined,
) {
  const record = memoryFileStorage.get(filePath)
  if (record) {
    if (record.kind === 'text') {
      return new Blob([record.text ?? ''], { type: 'text/plain;charset=utf-8' })
    }
    return new Blob([record.bytes ?? new ArrayBuffer(0)])
  }
  if (/^(?:https?:|blob:|data:)/i.test(filePath) && runtimeFetch) {
    try {
      const response = await runtimeFetch(filePath, { method: 'GET' })
      return await response.blob()
    }
    catch {
      // fallback to plain text payload
    }
  }
  return new Blob([filePath], { type: 'text/plain;charset=utf-8' })
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

function normalizeAuthScope(scope: unknown) {
  if (typeof scope !== 'string') {
    return ''
  }
  return scope.trim()
}

function buildAuthSettingSnapshot() {
  const authSetting: Record<string, boolean> = {}
  for (const [scope, status] of webAuthorizeState.entries()) {
    authSetting[scope] = status === 'authorized'
  }
  return authSetting
}

function normalizeAuthorizeDecision(decision: unknown): AppAuthorizeStatus {
  if (decision === true) {
    return 'authorized'
  }
  if (decision === false) {
    return 'denied'
  }
  if (decision === 'authorized' || decision === 'denied' || decision === 'not determined') {
    return decision
  }
  return 'authorized'
}

function resolveAuthorizeDecision(scope: string): AppAuthorizeStatus {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const decisionSource = runtimeGlobal.__weappViteWebAuthorizeDecision
  if (typeof decisionSource === 'function') {
    try {
      return normalizeAuthorizeDecision((decisionSource as (value: string) => unknown)(scope))
    }
    catch {
      return 'authorized'
    }
  }
  if (decisionSource && typeof decisionSource === 'object') {
    return normalizeAuthorizeDecision((decisionSource as Record<string, unknown>)[scope])
  }
  return 'authorized'
}

function syncOpenSettingPreset() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebOpenSettingAuth
  if (!preset || typeof preset !== 'object') {
    return
  }
  for (const [scope, value] of Object.entries(preset as Record<string, unknown>)) {
    if (!WEB_SUPPORTED_AUTH_SCOPES.has(scope)) {
      continue
    }
    webAuthorizeState.set(scope, value ? 'authorized' : 'denied')
  }
}

export function getSetting(options?: GetSettingOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'getSetting:ok',
    authSetting: buildAuthSettingSnapshot(),
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
  syncOpenSettingPreset()
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'openSetting:ok',
    authSetting: buildAuthSettingSnapshot(),
  }))
}

function normalizeAppAuthorizeStatus(value: unknown): AppAuthorizeStatus {
  if (value === true) {
    return 'authorized'
  }
  if (value === false) {
    return 'denied'
  }
  if (value === 'authorized' || value === 'denied' || value === 'not determined') {
    return value
  }
  return 'not determined'
}

function syncOpenAppAuthorizeSettingPreset() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebOpenAppAuthorizeSetting
  if (!preset || typeof preset !== 'object') {
    return
  }
  for (const [key, scope] of Object.entries(APP_AUTHORIZE_SCOPE_MAP)) {
    if (!scope) {
      continue
    }
    const status = normalizeAppAuthorizeStatus((preset as Record<string, unknown>)[key])
    webAuthorizeState.set(scope, status)
  }
}

export function openAppAuthorizeSetting(options?: OpenAppAuthorizeSettingOptions) {
  syncOpenAppAuthorizeSettingPreset()
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

function getToastElement() {
  if (typeof document === 'undefined') {
    return undefined
  }
  const existing = document.querySelector(TOAST_SELECTOR) as HTMLElement | null
  if (existing) {
    return existing
  }
  const toast = document.createElement('div')
  toast.setAttribute('id', TOAST_ID)
  toast.setAttribute('data-weapp-web-toast', 'true')
  toast.setAttribute('hidden', 'true')
  toast.setAttribute('role', 'status')
  toast.setAttribute('aria-live', 'polite')
  if (!document.body) {
    return undefined
  }
  document.body.append(toast)
  return toast
}

function setToastVisible(toast: HTMLElement, visible: boolean) {
  if (visible) {
    toast.removeAttribute('hidden')
  }
  else {
    toast.setAttribute('hidden', 'true')
  }
  toast.setAttribute('style', [
    'position: fixed',
    'left: 50%',
    'top: 15%',
    'transform: translate(-50%, 0)',
    'max-width: min(560px, 90vw)',
    'padding: 10px 14px',
    'border-radius: 8px',
    'background: rgba(17, 24, 39, 0.9)',
    'color: #ffffff',
    'font-size: 14px',
    'line-height: 1.5',
    'text-align: center',
    'pointer-events: none',
    'z-index: 2147483646',
    `opacity: ${visible ? '1' : '0'}`,
  ].join(';'))
}

function hideToastElement() {
  const toast = getToastElement()
  if (!toast) {
    return
  }
  setToastVisible(toast, false)
}

function resolveToastPrefix(icon: ShowToastOptions['icon']) {
  if (icon === 'none') {
    return ''
  }
  if (icon === 'error') {
    return '[error] '
  }
  return '[ok] '
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

function getLoadingElement() {
  if (typeof document === 'undefined') {
    return undefined
  }
  const existing = document.querySelector(LOADING_SELECTOR) as HTMLElement | null
  if (existing) {
    return existing
  }
  if (!document.body) {
    return undefined
  }
  const loading = document.createElement('div')
  loading.setAttribute('id', LOADING_ID)
  loading.setAttribute('data-weapp-web-loading', 'true')
  loading.setAttribute('hidden', 'true')
  loading.setAttribute('role', 'status')
  loading.setAttribute('aria-live', 'polite')
  document.body.append(loading)
  return loading
}

function setLoadingVisible(
  loading: HTMLElement,
  visible: boolean,
  title: string,
  mask: boolean,
) {
  if (visible) {
    loading.removeAttribute('hidden')
  }
  else {
    loading.setAttribute('hidden', 'true')
  }
  loading.textContent = title
  loading.setAttribute('style', [
    'position: fixed',
    'left: 50%',
    'top: 45%',
    'transform: translate(-50%, -50%)',
    'min-width: 120px',
    'max-width: min(560px, 90vw)',
    'padding: 14px 18px',
    'border-radius: 10px',
    'background: rgba(17, 24, 39, 0.92)',
    'color: #ffffff',
    'font-size: 14px',
    'line-height: 1.5',
    'text-align: center',
    `pointer-events: ${mask ? 'auto' : 'none'}`,
    'z-index: 2147483647',
    `opacity: ${visible ? '1' : '0'}`,
    `box-shadow: ${mask ? '0 0 0 99999px rgba(0, 0, 0, 0.28)' : 'none'}`,
  ].join(';'))
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

function inferImageTypeFromPath(path: string) {
  const lower = path.toLowerCase()
  if (lower.includes('.png')) {
    return 'png'
  }
  if (lower.includes('.jpg') || lower.includes('.jpeg')) {
    return 'jpg'
  }
  if (lower.includes('.gif')) {
    return 'gif'
  }
  if (lower.includes('.webp')) {
    return 'webp'
  }
  if (lower.includes('.bmp')) {
    return 'bmp'
  }
  if (lower.includes('.svg')) {
    return 'svg'
  }
  if (lower.includes('.avif')) {
    return 'avif'
  }
  return 'unknown'
}

function inferVideoTypeFromPath(path: string) {
  const lower = path.toLowerCase()
  if (lower.includes('.mp4')) {
    return 'mp4'
  }
  if (lower.includes('.mov')) {
    return 'mov'
  }
  if (lower.includes('.m4v')) {
    return 'm4v'
  }
  if (lower.includes('.webm')) {
    return 'webm'
  }
  if (lower.includes('.avi')) {
    return 'avi'
  }
  if (lower.includes('.mkv')) {
    return 'mkv'
  }
  return 'unknown'
}

function normalizeVideoInfoNumber(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return 0
  }
  return value
}

function normalizeVideoInfoPreset(value: unknown, src: string) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const info = value as Record<string, unknown>
  return {
    size: normalizeVideoInfoNumber(info.size),
    duration: normalizeVideoInfoNumber(info.duration),
    width: normalizeVideoInfoNumber(info.width),
    height: normalizeVideoInfoNumber(info.height),
    fps: normalizeVideoInfoNumber(info.fps),
    bitrate: normalizeVideoInfoNumber(info.bitrate),
    type: typeof info.type === 'string' ? info.type : inferVideoTypeFromPath(src),
    orientation: 'up' as const,
  }
}

function readPresetVideoInfo(src: string) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebVideoInfo
  if (typeof preset === 'function') {
    return normalizeVideoInfoPreset((preset as (value: string) => unknown)(src), src)
  }
  if (preset && typeof preset === 'object') {
    const sourcePreset = (preset as Record<string, unknown>)[src]
    if (sourcePreset && typeof sourcePreset === 'object') {
      return normalizeVideoInfoPreset(sourcePreset, src)
    }
    return normalizeVideoInfoPreset(preset, src)
  }
  return null
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

function getGlobalDialogHandlers() {
  const runtimeGlobal = globalThis as Record<string, unknown>
  return {
    confirm: runtimeGlobal.confirm as ((message?: string) => boolean) | undefined,
    alert: runtimeGlobal.alert as ((message?: string) => void) | undefined,
    prompt: runtimeGlobal.prompt as ((message?: string, defaultValue?: string) => string | null) | undefined,
  }
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

function resolveActionSheetSelection(itemList: string[]) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebActionSheetSelectIndex
  if (typeof preset === 'function') {
    const result = preset(itemList)
    if (Number.isInteger(result) && result >= 0 && result < itemList.length) {
      return result
    }
  }
  if (Number.isInteger(preset) && (preset as number) >= 0 && (preset as number) < itemList.length) {
    return preset as number
  }
  const { prompt } = getGlobalDialogHandlers()
  if (typeof prompt === 'function') {
    const lines = itemList.map((item, index) => `[${index}] ${item}`)
    const input = prompt(['请选择操作：', ...lines].join('\n'), '0')
    if (input === null) {
      return null
    }
    const parsed = Number.parseInt(String(input), 10)
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < itemList.length) {
      return parsed
    }
  }
  return 0
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

function normalizeChooseImageCount(count: number | undefined) {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return 9
  }
  return Math.max(1, Math.floor(count))
}

function createTempFilePath(file: { name?: string }) {
  const runtimeUrl = (globalThis as {
    URL?: {
      createObjectURL?: (value: unknown) => string
    }
  }).URL
  if (runtimeUrl && typeof runtimeUrl.createObjectURL === 'function') {
    const result = runtimeUrl.createObjectURL(file)
    if (result) {
      return result
    }
  }
  return file.name ?? ''
}

function normalizeChooseImageFile(file: {
  size?: number
  type?: string
  name?: string
}) {
  return {
    path: createTempFilePath(file),
    size: typeof file.size === 'number' ? file.size : 0,
    type: typeof file.type === 'string' ? file.type : '',
    name: typeof file.name === 'string' ? file.name : '',
  }
}

async function pickImageFilesByOpenPicker(count: number) {
  const picker = (globalThis as {
    showOpenFilePicker?: (options: {
      multiple?: boolean
      types?: Array<{
        description?: string
        accept?: Record<string, string[]>
      }>
    }) => Promise<Array<{ getFile?: () => Promise<any> }>>
  }).showOpenFilePicker
  if (typeof picker !== 'function') {
    return null
  }
  const handles = await picker({
    multiple: count > 1,
    types: [{
      description: 'Images',
      accept: {
        'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'],
      },
    }],
  })
  const files: any[] = []
  for (const handle of handles ?? []) {
    const file = await handle?.getFile?.()
    if (file) {
      files.push(file)
    }
    if (files.length >= count) {
      break
    }
  }
  return files
}

async function pickImageFilesByInput(count: number) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null
  }
  const input = document.createElement('input') as HTMLInputElement
  if (!input || typeof input !== 'object') {
    return null
  }
  input.setAttribute('type', 'file')
  input.setAttribute('accept', 'image/*')
  if (count > 1) {
    input.setAttribute('multiple', 'true')
  }
  input.setAttribute('style', 'position: fixed; left: -9999px; top: -9999px; opacity: 0;')
  if (document.body) {
    document.body.append(input)
  }
  try {
    const files = await new Promise<any[]>((resolve, reject) => {
      const onChange = () => {
        const selected = input.files ? Array.from(input.files) : []
        if (selected.length) {
          resolve(selected.slice(0, count))
        }
        else {
          reject(new Error('no file selected'))
        }
      }
      input.addEventListener('change', onChange, { once: true })
      if (typeof input.click === 'function') {
        input.click()
        return
      }
      reject(new Error('file input click is unavailable'))
    })
    return files
  }
  finally {
    if (input.parentNode) {
      input.parentNode.removeChild(input)
    }
  }
}

async function pickChooseImageFiles(count: number) {
  const viaPicker = await pickImageFilesByOpenPicker(count)
  if (Array.isArray(viaPicker)) {
    return viaPicker
  }
  const viaInput = await pickImageFilesByInput(count)
  if (Array.isArray(viaInput)) {
    return viaInput
  }
  throw new TypeError('Image picker is unavailable in current environment.')
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

function normalizeChooseMediaCount(count: number | undefined) {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return 1
  }
  return Math.max(1, Math.floor(count))
}

function normalizeChooseMediaTypes(mediaType: ChooseMediaOptions['mediaType']) {
  const normalized = new Set<ChooseMediaType>()
  for (const item of mediaType ?? []) {
    if (item === 'image') {
      normalized.add('image')
      continue
    }
    if (item === 'video') {
      normalized.add('video')
      continue
    }
    if (item === 'mix') {
      normalized.add('image')
      normalized.add('video')
    }
  }
  if (normalized.size === 0) {
    normalized.add('image')
    normalized.add('video')
  }
  return normalized
}

function buildChooseMediaOpenPickerAccept(types: Set<ChooseMediaType>) {
  const accept: Record<string, string[]> = {}
  if (types.has('image')) {
    accept['image/*'] = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif']
  }
  if (types.has('video')) {
    accept['video/*'] = ['.mp4', '.mov', '.m4v', '.webm']
  }
  return accept
}

function buildChooseMediaInputAccept(types: Set<ChooseMediaType>) {
  if (types.size === 2) {
    return 'image/*,video/*'
  }
  return types.has('video') ? 'video/*' : 'image/*'
}

function inferChooseMediaFileType(file: { type?: string, name?: string }): ChooseMediaType {
  const mimeType = typeof file.type === 'string' ? file.type.toLowerCase() : ''
  if (mimeType.startsWith('video/')) {
    return 'video'
  }
  if (mimeType.startsWith('image/')) {
    return 'image'
  }
  const fileName = typeof file.name === 'string' ? file.name.toLowerCase() : ''
  if (/\.(?:mp4|mov|m4v|webm)$/i.test(fileName)) {
    return 'video'
  }
  return 'image'
}

function normalizeChooseMediaFile(file: {
  size?: number
  type?: string
  name?: string
}) {
  const fileType = inferChooseMediaFileType(file)
  return {
    tempFilePath: createTempFilePath(file),
    size: typeof file.size === 'number' ? file.size : 0,
    fileType,
    width: 0,
    height: 0,
    duration: 0,
  } as ChooseMediaTempFile
}

async function pickMediaFilesByOpenPicker(count: number, types: Set<ChooseMediaType>) {
  const picker = (globalThis as {
    showOpenFilePicker?: (options: {
      multiple?: boolean
      types?: Array<{
        description?: string
        accept?: Record<string, string[]>
      }>
    }) => Promise<Array<{ getFile?: () => Promise<any> }>>
  }).showOpenFilePicker
  if (typeof picker !== 'function') {
    return null
  }
  const handles = await picker({
    multiple: count > 1,
    types: [{
      description: 'Media',
      accept: buildChooseMediaOpenPickerAccept(types),
    }],
  })
  const files: any[] = []
  for (const handle of handles ?? []) {
    const file = await handle?.getFile?.()
    if (file) {
      files.push(file)
    }
    if (files.length >= count) {
      break
    }
  }
  return files
}

async function pickMediaFilesByInput(count: number, types: Set<ChooseMediaType>) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null
  }
  const input = document.createElement('input') as HTMLInputElement
  if (!input || typeof input !== 'object') {
    return null
  }
  input.setAttribute('type', 'file')
  input.setAttribute('accept', buildChooseMediaInputAccept(types))
  if (count > 1) {
    input.setAttribute('multiple', 'true')
  }
  input.setAttribute('style', 'position: fixed; left: -9999px; top: -9999px; opacity: 0;')
  if (document.body) {
    document.body.append(input)
  }
  try {
    const files = await new Promise<any[]>((resolve, reject) => {
      const onChange = () => {
        const selected = input.files ? Array.from(input.files) : []
        if (selected.length) {
          resolve(selected.slice(0, count))
          return
        }
        reject(new Error('no file selected'))
      }
      input.addEventListener('change', onChange, { once: true })
      if (typeof input.click === 'function') {
        input.click()
        return
      }
      reject(new Error('file input click is unavailable'))
    })
    return files
  }
  finally {
    if (input.parentNode) {
      input.parentNode.removeChild(input)
    }
  }
}

async function pickChooseMediaFiles(count: number, types: Set<ChooseMediaType>) {
  const viaPicker = await pickMediaFilesByOpenPicker(count, types)
  if (Array.isArray(viaPicker)) {
    return viaPicker
  }
  const viaInput = await pickMediaFilesByInput(count, types)
  if (Array.isArray(viaInput)) {
    return viaInput
  }
  throw new TypeError('Media picker is unavailable in current environment.')
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

function normalizeCompressImageQuality(quality: number | undefined) {
  if (typeof quality !== 'number' || Number.isNaN(quality)) {
    return 80
  }
  return Math.max(0, Math.min(100, Math.round(quality)))
}

function resolveCompressImageMimeType(src: string) {
  const lower = src.toLowerCase()
  if (lower.includes('.jpg') || lower.includes('.jpeg')) {
    return 'image/jpeg'
  }
  if (lower.includes('.webp')) {
    return 'image/webp'
  }
  return 'image/png'
}

async function compressImageByCanvas(src: string, quality: number) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return src
  }
  const ImageCtor = (globalThis as { Image?: typeof Image }).Image
  if (typeof ImageCtor !== 'function') {
    return src
  }
  const canvas = document.createElement('canvas') as HTMLCanvasElement
  if (!canvas || typeof canvas.getContext !== 'function') {
    return src
  }
  return new Promise<string>((resolve, reject) => {
    const image = new ImageCtor()
    image.onload = () => {
      try {
        const width = Number((image as { naturalWidth?: number }).naturalWidth ?? image.width ?? 0)
        const height = Number((image as { naturalHeight?: number }).naturalHeight ?? image.height ?? 0)
        const context = canvas.getContext('2d')
        if (!context || typeof context.drawImage !== 'function' || width <= 0 || height <= 0) {
          resolve(src)
          return
        }
        canvas.width = width
        canvas.height = height
        context.drawImage(image, 0, 0, width, height)
        if (typeof canvas.toDataURL !== 'function') {
          resolve(src)
          return
        }
        const dataUrl = canvas.toDataURL(resolveCompressImageMimeType(src), quality / 100)
        resolve(dataUrl || src)
      }
      catch (error) {
        reject(error)
      }
    }
    image.onerror = () => {
      reject(new Error('image load error'))
    }
    image.src = src
  })
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

function normalizeCompressVideoResult(value: unknown, src: string) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const info = value as Record<string, unknown>
  const tempFilePath = typeof info.tempFilePath === 'string' && info.tempFilePath.trim()
    ? info.tempFilePath.trim()
    : src
  return {
    tempFilePath,
    size: normalizeVideoInfoNumber(info.size),
    duration: normalizeVideoInfoNumber(info.duration),
    width: normalizeVideoInfoNumber(info.width),
    height: normalizeVideoInfoNumber(info.height),
    bitrate: normalizeVideoInfoNumber(info.bitrate),
    fps: normalizeVideoInfoNumber(info.fps),
  }
}

function readPresetCompressVideo(src: string) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebCompressVideo
  if (typeof preset === 'function') {
    return normalizeCompressVideoResult((preset as (value: string) => unknown)(src), src)
  }
  if (preset && typeof preset === 'object') {
    const sourcePreset = (preset as Record<string, unknown>)[src]
    if (sourcePreset && typeof sourcePreset === 'object') {
      return normalizeCompressVideoResult(sourcePreset, src)
    }
    return normalizeCompressVideoResult(preset, src)
  }
  if (typeof preset === 'string' && preset.trim()) {
    return {
      tempFilePath: preset.trim(),
      size: 0,
      duration: 0,
      width: 0,
      height: 0,
      bitrate: 0,
      fps: 0,
    }
  }
  return null
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

function normalizeChooseVideoFile(file: {
  size?: number
  type?: string
  name?: string
}) {
  if (inferChooseMediaFileType(file) !== 'video') {
    return null
  }
  return {
    tempFilePath: createTempFilePath(file),
    duration: 0,
    size: typeof file.size === 'number' ? file.size : 0,
    height: 0,
    width: 0,
  } satisfies Omit<ChooseVideoSuccessResult, 'errMsg'>
}

async function pickChooseVideoFile() {
  const files = await pickChooseMediaFiles(1, new Set(['video']))
  return files[0] ?? null
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

function normalizeChooseMessageFileCount(count: number | undefined) {
  if (typeof count !== 'number' || Number.isNaN(count)) {
    return 1
  }
  return Math.max(1, Math.floor(count))
}

function normalizeChooseMessageFileType(type: ChooseMessageFileOptions['type']) {
  if (type === 'video' || type === 'image' || type === 'file' || type === 'all') {
    return type
  }
  return 'all'
}

function buildChooseMessageAccept(type: ReturnType<typeof normalizeChooseMessageFileType>) {
  if (type === 'video') {
    return 'video/*'
  }
  if (type === 'image') {
    return 'image/*'
  }
  if (type === 'file') {
    return '*/*'
  }
  return '*/*'
}

function normalizeChooseMessageFile(file: {
  size?: number
  type?: string
  name?: string
  lastModified?: number
}) {
  return {
    path: createTempFilePath(file),
    size: typeof file.size === 'number' ? file.size : 0,
    type: typeof file.type === 'string' ? file.type : '',
    name: typeof file.name === 'string' ? file.name : '',
    time: typeof file.lastModified === 'number' ? file.lastModified : Date.now(),
  }
}

async function pickMessageFilesByOpenPicker(count: number, type: ReturnType<typeof normalizeChooseMessageFileType>) {
  const picker = (globalThis as {
    showOpenFilePicker?: (options: {
      multiple?: boolean
      types?: Array<{
        description?: string
        accept?: Record<string, string[]>
      }>
    }) => Promise<Array<{ getFile?: () => Promise<any> }>>
  }).showOpenFilePicker
  if (typeof picker !== 'function') {
    return null
  }
  const accept = buildChooseMessageAccept(type)
  const handles = await picker({
    multiple: count > 1,
    types: [{
      description: 'Message Files',
      accept: {
        [accept]: [],
      },
    }],
  })
  const files: any[] = []
  for (const handle of handles ?? []) {
    const file = await handle?.getFile?.()
    if (file) {
      files.push(file)
    }
    if (files.length >= count) {
      break
    }
  }
  return files
}

async function pickMessageFilesByInput(count: number, type: ReturnType<typeof normalizeChooseMessageFileType>) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null
  }
  const input = document.createElement('input') as HTMLInputElement
  input.setAttribute('type', 'file')
  input.setAttribute('accept', buildChooseMessageAccept(type))
  if (count > 1) {
    input.setAttribute('multiple', 'true')
  }
  input.setAttribute('style', 'position: fixed; left: -9999px; top: -9999px; opacity: 0;')
  if (document.body) {
    document.body.append(input)
  }
  try {
    const files = await new Promise<any[]>((resolve, reject) => {
      const onChange = () => {
        const selected = input.files ? Array.from(input.files) : []
        if (selected.length) {
          resolve(selected.slice(0, count))
          return
        }
        reject(new Error('no file selected'))
      }
      input.addEventListener('change', onChange, { once: true })
      if (typeof input.click === 'function') {
        input.click()
        return
      }
      reject(new Error('file input click is unavailable'))
    })
    return files
  }
  finally {
    if (input.parentNode) {
      input.parentNode.removeChild(input)
    }
  }
}

async function pickChooseMessageFiles(count: number, type: ReturnType<typeof normalizeChooseMessageFileType>) {
  const viaPicker = await pickMessageFilesByOpenPicker(count, type)
  if (Array.isArray(viaPicker)) {
    return viaPicker
  }
  const viaInput = await pickMessageFilesByInput(count, type)
  if (Array.isArray(viaInput)) {
    return viaInput
  }
  throw new TypeError('Message file picker is unavailable in current environment.')
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

function normalizeChooseFileExtensions(extension: ChooseFileOptions['extension']) {
  const set = new Set<string>()
  for (const item of extension ?? []) {
    if (typeof item !== 'string') {
      continue
    }
    const normalized = item.trim().toLowerCase()
    if (!normalized) {
      continue
    }
    set.add(normalized.startsWith('.') ? normalized : `.${normalized}`)
  }
  return Array.from(set)
}

function buildChooseFilePickerAccept(
  type: ReturnType<typeof normalizeChooseMessageFileType>,
  extensions: string[],
) {
  if (extensions.length) {
    return {
      '*/*': extensions,
    }
  }
  return {
    [buildChooseMessageAccept(type)]: [],
  }
}

function buildChooseFileInputAccept(
  type: ReturnType<typeof normalizeChooseMessageFileType>,
  extensions: string[],
) {
  if (extensions.length) {
    return extensions.join(',')
  }
  return buildChooseMessageAccept(type)
}

async function pickChooseFileByOpenPicker(
  count: number,
  type: ReturnType<typeof normalizeChooseMessageFileType>,
  extensions: string[],
) {
  const picker = (globalThis as {
    showOpenFilePicker?: (options: {
      multiple?: boolean
      types?: Array<{
        description?: string
        accept?: Record<string, string[]>
      }>
    }) => Promise<Array<{ getFile?: () => Promise<any> }>>
  }).showOpenFilePicker
  if (typeof picker !== 'function') {
    return null
  }
  const handles = await picker({
    multiple: count > 1,
    types: [{
      description: 'Files',
      accept: buildChooseFilePickerAccept(type, extensions),
    }],
  })
  const files: any[] = []
  for (const handle of handles ?? []) {
    const file = await handle?.getFile?.()
    if (file) {
      files.push(file)
    }
    if (files.length >= count) {
      break
    }
  }
  return files
}

async function pickChooseFileByInput(
  count: number,
  type: ReturnType<typeof normalizeChooseMessageFileType>,
  extensions: string[],
) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return null
  }
  const input = document.createElement('input') as HTMLInputElement
  if (!input || typeof input !== 'object') {
    return null
  }
  input.setAttribute('type', 'file')
  input.setAttribute('accept', buildChooseFileInputAccept(type, extensions))
  if (count > 1) {
    input.setAttribute('multiple', 'true')
  }
  input.setAttribute('style', 'position: fixed; left: -9999px; top: -9999px; opacity: 0;')
  if (document.body) {
    document.body.append(input)
  }
  try {
    const files = await new Promise<any[]>((resolve, reject) => {
      const onChange = () => {
        const selected = input.files ? Array.from(input.files) : []
        if (selected.length) {
          resolve(selected.slice(0, count))
          return
        }
        reject(new Error('no file selected'))
      }
      input.addEventListener('change', onChange, { once: true })
      if (typeof input.click === 'function') {
        input.click()
        return
      }
      reject(new Error('file input click is unavailable'))
    })
    return files
  }
  finally {
    if (input.parentNode) {
      input.parentNode.removeChild(input)
    }
  }
}

async function pickChooseFileFiles(
  count: number,
  type: ReturnType<typeof normalizeChooseMessageFileType>,
  extensions: string[],
) {
  const viaPicker = await pickChooseFileByOpenPicker(count, type, extensions)
  if (Array.isArray(viaPicker)) {
    return viaPicker
  }
  const viaInput = await pickChooseFileByInput(count, type, extensions)
  if (Array.isArray(viaInput)) {
    return viaInput
  }
  throw new TypeError('File picker is unavailable in current environment.')
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

  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      window.open(target, '_blank', 'noopener,noreferrer')
    }
    catch {
      // ignore browser popup restrictions and keep API-level success semantics
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'previewImage:ok' }))
}

function normalizePreviewMediaSources(sources: PreviewMediaOptions['sources']) {
  return Array.isArray(sources)
    ? sources
        .map((source) => {
          if (!source || typeof source !== 'object') {
            return null
          }
          const url = typeof source.url === 'string' ? source.url.trim() : ''
          if (!url) {
            return null
          }
          return {
            url,
            type: source.type === 'video' ? 'video' : 'image',
            poster: typeof source.poster === 'string' ? source.poster : '',
          }
        })
        .filter((item): item is { url: string, type: 'image' | 'video', poster: string } => Boolean(item))
    : []
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
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      window.open(target, '_blank', 'noopener,noreferrer')
    }
    catch {
      // ignore browser popup restrictions and keep API-level success semantics
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'previewMedia:ok' }))
}

function readOpenVideoEditorPreset(src: string) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebOpenVideoEditor
  if (typeof preset === 'function') {
    const value = (preset as (value: string) => unknown)(src)
    return typeof value === 'string' && value.trim() ? value.trim() : ''
  }
  if (typeof preset === 'string' && preset.trim()) {
    return preset.trim()
  }
  if (preset && typeof preset === 'object') {
    const value = (preset as Record<string, unknown>)[src]
    return typeof value === 'string' && value.trim() ? value.trim() : ''
  }
  return ''
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
  if (typeof document !== 'undefined' && document.body) {
    try {
      const link = document.createElement('a')
      link.setAttribute('href', filePath)
      link.setAttribute('download', '')
      link.setAttribute('style', 'display:none')
      document.body.append(link)
      link.click?.()
      if (link.parentNode) {
        link.parentNode.removeChild(link)
      }
    }
    catch {
      // keep API-level success semantics for browser restrictions
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'saveImageToPhotosAlbum:ok' }))
}

export function saveVideoToPhotosAlbum(options?: SaveVideoToPhotosAlbumOptions) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'saveVideoToPhotosAlbum:fail invalid filePath')
    return Promise.reject(failure)
  }
  if (typeof document !== 'undefined' && document.body) {
    try {
      const link = document.createElement('a')
      link.setAttribute('href', filePath)
      link.setAttribute('download', '')
      link.setAttribute('style', 'display:none')
      document.body.append(link)
      link.click?.()
      if (link.parentNode) {
        link.parentNode.removeChild(link)
      }
    }
    catch {
      // keep API-level success semantics for browser restrictions
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'saveVideoToPhotosAlbum:ok' }))
}

export function saveFileToDisk(options?: SaveFileToDiskOptions) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'saveFileToDisk:fail invalid filePath')
    return Promise.reject(failure)
  }
  const fileName = typeof options?.fileName === 'string' ? options.fileName.trim() : ''
  if (typeof document !== 'undefined' && document.body) {
    try {
      const link = document.createElement('a')
      link.setAttribute('href', filePath)
      link.setAttribute('download', fileName)
      link.setAttribute('style', 'display:none')
      document.body.append(link)
      link.click?.()
      if (link.parentNode) {
        link.parentNode.removeChild(link)
      }
    }
    catch {
      // keep API-level success semantics for browser restrictions
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'saveFileToDisk:ok' }))
}

function resolveOpenDocumentUrl(filePath: string) {
  const record = memoryFileStorage.get(filePath)
  const runtimeUrl = (globalThis as {
    URL?: {
      createObjectURL?: (value: unknown) => string
    }
  }).URL

  if (record) {
    if (record.kind === 'text') {
      const text = record.text ?? ''
      if (typeof Blob === 'function' && runtimeUrl?.createObjectURL) {
        return runtimeUrl.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
      }
      return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
    }
    const bytes = record.bytes ?? new ArrayBuffer(0)
    if (typeof Blob === 'function' && runtimeUrl?.createObjectURL) {
      return runtimeUrl.createObjectURL(new Blob([bytes]))
    }
    return ''
  }

  if (/^(?:https?:|blob:|data:)/i.test(filePath)) {
    return filePath
  }
  try {
    const runtimeLocation = (typeof location !== 'undefined' ? location : undefined) as { href?: string } | undefined
    if (runtimeLocation?.href) {
      return new URL(filePath, runtimeLocation.href).toString()
    }
  }
  catch {
    // fallback to raw filePath
  }
  return filePath
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
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebScanCodeResult
  let rawResult: unknown = preset
  if (rawResult == null) {
    const { prompt } = getGlobalDialogHandlers()
    if (typeof prompt === 'function') {
      rawResult = prompt('请输入二维码/条码内容', '')
    }
  }
  if (rawResult == null) {
    const failure = callWxAsyncFailure(options, 'scanCode:fail cancel')
    return Promise.reject(failure)
  }
  const resultText = typeof rawResult === 'string'
    ? rawResult
    : String((rawResult as { result?: unknown })?.result ?? '')
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

async function writeClipboardData(data: string) {
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  if (runtimeNavigator?.clipboard && typeof runtimeNavigator.clipboard.writeText === 'function') {
    await runtimeNavigator.clipboard.writeText(data)
    return
  }

  if (typeof document === 'undefined' || !document.body) {
    throw new Error('Clipboard API is unavailable in current environment.')
  }

  const execCommand = (document as Document & { execCommand?: (command: string) => boolean }).execCommand
  if (typeof execCommand !== 'function') {
    throw new TypeError('Clipboard API is unavailable in current environment.')
  }

  const textarea = document.createElement('textarea') as HTMLTextAreaElement
  textarea.value = data
  textarea.setAttribute('readonly', 'true')
  textarea.setAttribute('style', 'position: fixed; top: -9999px; left: -9999px; opacity: 0;')
  document.body.append(textarea)
  textarea.select?.()
  const copied = execCommand.call(document, 'copy')
  if (textarea.parentNode) {
    textarea.parentNode.removeChild(textarea)
  }
  if (!copied) {
    throw new Error('document.execCommand("copy") returned false.')
  }
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
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  if (!runtimeNavigator?.clipboard || typeof runtimeNavigator.clipboard.readText !== 'function') {
    const failure = callWxAsyncFailure(options, 'getClipboardData:fail Clipboard API is unavailable in current environment.')
    return Promise.reject(failure)
  }
  try {
    const data = await runtimeNavigator.clipboard.readText()
    return callWxAsyncSuccess(options, { errMsg: 'getClipboardData:ok', data })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `getClipboardData:fail ${message}`)
    return Promise.reject(failure)
  }
}

function resolveSystemName(userAgent: string) {
  if (/android/i.test(userAgent)) {
    return 'Android'
  }
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return 'iOS'
  }
  if (/windows/i.test(userAgent)) {
    return 'Windows'
  }
  if (/mac os x/i.test(userAgent)) {
    return 'macOS'
  }
  if (/linux/i.test(userAgent)) {
    return 'Linux'
  }
  return 'Unknown'
}

function resolvePlatformName(
  userAgent: string,
  runtimeNavigator: Navigator | undefined,
) {
  const navigatorWithUAData = runtimeNavigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const raw = navigatorWithUAData.userAgentData?.platform
    ?? runtimeNavigator?.platform
    ?? resolveSystemName(userAgent)
  const normalized = raw.toLowerCase()
  if (normalized.includes('android')) {
    return 'android'
  }
  if (normalized.includes('iphone') || normalized.includes('ipad') || normalized.includes('ios')) {
    return 'ios'
  }
  if (normalized.includes('win')) {
    return 'windows'
  }
  if (normalized.includes('mac')) {
    return 'mac'
  }
  if (normalized.includes('linux')) {
    return 'linux'
  }
  return normalized || 'web'
}

function normalizePositiveNumber(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return fallback
  }
  return value
}

export function getSystemInfoSync(): SystemInfo {
  const runtimeWindow = (typeof window !== 'undefined'
    ? window
    : globalThis) as {
    innerWidth?: number
    innerHeight?: number
    devicePixelRatio?: number
  }
  const runtimeScreen = (typeof screen !== 'undefined'
    ? screen
    : globalThis) as {
    width?: number
    height?: number
  }
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  const userAgent = runtimeNavigator?.userAgent ?? ''
  const windowWidth = normalizePositiveNumber(
    runtimeWindow.innerWidth,
    normalizePositiveNumber(runtimeScreen.width, 0),
  )
  const windowHeight = normalizePositiveNumber(
    runtimeWindow.innerHeight,
    normalizePositiveNumber(runtimeScreen.height, 0),
  )
  const screenWidth = normalizePositiveNumber(runtimeScreen.width, windowWidth)
  const screenHeight = normalizePositiveNumber(runtimeScreen.height, windowHeight)

  return {
    brand: 'web',
    model: runtimeNavigator?.platform ?? 'web',
    pixelRatio: normalizePositiveNumber(runtimeWindow.devicePixelRatio, 1),
    screenWidth,
    screenHeight,
    windowWidth,
    windowHeight,
    statusBarHeight: 0,
    language: runtimeNavigator?.language ?? 'en',
    version: runtimeNavigator?.appVersion ?? userAgent,
    system: resolveSystemName(userAgent),
    platform: resolvePlatformName(userAgent, runtimeNavigator),
  }
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
  const systemInfo = getSystemInfoSync()
  const safeArea = {
    left: 0,
    right: systemInfo.windowWidth,
    top: systemInfo.statusBarHeight,
    bottom: systemInfo.windowHeight,
    width: systemInfo.windowWidth,
    height: Math.max(0, systemInfo.windowHeight - systemInfo.statusBarHeight),
  }
  return {
    pixelRatio: systemInfo.pixelRatio,
    screenWidth: systemInfo.screenWidth,
    screenHeight: systemInfo.screenHeight,
    windowWidth: systemInfo.windowWidth,
    windowHeight: systemInfo.windowHeight,
    statusBarHeight: systemInfo.statusBarHeight,
    screenTop: systemInfo.statusBarHeight,
    safeArea,
  }
}

function resolveDeviceOrientation(): 'portrait' | 'landscape' {
  const runtimeWindow = (typeof window !== 'undefined'
    ? window
    : globalThis) as {
    innerWidth?: number
    innerHeight?: number
  }
  const width = normalizePositiveNumber(runtimeWindow.innerWidth, 0)
  const height = normalizePositiveNumber(runtimeWindow.innerHeight, 0)
  if (width > 0 && height > 0 && width > height) {
    return 'landscape'
  }
  return 'portrait'
}

function normalizeMemorySize(memory: unknown) {
  if (typeof memory !== 'number' || Number.isNaN(memory) || memory <= 0) {
    return 0
  }
  return Math.round(memory * 1024)
}

export function getDeviceInfo(): DeviceInfo {
  const runtimeNavigator = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & {
    deviceMemory?: number
  }) | undefined
  const systemInfo = getSystemInfoSync()
  return {
    brand: systemInfo.brand,
    model: systemInfo.model,
    system: systemInfo.system,
    platform: systemInfo.platform,
    memorySize: normalizeMemorySize(runtimeNavigator?.deviceMemory),
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

function generateLoginCode() {
  const now = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `web_${now}_${random}`
}

export function login(options?: LoginOptions) {
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'login:ok',
    code: generateLoginCode(),
  }))
}

export function getAccountInfoSync(): AccountInfoSync {
  const runtimeLocation = (typeof location !== 'undefined' ? location : undefined) as {
    hostname?: string
  } | undefined
  const host = runtimeLocation?.hostname?.trim()
  const appId = host ? `web:${host}` : 'web'
  return {
    miniProgram: {
      appId,
      envVersion: 'develop',
      version: '0.0.0-web',
    },
    plugin: {},
  }
}

function resolveRuntimeTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  catch {
    return 'light'
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
  const width = 88
  const height = 32
  const right = Math.max(width, windowWidth - 8)
  const top = Math.max(0, statusBarHeight + (44 - height) / 2)
  const left = Math.max(0, right - width)
  return {
    width,
    height,
    top,
    right,
    bottom: top + height,
    left,
  }
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
    pageScrollTo,
    createCanvasContext,
    createWorker,
    createVKSession,
    createSelectorQuery,
    setNavigationBarTitle,
    setNavigationBarColor,
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
    authorize,
    openSetting,
    openAppAuthorizeSetting,
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
