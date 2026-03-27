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

export interface HeadlessWxSetStorageOption extends HeadlessWxCallbackOption<HeadlessWxStorageResult> {
  data: unknown
  key: string
}

export interface HeadlessWxGetStorageOption extends HeadlessWxCallbackOption<HeadlessWxGetStorageResult> {
  key: string
}

export interface HeadlessWxGetStorageInfoOption extends HeadlessWxCallbackOption<HeadlessWxStorageInfoResult> {}

export interface HeadlessWxGetSystemInfoOption extends HeadlessWxCallbackOption<HeadlessWxSystemInfoResult> {}

export interface HeadlessWxRemoveStorageOption extends HeadlessWxCallbackOption<HeadlessWxStorageResult> {
  key: string
}

export interface HeadlessWxClearStorageOption extends HeadlessWxCallbackOption<HeadlessWxStorageResult> {}

export interface HeadlessWxHideLoadingOption extends HeadlessWxCallbackOption<{ errMsg: string }> {}

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

export interface HeadlessWxDriver {
  clearStorageSync: () => void
  getStorageInfoSync: () => HeadlessWxStorageInfoResult
  getStorageSync: (key: string) => unknown
  getSystemInfoSync: () => HeadlessWxSystemInfoResult
  hideLoading: () => { errMsg: string }
  hideToast: () => { errMsg: string }
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  nextTick: (callback?: () => void) => void
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeStorageSync: (key: string) => void
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestSuccessResult
  setStorageSync: (key: string, value: unknown) => void
  showLoading: (option: HeadlessWxShowLoadingOption) => { errMsg: string }
  showToast: (option: HeadlessWxShowToastOption) => { errMsg: string }
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
}

export interface HeadlessWx {
  clearStorage: (option?: HeadlessWxClearStorageOption) => HeadlessWxStorageResult | undefined
  clearStorageSync: () => void
  getStorageInfo: (option?: HeadlessWxGetStorageInfoOption) => HeadlessWxStorageInfoResult | undefined
  getStorageInfoSync: () => HeadlessWxStorageInfoResult
  getStorage: (option: HeadlessWxGetStorageOption) => HeadlessWxGetStorageResult | undefined
  getStorageSync: (key: string) => unknown
  getSystemInfo: (option?: HeadlessWxGetSystemInfoOption) => HeadlessWxSystemInfoResult | undefined
  getSystemInfoSync: () => HeadlessWxSystemInfoResult
  hideLoading: (option?: HeadlessWxHideLoadingOption) => { errMsg: string } | undefined
  hideToast: () => { errMsg: string }
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  nextTick: (callback?: () => void) => void
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeStorage: (option: HeadlessWxRemoveStorageOption) => HeadlessWxStorageResult | undefined
  removeStorageSync: (key: string) => void
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestTask
  setStorage: (option: HeadlessWxSetStorageOption) => HeadlessWxStorageResult | undefined
  setStorageSync: (key: string, value: unknown) => void
  showLoading: (option: HeadlessWxShowLoadingOption) => { errMsg: string } | undefined
  showToast: (option: HeadlessWxShowToastOption) => { errMsg: string } | undefined
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
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

export function createHeadlessWx(driver: HeadlessWxDriver): HeadlessWx {
  return {
    clearStorage: option => invokeWxApi(() => {
      driver.clearStorageSync()
      return {
        errMsg: 'clearStorage:ok',
      }
    }, option),
    clearStorageSync: () => driver.clearStorageSync(),
    getStorageInfo: option => invokeWxApi(() => driver.getStorageInfoSync(), option),
    getStorageInfoSync: () => driver.getStorageInfoSync(),
    getStorage: option => invokeWxApi(() => ({
      data: driver.getStorageSync(option.key),
      errMsg: 'getStorage:ok',
    }), option),
    getStorageSync: key => driver.getStorageSync(key),
    getSystemInfo: option => invokeWxApi(() => driver.getSystemInfoSync(), option),
    getSystemInfoSync: () => driver.getSystemInfoSync(),
    hideLoading: option => invokeWxApi(() => driver.hideLoading(), option),
    hideToast: () => driver.hideToast(),
    navigateBack: option => invokeWxApi(() => {
      driver.navigateBack(option)
    }, option),
    navigateTo: option => invokeWxApi(() => {
      driver.navigateTo(option)
    }, option),
    nextTick: callback => driver.nextTick(callback),
    pageScrollTo: option => invokeWxApi(() => {
      driver.pageScrollTo(option)
    }, option),
    reLaunch: option => invokeWxApi(() => {
      driver.reLaunch(option)
    }, option),
    redirectTo: option => invokeWxApi(() => {
      driver.redirectTo(option)
    }, option),
    removeStorage: option => invokeWxApi(() => {
      driver.removeStorageSync(option.key)
      return {
        errMsg: 'removeStorage:ok',
      }
    }, option),
    removeStorageSync: key => driver.removeStorageSync(key),
    request: (option) => {
      invokeWxApi(() => driver.request(option), option)
      return {
        abort() {},
      }
    },
    setStorage: option => invokeWxApi(() => {
      driver.setStorageSync(option.key, option.data)
      return {
        errMsg: 'setStorage:ok',
      }
    }, option),
    setStorageSync: (key, value) => driver.setStorageSync(key, value),
    showLoading: option => invokeWxApi(() => driver.showLoading(option), option),
    showToast: option => invokeWxApi(() => driver.showToast(option), option),
    stopPullDownRefresh: () => driver.stopPullDownRefresh(),
    switchTab: option => invokeWxApi(() => {
      driver.switchTab(option)
    }, option),
  }
}
