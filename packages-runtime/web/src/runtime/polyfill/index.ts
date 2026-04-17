import type {
  AdBaseOptions,
  CloudBridge,
  GetExtConfigOptions,
  InterstitialAd,
  LogManager,
  LogManagerOptions,
  MiniProgramAsyncOptions,
  MiniProgramBaseResult,
  RewardedVideoAd,
  SetBackgroundColorOptions,
  SetBackgroundTextStyleOptions,
  UpdateManager,
} from './types'
import { getDefaultMiniProgramRuntimeGlobalKey, getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared'
import { emitRuntimeWarning } from '../warning'
import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
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

const MINI_PROGRAM_GLOBAL_KEYS = getMiniProgramRuntimeGlobalKeys()
const DEFAULT_MINI_PROGRAM_GLOBAL_KEY = getDefaultMiniProgramRuntimeGlobalKey()
const globalTarget = typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>) : {}

function resolveMiniProgramBridge() {
  for (const runtimeGlobalKey of MINI_PROGRAM_GLOBAL_KEYS) {
    const candidate = globalTarget[runtimeGlobalKey]
    if (candidate && typeof candidate === 'object') {
      return candidate as Record<string, unknown>
    }
  }
  const fallback = globalTarget[DEFAULT_MINI_PROGRAM_GLOBAL_KEY]
  if (fallback && typeof fallback === 'object') {
    return fallback as Record<string, unknown>
  }
  return undefined
}

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
  return canIUseBridge(resolveMiniProgramBridge(), schema)
}

const cloudBridge: CloudBridge = createCloudBridge(
  (options, result) => callMiniProgramAsyncSuccess(
    options as unknown as MiniProgramAsyncOptions<MiniProgramBaseResult> | undefined,
    result as MiniProgramBaseResult,
  ),
  (options, errMsg) => callMiniProgramAsyncFailure(
    options as unknown as MiniProgramAsyncOptions<MiniProgramBaseResult> | undefined,
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

if (globalTarget) {
  const miniProgramBridge = (globalTarget[DEFAULT_MINI_PROGRAM_GLOBAL_KEY] as Record<string, unknown> | undefined) ?? {}
  Object.assign(miniProgramBridge, {
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
  const miniProgramEnv = (miniProgramBridge.env as Record<string, unknown> | undefined) ?? {}
  if (typeof miniProgramEnv.USER_DATA_PATH !== 'string' || !miniProgramEnv.USER_DATA_PATH.trim()) {
    miniProgramEnv.USER_DATA_PATH = WEB_USER_DATA_PATH
  }
  miniProgramBridge.env = miniProgramEnv
  for (const runtimeGlobalKey of MINI_PROGRAM_GLOBAL_KEYS) {
    globalTarget[runtimeGlobalKey] = miniProgramBridge
  }
  if (typeof globalTarget.getApp !== 'function') {
    globalTarget.getApp = getAppInstance
  }
  if (typeof globalTarget.getCurrentPages !== 'function') {
    globalTarget.getCurrentPages = getCurrentPagesInternal
  }
}
