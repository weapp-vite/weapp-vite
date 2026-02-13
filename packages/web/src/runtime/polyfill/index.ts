import type {
  AdBaseOptions,
  CloudBridge,
  GetExtConfigOptions,
  InterstitialAd,
  LogManager,
  LogManagerOptions,
  RewardedVideoAd,
  SetBackgroundColorOptions,
  SetBackgroundTextStyleOptions,
  UpdateManager,
  WxAsyncOptions,
  WxBaseResult,
} from './types'
import { emitRuntimeWarning } from '../warning'
import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  setBackgroundColorBridge,
  setBackgroundTextStyleBridge,
} from './background'
import { createCloudBridge } from './cloud'
import * as deviceAuthSystemApi from './deviceAuthSystemApi'
import { WEB_USER_DATA_PATH } from './files'
import { createNavigationBarRuntimeBridge } from './navigationBarRuntime'
import {
  createInterstitialAdBridge,
  createRewardedVideoAdBridge,
  getExtConfigBridge,
  getExtConfigSyncBridge,
  getLogManagerBridge,
  getUpdateManagerBridge,
  reportAnalyticsBridge,
} from './platformApi'
import {
  getAppInstance,
  getCurrentPagesInternal,
  getEnterOptionsSync,
  getLaunchOptionsSync,
  navigateBack,
  navigateTo,
  redirectTo,
  reLaunch,
  switchTab,
} from './routeRuntime'
import {
  canIUseBridge,
} from './runtimeCapabilityApi'
import * as runtimeDataApi from './runtimeDataApi'
import * as uiMediaApi from './uiMediaApi'

export * from './deviceAuthSystemApi'

export {
  getEnterOptionsSync,
  getLaunchOptionsSync,
  initializePageRoutes,
  navigateBack,
  navigateTo,
  redirectTo,
  registerApp,
  registerComponent,
  registerPage,
  reLaunch,
  switchTab,
} from './routeRuntime'

export * from './runtimeDataApi'
export * from './uiMediaApi'

const navigationBarRuntimeBridge = createNavigationBarRuntimeBridge(
  () => getCurrentPagesInternal() as Array<HTMLElement & { renderRoot?: ShadowRoot | HTMLElement }>,
  emitRuntimeWarning,
)

export function setNavigationBarTitle(options: { title: string }) {
  return navigationBarRuntimeBridge.setNavigationBarTitle(options)
}

export function setNavigationBarColor(options: {
  frontColor?: string
  backgroundColor?: string
  animation?: { duration?: number, timingFunction?: string }
}) {
  return navigationBarRuntimeBridge.setNavigationBarColor(options)
}

export function showNavigationBarLoading() {
  return navigationBarRuntimeBridge.showNavigationBarLoading()
}

export function hideNavigationBarLoading() {
  return navigationBarRuntimeBridge.hideNavigationBarLoading()
}

export function setBackgroundColor(options?: SetBackgroundColorOptions) {
  return setBackgroundColorBridge(options)
}

export function setBackgroundTextStyle(options?: SetBackgroundTextStyleOptions) {
  return setBackgroundTextStyleBridge(options)
}

export function canIUse(schema: string) {
  return canIUseBridge(globalTarget.wx as Record<string, unknown> | undefined, schema)
}

const cloudBridge: CloudBridge = createCloudBridge(
  (options, result) => callWxAsyncSuccess(
    options as unknown as WxAsyncOptions<WxBaseResult> | undefined,
    result as WxBaseResult,
  ),
  (options, errMsg) => callWxAsyncFailure(
    options as unknown as WxAsyncOptions<WxBaseResult> | undefined,
    errMsg,
  ),
) as CloudBridge

export function createRewardedVideoAd(options?: AdBaseOptions): RewardedVideoAd {
  return createRewardedVideoAdBridge(options)
}

export function createInterstitialAd(options?: AdBaseOptions): InterstitialAd {
  return createInterstitialAdBridge(options)
}

export function getExtConfigSync() {
  return getExtConfigSyncBridge()
}

export function getExtConfig(options?: GetExtConfigOptions) {
  return getExtConfigBridge(options)
}

export function getUpdateManager(): UpdateManager {
  return getUpdateManagerBridge()
}

export function getLogManager(options?: LogManagerOptions): LogManager {
  return getLogManagerBridge(options)
}

export function reportAnalytics(eventName: string, data?: Record<string, unknown>) {
  reportAnalyticsBridge(eventName, data)
}

const globalTarget = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {}

if (globalTarget) {
  const wxBridge = (globalTarget.wx as Record<string, unknown> | undefined) ?? {}
  Object.assign(wxBridge, {
    navigateTo,
    navigateBack,
    redirectTo,
    switchTab,
    reLaunch,
    getLaunchOptionsSync,
    getEnterOptionsSync,
    ...runtimeDataApi,
    setNavigationBarTitle,
    setNavigationBarColor,
    setBackgroundColor,
    setBackgroundTextStyle,
    showNavigationBarLoading,
    hideNavigationBarLoading,
    ...uiMediaApi,
    ...deviceAuthSystemApi,
    createRewardedVideoAd,
    createInterstitialAd,
    getExtConfigSync,
    getExtConfig,
    getUpdateManager,
    getLogManager,
    reportAnalytics,
    canIUse,
    cloud: cloudBridge,
  })
  const wxEnv = (wxBridge.env as Record<string, unknown> | undefined) ?? {}
  if (typeof wxEnv.USER_DATA_PATH !== 'string' || !wxEnv.USER_DATA_PATH.trim()) {
    wxEnv.USER_DATA_PATH = WEB_USER_DATA_PATH
  }
  wxBridge.env = wxEnv
  globalTarget.wx = wxBridge
  if (typeof globalTarget.getApp !== 'function') {
    globalTarget.getApp = getAppInstance
  }
  if (typeof globalTarget.getCurrentPages !== 'function') {
    globalTarget.getCurrentPages = getCurrentPagesInternal
  }
}
