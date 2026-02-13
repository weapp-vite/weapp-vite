export interface WxBaseResult {
  errMsg: string
}

export interface WxAsyncOptions<SuccessResult extends WxBaseResult> {
  success?: (result: SuccessResult) => void
  fail?: (result: WxBaseResult) => void
  complete?: (result: SuccessResult | WxBaseResult) => void
}

export interface ShowToastOptions extends WxAsyncOptions<WxBaseResult> {
  title?: string
  icon?: 'success' | 'error' | 'none'
  duration?: number
}

export interface SetClipboardDataOptions extends WxAsyncOptions<WxBaseResult> {
  data?: string
}

export interface GetClipboardDataSuccessResult extends WxBaseResult {
  data: string
}

export interface GetClipboardDataOptions extends WxAsyncOptions<GetClipboardDataSuccessResult> {}

export interface SetStorageOptions extends WxAsyncOptions<WxBaseResult> {
  key?: string
  data?: any
}

export interface GetStorageSuccessResult extends WxBaseResult {
  data: any
}

export interface GetStorageOptions extends WxAsyncOptions<GetStorageSuccessResult> {
  key?: string
}

export interface RemoveStorageOptions extends WxAsyncOptions<WxBaseResult> {
  key?: string
}

export interface StorageInfoResult extends WxBaseResult {
  keys: string[]
  currentSize: number
  limitSize: number
}

export interface FileReadResult extends WxBaseResult {
  data: string | ArrayBuffer
}

export interface FileWriteOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
  data?: string | ArrayBuffer | ArrayBufferView
  encoding?: string
}

export interface FileReadOptions extends WxAsyncOptions<FileReadResult> {
  filePath?: string
  encoding?: string
}

export interface FileSystemManager {
  writeFile: (options?: FileWriteOptions) => void
  readFile: (options?: FileReadOptions) => void
  writeFileSync: (filePath: string, data: string | ArrayBuffer | ArrayBufferView, encoding?: string) => void
  readFileSync: (filePath: string, encoding?: string) => string | ArrayBuffer
}

export type WorkerMessageCallback = (result: { data: unknown }) => void
export type WorkerErrorCallback = (result: { message: string, filename?: string, lineno?: number, colno?: number }) => void

export interface WorkerBridge {
  postMessage: (data: unknown) => void
  terminate: () => void
  onMessage: (callback: WorkerMessageCallback) => void
  offMessage: (callback?: WorkerMessageCallback) => void
  onError: (callback: WorkerErrorCallback) => void
  offError: (callback?: WorkerErrorCallback) => void
}

export interface RequestSuccessResult extends WxBaseResult {
  data: any
  statusCode: number
  header: Record<string, string>
}

export interface RequestOptions extends WxAsyncOptions<RequestSuccessResult> {
  url?: string
  method?: string
  data?: any
  header?: Record<string, string>
  timeout?: number
  dataType?: 'json' | 'text'
  responseType?: 'text' | 'arraybuffer'
}

export interface DownloadFileSuccessResult extends WxBaseResult {
  tempFilePath: string
  statusCode: number
}

export interface DownloadFileOptions extends WxAsyncOptions<DownloadFileSuccessResult> {
  url?: string
  header?: Record<string, string>
  timeout?: number
}

export interface UploadFileSuccessResult extends WxBaseResult {
  data: string
  statusCode: number
  header: Record<string, string>
}

export interface UploadFileOptions extends WxAsyncOptions<UploadFileSuccessResult> {
  url?: string
  filePath?: string
  name?: string
  header?: Record<string, string>
  formData?: Record<string, unknown>
  timeout?: number
}

export interface PreviewImageOptions extends WxAsyncOptions<WxBaseResult> {
  current?: string
  urls?: string[]
}

export interface ChooseImageTempFile {
  path: string
  size: number
  type: string
  name: string
}

export interface ChooseImageSuccessResult extends WxBaseResult {
  tempFilePaths: string[]
  tempFiles: ChooseImageTempFile[]
}

export interface ChooseImageOptions extends WxAsyncOptions<ChooseImageSuccessResult> {
  count?: number
  sizeType?: Array<'original' | 'compressed'>
  sourceType?: Array<'album' | 'camera'>
}

export interface AuthSettingResult {
  authSetting: Record<string, boolean>
}

export interface GetSettingSuccessResult extends WxBaseResult, AuthSettingResult {}

export interface GetSettingOptions extends WxAsyncOptions<GetSettingSuccessResult> {}

export interface AuthorizeOptions extends WxAsyncOptions<WxBaseResult> {
  scope?: string
}

export interface OpenSettingSuccessResult extends WxBaseResult, AuthSettingResult {}

export interface OpenSettingOptions extends WxAsyncOptions<OpenSettingSuccessResult> {}

export type ChooseMediaType = 'image' | 'video'

export interface ChooseMediaTempFile {
  tempFilePath: string
  size: number
  fileType: ChooseMediaType
  thumbTempFilePath?: string
  width: number
  height: number
  duration: number
}

export interface ChooseMediaSuccessResult extends WxBaseResult {
  type: ChooseMediaType
  tempFiles: ChooseMediaTempFile[]
}

export interface ChooseMediaOptions extends WxAsyncOptions<ChooseMediaSuccessResult> {
  count?: number
  mediaType?: Array<'image' | 'video' | 'mix'>
  sourceType?: Array<'album' | 'camera'>
  maxDuration?: number
  sizeType?: Array<'original' | 'compressed'>
  camera?: 'back' | 'front'
}

export interface CompressImageSuccessResult extends WxBaseResult {
  tempFilePath: string
}

export interface CompressImageOptions extends WxAsyncOptions<CompressImageSuccessResult> {
  src?: string
  quality?: number
  compressedWidth?: number
  compressedHeight?: number
}

export interface ChooseVideoSuccessResult extends WxBaseResult {
  tempFilePath: string
  duration: number
  size: number
  height: number
  width: number
}

export interface ChooseVideoOptions extends WxAsyncOptions<ChooseVideoSuccessResult> {
  sourceType?: Array<'album' | 'camera'>
  compressed?: boolean
  maxDuration?: number
  camera?: 'back' | 'front'
}

export interface GetVideoInfoSuccessResult extends WxBaseResult {
  size: number
  duration: number
  width: number
  height: number
  fps: number
  bitrate: number
  type: string
  orientation: 'up'
}

export interface GetVideoInfoOptions extends WxAsyncOptions<GetVideoInfoSuccessResult> {
  src?: string
}

export interface CompressVideoSuccessResult extends WxBaseResult {
  tempFilePath: string
  size: number
  duration: number
  width: number
  height: number
  bitrate: number
  fps: number
}

export interface CompressVideoOptions extends WxAsyncOptions<CompressVideoSuccessResult> {
  src?: string
  quality?: 'low' | 'medium' | 'high'
  bitrate?: number
}

export interface MediaPreviewSource {
  url: string
  type?: 'image' | 'video'
  poster?: string
}

export interface PreviewMediaOptions extends WxAsyncOptions<WxBaseResult> {
  sources?: MediaPreviewSource[]
  current?: number
}

export interface SaveVideoToPhotosAlbumOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
}

export interface ChooseFileSuccessResult extends WxBaseResult {
  tempFiles: ChooseMessageFileTempFile[]
}

export interface ChooseFileOptions extends WxAsyncOptions<ChooseFileSuccessResult> {
  count?: number
  type?: 'all' | 'video' | 'image' | 'file'
  extension?: string[]
}

export interface OpenVideoEditorSuccessResult extends WxBaseResult {
  tempFilePath: string
}

export interface OpenVideoEditorOptions extends WxAsyncOptions<OpenVideoEditorSuccessResult> {
  src?: string
}

export interface SaveFileSuccessResult extends WxBaseResult {
  savedFilePath: string
}

export interface SaveFileOptions extends WxAsyncOptions<SaveFileSuccessResult> {
  tempFilePath?: string
  filePath?: string
}

export interface SaveFileToDiskOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
  fileName?: string
}

export interface ChooseMessageFileTempFile {
  path: string
  size: number
  type: string
  name: string
  time: number
}

export interface ChooseMessageFileSuccessResult extends WxBaseResult {
  tempFiles: ChooseMessageFileTempFile[]
}

export interface ChooseMessageFileOptions extends WxAsyncOptions<ChooseMessageFileSuccessResult> {
  count?: number
  type?: 'all' | 'video' | 'image' | 'file'
}

export interface SaveImageToPhotosAlbumOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
}

export interface ScanCodeSuccessResult extends WxBaseResult {
  result: string
  scanType: string
  charSet: string
  path: string
  rawData: string
}

export interface ScanCodeOptions extends WxAsyncOptions<ScanCodeSuccessResult> {
  onlyFromCamera?: boolean
  scanType?: string[]
}

export interface GetLocationSuccessResult extends WxBaseResult {
  latitude: number
  longitude: number
  speed: number
  accuracy: number
  altitude: number
  verticalAccuracy: number
  horizontalAccuracy: number
}

export interface GetLocationOptions extends WxAsyncOptions<GetLocationSuccessResult> {
  type?: 'wgs84' | 'gcj02'
  altitude?: boolean
  isHighAccuracy?: boolean
  highAccuracyExpireTime?: number
}

export interface GetFuzzyLocationSuccessResult extends WxBaseResult {
  latitude: number
  longitude: number
  accuracy: number
}

export interface GetFuzzyLocationOptions extends WxAsyncOptions<GetFuzzyLocationSuccessResult> {}

export type NetworkType = 'wifi' | '2g' | '3g' | '4g' | '5g' | 'unknown' | 'none'

export interface NetworkStatusResult {
  isConnected: boolean
  networkType: NetworkType
}

export interface GetNetworkTypeSuccessResult extends WxBaseResult, NetworkStatusResult {}

export interface GetNetworkTypeOptions extends WxAsyncOptions<GetNetworkTypeSuccessResult> {}

export type NetworkStatusChangeCallback = (result: NetworkStatusResult) => void

export interface WindowResizeResult {
  size: {
    windowWidth: number
    windowHeight: number
  }
  windowWidth: number
  windowHeight: number
}

export type WindowResizeCallback = (result: WindowResizeResult) => void

export interface ShowLoadingOptions extends WxAsyncOptions<WxBaseResult> {
  title?: string
  mask?: boolean
}

export interface SetBackgroundColorOptions extends WxAsyncOptions<WxBaseResult> {
  backgroundColor?: string
  backgroundColorTop?: string
  backgroundColorBottom?: string
}

export interface SetBackgroundTextStyleOptions extends WxAsyncOptions<WxBaseResult> {
  textStyle?: 'dark' | 'light'
}

export interface ShareMenuOptions extends WxAsyncOptions<WxBaseResult> {
  withShareTicket?: boolean
  menus?: string[]
}

export interface NavigateToMiniProgramOptions extends WxAsyncOptions<WxBaseResult> {
  appId?: string
  path?: string
  extraData?: Record<string, any>
  envVersion?: 'develop' | 'trial' | 'release'
}

export interface LoadSubPackageOptions extends WxAsyncOptions<WxBaseResult> {
  name?: string
  root?: string
}

export interface PreloadSubpackageOptions extends WxAsyncOptions<WxBaseResult> {
  name?: string
  root?: string
}

export interface UpdateManagerCheckResult {
  hasUpdate: boolean
}

export interface UpdateManager {
  applyUpdate: () => void
  onCheckForUpdate: (callback: (result: UpdateManagerCheckResult) => void) => void
  onUpdateReady: (callback: () => void) => void
  onUpdateFailed: (callback: () => void) => void
}

export interface LogManagerOptions {
  level?: 0 | 1
}

export interface LogManager {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
}

export interface ChooseLocationSuccessResult extends WxBaseResult {
  name: string
  address: string
  latitude: number
  longitude: number
}

export interface ChooseLocationOptions extends WxAsyncOptions<ChooseLocationSuccessResult> {}

export interface ChooseAddressSuccessResult extends WxBaseResult {
  userName: string
  postalCode: string
  provinceName: string
  cityName: string
  countyName: string
  detailInfo: string
  nationalCode: string
  telNumber: string
}

export interface ChooseAddressOptions extends WxAsyncOptions<ChooseAddressSuccessResult> {}

export interface GetImageInfoSuccessResult extends WxBaseResult {
  width: number
  height: number
  path: string
  type: string
  orientation: 'up'
}

export interface GetImageInfoOptions extends WxAsyncOptions<GetImageInfoSuccessResult> {
  src?: string
}

export interface MakePhoneCallOptions extends WxAsyncOptions<WxBaseResult> {
  phoneNumber?: string
}

export interface OpenLocationOptions extends WxAsyncOptions<WxBaseResult> {
  latitude?: number
  longitude?: number
  scale?: number
  name?: string
  address?: string
}

export interface TabBarOptions extends WxAsyncOptions<WxBaseResult> {
  animation?: boolean
}

export interface OpenCustomerServiceChatOptions extends WxAsyncOptions<WxBaseResult> {
  corpId?: string
  extInfo?: Record<string, any>
  url?: string
}

export interface RequestPaymentOptions extends WxAsyncOptions<WxBaseResult> {
  timeStamp?: string
  nonceStr?: string
  package?: string
  signType?: string
  paySign?: string
}

export interface RequestSubscribeMessageSuccessResult extends WxBaseResult {
  [tmplId: string]: string
}

export interface RequestSubscribeMessageOptions extends WxAsyncOptions<RequestSubscribeMessageSuccessResult> {
  tmplIds?: string[]
}

export interface CloudInitOptions {
  env?: string
  traceUser?: boolean
}

export interface CloudCallFunctionSuccessResult extends WxBaseResult {
  result: Record<string, unknown>
  requestID: string
}

export interface CloudCallFunctionOptions extends WxAsyncOptions<CloudCallFunctionSuccessResult> {
  name?: string
  data?: Record<string, unknown>
  config?: Record<string, unknown>
}

export interface CloudBridge {
  init: (options?: CloudInitOptions) => void
  callFunction: (options?: CloudCallFunctionOptions) => Promise<CloudCallFunctionSuccessResult>
}

export interface VibrateShortOptions extends WxAsyncOptions<WxBaseResult> {
  type?: 'heavy' | 'medium' | 'light'
}

export interface BatteryInfo {
  level: number
  isCharging: boolean
}

export interface GetBatteryInfoSuccessResult extends WxBaseResult, BatteryInfo {}

export interface GetExtConfigSuccessResult extends WxBaseResult {
  extConfig: Record<string, any>
}

export interface GetExtConfigOptions extends WxAsyncOptions<GetExtConfigSuccessResult> {}

export interface ShowModalSuccessResult extends WxBaseResult {
  confirm: boolean
  cancel: boolean
}

export interface ShowModalOptions extends WxAsyncOptions<ShowModalSuccessResult> {
  title?: string
  content?: string
  showCancel?: boolean
  confirmText?: string
  cancelText?: string
}

export interface ShowActionSheetSuccessResult extends WxBaseResult {
  tapIndex: number
}

export interface ShowActionSheetOptions extends WxAsyncOptions<ShowActionSheetSuccessResult> {
  itemList?: string[]
  itemColor?: string
  alertText?: string
}

export interface OpenDocumentOptions extends WxAsyncOptions<WxBaseResult> {
  filePath?: string
  fileType?: string
  showMenu?: boolean
}

export interface PageScrollToOptions extends WxAsyncOptions<WxBaseResult> {
  scrollTop?: number
  duration?: number
}

export interface SelectorQueryNodeFields {
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

export type SelectorQueryNodeCallback = (result: any) => void

export interface SelectorQuery {
  in: (context?: unknown) => SelectorQuery
  select: (selector: string) => SelectorQueryNodesRef
  selectAll: (selector: string) => SelectorQueryNodesRef
  selectViewport: () => SelectorQueryNodesRef
  exec: (callback?: (result: any[]) => void) => SelectorQuery
}

export interface SelectorQueryNodesRef {
  boundingClientRect: (callback?: SelectorQueryNodeCallback) => SelectorQuery
  scrollOffset: (callback?: SelectorQueryNodeCallback) => SelectorQuery
  fields: (fields: SelectorQueryNodeFields, callback?: SelectorQueryNodeCallback) => SelectorQuery
  node: (callback?: SelectorQueryNodeCallback) => SelectorQuery
}

export interface CanvasContext {
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

export interface VideoContext {
  play: () => void
  pause: () => void
  stop: () => void
  seek: (position: number) => void
  playbackRate: (rate: number) => void
  requestFullScreen: () => void
  exitFullScreen: () => void
}

export interface AdBaseOptions {
  adUnitId?: string
}

export interface AdError {
  errMsg: string
  errCode: number
}

export interface AdLoadResult {
  errMsg: string
}

export interface AdShowResult {
  errMsg: string
}

export interface RewardedVideoAdCloseResult {
  isEnded: boolean
}

export interface RewardedVideoAd {
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

export interface InterstitialAd {
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

export interface VkSession {
  start: () => Promise<WxBaseResult>
  stop: () => Promise<WxBaseResult>
  destroy: () => void
  on: (eventName: string, callback: (payload: unknown) => void) => void
  off: (eventName?: string, callback?: (payload: unknown) => void) => void
}

export interface SystemInfo {
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

export interface AppBaseInfo {
  SDKVersion: string
  language: string
  version: string
  platform: string
  enableDebug: boolean
  theme: 'light' | 'dark'
}

export interface MenuButtonBoundingClientRect {
  width: number
  height: number
  top: number
  right: number
  bottom: number
  left: number
}

export interface WindowInfo {
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

export interface DeviceInfo {
  brand: string
  model: string
  system: string
  platform: string
  memorySize: number
  benchmarkLevel: number
  abi: string
  deviceOrientation: 'portrait' | 'landscape'
}

export interface SystemSetting {
  bluetoothEnabled: boolean
  wifiEnabled: boolean
  locationEnabled: boolean
  locationReducedAccuracy: boolean
  deviceOrientation: 'portrait' | 'landscape'
}

export type AppAuthorizeStatus = 'authorized' | 'denied' | 'not determined'

export interface AppAuthorizeSetting {
  albumAuthorized: AppAuthorizeStatus
  bluetoothAuthorized: AppAuthorizeStatus
  cameraAuthorized: AppAuthorizeStatus
  locationAuthorized: AppAuthorizeStatus
  microphoneAuthorized: AppAuthorizeStatus
  notificationAuthorized: AppAuthorizeStatus
  phoneCalendarAuthorized: AppAuthorizeStatus
}

export interface OpenAppAuthorizeSettingSuccessResult extends WxBaseResult, AppAuthorizeSetting {}

export interface OpenAppAuthorizeSettingOptions extends WxAsyncOptions<OpenAppAuthorizeSettingSuccessResult> {}

export interface LoginSuccessResult extends WxBaseResult {
  code: string
}

export interface LoginOptions extends WxAsyncOptions<LoginSuccessResult> {
  timeout?: number
}

export interface CheckSessionOptions extends WxAsyncOptions<WxBaseResult> {}

export interface UserInfo {
  nickName: string
  avatarUrl: string
  gender: 0 | 1 | 2
  country: string
  province: string
  city: string
  language: string
}

export interface UserProfileSuccessResult extends WxBaseResult {
  userInfo: UserInfo
  rawData: string
  signature: string
  encryptedData: string
  iv: string
}

export interface GetUserInfoOptions extends WxAsyncOptions<UserProfileSuccessResult> {
  lang?: 'en' | 'zh_CN' | 'zh_TW'
}

export interface GetUserProfileOptions extends WxAsyncOptions<UserProfileSuccessResult> {
  desc?: string
  lang?: 'en' | 'zh_CN' | 'zh_TW'
}

export interface AccountInfoSync {
  miniProgram: {
    appId: string
    envVersion: 'develop' | 'trial' | 'release'
    version: string
  }
  plugin: Record<string, unknown>
}

export interface GetSystemInfoSuccessResult extends WxBaseResult, SystemInfo {}

export interface GetSystemInfoOptions extends WxAsyncOptions<GetSystemInfoSuccessResult> {}
