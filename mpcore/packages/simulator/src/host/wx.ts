export interface HeadlessWxCallbackOption<TResult = void> {
  complete?: (result?: TResult) => void
  fail?: (error: Error) => void
  success?: (result: TResult) => void
}

export interface HeadlessWxNavigateOption extends HeadlessWxCallbackOption {
  url: string
}

export interface HeadlessWxNavigateBackOption extends HeadlessWxCallbackOption {
  delta?: number
}

export interface HeadlessWxPageScrollToOption extends HeadlessWxCallbackOption {
  duration?: number
  scrollTop?: number
  selector?: string
}

export interface HeadlessWxVideoContext {
  exitFullScreen: () => void
  pause: () => void
  play: () => void
  requestFullScreen: () => void
  seek: (position: number) => void
  stop: () => void
}

export interface HeadlessWxAnimationStepOption {
  delay?: number
  duration?: number
  timingFunction?: 'ease' | 'ease-in' | 'ease-in-out' | 'ease-out' | 'linear' | 'step-end' | 'step-start'
  transformOrigin?: string
}

export interface HeadlessWxAnimationAction {
  args: unknown[]
  type: string
}

export interface HeadlessWxAnimationExportResult {
  actions: Array<{
    animates: HeadlessWxAnimationAction[]
    option: Required<HeadlessWxAnimationStepOption>
  }>
}

export interface HeadlessWxAnimation {
  backgroundColor: (value: string) => HeadlessWxAnimation
  bottom: (value: number | string) => HeadlessWxAnimation
  export: () => HeadlessWxAnimationExportResult
  height: (value: number | string) => HeadlessWxAnimation
  left: (value: number | string) => HeadlessWxAnimation
  opacity: (value: number) => HeadlessWxAnimation
  right: (value: number | string) => HeadlessWxAnimation
  rotate: (angle: number) => HeadlessWxAnimation
  scale: (sx: number, sy?: number) => HeadlessWxAnimation
  step: (option?: HeadlessWxAnimationStepOption) => HeadlessWxAnimation
  top: (value: number | string) => HeadlessWxAnimation
  translate: (tx?: number | string, ty?: number | string) => HeadlessWxAnimation
  translate3d: (tx?: number | string, ty?: number | string, tz?: number | string) => HeadlessWxAnimation
  translateX: (translation: number) => HeadlessWxAnimation
  translateY: (translation: number) => HeadlessWxAnimation
  translateZ: (translation: number) => HeadlessWxAnimation
  width: (value: number | string) => HeadlessWxAnimation
}

export interface HeadlessWxCanvasDrawCall {
  args: unknown[]
  type: string
}

export interface HeadlessWxCanvasSnapshot {
  canvasId: string
  drawCalls: HeadlessWxCanvasDrawCall[]
  fillStyle: string
  fontSize: number
  lineWidth: number
  reserve: boolean
  strokeStyle: string
}

export interface HeadlessWxCanvasContext {
  __getSnapshot: () => HeadlessWxCanvasSnapshot
  arc: (x: number, y: number, r: number, sAngle: number, eAngle: number, counterclockwise?: boolean) => void
  beginPath: () => void
  clearRect: (x: number, y: number, width: number, height: number) => void
  closePath: () => void
  draw: (reserve?: boolean, callback?: () => void) => void
  drawImage: (image: string, ...args: number[]) => void
  fill: () => void
  fillRect: (x: number, y: number, width: number, height: number) => void
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void
  lineTo: (x: number, y: number) => void
  measureText: (text: string) => { width: number }
  moveTo: (x: number, y: number) => void
  rect: (x: number, y: number, width: number, height: number) => void
  restore: () => void
  rotate: (rotate: number) => void
  save: () => void
  scale: (scaleWidth: number, scaleHeight: number) => void
  setFillStyle: (value: string) => void
  setFontSize: (fontSize: number) => void
  setLineWidth: (value: number) => void
  setStrokeStyle: (value: string) => void
  stroke: () => void
  strokeRect: (x: number, y: number, width: number, height: number) => void
  translate: (x: number, y: number) => void
}

export interface HeadlessWxIntersectionObserverMargins {
  bottom?: number
  left?: number
  right?: number
  top?: number
}

export interface HeadlessWxIntersectionObserverObserveAllResult {
  boundingClientRect: HeadlessWxSelectorQueryBoundingClientRectResult
  id: string
  intersectionRatio: number
  intersectionRect: HeadlessWxSelectorQueryBoundingClientRectResult
  relativeRect: HeadlessWxSelectorQueryBoundingClientRectResult
}

export interface HeadlessWxIntersectionObserver {
  disconnect: () => void
  observe: (selector: string, callback: (result: HeadlessWxIntersectionObserverObserveAllResult) => void) => void
  relativeTo: (selector: string, margins?: HeadlessWxIntersectionObserverMargins) => HeadlessWxIntersectionObserver
  relativeToViewport: (margins?: HeadlessWxIntersectionObserverMargins) => HeadlessWxIntersectionObserver
}

export interface HeadlessWxCreateIntersectionObserverOption {
  thresholds?: number[]
}

export interface HeadlessWxObserveDescriptor {
  height?: number
  maxHeight?: number
  maxWidth?: number
  minHeight?: number
  minWidth?: number
  orientation?: string
  width?: number
}

export interface HeadlessWxMediaQueryObserverObserveCallbackResult {
  matches: boolean
}

export interface HeadlessWxMediaQueryObserver {
  disconnect: () => void
  observe: (
    descriptor: HeadlessWxObserveDescriptor,
    callback: (result: HeadlessWxMediaQueryObserverObserveCallbackResult) => void,
  ) => void
}

export interface HeadlessWxSelectorQueryBoundingClientRectResult {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export interface HeadlessWxSelectorQueryScrollOffsetResult {
  scrollLeft: number
  scrollTop: number
}

export interface HeadlessWxSelectorQueryFieldsOption {
  computedStyle?: string[]
  context?: boolean
  dataset?: boolean
  id?: boolean
  mark?: boolean
  node?: boolean
  properties?: string[]
  rect?: boolean
  scrollOffset?: boolean
  size?: boolean
}

export interface HeadlessWxSelectorQueryRequest {
  fields: HeadlessWxSelectorQueryFieldsOption
  selector?: string
  single: boolean
  target: 'selector' | 'viewport'
}

export interface HeadlessWxSelectorQueryNode {
  boundingClientRect: (callback?: (result: HeadlessWxSelectorQueryBoundingClientRectResult | HeadlessWxSelectorQueryBoundingClientRectResult[] | null) => void) => HeadlessWxSelectorQuery
  fields: (
    fields: HeadlessWxSelectorQueryFieldsOption,
    callback?: (result: Record<string, any> | Record<string, any>[] | null) => void,
  ) => HeadlessWxSelectorQuery
  scrollOffset: (callback?: (result: HeadlessWxSelectorQueryScrollOffsetResult | HeadlessWxSelectorQueryScrollOffsetResult[] | null) => void) => HeadlessWxSelectorQuery
}

export interface HeadlessWxSelectorQuery {
  exec: (callback?: (result: unknown[]) => void) => unknown[]
  in: (component: Record<string, any>) => HeadlessWxSelectorQuery
  select: (selector: string) => HeadlessWxSelectorQueryNode
  selectAll: (selector: string) => HeadlessWxSelectorQueryNode
  selectViewport: () => HeadlessWxSelectorQueryNode
}

export interface HeadlessWxStorageResult {
  errMsg: string
}

export interface HeadlessWxGetStorageResult extends HeadlessWxStorageResult {
  data: unknown
}

export interface HeadlessWxStorageInfoResult extends HeadlessWxStorageResult {
  currentSize: number
  keys: string[]
  limitSize: number
}

export type HeadlessWxNetworkType = '2g' | '3g' | '4g' | '5g' | 'none' | 'unknown' | 'wifi'

export interface HeadlessWxGetNetworkTypeResult {
  errMsg: string
  networkType: HeadlessWxNetworkType
}

export interface HeadlessWxNetworkStatusChangeResult {
  isConnected: boolean
  networkType: HeadlessWxNetworkType
}

export type HeadlessWxNetworkStatusChangeCallback = (result: HeadlessWxNetworkStatusChangeResult) => void

export interface HeadlessWxSystemInfoResult {
  SDKVersion: string
  brand: string
  language: string
  model: string
  pixelRatio: number
  platform: string
  screenHeight: number
  screenWidth: number
  system: string
  version: string
  windowHeight: number
  windowWidth: number
}

export interface HeadlessWxAppBaseInfoResult {
  SDKVersion: string
  enableDebug: boolean
  host: {
    env: string
  }
  language: string
  platform: string
  version: string
}

export interface HeadlessWxWindowInfoResult {
  pixelRatio: number
  screenHeight: number
  screenWidth: number
  statusBarHeight: number
  windowHeight: number
  windowWidth: number
}

export interface HeadlessWxLaunchOptions {
  path: string
  query: Record<string, string>
  referrerInfo: {
    appId: string
    extraData: Record<string, never>
  }
  scene: number
}

export interface HeadlessWxMenuButtonBoundingClientRectResult {
  bottom: number
  height: number
  left: number
  right: number
  top: number
  width: number
}

export interface HeadlessWxSetStorageOption extends HeadlessWxCallbackOption<HeadlessWxStorageResult> {
  data: unknown
  key: string
}

export interface HeadlessWxGetStorageOption extends HeadlessWxCallbackOption<HeadlessWxGetStorageResult> {
  key: string
}

export interface HeadlessWxGetStorageInfoOption extends HeadlessWxCallbackOption<HeadlessWxStorageInfoResult> {}

export interface HeadlessWxGetNetworkTypeOption extends HeadlessWxCallbackOption<HeadlessWxGetNetworkTypeResult> {}

export interface HeadlessWxGetSystemInfoOption extends HeadlessWxCallbackOption<HeadlessWxSystemInfoResult> {}

export interface HeadlessWxGetWindowInfoOption extends HeadlessWxCallbackOption<HeadlessWxWindowInfoResult> {}

export interface HeadlessWxGetAppBaseInfoOption extends HeadlessWxCallbackOption<HeadlessWxAppBaseInfoResult> {}

export interface HeadlessWxRemoveStorageOption extends HeadlessWxCallbackOption<HeadlessWxStorageResult> {
  key: string
}

export interface HeadlessWxClearStorageOption extends HeadlessWxCallbackOption<HeadlessWxStorageResult> {}

export interface HeadlessWxHideLoadingOption extends HeadlessWxCallbackOption<{ errMsg: string }> {}

export interface HeadlessWxSetBackgroundTextStyleOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  textStyle: string
}

export interface HeadlessWxSetBackgroundColorOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  backgroundColor?: string
  backgroundColorBottom?: string
  backgroundColorTop?: string
}

export interface HeadlessWxSetNavigationBarTitleOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  title: string
}

export interface HeadlessWxSetNavigationBarColorOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  animation?: {
    duration?: number
    timingFunction?: string
  }
  backgroundColor?: string
  frontColor?: string
}

export interface HeadlessWxShowNavigationBarLoadingOption extends HeadlessWxCallbackOption<{ errMsg: string }> {}

export interface HeadlessWxHideNavigationBarLoadingOption extends HeadlessWxCallbackOption<{ errMsg: string }> {}

export interface HeadlessWxShareMenuOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  isUpdatableMessage?: boolean
  menus?: string[]
  withShareTicket?: boolean
}

export interface HeadlessWxTabBarOption extends HeadlessWxCallbackOption<{ errMsg: string }> {}

export interface HeadlessWxTabBarItemOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  index: number
}

export interface HeadlessWxSetTabBarBadgeOption extends HeadlessWxTabBarItemOption {
  text: string
}

export interface HeadlessWxShowActionSheetResult {
  errMsg: string
  tapIndex: number
}

export interface HeadlessWxShowActionSheetOption extends HeadlessWxCallbackOption<HeadlessWxShowActionSheetResult> {
  itemList: string[]
}

export interface HeadlessWxShowModalResult {
  cancel: boolean
  confirm: boolean
  errMsg: string
}

export interface HeadlessWxShowModalOption extends HeadlessWxCallbackOption<HeadlessWxShowModalResult> {
  cancelColor?: string
  cancelText?: string
  confirmColor?: string
  confirmText?: string
  content: string
  showCancel?: boolean
  title?: string
}

export interface HeadlessWxShowToastOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  duration?: number
  icon?: string
  mask?: boolean
  title: string
}

export interface HeadlessWxShowLoadingOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  mask?: boolean
  title: string
}

export interface HeadlessWxRequestSuccessResult {
  cookies: string[]
  data: unknown
  errMsg: string
  header: Record<string, string>
  statusCode: number
}

export interface HeadlessWxRequestOption extends HeadlessWxCallbackOption<HeadlessWxRequestSuccessResult> {
  data?: unknown
  header?: Record<string, string>
  method?: string
  url: string
}

export interface HeadlessWxRequestTask {
  abort: () => void
}

export interface HeadlessWxDownloadFileSuccessResult {
  errMsg: string
  statusCode: number
  tempFilePath: string
}

export interface HeadlessWxDownloadFileOption extends HeadlessWxCallbackOption<HeadlessWxDownloadFileSuccessResult> {
  filePath?: string
  header?: Record<string, string>
  url: string
}

export interface HeadlessWxUploadFileSuccessResult {
  data: string
  errMsg: string
  statusCode: number
}

export interface HeadlessWxUploadFileOption extends HeadlessWxCallbackOption<HeadlessWxUploadFileSuccessResult> {
  fileName?: string
  filePath: string
  formData?: Record<string, unknown>
  header?: Record<string, string>
  name: string
  url: string
}

export interface HeadlessWxSaveFileSuccessResult {
  errMsg: string
  savedFilePath: string
}

export interface HeadlessWxSaveFileOption extends HeadlessWxCallbackOption<HeadlessWxSaveFileSuccessResult> {
  filePath?: string
  tempFilePath: string
}

export interface HeadlessWxSavedFileInfo {
  createTime: number
  filePath: string
  size: number
}

export interface HeadlessWxGetSavedFileListSuccessResult {
  errMsg: string
  fileList: HeadlessWxSavedFileInfo[]
}

export interface HeadlessWxGetSavedFileListOption extends HeadlessWxCallbackOption<HeadlessWxGetSavedFileListSuccessResult> {}

export interface HeadlessWxGetSavedFileInfoSuccessResult {
  createTime: number
  errMsg: string
  size: number
}

export interface HeadlessWxGetSavedFileInfoOption extends HeadlessWxCallbackOption<HeadlessWxGetSavedFileInfoSuccessResult> {
  filePath: string
}

export interface HeadlessWxRemoveSavedFileOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  filePath: string
}

export interface HeadlessWxFileSystemResult {
  errMsg: string
}

export interface HeadlessWxReadFileSuccessResult {
  data: string
  errMsg: string
}

export interface HeadlessWxReadFileOption extends HeadlessWxCallbackOption<HeadlessWxReadFileSuccessResult> {
  encoding?: string
  filePath: string
}

export interface HeadlessWxWriteFileOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  data: string
  encoding?: string
  filePath: string
}

export interface HeadlessWxAccessFileOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  path: string
}

export interface HeadlessWxAppendFileOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  data: string
  encoding?: string
  filePath: string
}

export interface HeadlessWxUnlinkOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  filePath: string
}

export interface HeadlessWxCopyFileOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  destPath: string
  srcPath: string
}

export interface HeadlessWxRenameOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  newPath: string
  oldPath: string
}

export interface HeadlessWxMkdirOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  dirPath: string
  recursive?: boolean
}

export interface HeadlessWxRmdirOption extends HeadlessWxCallbackOption<HeadlessWxFileSystemResult> {
  dirPath: string
  recursive?: boolean
}

export interface HeadlessWxReadDirSuccessResult {
  errMsg: string
  files: string[]
}

export interface HeadlessWxReadDirOption extends HeadlessWxCallbackOption<HeadlessWxReadDirSuccessResult> {
  dirPath: string
}

export interface HeadlessWxStats {
  isDirectory: () => boolean
  isFile: () => boolean
  size: number
}

export interface HeadlessWxStatSuccessResult {
  errMsg: string
  stats: HeadlessWxStats
}

export interface HeadlessWxStatOption extends HeadlessWxCallbackOption<HeadlessWxStatSuccessResult> {
  path: string
}

export interface HeadlessWxFileSystemManager {
  access: (option: HeadlessWxAccessFileOption) => HeadlessWxFileSystemResult | undefined
  accessSync: (path: string) => void
  appendFile: (option: HeadlessWxAppendFileOption) => HeadlessWxFileSystemResult | undefined
  appendFileSync: (filePath: string, data: string, encoding?: string) => void
  copyFile: (option: HeadlessWxCopyFileOption) => HeadlessWxFileSystemResult | undefined
  copyFileSync: (srcPath: string, destPath: string) => void
  mkdir: (option: HeadlessWxMkdirOption) => HeadlessWxFileSystemResult | undefined
  mkdirSync: (dirPath: string, recursive?: boolean) => void
  readFile: (option: HeadlessWxReadFileOption) => HeadlessWxReadFileSuccessResult | undefined
  readFileSync: (filePath: string, encoding?: string) => string
  readdir: (option: HeadlessWxReadDirOption) => HeadlessWxReadDirSuccessResult | undefined
  readdirSync: (dirPath: string) => string[]
  rmdir: (option: HeadlessWxRmdirOption) => HeadlessWxFileSystemResult | undefined
  rmdirSync: (dirPath: string, recursive?: boolean) => void
  rename: (option: HeadlessWxRenameOption) => HeadlessWxFileSystemResult | undefined
  renameSync: (oldPath: string, newPath: string) => void
  stat: (option: HeadlessWxStatOption) => HeadlessWxStatSuccessResult | undefined
  statSync: (path: string) => HeadlessWxStats
  unlink: (option: HeadlessWxUnlinkOption) => HeadlessWxFileSystemResult | undefined
  unlinkSync: (filePath: string) => void
  writeFile: (option: HeadlessWxWriteFileOption) => HeadlessWxFileSystemResult | undefined
  writeFileSync: (filePath: string, data: string, encoding?: string) => void
}

export interface HeadlessWxDriver {
  createAnimation: (option?: HeadlessWxAnimationStepOption) => HeadlessWxAnimation
  createCanvasContext: (canvasId: string, scope?: Record<string, any>) => HeadlessWxCanvasContext
  createIntersectionObserver: (
    scope: Record<string, any> | undefined,
    options?: HeadlessWxCreateIntersectionObserverOption,
  ) => HeadlessWxIntersectionObserver
  createVideoContext: (videoId: string, scope?: Record<string, any>) => HeadlessWxVideoContext
  executeSelectorQuery: (requests: HeadlessWxSelectorQueryRequest[], scope?: Record<string, any>) => unknown[]
  getAppBaseInfoSync: () => HeadlessWxAppBaseInfoResult
  getFileSystemManager: () => HeadlessWxFileSystemManager
  getSavedFileInfo: (option: HeadlessWxGetSavedFileInfoOption) => HeadlessWxGetSavedFileInfoSuccessResult
  getSavedFileList: (option?: HeadlessWxGetSavedFileListOption) => HeadlessWxGetSavedFileListSuccessResult
  clearStorageSync: () => void
  getEnterOptionsSync: () => HeadlessWxLaunchOptions
  getLaunchOptionsSync: () => HeadlessWxLaunchOptions
  getMenuButtonBoundingClientRect: () => HeadlessWxMenuButtonBoundingClientRectResult
  getNetworkType: () => HeadlessWxGetNetworkTypeResult
  getStorageInfoSync: () => HeadlessWxStorageInfoResult
  getStorageSync: (key: string) => unknown
  getSystemInfoSync: () => HeadlessWxSystemInfoResult
  getWindowInfoSync: () => HeadlessWxWindowInfoResult
  hideLoading: () => { errMsg: string }
  hideToast: () => { errMsg: string }
  downloadFile: (option: HeadlessWxDownloadFileOption) => HeadlessWxRequestTask
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  nextTick: (callback?: () => void) => void
  offNetworkStatusChange: (callback?: HeadlessWxNetworkStatusChangeCallback) => void
  onNetworkStatusChange: (callback: HeadlessWxNetworkStatusChangeCallback) => void
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeStorageSync: (key: string) => void
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestTask
  removeSavedFile: (option: HeadlessWxRemoveSavedFileOption) => { errMsg: string }
  saveFile: (option: HeadlessWxSaveFileOption) => HeadlessWxSaveFileSuccessResult
  setBackgroundColor: (option: HeadlessWxSetBackgroundColorOption) => { errMsg: string }
  setBackgroundTextStyle: (option: HeadlessWxSetBackgroundTextStyleOption) => { errMsg: string }
  setStorageSync: (key: string, value: unknown) => void
  setNavigationBarColor: (option: HeadlessWxSetNavigationBarColorOption) => { errMsg: string }
  setNavigationBarTitle: (option: HeadlessWxSetNavigationBarTitleOption) => { errMsg: string }
  hideShareMenu: () => { errMsg: string }
  hideNavigationBarLoading: () => { errMsg: string }
  hideTabBar: () => { errMsg: string }
  hideTabBarRedDot: (option: HeadlessWxTabBarItemOption) => { errMsg: string }
  showShareMenu: (option: HeadlessWxShareMenuOption) => { errMsg: string }
  showNavigationBarLoading: () => { errMsg: string }
  showTabBar: () => { errMsg: string }
  showTabBarRedDot: (option: HeadlessWxTabBarItemOption) => { errMsg: string }
  showActionSheet: (option: HeadlessWxShowActionSheetOption) => HeadlessWxShowActionSheetResult
  showLoading: (option: HeadlessWxShowLoadingOption) => { errMsg: string }
  showModal: (option: HeadlessWxShowModalOption) => HeadlessWxShowModalResult
  showToast: (option: HeadlessWxShowToastOption) => { errMsg: string }
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
  uploadFile: (option: HeadlessWxUploadFileOption) => HeadlessWxRequestTask
  removeTabBarBadge: (option: HeadlessWxTabBarItemOption) => { errMsg: string }
  setTabBarBadge: (option: HeadlessWxSetTabBarBadgeOption) => { errMsg: string }
  updateShareMenu: (option: HeadlessWxShareMenuOption) => { errMsg: string }
}

export interface HeadlessWx {
  canIUse: (schema: string) => boolean
  clearStorage: (option?: HeadlessWxClearStorageOption) => HeadlessWxStorageResult | undefined
  clearStorageSync: () => void
  createAnimation: (option?: HeadlessWxAnimationStepOption) => HeadlessWxAnimation
  createCanvasContext: (canvasId: string, component?: Record<string, any>) => HeadlessWxCanvasContext
  createIntersectionObserver: (
    component?: Record<string, any>,
    options?: HeadlessWxCreateIntersectionObserverOption,
  ) => HeadlessWxIntersectionObserver
  createVideoContext: (videoId: string, component?: Record<string, any>) => HeadlessWxVideoContext
  createSelectorQuery: () => HeadlessWxSelectorQuery
  getFileSystemManager: () => HeadlessWxFileSystemManager
  getSavedFileInfo: (option: HeadlessWxGetSavedFileInfoOption) => HeadlessWxGetSavedFileInfoSuccessResult | undefined
  getSavedFileList: (option?: HeadlessWxGetSavedFileListOption) => HeadlessWxGetSavedFileListSuccessResult | undefined
  getEnterOptionsSync: () => HeadlessWxLaunchOptions
  getAppBaseInfo: (option?: HeadlessWxGetAppBaseInfoOption) => HeadlessWxAppBaseInfoResult | undefined
  getAppBaseInfoSync: () => HeadlessWxAppBaseInfoResult
  getLaunchOptionsSync: () => HeadlessWxLaunchOptions
  getMenuButtonBoundingClientRect: () => HeadlessWxMenuButtonBoundingClientRectResult
  getNetworkType: (option?: HeadlessWxGetNetworkTypeOption) => HeadlessWxGetNetworkTypeResult | undefined
  getStorageInfo: (option?: HeadlessWxGetStorageInfoOption) => HeadlessWxStorageInfoResult | undefined
  getStorageInfoSync: () => HeadlessWxStorageInfoResult
  getStorage: (option: HeadlessWxGetStorageOption) => HeadlessWxGetStorageResult | undefined
  getStorageSync: (key: string) => unknown
  getSystemInfo: (option?: HeadlessWxGetSystemInfoOption) => HeadlessWxSystemInfoResult | undefined
  getSystemInfoSync: () => HeadlessWxSystemInfoResult
  getWindowInfo: (option?: HeadlessWxGetWindowInfoOption) => HeadlessWxWindowInfoResult | undefined
  getWindowInfoSync: () => HeadlessWxWindowInfoResult
  hideLoading: (option?: HeadlessWxHideLoadingOption) => { errMsg: string } | undefined
  hideToast: () => { errMsg: string }
  downloadFile: (option: HeadlessWxDownloadFileOption) => HeadlessWxRequestTask
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  nextTick: (callback?: () => void) => void
  offNetworkStatusChange: (callback?: HeadlessWxNetworkStatusChangeCallback) => void
  onNetworkStatusChange: (callback: HeadlessWxNetworkStatusChangeCallback) => void
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeSavedFile: (option: HeadlessWxRemoveSavedFileOption) => { errMsg: string } | undefined
  removeStorage: (option: HeadlessWxRemoveStorageOption) => HeadlessWxStorageResult | undefined
  removeStorageSync: (key: string) => void
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestTask
  saveFile: (option: HeadlessWxSaveFileOption) => HeadlessWxSaveFileSuccessResult | undefined
  setBackgroundColor: (option: HeadlessWxSetBackgroundColorOption) => { errMsg: string } | undefined
  setBackgroundTextStyle: (option: HeadlessWxSetBackgroundTextStyleOption) => { errMsg: string } | undefined
  setStorage: (option: HeadlessWxSetStorageOption) => HeadlessWxStorageResult | undefined
  setStorageSync: (key: string, value: unknown) => void
  setNavigationBarColor: (option: HeadlessWxSetNavigationBarColorOption) => { errMsg: string } | undefined
  setNavigationBarTitle: (option: HeadlessWxSetNavigationBarTitleOption) => { errMsg: string } | undefined
  hideShareMenu: (option?: HeadlessWxCallbackOption<{ errMsg: string }>) => { errMsg: string } | undefined
  hideNavigationBarLoading: (option?: HeadlessWxHideNavigationBarLoadingOption) => { errMsg: string } | undefined
  hideTabBar: (option?: HeadlessWxTabBarOption) => { errMsg: string } | undefined
  hideTabBarRedDot: (option: HeadlessWxTabBarItemOption) => { errMsg: string } | undefined
  showShareMenu: (option?: HeadlessWxShareMenuOption) => { errMsg: string } | undefined
  showNavigationBarLoading: (option?: HeadlessWxShowNavigationBarLoadingOption) => { errMsg: string } | undefined
  showTabBar: (option?: HeadlessWxTabBarOption) => { errMsg: string } | undefined
  showTabBarRedDot: (option: HeadlessWxTabBarItemOption) => { errMsg: string } | undefined
  showActionSheet: (option: HeadlessWxShowActionSheetOption) => HeadlessWxShowActionSheetResult | undefined
  showLoading: (option: HeadlessWxShowLoadingOption) => { errMsg: string } | undefined
  showModal: (option: HeadlessWxShowModalOption) => HeadlessWxShowModalResult | undefined
  showToast: (option: HeadlessWxShowToastOption) => { errMsg: string } | undefined
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
  uploadFile: (option: HeadlessWxUploadFileOption) => HeadlessWxRequestTask
  removeTabBarBadge: (option: HeadlessWxTabBarItemOption) => { errMsg: string } | undefined
  setTabBarBadge: (option: HeadlessWxSetTabBarBadgeOption) => { errMsg: string } | undefined
  updateShareMenu: (option?: HeadlessWxShareMenuOption) => { errMsg: string } | undefined
}

function invokeWxApi<TOption extends HeadlessWxCallbackOption<TResult>, TResult>(
  operation: () => TResult,
  option?: TOption,
) {
  try {
    const result = operation()
    option?.success?.(result)
    option?.complete?.(result)
    return result
  }
  catch (error) {
    option?.fail?.(error as Error)
    option?.complete?.()
    return undefined
  }
}

function resolveCapabilityValue(source: Record<string, any>, schema: string) {
  const segments = schema
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean)

  let current: any = source
  for (const segment of segments) {
    if (current == null || !(segment in current)) {
      return undefined
    }
    current = current[segment]
  }
  return current
}

export function createHeadlessWx(driver: HeadlessWxDriver): HeadlessWx {
  const capabilityTree = {
    canIUse: true,
    clearStorage: true,
    clearStorageSync: true,
    createAnimation: true,
    createCanvasContext: true,
    createIntersectionObserver: true,
    createVideoContext: true,
    createSelectorQuery: true,
    getFileSystemManager: true,
    getSavedFileInfo: true,
    getSavedFileList: true,
    getAppBaseInfo: {
      return: {
        SDKVersion: true,
        enableDebug: true,
        host: {
          env: true,
        },
        language: true,
        platform: true,
        version: true,
      },
    },
    getAppBaseInfoSync: {
      return: {
        SDKVersion: true,
        enableDebug: true,
        host: {
          env: true,
        },
        language: true,
        platform: true,
        version: true,
      },
    },
    getEnterOptionsSync: {
      return: {
        path: true,
        query: true,
        referrerInfo: {
          appId: true,
          extraData: true,
        },
        scene: true,
      },
    },
    getLaunchOptionsSync: {
      return: {
        path: true,
        query: true,
        referrerInfo: {
          appId: true,
          extraData: true,
        },
        scene: true,
      },
    },
    getMenuButtonBoundingClientRect: {
      return: {
        bottom: true,
        height: true,
        left: true,
        right: true,
        top: true,
        width: true,
      },
    },
    getNetworkType: {
      return: {
        networkType: true,
      },
    },
    getStorage: true,
    getStorageInfo: {
      return: {
        currentSize: true,
        keys: true,
        limitSize: true,
      },
    },
    getStorageInfoSync: {
      return: {
        currentSize: true,
        keys: true,
        limitSize: true,
      },
    },
    getStorageSync: true,
    getSystemInfo: {
      return: {
        SDKVersion: true,
        brand: true,
        language: true,
        model: true,
        pixelRatio: true,
        platform: true,
        screenHeight: true,
        screenWidth: true,
        system: true,
        version: true,
        windowHeight: true,
        windowWidth: true,
      },
    },
    getSystemInfoSync: {
      return: {
        SDKVersion: true,
        brand: true,
        language: true,
        model: true,
        pixelRatio: true,
        platform: true,
        screenHeight: true,
        screenWidth: true,
        system: true,
        version: true,
        windowHeight: true,
        windowWidth: true,
      },
    },
    getWindowInfo: {
      return: {
        pixelRatio: true,
        screenHeight: true,
        screenWidth: true,
        statusBarHeight: true,
        windowHeight: true,
        windowWidth: true,
      },
    },
    getWindowInfoSync: {
      return: {
        pixelRatio: true,
        screenHeight: true,
        screenWidth: true,
        statusBarHeight: true,
        windowHeight: true,
        windowWidth: true,
      },
    },
    hideLoading: true,
    hideToast: true,
    downloadFile: true,
    navigateBack: true,
    navigateTo: true,
    nextTick: true,
    offNetworkStatusChange: true,
    onNetworkStatusChange: true,
    pageScrollTo: true,
    reLaunch: true,
    redirectTo: true,
    removeStorage: true,
    removeStorageSync: true,
    request: true,
    saveFile: true,
    setBackgroundColor: true,
    setBackgroundTextStyle: true,
    setStorage: true,
    setStorageSync: true,
    setNavigationBarColor: true,
    setNavigationBarTitle: true,
    hideShareMenu: true,
    hideNavigationBarLoading: true,
    hideTabBar: true,
    hideTabBarRedDot: true,
    showShareMenu: true,
    showNavigationBarLoading: true,
    showTabBar: true,
    showTabBarRedDot: true,
    showActionSheet: true,
    showLoading: true,
    showModal: true,
    showToast: true,
    stopPullDownRefresh: true,
    switchTab: true,
    uploadFile: true,
    removeTabBarBadge: true,
    setTabBarBadge: true,
    updateShareMenu: true,
  }

  return {
    canIUse: schema => typeof schema === 'string' && schema.trim() !== '' && resolveCapabilityValue(capabilityTree, schema.trim()) != null,
    clearStorage: option => invokeWxApi(() => {
      driver.clearStorageSync()
      return {
        errMsg: 'clearStorage:ok',
      }
    }, option),
    clearStorageSync: () => driver.clearStorageSync(),
    createAnimation: option => driver.createAnimation(option),
    createCanvasContext: (canvasId, component) => driver.createCanvasContext(canvasId, component),
    createIntersectionObserver: (component, options) => driver.createIntersectionObserver(component, options),
    createVideoContext: (videoId, component) => driver.createVideoContext(videoId, component),
    createSelectorQuery: () => {
      const requests: HeadlessWxSelectorQueryRequest[] = []
      let scope: Record<string, any> | undefined
      const callbacks: Array<(result: any) => void> = []
      let query!: HeadlessWxSelectorQuery

      const createNode = (target: HeadlessWxSelectorQueryRequest['target'], selector?: string, single = true): HeadlessWxSelectorQueryNode => ({
        boundingClientRect: (callback) => {
          requests.push({
            fields: {
              rect: true,
              size: true,
            },
            selector,
            single,
            target,
          })
          if (callback) {
            callbacks.push(callback as (result: Record<string, any> | null) => void)
          }
          return query
        },
        fields: (fields, callback) => {
          requests.push({
            fields: {
              ...fields,
            },
            selector,
            single,
            target,
          })
          if (callback) {
            callbacks.push(callback)
          }
          return query
        },
        scrollOffset: (callback) => {
          requests.push({
            fields: {
              scrollOffset: true,
            },
            selector,
            single,
            target,
          })
          if (callback) {
            callbacks.push(callback as (result: Record<string, any> | null) => void)
          }
          return query
        },
      })

      query = {
        exec: (callback) => {
          const result = driver.executeSelectorQuery(requests, scope)
          for (const [index, item] of result.entries()) {
            callbacks[index]?.(item)
          }
          callback?.(result)
          return result
        },
        in: (component) => {
          scope = component
          return query
        },
        select: selector => createNode('selector', selector, true),
        selectAll: selector => createNode('selector', selector, false),
        selectViewport: () => createNode('viewport', undefined, true),
      }

      return query
    },
    getEnterOptionsSync: () => driver.getEnterOptionsSync(),
    getFileSystemManager: () => driver.getFileSystemManager(),
    getSavedFileInfo: option => invokeWxApi(() => driver.getSavedFileInfo(option), option),
    getSavedFileList: option => invokeWxApi(() => driver.getSavedFileList(option), option),
    getAppBaseInfo: option => invokeWxApi(() => driver.getAppBaseInfoSync(), option),
    getAppBaseInfoSync: () => driver.getAppBaseInfoSync(),
    getLaunchOptionsSync: () => driver.getLaunchOptionsSync(),
    getMenuButtonBoundingClientRect: () => driver.getMenuButtonBoundingClientRect(),
    getNetworkType: option => invokeWxApi(() => driver.getNetworkType(), option),
    getStorageInfo: option => invokeWxApi(() => driver.getStorageInfoSync(), option),
    getStorageInfoSync: () => driver.getStorageInfoSync(),
    getStorage: option => invokeWxApi(() => ({
      data: driver.getStorageSync(option.key),
      errMsg: 'getStorage:ok',
    }), option),
    getStorageSync: key => driver.getStorageSync(key),
    getSystemInfo: option => invokeWxApi(() => driver.getSystemInfoSync(), option),
    getSystemInfoSync: () => driver.getSystemInfoSync(),
    getWindowInfo: option => invokeWxApi(() => driver.getWindowInfoSync(), option),
    getWindowInfoSync: () => driver.getWindowInfoSync(),
    hideLoading: option => invokeWxApi(() => driver.hideLoading(), option),
    hideToast: () => driver.hideToast(),
    downloadFile: option => driver.downloadFile(option),
    navigateBack: option => invokeWxApi(() => {
      driver.navigateBack(option)
    }, option),
    navigateTo: option => invokeWxApi(() => {
      driver.navigateTo(option)
    }, option),
    nextTick: callback => driver.nextTick(callback),
    offNetworkStatusChange: callback => driver.offNetworkStatusChange(callback),
    onNetworkStatusChange: callback => driver.onNetworkStatusChange(callback),
    pageScrollTo: option => invokeWxApi(() => {
      driver.pageScrollTo(option)
    }, option),
    reLaunch: option => invokeWxApi(() => {
      driver.reLaunch(option)
    }, option),
    redirectTo: option => invokeWxApi(() => {
      driver.redirectTo(option)
    }, option),
    removeSavedFile: option => invokeWxApi(() => driver.removeSavedFile(option), option),
    removeStorage: option => invokeWxApi(() => {
      driver.removeStorageSync(option.key)
      return {
        errMsg: 'removeStorage:ok',
      }
    }, option),
    removeStorageSync: key => driver.removeStorageSync(key),
    request: option => driver.request(option),
    saveFile: option => invokeWxApi(() => driver.saveFile(option), option),
    setBackgroundColor: option => invokeWxApi(() => driver.setBackgroundColor(option), option),
    setBackgroundTextStyle: option => invokeWxApi(() => driver.setBackgroundTextStyle(option), option),
    setStorage: option => invokeWxApi(() => {
      driver.setStorageSync(option.key, option.data)
      return {
        errMsg: 'setStorage:ok',
      }
    }, option),
    setStorageSync: (key, value) => driver.setStorageSync(key, value),
    setNavigationBarColor: option => invokeWxApi(() => driver.setNavigationBarColor(option), option),
    setNavigationBarTitle: option => invokeWxApi(() => driver.setNavigationBarTitle(option), option),
    hideShareMenu: option => invokeWxApi(() => driver.hideShareMenu(), option),
    hideNavigationBarLoading: option => invokeWxApi(() => driver.hideNavigationBarLoading(), option),
    hideTabBar: option => invokeWxApi(() => driver.hideTabBar(), option),
    hideTabBarRedDot: option => invokeWxApi(() => driver.hideTabBarRedDot(option), option),
    showShareMenu: option => invokeWxApi(() => driver.showShareMenu(option ?? {}), option),
    showNavigationBarLoading: option => invokeWxApi(() => driver.showNavigationBarLoading(), option),
    showTabBar: option => invokeWxApi(() => driver.showTabBar(), option),
    showTabBarRedDot: option => invokeWxApi(() => driver.showTabBarRedDot(option), option),
    showActionSheet: option => invokeWxApi(() => driver.showActionSheet(option), option),
    showLoading: option => invokeWxApi(() => driver.showLoading(option), option),
    showModal: option => invokeWxApi(() => driver.showModal(option), option),
    showToast: option => invokeWxApi(() => driver.showToast(option), option),
    stopPullDownRefresh: () => driver.stopPullDownRefresh(),
    switchTab: option => invokeWxApi(() => {
      driver.switchTab(option)
    }, option),
    uploadFile: option => driver.uploadFile(option),
    removeTabBarBadge: option => invokeWxApi(() => driver.removeTabBarBadge(option), option),
    setTabBarBadge: option => invokeWxApi(() => driver.setTabBarBadge(option), option),
    updateShareMenu: option => invokeWxApi(() => driver.updateShareMenu(option ?? {}), option),
  }
}
