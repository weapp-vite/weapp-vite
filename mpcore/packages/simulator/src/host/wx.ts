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
  globalAlpha: number
  lineCap: string
  lineDash: number[]
  lineDashOffset: number
  lineJoin: string
  miterLimit: number
  lineWidth: number
  reserve: boolean
  shadowBlur: number
  shadowColor: string
  shadowOffsetX: number
  shadowOffsetY: number
  strokeStyle: string
  textAlign: string
  textBaseline: string
}

export interface HeadlessWxCanvasContext {
  __getSnapshot: () => HeadlessWxCanvasSnapshot
  arc: (x: number, y: number, r: number, sAngle: number, eAngle: number, counterclockwise?: boolean) => void
  arcTo: (x1: number, y1: number, x2: number, y2: number, radius: number) => void
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) => void
  beginPath: () => void
  clearRect: (x: number, y: number, width: number, height: number) => void
  clip: (fillRule?: string) => void
  closePath: () => void
  draw: (reserve?: boolean, callback?: () => void) => void
  drawImage: (image: string, ...args: number[]) => void
  fill: (fillRule?: string) => void
  fillRect: (x: number, y: number, width: number, height: number) => void
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void
  lineTo: (x: number, y: number) => void
  measureText: (text: string) => { width: number }
  moveTo: (x: number, y: number) => void
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void
  rect: (x: number, y: number, width: number, height: number) => void
  restore: () => void
  rotate: (rotate: number) => void
  save: () => void
  scale: (scaleWidth: number, scaleHeight: number) => void
  setFillStyle: (value: string) => void
  setFontSize: (fontSize: number) => void
  setGlobalAlpha: (value: number) => void
  setLineCap: (value: string) => void
  setLineDash: (pattern: number[], offset?: number) => void
  setLineJoin: (value: string) => void
  setMiterLimit: (value: number) => void
  setLineWidth: (value: number) => void
  setShadow: (offsetX: number, offsetY: number, blur: number, color: string) => void
  setStrokeStyle: (value: string) => void
  setTextAlign: (value: string) => void
  setTextBaseline: (value: string) => void
  stroke: () => void
  strokeRect: (x: number, y: number, width: number, height: number) => void
  strokeText: (text: string, x: number, y: number, maxWidth?: number) => void
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

export interface HeadlessWxSetClipboardDataResult {
  errMsg: string
}

export interface HeadlessWxSetClipboardDataOption extends HeadlessWxCallbackOption<HeadlessWxSetClipboardDataResult> {
  data: string
}

export interface HeadlessWxGetClipboardDataResult {
  data: string
  errMsg: string
}

export interface HeadlessWxGetClipboardDataOption extends HeadlessWxCallbackOption<HeadlessWxGetClipboardDataResult> {}

export interface HeadlessWxGetStorageOption extends HeadlessWxCallbackOption<HeadlessWxGetStorageResult> {
  key: string
}

export interface HeadlessWxGetStorageInfoOption extends HeadlessWxCallbackOption<HeadlessWxStorageInfoResult> {}

export interface HeadlessWxGetNetworkTypeOption extends HeadlessWxCallbackOption<HeadlessWxGetNetworkTypeResult> {}

export interface HeadlessWxGetSystemInfoOption extends HeadlessWxCallbackOption<HeadlessWxSystemInfoResult> {}

export interface HeadlessWxGetWindowInfoOption extends HeadlessWxCallbackOption<HeadlessWxWindowInfoResult> {}

export interface HeadlessWxGetAppBaseInfoOption extends HeadlessWxCallbackOption<HeadlessWxAppBaseInfoResult> {}

export interface HeadlessWxGetImageInfoResult {
  errMsg: string
  height: number
  orientation: 'up'
  path: string
  type: string
  width: number
}

export interface HeadlessWxGetImageInfoOption extends HeadlessWxCallbackOption<HeadlessWxGetImageInfoResult> {
  src: string
}

export interface HeadlessWxGetFileInfoResult {
  digest: string
  errMsg: string
  size: number
}

export interface HeadlessWxGetFileInfoOption extends HeadlessWxCallbackOption<HeadlessWxGetFileInfoResult> {
  digestAlgorithm?: 'md5' | 'sha1'
  filePath: string
}

export interface HeadlessWxOpenDocumentResult {
  errMsg: string
}

export interface HeadlessWxOpenDocumentOption extends HeadlessWxCallbackOption<HeadlessWxOpenDocumentResult> {
  filePath: string
  fileType?: string
  showMenu?: boolean
}

export interface HeadlessWxGetVideoInfoResult {
  bitrate: number
  duration: number
  errMsg: string
  fps: number
  height: number
  orientation: 'up'
  size: number
  type: string
  width: number
}

export interface HeadlessWxGetVideoInfoOption extends HeadlessWxCallbackOption<HeadlessWxGetVideoInfoResult> {
  src: string
}

export interface HeadlessWxRemoveStorageOption extends HeadlessWxCallbackOption<HeadlessWxStorageResult> {
  key: string
}

export interface HeadlessWxClearStorageOption extends HeadlessWxCallbackOption<HeadlessWxStorageResult> {}

export interface HeadlessWxHideLoadingOption extends HeadlessWxCallbackOption<{ errMsg: string }> {}

export interface HeadlessWxStartPullDownRefreshOption extends HeadlessWxCallbackOption<{ errMsg: string }> {}

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

export interface HeadlessWxCanvasToTempFilePathSuccessResult {
  errMsg: string
  tempFilePath: string
}

export interface HeadlessWxCanvasToTempFilePathOption extends HeadlessWxCallbackOption<HeadlessWxCanvasToTempFilePathSuccessResult> {
  canvasId: string
  component?: Record<string, any>
  destHeight?: number
  destWidth?: number
  fileType?: string
  height?: number
  quality?: number
  width?: number
  x?: number
  y?: number
}

export interface HeadlessWxSaveImageToPhotosAlbumResult {
  errMsg: string
}

export interface HeadlessWxSaveImageToPhotosAlbumOption extends HeadlessWxCallbackOption<HeadlessWxSaveImageToPhotosAlbumResult> {
  filePath: string
}

export interface HeadlessWxSaveVideoToPhotosAlbumResult {
  errMsg: string
}

export interface HeadlessWxSaveVideoToPhotosAlbumOption extends HeadlessWxCallbackOption<HeadlessWxSaveVideoToPhotosAlbumResult> {
  filePath: string
}

export interface HeadlessWxPreviewImageResult {
  errMsg: string
}

export interface HeadlessWxPreviewImageOption extends HeadlessWxCallbackOption<HeadlessWxPreviewImageResult> {
  current?: string
  urls: string[]
}

export interface HeadlessWxChooseImageTempFile {
  path: string
  size: number
}

export interface HeadlessWxChooseImageResult {
  errMsg: string
  tempFilePaths: string[]
  tempFiles: HeadlessWxChooseImageTempFile[]
}

export interface HeadlessWxChooseImageOption extends HeadlessWxCallbackOption<HeadlessWxChooseImageResult> {
  count?: number
  sizeType?: string[]
  sourceType?: string[]
}

export interface HeadlessWxChooseMessageFileTempFile {
  name: string
  path: string
  size: number
  time: number
  type: string
}

export interface HeadlessWxChooseMessageFileResult {
  errMsg: string
  tempFiles: HeadlessWxChooseMessageFileTempFile[]
}

export interface HeadlessWxChooseMessageFileOption extends HeadlessWxCallbackOption<HeadlessWxChooseMessageFileResult> {
  count?: number
  extension?: string[]
  type?: 'all' | 'file' | 'image' | 'video'
}

export interface HeadlessWxCompressImageResult {
  errMsg: string
  tempFilePath: string
}

export interface HeadlessWxCompressImageOption extends HeadlessWxCallbackOption<HeadlessWxCompressImageResult> {
  compressedHeight?: number
  compressedWidth?: number
  quality?: number
  src: string
}

export interface HeadlessWxChooseVideoResult {
  duration: number
  errMsg: string
  height: number
  size: number
  tempFilePath: string
  width: number
}

export interface HeadlessWxChooseVideoOption extends HeadlessWxCallbackOption<HeadlessWxChooseVideoResult> {
  camera?: string[]
  compressed?: boolean
  maxDuration?: number
  sourceType?: string[]
}

export interface HeadlessWxChooseMediaTempFile {
  duration?: number
  fileType: 'image' | 'video'
  height: number
  size: number
  tempFilePath: string
  thumbTempFilePath?: string
  width: number
}

export interface HeadlessWxChooseMediaResult {
  errMsg: string
  tempFiles: HeadlessWxChooseMediaTempFile[]
  type: 'image' | 'mix' | 'video'
}

export interface HeadlessWxChooseMediaOption extends HeadlessWxCallbackOption<HeadlessWxChooseMediaResult> {
  camera?: string[]
  count?: number
  maxDuration?: number
  mediaType?: Array<'image' | 'video'>
  sizeType?: string[]
  sourceType?: string[]
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
  chooseImage: (option: HeadlessWxChooseImageOption) => HeadlessWxChooseImageResult
  chooseMessageFile: (option: HeadlessWxChooseMessageFileOption) => HeadlessWxChooseMessageFileResult
  chooseMedia: (option: HeadlessWxChooseMediaOption) => HeadlessWxChooseMediaResult
  chooseVideo: (option: HeadlessWxChooseVideoOption) => HeadlessWxChooseVideoResult
  compressImage: (option: HeadlessWxCompressImageOption) => HeadlessWxCompressImageResult
  createAnimation: (option?: HeadlessWxAnimationStepOption) => HeadlessWxAnimation
  createCanvasContext: (canvasId: string, scope?: Record<string, any>) => HeadlessWxCanvasContext
  canvasToTempFilePath: (option: HeadlessWxCanvasToTempFilePathOption) => HeadlessWxCanvasToTempFilePathSuccessResult
  createIntersectionObserver: (
    scope: Record<string, any> | undefined,
    options?: HeadlessWxCreateIntersectionObserverOption,
  ) => HeadlessWxIntersectionObserver
  createVideoContext: (videoId: string, scope?: Record<string, any>) => HeadlessWxVideoContext
  executeSelectorQuery: (requests: HeadlessWxSelectorQueryRequest[], scope?: Record<string, any>) => unknown[]
  getAppBaseInfoSync: () => HeadlessWxAppBaseInfoResult
  getFileInfo: (option: HeadlessWxGetFileInfoOption) => HeadlessWxGetFileInfoResult
  getImageInfo: (option: HeadlessWxGetImageInfoOption) => HeadlessWxGetImageInfoResult
  getVideoInfo: (option: HeadlessWxGetVideoInfoOption) => HeadlessWxGetVideoInfoResult
  getFileSystemManager: () => HeadlessWxFileSystemManager
  getSavedFileInfo: (option: HeadlessWxGetSavedFileInfoOption) => HeadlessWxGetSavedFileInfoSuccessResult
  getSavedFileList: (option?: HeadlessWxGetSavedFileListOption) => HeadlessWxGetSavedFileListSuccessResult
  clearStorageSync: () => void
  getEnterOptionsSync: () => HeadlessWxLaunchOptions
  getLaunchOptionsSync: () => HeadlessWxLaunchOptions
  getMenuButtonBoundingClientRect: () => HeadlessWxMenuButtonBoundingClientRectResult
  getClipboardData: () => HeadlessWxGetClipboardDataResult
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
  openDocument: (option: HeadlessWxOpenDocumentOption) => HeadlessWxOpenDocumentResult
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeStorageSync: (key: string) => void
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestTask
  previewImage: (option: HeadlessWxPreviewImageOption) => HeadlessWxPreviewImageResult
  removeSavedFile: (option: HeadlessWxRemoveSavedFileOption) => { errMsg: string }
  saveImageToPhotosAlbum: (option: HeadlessWxSaveImageToPhotosAlbumOption) => HeadlessWxSaveImageToPhotosAlbumResult
  saveVideoToPhotosAlbum: (option: HeadlessWxSaveVideoToPhotosAlbumOption) => HeadlessWxSaveVideoToPhotosAlbumResult
  saveFile: (option: HeadlessWxSaveFileOption) => HeadlessWxSaveFileSuccessResult
  setBackgroundColor: (option: HeadlessWxSetBackgroundColorOption) => { errMsg: string }
  setBackgroundTextStyle: (option: HeadlessWxSetBackgroundTextStyleOption) => { errMsg: string }
  setClipboardData: (option: HeadlessWxSetClipboardDataOption) => HeadlessWxSetClipboardDataResult
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
  startPullDownRefresh: () => { errMsg: string }
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
  uploadFile: (option: HeadlessWxUploadFileOption) => HeadlessWxRequestTask
  removeTabBarBadge: (option: HeadlessWxTabBarItemOption) => { errMsg: string }
  setTabBarBadge: (option: HeadlessWxSetTabBarBadgeOption) => { errMsg: string }
  updateShareMenu: (option: HeadlessWxShareMenuOption) => { errMsg: string }
}

export interface HeadlessWx {
  canIUse: (schema: string) => boolean
  chooseImage: (option?: HeadlessWxChooseImageOption) => HeadlessWxChooseImageResult | undefined
  chooseMessageFile: (option?: HeadlessWxChooseMessageFileOption) => HeadlessWxChooseMessageFileResult | undefined
  chooseMedia: (option?: HeadlessWxChooseMediaOption) => HeadlessWxChooseMediaResult | undefined
  chooseVideo: (option?: HeadlessWxChooseVideoOption) => HeadlessWxChooseVideoResult | undefined
  compressImage: (option: HeadlessWxCompressImageOption) => HeadlessWxCompressImageResult | undefined
  clearStorage: (option?: HeadlessWxClearStorageOption) => HeadlessWxStorageResult | undefined
  clearStorageSync: () => void
  canvasToTempFilePath: (option: HeadlessWxCanvasToTempFilePathOption) => HeadlessWxCanvasToTempFilePathSuccessResult | undefined
  createAnimation: (option?: HeadlessWxAnimationStepOption) => HeadlessWxAnimation
  createCanvasContext: (canvasId: string, component?: Record<string, any>) => HeadlessWxCanvasContext
  createIntersectionObserver: (
    component?: Record<string, any>,
    options?: HeadlessWxCreateIntersectionObserverOption,
  ) => HeadlessWxIntersectionObserver
  createVideoContext: (videoId: string, component?: Record<string, any>) => HeadlessWxVideoContext
  createSelectorQuery: () => HeadlessWxSelectorQuery
  getFileInfo: (option: HeadlessWxGetFileInfoOption) => HeadlessWxGetFileInfoResult | undefined
  getImageInfo: (option: HeadlessWxGetImageInfoOption) => HeadlessWxGetImageInfoResult | undefined
  getVideoInfo: (option: HeadlessWxGetVideoInfoOption) => HeadlessWxGetVideoInfoResult | undefined
  getFileSystemManager: () => HeadlessWxFileSystemManager
  getSavedFileInfo: (option: HeadlessWxGetSavedFileInfoOption) => HeadlessWxGetSavedFileInfoSuccessResult | undefined
  getSavedFileList: (option?: HeadlessWxGetSavedFileListOption) => HeadlessWxGetSavedFileListSuccessResult | undefined
  getEnterOptionsSync: () => HeadlessWxLaunchOptions
  getAppBaseInfo: (option?: HeadlessWxGetAppBaseInfoOption) => HeadlessWxAppBaseInfoResult | undefined
  getAppBaseInfoSync: () => HeadlessWxAppBaseInfoResult
  getLaunchOptionsSync: () => HeadlessWxLaunchOptions
  getMenuButtonBoundingClientRect: () => HeadlessWxMenuButtonBoundingClientRectResult
  getClipboardData: (option?: HeadlessWxGetClipboardDataOption) => HeadlessWxGetClipboardDataResult | undefined
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
  openDocument: (option: HeadlessWxOpenDocumentOption) => HeadlessWxOpenDocumentResult | undefined
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  previewImage: (option: HeadlessWxPreviewImageOption) => HeadlessWxPreviewImageResult | undefined
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeSavedFile: (option: HeadlessWxRemoveSavedFileOption) => { errMsg: string } | undefined
  saveImageToPhotosAlbum: (option: HeadlessWxSaveImageToPhotosAlbumOption) => HeadlessWxSaveImageToPhotosAlbumResult | undefined
  saveVideoToPhotosAlbum: (option: HeadlessWxSaveVideoToPhotosAlbumOption) => HeadlessWxSaveVideoToPhotosAlbumResult | undefined
  removeStorage: (option: HeadlessWxRemoveStorageOption) => HeadlessWxStorageResult | undefined
  removeStorageSync: (key: string) => void
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestTask
  saveFile: (option: HeadlessWxSaveFileOption) => HeadlessWxSaveFileSuccessResult | undefined
  setBackgroundColor: (option: HeadlessWxSetBackgroundColorOption) => { errMsg: string } | undefined
  setBackgroundTextStyle: (option: HeadlessWxSetBackgroundTextStyleOption) => { errMsg: string } | undefined
  setClipboardData: (option: HeadlessWxSetClipboardDataOption) => HeadlessWxSetClipboardDataResult | undefined
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
  startPullDownRefresh: (option?: HeadlessWxStartPullDownRefreshOption) => { errMsg: string } | undefined
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
    canvasToTempFilePath: true,
    chooseImage: {
      return: {
        errMsg: true,
        tempFilePaths: true,
        tempFiles: true,
      },
    },
    chooseMessageFile: {
      return: {
        errMsg: true,
        tempFiles: true,
      },
    },
    chooseMedia: {
      return: {
        errMsg: true,
        tempFiles: true,
        type: true,
      },
    },
    chooseVideo: {
      return: {
        duration: true,
        errMsg: true,
        height: true,
        size: true,
        tempFilePath: true,
        width: true,
      },
    },
    compressImage: {
      return: {
        errMsg: true,
        tempFilePath: true,
      },
    },
    clearStorage: true,
    clearStorageSync: true,
    createAnimation: true,
    createCanvasContext: true,
    createIntersectionObserver: true,
    createVideoContext: true,
    createSelectorQuery: true,
    getImageInfo: {
      return: {
        errMsg: true,
        height: true,
        orientation: true,
        path: true,
        type: true,
        width: true,
      },
    },
    getFileInfo: {
      return: {
        digest: true,
        errMsg: true,
        size: true,
      },
    },
    openDocument: {
      return: {
        errMsg: true,
      },
    },
    getVideoInfo: {
      return: {
        bitrate: true,
        duration: true,
        errMsg: true,
        fps: true,
        height: true,
        orientation: true,
        size: true,
        type: true,
        width: true,
      },
    },
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
    getClipboardData: {
      return: {
        data: true,
        errMsg: true,
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
    previewImage: true,
    reLaunch: true,
    redirectTo: true,
    saveImageToPhotosAlbum: true,
    saveVideoToPhotosAlbum: true,
    removeStorage: true,
    removeStorageSync: true,
    request: true,
    saveFile: true,
    setBackgroundColor: true,
    setBackgroundTextStyle: true,
    setClipboardData: true,
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
    startPullDownRefresh: true,
    stopPullDownRefresh: true,
    switchTab: true,
    uploadFile: true,
    removeTabBarBadge: true,
    setTabBarBadge: true,
    updateShareMenu: true,
  }

  return {
    canIUse: schema => typeof schema === 'string' && schema.trim() !== '' && resolveCapabilityValue(capabilityTree, schema.trim()) != null,
    canvasToTempFilePath: option => invokeWxApi(() => driver.canvasToTempFilePath(option), option),
    chooseImage: option => invokeWxApi(() => driver.chooseImage(option ?? {}), option),
    chooseMessageFile: option => invokeWxApi(() => driver.chooseMessageFile(option ?? {}), option),
    chooseMedia: option => invokeWxApi(() => driver.chooseMedia(option ?? {}), option),
    chooseVideo: option => invokeWxApi(() => driver.chooseVideo(option ?? {}), option),
    compressImage: option => invokeWxApi(() => driver.compressImage(option), option),
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
    getFileInfo: option => invokeWxApi(() => driver.getFileInfo(option), option),
    getImageInfo: option => invokeWxApi(() => driver.getImageInfo(option), option),
    getVideoInfo: option => invokeWxApi(() => driver.getVideoInfo(option), option),
    getFileSystemManager: () => driver.getFileSystemManager(),
    getSavedFileInfo: option => invokeWxApi(() => driver.getSavedFileInfo(option), option),
    getSavedFileList: option => invokeWxApi(() => driver.getSavedFileList(option), option),
    getAppBaseInfo: option => invokeWxApi(() => driver.getAppBaseInfoSync(), option),
    getAppBaseInfoSync: () => driver.getAppBaseInfoSync(),
    getLaunchOptionsSync: () => driver.getLaunchOptionsSync(),
    getClipboardData: option => invokeWxApi(() => driver.getClipboardData(), option),
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
    openDocument: option => invokeWxApi(() => driver.openDocument(option), option),
    pageScrollTo: option => invokeWxApi(() => {
      driver.pageScrollTo(option)
    }, option),
    previewImage: option => invokeWxApi(() => driver.previewImage(option), option),
    reLaunch: option => invokeWxApi(() => {
      driver.reLaunch(option)
    }, option),
    redirectTo: option => invokeWxApi(() => {
      driver.redirectTo(option)
    }, option),
    removeSavedFile: option => invokeWxApi(() => driver.removeSavedFile(option), option),
    saveImageToPhotosAlbum: option => invokeWxApi(() => driver.saveImageToPhotosAlbum(option), option),
    saveVideoToPhotosAlbum: option => invokeWxApi(() => driver.saveVideoToPhotosAlbum(option), option),
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
    setClipboardData: option => invokeWxApi(() => driver.setClipboardData(option), option),
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
    startPullDownRefresh: option => invokeWxApi(() => driver.startPullDownRefresh(), option),
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
