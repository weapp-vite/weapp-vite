function createUnsupportedWxApi(name: string) {
  return () => {
    throw new Error(`wx.${name} is not implemented in headless runtime yet.`)
  }
}

interface HeadlessWxCallbackOption {
  complete?: () => void
  fail?: (error: Error) => void
  success?: () => void
}

export interface HeadlessWxNavigateOption {
  url: string
  complete?: () => void
  fail?: (error: Error) => void
  success?: () => void
}

export interface HeadlessWxNavigateBackOption {
  delta?: number
  complete?: () => void
  fail?: (error: Error) => void
  success?: () => void
}

export interface HeadlessWxPageScrollToOption {
  scrollTop?: number
  duration?: number
  selector?: string
  success?: () => void
  fail?: (error: Error) => void
  complete?: () => void
}

export interface HeadlessWxDriver {
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
}

export interface HeadlessWx {
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
}

function invokeWxApi<TOption extends HeadlessWxCallbackOption>(operation: () => unknown, option?: TOption) {
  try {
    const result = operation()
    option?.success?.()
    option?.complete?.()
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
    navigateBack: option => invokeWxApi(() => driver.navigateBack(option), option),
    navigateTo: option => invokeWxApi(() => driver.navigateTo(option), option),
    pageScrollTo: option => invokeWxApi(() => driver.pageScrollTo(option), option),
    reLaunch: option => invokeWxApi(() => driver.reLaunch(option), option),
    redirectTo: option => invokeWxApi(() => driver.redirectTo(option), option),
    stopPullDownRefresh: () => driver.stopPullDownRefresh(),
    switchTab: option => invokeWxApi(() => driver.switchTab(option), option),
  }
}
