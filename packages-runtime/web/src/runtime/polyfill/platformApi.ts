import {
  createInterstitialAdImpl,
  createRewardedVideoAdImpl,
} from './ad'
import { callWxAsyncSuccess, scheduleMicrotask } from './async'
import {
  createLogManagerBridge,
  createUpdateManagerBridge,
  readExtConfigValue,
  readRuntimeConsole,
  reportAnalyticsEvent,
  resolveUpdateManagerPreset,
} from './platformRuntime'

export function createRewardedVideoAdBridge(options?: any): any {
  return createRewardedVideoAdImpl(options)
}

export function createInterstitialAdBridge(options?: any): any {
  return createInterstitialAdImpl(options)
}

export function getExtConfigSyncBridge() {
  return readExtConfigValue()
}

export function getExtConfigBridge(options?: any): Promise<any> {
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'getExtConfig:ok',
    extConfig: getExtConfigSyncBridge(),
  }))
}

export function getUpdateManagerBridge() {
  return createUpdateManagerBridge(resolveUpdateManagerPreset, scheduleMicrotask)
}

export function getLogManagerBridge(options?: any) {
  const level = options?.level === 0 ? 0 : 1
  return createLogManagerBridge(level, readRuntimeConsole())
}

export function reportAnalyticsBridge(eventName: string, data?: Record<string, unknown>) {
  reportAnalyticsEvent(eventName, data)
}
