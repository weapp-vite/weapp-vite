import type { InternalRuntimeState } from '../types'
import { WEVU_CURRENT_SETUP_STATE_KEY, WEVU_HOOKS_KEY } from '@weapp-core/constants'
import { getCurrentMiniProgramGlobalObject, getCurrentMiniProgramRuntimeCapabilities, getMiniProgramRuntimeGlobalObject, supportsCurrentMiniProgramRuntimeCapability } from '../platform'

// 仅供同步 setup() 调用期间使用的当前实例引用。wevu 的根入口与
// `wevu/router` 可能被打包成多个模块副本，必须通过宿主全局共享状态。
interface CurrentSetupState {
  instance?: InternalRuntimeState
  context?: any
}

const currentSetupState: CurrentSetupState = (() => {
  // Web 会在模块加载后安装宿主 API；可用时优先使用稳定的执行域全局，
  // 防止不同入口因导入时机不同而持有两份 setup 状态。
  const host = typeof globalThis !== 'undefined'
    ? globalThis as Record<string, any>
    : getMiniProgramRuntimeGlobalObject()
  return host ? host[WEVU_CURRENT_SETUP_STATE_KEY] ??= {} : {}
})()

export function getCurrentInstance<T extends InternalRuntimeState = InternalRuntimeState>(): T | undefined {
  return currentSetupState.instance as T | undefined
}

/**
 * 设置当前运行时实例（框架内部使用）。
 * @internal
 */
export function setCurrentInstance(inst: InternalRuntimeState | undefined) {
  currentSetupState.instance = inst
}

export function getCurrentSetupContext<T = any>(): T | undefined {
  return currentSetupState.context as T | undefined
}

/**
 * 设置当前 setup 上下文（框架内部使用）。
 * @internal
 */
export function setCurrentSetupContext(ctx: any | undefined) {
  currentSetupState.context = ctx
}

export function assertInSetup(name: string): InternalRuntimeState {
  if (!currentSetupState.instance) {
    throw new Error(`${name}() 必须在 setup() 的同步阶段调用`)
  }
  return currentSetupState.instance
}

function ensureHookBucket(target: InternalRuntimeState): Record<string, any> {
  if (!target[WEVU_HOOKS_KEY]) {
    target[WEVU_HOOKS_KEY] = Object.create(null)
  }
  return target[WEVU_HOOKS_KEY] as Record<string, any>
}

type ShareMenuName = 'shareAppMessage' | 'shareTimeline'

function buildShareMenus(
  enableOnShareAppMessage: boolean,
  enableOnShareTimeline: boolean,
): ShareMenuName[] {
  const runtimeCapabilities = getCurrentMiniProgramRuntimeCapabilities()
  const shouldShowShareAppMessage = runtimeCapabilities.shareTimelineRequiresShareAppMessage
    ? (enableOnShareAppMessage || enableOnShareTimeline)
    : enableOnShareAppMessage

  const menus: ShareMenuName[] = []
  if (shouldShowShareAppMessage) {
    menus.push('shareAppMessage')
  }
  if (enableOnShareTimeline) {
    menus.push('shareTimeline')
  }
  return menus
}

function tryShowShareMenu(showShareMenu: (...args: any[]) => unknown, menus: ShareMenuName[]) {
  const payloads = [
    { withShareTicket: true, menus },
    { menus },
    menus.includes('shareTimeline') ? { withShareTicket: true } : undefined,
    menus.includes('shareTimeline') ? {} : undefined,
    undefined,
  ]

  for (const payload of payloads) {
    try {
      if (payload === undefined) {
        showShareMenu()
      }
      else {
        showShareMenu(payload as any)
      }
      return
    }
    catch {
      // 继续尝试更保守的 payload，兼容不同宿主的 showShareMenu 参数形态。
    }
  }
}

export function pushHook(
  target: InternalRuntimeState,
  name: string,
  handler: (...args: any[]) => any,
  { single = false } = {},
) {
  const bucket = ensureHookBucket(target)
  if (single) {
    bucket[name] = handler
  }
  else {
    const list: Array<(...args: any[]) => any> = bucket[name] ?? (bucket[name] = [])
    list.push(handler)
  }
}

export function ensureSinglePageHookOnInstance(target: InternalRuntimeState, name: 'onShareAppMessage' | 'onShareTimeline' | 'onAddToFavorites') {
  const bridges = ((target as any).__wevuShareHookBridges ??= Object.create(null)) as Record<string, (...args: any[]) => any>
  if (typeof bridges[name] === 'function') {
    return
  }

  const original = (target as any)[name]
  const bridge = function onWevuShareHookBridge(this: InternalRuntimeState, ...args: any[]) {
    const hooks = this[WEVU_HOOKS_KEY] as Record<string, any> | undefined
    const entry = hooks?.[name]
    const runtime = this.__wevu
    const ctx = runtime?.proxy ?? this
    let ret: any

    if (typeof entry === 'function') {
      try {
        ret = entry.apply(ctx, args)
      }
      catch {
        ret = undefined
      }
    }
    else if (Array.isArray(entry)) {
      for (const fn of entry) {
        try {
          ret = fn.apply(ctx, args)
        }
        catch {
          // 忽略单个 hook 抛出的异常，继续执行后续 hook
        }
      }
    }

    if (ret !== undefined) {
      return ret
    }
    if (typeof original === 'function') {
      return original.apply(this, args)
    }
    return undefined
  }

  bridges[name] = bridge
  ;(target as any)[name] = bridge
}

export function ensurePageShareMenusOnSetup(target: InternalRuntimeState) {
  if (!supportsCurrentMiniProgramRuntimeCapability('pageShareMenu')) {
    return
  }
  const miniProgramGlobal = getCurrentMiniProgramGlobalObject()
  if (!miniProgramGlobal || typeof miniProgramGlobal.showShareMenu !== 'function') {
    return
  }

  const hooks = (target[WEVU_HOOKS_KEY] ?? {}) as Record<string, any>
  const hasShareAppMessage = typeof hooks.onShareAppMessage === 'function'
  const hasShareTimeline = typeof hooks.onShareTimeline === 'function'

  if (!hasShareAppMessage && !hasShareTimeline) {
    return
  }

  const menus = buildShareMenus(hasShareAppMessage, hasShareTimeline)
  if (!menus.length) {
    return
  }

  tryShowShareMenu(miniProgramGlobal.showShareMenu.bind(miniProgramGlobal), menus)
}

/**
 * 调用批量 hook（框架内部调度入口）。
 * @internal
 */
export function callHookList(target: InternalRuntimeState, name: string, args: any[] = []) {
  const hooks = target[WEVU_HOOKS_KEY]
  if (!hooks) {
    return
  }
  const list = hooks[name]
  if (!list) {
    return
  }
  const runtime = target.__wevu
  const ctx = runtime?.proxy ?? target
  if (Array.isArray(list)) {
    for (const fn of list) {
      try {
        fn.apply(ctx, args)
      }
      catch {
        // 忽略单个 hook 抛出的异常，防止阻塞其他监听
      }
    }
  }
  else if (typeof list === 'function') {
    try {
      list.apply(ctx, args)
    }
    catch {
      // 忽略单个 hook 抛出的异常，防止阻塞其他监听
    }
  }
}

/**
 * 调用返回值型 hook（框架内部调度入口）。
 * @internal
 */
export function callHookReturn(target: InternalRuntimeState, name: string, args: any[] = []) {
  const hooks = target[WEVU_HOOKS_KEY]
  if (!hooks) {
    return undefined
  }
  const entry = hooks[name]
  if (!entry) {
    return undefined
  }
  const runtime = target.__wevu
  const ctx = runtime?.proxy ?? target
  if (typeof entry === 'function') {
    try {
      return entry.apply(ctx, args)
    }
    catch {
      return undefined
    }
  }
  if (Array.isArray(entry)) {
    let out: any
    for (const fn of entry) {
      try {
        out = fn.apply(ctx, args)
      }
      catch {
        // 忽略单个 hook 抛出的异常，继续执行后续 hook
      }
    }
    return out
  }
  return undefined
}
