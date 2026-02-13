import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  buildMenuButtonRect,
  buildWindowInfoSnapshot,
  readDeviceMemorySize,
  readSystemInfoSnapshot,
  resolveAccountAppId,
  resolveDeviceOrientation,
  resolveRuntimeTheme,
} from './system'

export function getSystemInfoSyncBridge() {
  return readSystemInfoSnapshot()
}

export function getSystemInfoBridge(options?: any): Promise<any> {
  try {
    const info = getSystemInfoSyncBridge()
    return Promise.resolve(callWxAsyncSuccess(options, {
      errMsg: 'getSystemInfo:ok',
      ...info,
    }))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `getSystemInfo:fail ${message}`)
    return Promise.reject(failure)
  }
}

export function getWindowInfoBridge() {
  return buildWindowInfoSnapshot(getSystemInfoSyncBridge())
}

export function getDeviceInfoBridge() {
  const systemInfo = getSystemInfoSyncBridge()
  return {
    brand: systemInfo.brand,
    model: systemInfo.model,
    system: systemInfo.system,
    platform: systemInfo.platform,
    memorySize: readDeviceMemorySize(),
    benchmarkLevel: -1,
    abi: 'web',
    deviceOrientation: resolveDeviceOrientation(),
  }
}

export function getAccountInfoSyncBridge() {
  const appId = resolveAccountAppId()
  return {
    miniProgram: {
      appId,
      envVersion: 'develop',
      version: '0.0.0-web',
    },
    plugin: {},
  }
}

export function getAppBaseInfoBridge() {
  const systemInfo = getSystemInfoSyncBridge()
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  return {
    SDKVersion: 'web',
    language: runtimeNavigator?.language ?? 'en',
    version: runtimeNavigator?.appVersion ?? runtimeNavigator?.userAgent ?? 'web',
    platform: systemInfo.platform,
    enableDebug: false,
    theme: resolveRuntimeTheme(),
  }
}

export function getMenuButtonBoundingClientRectBridge() {
  const { windowWidth, statusBarHeight } = getSystemInfoSyncBridge()
  return buildMenuButtonRect(windowWidth, statusBarHeight)
}
