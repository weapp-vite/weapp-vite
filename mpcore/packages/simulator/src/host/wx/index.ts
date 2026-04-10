import type { HeadlessWx, HeadlessWxDriver } from './api'
import type {
  HeadlessWxCallbackOption,
  HeadlessWxSelectorQuery,
  HeadlessWxSelectorQueryNode,
  HeadlessWxSelectorQueryRequest,
} from './core'

export * from './api'
export * from './core'
export * from './fileSystem'
export * from './media'

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
    chooseImage: { return: { errMsg: true, tempFilePaths: true, tempFiles: true } },
    chooseMessageFile: { return: { errMsg: true, tempFiles: true } },
    chooseMedia: { return: { errMsg: true, tempFiles: true, type: true } },
    chooseVideo: { return: { duration: true, errMsg: true, height: true, size: true, tempFilePath: true, width: true } },
    compressImage: { return: { errMsg: true, tempFilePath: true } },
    clearStorage: true,
    clearStorageSync: true,
    createAnimation: true,
    createCanvasContext: true,
    createIntersectionObserver: true,
    createVideoContext: true,
    createSelectorQuery: true,
    getImageInfo: { return: { errMsg: true, height: true, orientation: true, path: true, type: true, width: true } },
    getFileInfo: { return: { digest: true, errMsg: true, size: true } },
    openDocument: { return: { errMsg: true } },
    getVideoInfo: { return: { bitrate: true, duration: true, errMsg: true, fps: true, height: true, orientation: true, size: true, type: true, width: true } },
    getFileSystemManager: true,
    getSavedFileInfo: true,
    getSavedFileList: true,
    getAppBaseInfo: { return: { SDKVersion: true, enableDebug: true, host: { env: true }, language: true, platform: true, version: true } },
    getAppBaseInfoSync: { return: { SDKVersion: true, enableDebug: true, host: { env: true }, language: true, platform: true, version: true } },
    getEnterOptionsSync: { return: { path: true, query: true, referrerInfo: { appId: true, extraData: true }, scene: true } },
    getLaunchOptionsSync: { return: { path: true, query: true, referrerInfo: { appId: true, extraData: true }, scene: true } },
    getClipboardData: { return: { data: true, errMsg: true } },
    getMenuButtonBoundingClientRect: { return: { bottom: true, height: true, left: true, right: true, top: true, width: true } },
    getNetworkType: { return: { networkType: true } },
    getStorage: true,
    getStorageInfo: { return: { currentSize: true, keys: true, limitSize: true } },
    getStorageInfoSync: { return: { currentSize: true, keys: true, limitSize: true } },
    getStorageSync: true,
    getSystemInfo: { return: { SDKVersion: true, brand: true, language: true, model: true, pixelRatio: true, platform: true, screenHeight: true, screenWidth: true, system: true, version: true, windowHeight: true, windowWidth: true } },
    getSystemInfoSync: { return: { SDKVersion: true, brand: true, language: true, model: true, pixelRatio: true, platform: true, screenHeight: true, screenWidth: true, system: true, version: true, windowHeight: true, windowWidth: true } },
    getWindowInfo: { return: { pixelRatio: true, screenHeight: true, screenWidth: true, statusBarHeight: true, windowHeight: true, windowWidth: true } },
    getWindowInfoSync: { return: { pixelRatio: true, screenHeight: true, screenWidth: true, statusBarHeight: true, windowHeight: true, windowWidth: true } },
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
    clearStorage: option => invokeWxApi(() => ({ errMsg: (driver.clearStorageSync(), 'clearStorage:ok') }), option),
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
          requests.push({ fields: { rect: true, size: true }, selector, single, target })
          if (callback) {
            callbacks.push(callback as (result: Record<string, any> | null) => void)
          }
          return query
        },
        fields: (fields, callback) => {
          requests.push({ fields: { ...fields }, selector, single, target })
          if (callback) {
            callbacks.push(callback)
          }
          return query
        },
        scrollOffset: (callback) => {
          requests.push({ fields: { scrollOffset: true }, selector, single, target })
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
    getStorage: option => invokeWxApi(() => ({ data: driver.getStorageSync(option.key), errMsg: 'getStorage:ok' }), option),
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
      return { errMsg: 'removeStorage:ok' }
    }, option),
    removeStorageSync: key => driver.removeStorageSync(key),
    request: option => driver.request(option),
    saveFile: option => invokeWxApi(() => driver.saveFile(option), option),
    setBackgroundColor: option => invokeWxApi(() => driver.setBackgroundColor(option), option),
    setBackgroundTextStyle: option => invokeWxApi(() => driver.setBackgroundTextStyle(option), option),
    setClipboardData: option => invokeWxApi(() => driver.setClipboardData(option), option),
    setStorage: option => invokeWxApi(() => {
      driver.setStorageSync(option.key, option.data)
      return { errMsg: 'setStorage:ok' }
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
