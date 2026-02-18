export function resolveSystemName(userAgent: string) {
  if (/android/i.test(userAgent)) {
    return 'Android'
  }
  if (/iphone|ipad|ipod/i.test(userAgent)) {
    return 'iOS'
  }
  if (/windows/i.test(userAgent)) {
    return 'Windows'
  }
  if (/mac os x/i.test(userAgent)) {
    return 'macOS'
  }
  if (/linux/i.test(userAgent)) {
    return 'Linux'
  }
  return 'Unknown'
}

export function resolvePlatformName(
  userAgent: string,
  runtimeNavigator: Navigator | undefined,
) {
  const navigatorWithUAData = runtimeNavigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const raw = navigatorWithUAData?.userAgentData?.platform
    ?? runtimeNavigator?.platform
    ?? resolveSystemName(userAgent)
  const normalized = raw.toLowerCase()
  if (normalized.includes('android')) {
    return 'android'
  }
  if (normalized.includes('iphone') || normalized.includes('ipad') || normalized.includes('ios')) {
    return 'ios'
  }
  if (normalized.includes('win')) {
    return 'windows'
  }
  if (normalized.includes('mac')) {
    return 'mac'
  }
  if (normalized.includes('linux')) {
    return 'linux'
  }
  return normalized || 'web'
}

export function normalizePositiveNumber(value: number | undefined, fallback: number) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return fallback
  }
  return value
}

export function resolveDeviceOrientation(): 'portrait' | 'landscape' {
  const runtimeWindow = (typeof window !== 'undefined'
    ? window
    : globalThis) as {
    innerWidth?: number
    innerHeight?: number
  }
  const width = normalizePositiveNumber(runtimeWindow.innerWidth, 0)
  const height = normalizePositiveNumber(runtimeWindow.innerHeight, 0)
  if (width > 0 && height > 0 && width > height) {
    return 'landscape'
  }
  return 'portrait'
}

export function normalizeMemorySize(memory: unknown) {
  if (typeof memory !== 'number' || Number.isNaN(memory) || memory <= 0) {
    return 0
  }
  return Math.round(memory * 1024)
}

export function resolveRuntimeTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  catch {
    return 'light'
  }
}

export function readSystemInfoSnapshot() {
  const runtimeWindow = (typeof window !== 'undefined'
    ? window
    : globalThis) as {
    innerWidth?: number
    innerHeight?: number
    devicePixelRatio?: number
  }
  const runtimeScreen = (typeof screen !== 'undefined'
    ? screen
    : globalThis) as {
    width?: number
    height?: number
  }
  const runtimeNavigator = typeof navigator !== 'undefined' ? navigator : undefined
  const userAgent = runtimeNavigator?.userAgent ?? ''
  const windowWidth = normalizePositiveNumber(
    runtimeWindow.innerWidth,
    normalizePositiveNumber(runtimeScreen.width, 0),
  )
  const windowHeight = normalizePositiveNumber(
    runtimeWindow.innerHeight,
    normalizePositiveNumber(runtimeScreen.height, 0),
  )
  const screenWidth = normalizePositiveNumber(runtimeScreen.width, windowWidth)
  const screenHeight = normalizePositiveNumber(runtimeScreen.height, windowHeight)

  return {
    brand: 'web',
    model: runtimeNavigator?.platform ?? 'web',
    pixelRatio: normalizePositiveNumber(runtimeWindow.devicePixelRatio, 1),
    screenWidth,
    screenHeight,
    windowWidth,
    windowHeight,
    statusBarHeight: 0,
    language: runtimeNavigator?.language ?? 'en',
    version: runtimeNavigator?.appVersion ?? userAgent,
    system: resolveSystemName(userAgent),
    platform: resolvePlatformName(userAgent, runtimeNavigator),
  }
}

export function buildWindowInfoSnapshot(systemInfo: {
  pixelRatio: number
  screenWidth: number
  screenHeight: number
  windowWidth: number
  windowHeight: number
  statusBarHeight: number
}) {
  const safeArea = {
    left: 0,
    right: systemInfo.windowWidth,
    top: systemInfo.statusBarHeight,
    bottom: systemInfo.windowHeight,
    width: systemInfo.windowWidth,
    height: Math.max(0, systemInfo.windowHeight - systemInfo.statusBarHeight),
  }
  return {
    pixelRatio: systemInfo.pixelRatio,
    screenWidth: systemInfo.screenWidth,
    screenHeight: systemInfo.screenHeight,
    windowWidth: systemInfo.windowWidth,
    windowHeight: systemInfo.windowHeight,
    statusBarHeight: systemInfo.statusBarHeight,
    screenTop: systemInfo.statusBarHeight,
    safeArea,
  }
}

export function readDeviceMemorySize() {
  const runtimeNavigator = (typeof navigator !== 'undefined' ? navigator : undefined) as (Navigator & {
    deviceMemory?: number
  }) | undefined
  return normalizeMemorySize(runtimeNavigator?.deviceMemory)
}

export function resolveAccountAppId() {
  const runtimeLocation = (typeof location !== 'undefined' ? location : undefined) as {
    hostname?: string
  } | undefined
  const host = runtimeLocation?.hostname?.trim()
  return host ? `web:${host}` : 'web'
}

export function buildMenuButtonRect(windowWidth: number, statusBarHeight: number) {
  const width = 88
  const height = 32
  const right = Math.max(width, windowWidth - 8)
  const top = Math.max(0, statusBarHeight + (44 - height) / 2)
  const left = Math.max(0, right - width)
  return {
    width,
    height,
    top,
    right,
    bottom: top + height,
    left,
  }
}
