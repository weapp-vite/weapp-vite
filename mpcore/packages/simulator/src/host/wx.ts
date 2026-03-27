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

export interface HeadlessWxSetNavigationBarTitleOption extends HeadlessWxCallbackOption<{ errMsg: string }> {
  title: string
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

export interface HeadlessWxDriver {
  getAppBaseInfoSync: () => HeadlessWxAppBaseInfoResult
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
  setStorageSync: (key: string, value: unknown) => void
  setNavigationBarTitle: (option: HeadlessWxSetNavigationBarTitleOption) => { errMsg: string }
  showLoading: (option: HeadlessWxShowLoadingOption) => { errMsg: string }
  showModal: (option: HeadlessWxShowModalOption) => HeadlessWxShowModalResult
  showToast: (option: HeadlessWxShowToastOption) => { errMsg: string }
  stopPullDownRefresh: () => void
  switchTab: (option: HeadlessWxNavigateOption) => unknown
}

export interface HeadlessWx {
  canIUse: (schema: string) => boolean
  clearStorage: (option?: HeadlessWxClearStorageOption) => HeadlessWxStorageResult | undefined
  clearStorageSync: () => void
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
  navigateBack: (option?: HeadlessWxNavigateBackOption) => unknown
  navigateTo: (option: HeadlessWxNavigateOption) => unknown
  nextTick: (callback?: () => void) => void
  offNetworkStatusChange: (callback?: HeadlessWxNetworkStatusChangeCallback) => void
  onNetworkStatusChange: (callback: HeadlessWxNetworkStatusChangeCallback) => void
  pageScrollTo: (option: HeadlessWxPageScrollToOption) => unknown
  reLaunch: (option: HeadlessWxNavigateOption) => unknown
  redirectTo: (option: HeadlessWxNavigateOption) => unknown
  removeStorage: (option: HeadlessWxRemoveStorageOption) => HeadlessWxStorageResult | undefined
  removeStorageSync: (key: string) => void
  request: (option: HeadlessWxRequestOption) => HeadlessWxRequestTask
  setStorage: (option: HeadlessWxSetStorageOption) => HeadlessWxStorageResult | undefined
  setStorageSync: (key: string, value: unknown) => void
  setNavigationBarTitle: (option: HeadlessWxSetNavigationBarTitleOption) => { errMsg: string } | undefined
  showLoading: (option: HeadlessWxShowLoadingOption) => { errMsg: string } | undefined
  showModal: (option: HeadlessWxShowModalOption) => HeadlessWxShowModalResult | undefined
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
    setStorage: true,
    setStorageSync: true,
    setNavigationBarTitle: true,
    showLoading: true,
    showModal: true,
    showToast: true,
    stopPullDownRefresh: true,
    switchTab: true,
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
    getEnterOptionsSync: () => driver.getEnterOptionsSync(),
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
    removeStorage: option => invokeWxApi(() => {
      driver.removeStorageSync(option.key)
      return {
        errMsg: 'removeStorage:ok',
      }
    }, option),
    removeStorageSync: key => driver.removeStorageSync(key),
    request: option => driver.request(option),
    setStorage: option => invokeWxApi(() => {
      driver.setStorageSync(option.key, option.data)
      return {
        errMsg: 'setStorage:ok',
      }
    }, option),
    setStorageSync: (key, value) => driver.setStorageSync(key, value),
    setNavigationBarTitle: option => invokeWxApi(() => driver.setNavigationBarTitle(option), option),
    showLoading: option => invokeWxApi(() => driver.showLoading(option), option),
    showModal: option => invokeWxApi(() => driver.showModal(option), option),
    showToast: option => invokeWxApi(() => driver.showToast(option), option),
    stopPullDownRefresh: () => driver.stopPullDownRefresh(),
    switchTab: option => invokeWxApi(() => {
      driver.switchTab(option)
    }, option),
  }
}
