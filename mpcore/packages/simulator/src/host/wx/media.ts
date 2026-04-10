import type {
  HeadlessWxAnimation,
  HeadlessWxAnimationStepOption,
  HeadlessWxAppBaseInfoResult,
  HeadlessWxCallbackOption,
  HeadlessWxCanvasContext,
  HeadlessWxCreateIntersectionObserverOption,
  HeadlessWxGetClipboardDataResult,
  HeadlessWxGetNetworkTypeResult,
  HeadlessWxIntersectionObserver,
  HeadlessWxLaunchOptions,
  HeadlessWxMenuButtonBoundingClientRectResult,
  HeadlessWxNavigateBackOption,
  HeadlessWxNavigateOption,
  HeadlessWxNetworkStatusChangeCallback,
  HeadlessWxPageScrollToOption,
  HeadlessWxSelectorQueryRequest,
  HeadlessWxSetClipboardDataOption,
  HeadlessWxSetClipboardDataResult,
  HeadlessWxStorageInfoResult,
  HeadlessWxStorageResult,
  HeadlessWxSystemInfoResult,
  HeadlessWxVideoContext,
  HeadlessWxWindowInfoResult,
} from './core'

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

export interface HeadlessWxDriverCapabilities {
  clearStorageSync: () => void
  createAnimation: (option?: HeadlessWxAnimationStepOption) => HeadlessWxAnimation
  createCanvasContext: (canvasId: string, scope?: Record<string, any>) => HeadlessWxCanvasContext
  createIntersectionObserver: (
    scope: Record<string, any> | undefined,
    options?: HeadlessWxCreateIntersectionObserverOption,
  ) => HeadlessWxIntersectionObserver
  createVideoContext: (videoId: string, scope?: Record<string, any>) => HeadlessWxVideoContext
  executeSelectorQuery: (requests: HeadlessWxSelectorQueryRequest[], scope?: Record<string, any>) => unknown[]
  getAppBaseInfoSync: () => HeadlessWxAppBaseInfoResult
  getClipboardData: () => HeadlessWxGetClipboardDataResult
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
  hideNavigationBarLoading: () => { errMsg: string }
  hideShareMenu: () => { errMsg: string }
  hideTabBar: () => { errMsg: string }
  hideTabBarRedDot: (option: HeadlessWxTabBarItemOption) => { errMsg: string }
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  nextTick: (callback?: () => void) => void
  offNetworkStatusChange: (callback?: HeadlessWxNetworkStatusChangeCallback) => void
  onNetworkStatusChange: (callback: HeadlessWxNetworkStatusChangeCallback) => void
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeStorageSync: (key: string) => void
  setStorageSync: (key: string, value: unknown) => void
  setBackgroundColor: (option: HeadlessWxSetBackgroundColorOption) => { errMsg: string }
  setBackgroundTextStyle: (option: HeadlessWxSetBackgroundTextStyleOption) => { errMsg: string }
  setClipboardData: (option: HeadlessWxSetClipboardDataOption) => HeadlessWxSetClipboardDataResult
  setNavigationBarColor: (option: HeadlessWxSetNavigationBarColorOption) => { errMsg: string }
  setNavigationBarTitle: (option: HeadlessWxSetNavigationBarTitleOption) => { errMsg: string }
  showActionSheet: (option: HeadlessWxShowActionSheetOption) => HeadlessWxShowActionSheetResult
  showLoading: (option: HeadlessWxShowLoadingOption) => { errMsg: string }
  showModal: (option: HeadlessWxShowModalOption) => HeadlessWxShowModalResult
  showNavigationBarLoading: () => { errMsg: string }
  showShareMenu: (option: HeadlessWxShareMenuOption) => { errMsg: string }
  showTabBar: () => { errMsg: string }
  showTabBarRedDot: (option: HeadlessWxTabBarItemOption) => { errMsg: string }
  showToast: (option: HeadlessWxShowToastOption) => { errMsg: string }
  startPullDownRefresh: () => { errMsg: string }
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
  removeTabBarBadge: (option: HeadlessWxTabBarItemOption) => { errMsg: string }
  setTabBarBadge: (option: HeadlessWxSetTabBarBadgeOption) => { errMsg: string }
  updateShareMenu: (option: HeadlessWxShareMenuOption) => { errMsg: string }
}
