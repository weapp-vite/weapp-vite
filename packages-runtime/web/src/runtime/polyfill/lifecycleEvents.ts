import { emitRuntimeWarning } from '../warning'

type Listener = (...args: any[]) => void

const listeners = new Map<string, Set<Listener>>()

function on(eventName: string, handler?: Listener) {
  if (typeof handler !== 'function') {
    return
  }
  const bucket = listeners.get(eventName) ?? new Set<Listener>()
  bucket.add(handler)
  listeners.set(eventName, bucket)
}

function off(eventName: string, handler?: Listener) {
  const bucket = listeners.get(eventName)
  if (!bucket) {
    return
  }
  if (handler) {
    bucket.delete(handler)
  }
  else {
    bucket.clear()
  }
  if (bucket.size === 0) {
    listeners.delete(eventName)
  }
}

/**
 * 触发所有已注册的监听器。单个监听器抛错不应影响其它监听器与调用方。
 */
export function emitLifecycleEvent(eventName: string, payload?: unknown) {
  const bucket = listeners.get(eventName)
  if (!bucket) {
    return
  }
  for (const handler of [...bucket]) {
    try {
      handler(payload)
    }
    catch (error) {
      emitRuntimeWarning(`[weapp-vite] ${eventName} listener threw`, { error })
    }
  }
}

/**
 * 小程序把启动期错误回调注册在 `app.onError` 上，web 端没有对应入口，
 * 这里用 window 的 error / unhandledrejection 事件驱动，保持回调语义。
 */
export function onError(handler?: Listener) {
  on('error', handler)
}

export function offError(handler?: Listener) {
  off('error', handler)
}

export function onUnhandledRejection(handler?: Listener) {
  on('unhandledRejection', handler)
}

export function offUnhandledRejection(handler?: Listener) {
  off('unhandledRejection', handler)
}

export function onThemeChange(handler?: Listener) {
  on('themeChange', handler)
}

export function offThemeChange(handler?: Listener) {
  off('themeChange', handler)
}

let installed = false

/**
 * 把浏览器侧的全局错误转成小程序回调。重复调用只注册一次。
 */
export function installErrorBridges() {
  if (installed || typeof window === 'undefined') {
    return
  }
  installed = true
  window.addEventListener('error', (event) => {
    emitLifecycleEvent('error', { message: event.message, stack: event.error?.stack })
  })
  window.addEventListener('unhandledrejection', (event) => {
    emitLifecycleEvent('unhandledRejection', { reason: event.reason })
  })
  const media = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : undefined
  media?.addEventListener?.('change', (event) => {
    emitLifecycleEvent('themeChange', { theme: event.matches ? 'dark' : 'light' })
  })
}

/**
 * 性能上报在小程序里依赖平台能力，web 端没有可对齐的数据源，
 * 保留为可调用的 no-op，避免 `onLaunch` 里调用即中断启动流程。
 */
export function reportEvent(...args: any[]) {
  emitRuntimeWarning(`[weapp-vite] wx.reportEvent 在 web 端为空实现，已忽略：${args.length} 个参数`, {
    key: 'reportEvent',
  })
}
