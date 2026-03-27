import type {
  HeadlessWxAppBaseInfoResult,
  HeadlessWxSystemInfoResult,
  HeadlessWxWindowInfoResult,
} from '../host'

export function createDefaultSystemInfo(): HeadlessWxSystemInfoResult {
  return {
    SDKVersion: '0.0.0',
    brand: 'devtools',
    language: 'zh_CN',
    model: 'headless-simulator',
    pixelRatio: 2,
    platform: 'devtools',
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

  return systemInfo
}

export function deriveWindowInfo(systemInfo: HeadlessWxSystemInfoResult): HeadlessWxWindowInfoResult {
  return {
    pixelRatio: systemInfo.pixelRatio,
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
