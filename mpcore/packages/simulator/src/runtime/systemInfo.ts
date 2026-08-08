import type {
  HeadlessWxAppBaseInfoResult,
  HeadlessWxDeviceInfoResult,
  HeadlessWxGetLocationResult,
  HeadlessWxMenuButtonBoundingClientRectResult,
  HeadlessWxSystemInfoResult,
  HeadlessWxWindowInfoResult,
} from '../host'

export function createDefaultLocationResult(): HeadlessWxGetLocationResult {
  return {
    accuracy: 10,
    altitude: 0,
    errMsg: 'getLocation:ok',
    horizontalAccuracy: 10,
    latitude: 31.2304,
    longitude: 121.4737,
    speed: 0,
    verticalAccuracy: 0,
  }
}

export function createDefaultSystemInfo(): HeadlessWxSystemInfoResult {
  const safeArea = {
    bottom: 667,
    height: 647,
    left: 0,
    right: 375,
    top: 20,
    width: 375,
  }
  return {
    SDKVersion: '0.0.0',
    brand: 'devtools',
    language: 'zh_CN',
    model: 'headless-simulator',
    pixelRatio: 2,
    platform: 'devtools',
    safeArea,
    safeAreaInsets: {
      bottom: 0,
      left: 0,
      right: 0,
      top: 20,
    },
    screenHeight: 667,
    screenWidth: 375,
    system: 'iOS 0.0.0',
    version: '0.0.0',
    windowHeight: 667,
    windowWidth: 375,
  }
}

export function applyResizeToSystemInfo(
  systemInfo: HeadlessWxSystemInfoResult,
  options: Record<string, any>,
) {
  const size = options?.size
  const nextWindowWidth = Number(size?.windowWidth)
  const nextWindowHeight = Number(size?.windowHeight)

  if (Number.isFinite(nextWindowWidth) && nextWindowWidth > 0) {
    systemInfo.windowWidth = nextWindowWidth
    systemInfo.screenWidth = nextWindowWidth
  }

  if (Number.isFinite(nextWindowHeight) && nextWindowHeight > 0) {
    systemInfo.windowHeight = nextWindowHeight
    systemInfo.screenHeight = nextWindowHeight
  }

  systemInfo.safeArea = {
    bottom: systemInfo.windowHeight,
    height: Math.max(0, systemInfo.windowHeight - 20),
    left: 0,
    right: systemInfo.windowWidth,
    top: 20,
    width: systemInfo.windowWidth,
  }
  systemInfo.safeAreaInsets = {
    bottom: 0,
    left: 0,
    right: 0,
    top: 20,
  }

  return systemInfo
}

export function deriveWindowInfo(systemInfo: HeadlessWxSystemInfoResult): HeadlessWxWindowInfoResult {
  return {
    pixelRatio: systemInfo.pixelRatio,
    safeArea: { ...systemInfo.safeArea },
    safeAreaInsets: { ...systemInfo.safeAreaInsets },
    screenHeight: systemInfo.screenHeight,
    screenWidth: systemInfo.screenWidth,
    statusBarHeight: 20,
    windowHeight: systemInfo.windowHeight,
    windowWidth: systemInfo.windowWidth,
  }
}

export function deriveAppBaseInfo(systemInfo: HeadlessWxSystemInfoResult): HeadlessWxAppBaseInfoResult {
  return {
    SDKVersion: systemInfo.SDKVersion,
    enableDebug: false,
    host: {
      env: systemInfo.platform,
    },
    language: systemInfo.language,
    platform: systemInfo.platform,
    version: systemInfo.version,
  }
}

export function deriveDeviceInfo(systemInfo: HeadlessWxSystemInfoResult): HeadlessWxDeviceInfoResult {
  return {
    abi: 'unknown',
    benchmarkLevel: 1,
    brand: systemInfo.brand,
    cpuType: 'unknown',
    deviceAbi: 'unknown',
    memorySize: 4096,
    model: systemInfo.model,
    platform: systemInfo.platform,
    system: systemInfo.system,
  }
}

export function deriveMenuButtonBoundingClientRect(
  systemInfo: HeadlessWxSystemInfoResult,
): HeadlessWxMenuButtonBoundingClientRectResult {
  const width = 87
  const height = 32
  const top = 32
  const right = Math.max(systemInfo.windowWidth - 12, width)
  const left = Math.max(0, right - width)
  const bottom = top + height

  return {
    bottom,
    height,
    left,
    right,
    top,
    width,
  }
}
