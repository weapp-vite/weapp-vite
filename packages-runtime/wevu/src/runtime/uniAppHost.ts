export type UniAppEventHandler = (...args: any[]) => void

interface UniAppEventListener {
  handler: UniAppEventHandler
  original: UniAppEventHandler
}

interface UniAppSafeArea {
  bottom?: number
  left?: number
  right?: number
  top?: number
}

interface UniAppSystemInfo {
  language?: string
  safeArea?: UniAppSafeArea
  safeAreaInsets?: UniAppSafeArea
  screenHeight?: number
  screenWidth?: number
  windowHeight?: number
  windowWidth?: number
  [key: string]: any
}

type UniAppHost = Record<string, any>

const eventListeners = new Map<string, Set<UniAppEventListener>>()
const hostAdapters = new WeakMap<object, UniAppHost>()

function normalizeDimension(value: unknown, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : fallback
}

function normalizeLocale(locale: unknown) {
  const normalized = String(locale || 'en').trim().replace('_', '-').toLowerCase()
  if (
    normalized === 'zh-tw'
    || normalized === 'zh-hk'
    || normalized === 'zh-mo'
    || normalized.startsWith('zh-hant')
  ) {
    return 'zh-Hant'
  }
  if (normalized.startsWith('zh')) {
    return 'zh-Hans'
  }
  return normalized.split('-')[0] || 'en'
}

function withSafeAreaInsets(info: UniAppSystemInfo = {}) {
  if (info.safeAreaInsets) {
    return info
  }
  const windowWidth = normalizeDimension(info.windowWidth, normalizeDimension(info.screenWidth))
  const windowHeight = normalizeDimension(info.windowHeight, normalizeDimension(info.screenHeight))
  const screenWidth = normalizeDimension(info.screenWidth, windowWidth)
  const screenHeight = normalizeDimension(info.screenHeight, windowHeight)
  const safeArea = info.safeArea ?? {
    bottom: windowHeight,
    left: 0,
    right: windowWidth,
    top: 0,
  }
  return {
    ...info,
    safeArea,
    safeAreaInsets: {
      bottom: Math.max(0, screenHeight - normalizeDimension(safeArea.bottom, windowHeight)),
      left: normalizeDimension(safeArea.left),
      right: Math.max(0, screenWidth - normalizeDimension(safeArea.right, windowWidth)),
      top: normalizeDimension(safeArea.top),
    },
  }
}

function $on(eventName: string, handler: UniAppEventHandler) {
  if (typeof eventName !== 'string' || typeof handler !== 'function') {
    return
  }
  const listeners = eventListeners.get(eventName) ?? new Set<UniAppEventListener>()
  listeners.add({ handler, original: handler })
  eventListeners.set(eventName, listeners)
}

function $off(eventName?: string, handler?: UniAppEventHandler) {
  if (eventName === undefined) {
    eventListeners.clear()
    return
  }
  if (typeof eventName !== 'string') {
    return
  }
  if (typeof handler !== 'function') {
    eventListeners.delete(eventName)
    return
  }
  const listeners = eventListeners.get(eventName)
  if (!listeners) {
    return
  }
  for (const listener of listeners) {
    if (listener.original === handler || listener.handler === handler) {
      listeners.delete(listener)
    }
  }
  if (listeners.size === 0) {
    eventListeners.delete(eventName)
  }
}

function $once(eventName: string, handler: UniAppEventHandler) {
  if (typeof eventName !== 'string' || typeof handler !== 'function') {
    return
  }
  const onceHandler: UniAppEventHandler = (...args) => {
    $off(eventName, handler)
    handler(...args)
  }
  const listeners = eventListeners.get(eventName) ?? new Set<UniAppEventListener>()
  listeners.add({ handler: onceHandler, original: handler })
  eventListeners.set(eventName, listeners)
}

function $emit(eventName: string, ...args: any[]) {
  const listeners = eventListeners.get(eventName)
  if (!listeners) {
    return
  }
  for (const { handler } of [...listeners]) {
    handler(...args)
  }
}

/**
 * 在原生小程序宿主上补齐 uni-app 专属 API，并保持未适配 API 继续继承宿主实现。
 */
export function createUniAppHost(host: UniAppHost): UniAppHost {
  const cached = hostAdapters.get(host)
  if (cached) {
    return cached
  }
  const uni = Object.create(host) as UniAppHost
  hostAdapters.set(host, uni)
  const getSystemInfoSnapshot = () => withSafeAreaInsets(host.getSystemInfoSync?.() ?? {})

  Object.assign(uni, {
    $emit,
    $off,
    $on,
    $once,
    getLocale() {
      if (typeof host.getLocale === 'function') {
        return normalizeLocale(host.getLocale())
      }
      const language = host.getAppBaseInfo?.().language ?? getSystemInfoSnapshot().language
      return normalizeLocale(language)
    },
    getSystemInfoSync: getSystemInfoSnapshot,
    getWindowInfo() {
      return withSafeAreaInsets(host.getWindowInfo?.() ?? getSystemInfoSnapshot())
    },
    rpx2px(value: number) {
      const width = normalizeDimension(getSystemInfoSnapshot().windowWidth)
      return Number.isFinite(value) && width > 0 ? value * width / 750 : 0
    },
  })

  return uni
}
