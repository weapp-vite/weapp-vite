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

export interface HeadlessWxShowToastOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  duration?: number
  icon?: string
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
  getStorageSync: (key: string) => unknown
  hideToast: () => { errMsg: string }
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeStorageSync: (key: string) => void
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestSuccessResult
  setStorageSync: (key: string, value: unknown) => void
  showToast: (option: HeadlessWxShowToastOption) => { errMsg: string }
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
}

export interface HeadlessWx {
  clearStorageSync: () => void
  getStorageSync: (key: string) => unknown
  hideToast: () => { errMsg: string }
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeStorageSync: (key: string) => void
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestTask
  setStorageSync: (key: string, value: unknown) => void
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
    clearStorageSync: () => driver.clearStorageSync(),
    getStorageSync: key => driver.getStorageSync(key),
    hideToast: () => driver.hideToast(),
    navigateBack: option => invokeWxApi(() => {
      driver.navigateBack(option)
    }, option),
    navigateTo: option => invokeWxApi(() => {
      driver.navigateTo(option)
    }, option),
    pageScrollTo: option => invokeWxApi(() => {
      driver.pageScrollTo(option)
    }, option),
    reLaunch: option => invokeWxApi(() => {
      driver.reLaunch(option)
    }, option),
    redirectTo: option => invokeWxApi(() => {
      driver.redirectTo(option)
    }, option),
    removeStorageSync: key => driver.removeStorageSync(key),
    request: (option) => {
      invokeWxApi(() => driver.request(option), option)
      return {
        abort() {},
      }
    },
    setStorageSync: (key, value) => driver.setStorageSync(key, value),
    showToast: option => invokeWxApi(() => driver.showToast(option), option),
    stopPullDownRefresh: () => driver.stopPullDownRefresh(),
    switchTab: option => invokeWxApi(() => {
      driver.switchTab(option)
    }, option),
  }
}
