import type { InternalRuntimeState } from '../types'
import { WEVU_HOOKS_KEY } from '@weapp-core/constants'
import { getCurrentMiniProgramRuntimeCapabilities, getMiniProgramGlobalObject, supportsCurrentMiniProgramRuntimeCapability } from '../platform'

// 仅供同步 setup() 调用期间使用的当前实例引用
let __currentInstance: InternalRuntimeState | undefined
let __currentSetupContext: any | undefined

export function getCurrentInstance<T extends InternalRuntimeState = InternalRuntimeState>(): T | undefined {
  return __currentInstance as T | undefined
}

/**
 * 设置当前运行时实例（框架内部使用）。
 * @internal
 */
export function setCurrentInstance(inst: InternalRuntimeState | undefined) {
  __currentInstance = inst
}

export function getCurrentSetupContext<T = any>(): T | undefined {
  return __currentSetupContext as T | undefined
}

/**
 * 设置当前 setup 上下文（框架内部使用）。
 * @internal
 */
export function setCurrentSetupContext(ctx: any | undefined) {
  __currentSetupContext = ctx
}

export function assertInSetup(name: string): InternalRuntimeState {
  if (!__currentInstance) {
    throw new Error(`${name}() 必须在 setup() 的同步阶段调用`)
  }
  return __currentInstance
}

function ensureHookBucket(target: InternalRuntimeState): Record<string, any> {
  if (!target[WEVU_HOOKS_KEY]) {
    target[WEVU_HOOKS_KEY] = Object.create(null)
  }
  return target[WEVU_HOOKS_KEY] as Record<string, any>
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
  const wxGlobal = getMiniProgramGlobalObject()
  if (!wxGlobal || typeof wxGlobal.showShareMenu !== 'function') {
    return
  }

  const hooks = (target[WEVU_HOOKS_KEY] ?? {}) as Record<string, any>
  const hasShareAppMessage = typeof hooks.onShareAppMessage === 'function'
  const hasShareTimeline = typeof hooks.onShareTimeline === 'function'

  if (!hasShareAppMessage && !hasShareTimeline) {
    return
  }

  const runtimeCapabilities = getCurrentMiniProgramRuntimeCapabilities()
  const menus: Array<'shareAppMessage' | 'shareTimeline'> = []
  if (hasShareAppMessage || (runtimeCapabilities.shareTimelineRequiresShareAppMessage && hasShareTimeline)) {
    menus.push('shareAppMessage')
  }
  if (hasShareTimeline) {
    menus.push('shareTimeline')
  }

  try {
    wxGlobal.showShareMenu({
      withShareTicket: true,
      menus,
    } as any)
  }
  catch {
    // 忽略平台差异导致的菜单能力异常，避免影响页面主流程
  }
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

export function ensurePageHookOnInstance(target: InternalRuntimeState, name: 'onPageScroll') {
  const bridges = ((target as any).__wevuPageHookBridges ??= Object.create(null)) as Record<string, (...args: any[]) => any>
  if (typeof bridges[name] === 'function') {
    return
  }

  const original = (target as any)[name]
  const bridge = function onWevuPageHookBridge(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, name, args)
    if (typeof original === 'function') {
      return original.apply(this, args)
    }
    return undefined
  }

  bridges[name] = bridge
  ;(target as any)[name] = bridge
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
