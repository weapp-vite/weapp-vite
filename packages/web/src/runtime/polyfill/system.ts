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
  const raw = navigatorWithUAData.userAgentData?.platform
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
