import type {
  HeadlessWxAnimation,
  HeadlessWxAnimationStepOption,
  HeadlessWxAppBaseInfoResult,
  HeadlessWxCallbackOption,
  HeadlessWxCanvasContext,
  HeadlessWxCreateIntersectionObserverOption,
  HeadlessWxGetAppBaseInfoOption,
  HeadlessWxGetClipboardDataOption,
  HeadlessWxGetClipboardDataResult,
  HeadlessWxGetNetworkTypeOption,
  HeadlessWxGetNetworkTypeResult,
  HeadlessWxGetStorageInfoOption,
  HeadlessWxGetStorageOption,
  HeadlessWxGetStorageResult,
  HeadlessWxGetSystemInfoOption,
  HeadlessWxGetWindowInfoOption,
  HeadlessWxIntersectionObserver,
  HeadlessWxLaunchOptions,
  HeadlessWxMenuButtonBoundingClientRectResult,
  HeadlessWxNavigateBackOption,
  HeadlessWxNavigateOption,
  HeadlessWxNetworkStatusChangeCallback,
  HeadlessWxPageScrollToOption,
  HeadlessWxSelectorQuery,
  HeadlessWxSetClipboardDataOption,
  HeadlessWxSetClipboardDataResult,
  HeadlessWxSetStorageOption,
  HeadlessWxStorageInfoResult,
  HeadlessWxStorageResult,
  HeadlessWxSystemInfoResult,
  HeadlessWxVideoContext,
  HeadlessWxWindowInfoResult,
} from './core'
import type { HeadlessWxFileSystemManager } from './fileSystem'
import type {
  HeadlessWxCanvasToTempFilePathOption,
  HeadlessWxCanvasToTempFilePathSuccessResult,
  HeadlessWxChooseImageOption,
  HeadlessWxChooseImageResult,
  HeadlessWxChooseMediaOption,
  HeadlessWxChooseMediaResult,
  HeadlessWxChooseMessageFileOption,
  HeadlessWxChooseMessageFileResult,
  HeadlessWxChooseVideoOption,
  HeadlessWxChooseVideoResult,
  HeadlessWxClearStorageOption,
  HeadlessWxCompressImageOption,
  HeadlessWxCompressImageResult,
  HeadlessWxDownloadFileOption,
  HeadlessWxDriverCapabilities,
  HeadlessWxGetFileInfoOption,
  HeadlessWxGetFileInfoResult,
  HeadlessWxGetImageInfoOption,
  HeadlessWxGetImageInfoResult,
  HeadlessWxGetSavedFileInfoOption,
  HeadlessWxGetSavedFileInfoSuccessResult,
  HeadlessWxGetSavedFileListOption,
  HeadlessWxGetSavedFileListSuccessResult,
  HeadlessWxGetVideoInfoOption,
  HeadlessWxGetVideoInfoResult,
  HeadlessWxHideLoadingOption,

  HeadlessWxHideNavigationBarLoadingOption,
  HeadlessWxOpenDocumentOption,
  HeadlessWxOpenDocumentResult,
  HeadlessWxPreviewImageOption,
  HeadlessWxPreviewImageResult,
  HeadlessWxRemoveSavedFileOption,
  HeadlessWxRemoveStorageOption,
  HeadlessWxRequestOption,
  HeadlessWxRequestTask,
  HeadlessWxSaveFileOption,
  HeadlessWxSaveFileSuccessResult,
  HeadlessWxSaveImageToPhotosAlbumOption,
  HeadlessWxSaveImageToPhotosAlbumResult,
  HeadlessWxSaveVideoToPhotosAlbumOption,
  HeadlessWxSaveVideoToPhotosAlbumResult,
  HeadlessWxSetBackgroundColorOption,
  HeadlessWxSetBackgroundTextStyleOption,
  HeadlessWxSetNavigationBarColorOption,
  HeadlessWxSetNavigationBarTitleOption,
  HeadlessWxSetTabBarBadgeOption,
  HeadlessWxShareMenuOption,
  HeadlessWxShowActionSheetOption,
  HeadlessWxShowActionSheetResult,
  HeadlessWxShowLoadingOption,
  HeadlessWxShowModalOption,
  HeadlessWxShowModalResult,
  HeadlessWxShowNavigationBarLoadingOption,
  HeadlessWxShowToastOption,
  HeadlessWxStartPullDownRefreshOption,
  HeadlessWxTabBarItemOption,
  HeadlessWxTabBarOption,
  HeadlessWxUploadFileOption,
} from './media'

export interface HeadlessWxDriver extends HeadlessWxDriverCapabilities {
  chooseImage: (option: HeadlessWxChooseImageOption) => HeadlessWxChooseImageResult
  chooseMessageFile: (option: HeadlessWxChooseMessageFileOption) => HeadlessWxChooseMessageFileResult
  chooseMedia: (option: HeadlessWxChooseMediaOption) => HeadlessWxChooseMediaResult
  chooseVideo: (option: HeadlessWxChooseVideoOption) => HeadlessWxChooseVideoResult
  compressImage: (option: HeadlessWxCompressImageOption) => HeadlessWxCompressImageResult
  getFileInfo: (option: HeadlessWxGetFileInfoOption) => HeadlessWxGetFileInfoResult
  getImageInfo: (option: HeadlessWxGetImageInfoOption) => HeadlessWxGetImageInfoResult
  getVideoInfo: (option: HeadlessWxGetVideoInfoOption) => HeadlessWxGetVideoInfoResult
  getFileSystemManager: () => HeadlessWxFileSystemManager
  getSavedFileInfo: (option: HeadlessWxGetSavedFileInfoOption) => HeadlessWxGetSavedFileInfoSuccessResult
  getSavedFileList: (option?: HeadlessWxGetSavedFileListOption) => HeadlessWxGetSavedFileListSuccessResult
  downloadFile: (option: HeadlessWxDownloadFileOption) => HeadlessWxRequestTask
  openDocument: (option: HeadlessWxOpenDocumentOption) => HeadlessWxOpenDocumentResult
  previewImage: (option: HeadlessWxPreviewImageOption) => HeadlessWxPreviewImageResult
  removeSavedFile: (option: HeadlessWxRemoveSavedFileOption) => { errMsg: string }
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestTask
  saveFile: (option: HeadlessWxSaveFileOption) => HeadlessWxSaveFileSuccessResult
  saveImageToPhotosAlbum: (option: HeadlessWxSaveImageToPhotosAlbumOption) => HeadlessWxSaveImageToPhotosAlbumResult
  saveVideoToPhotosAlbum: (option: HeadlessWxSaveVideoToPhotosAlbumOption) => HeadlessWxSaveVideoToPhotosAlbumResult
  canvasToTempFilePath: (option: HeadlessWxCanvasToTempFilePathOption) => HeadlessWxCanvasToTempFilePathSuccessResult
  uploadFile: (option: HeadlessWxUploadFileOption) => HeadlessWxRequestTask
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
