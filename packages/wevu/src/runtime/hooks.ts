import type { InternalRuntimeState } from './types'

// Current instance for use inside synchronous setup() only.
let __currentInstance: InternalRuntimeState | undefined
export function getCurrentInstance(): any {
  return __currentInstance
}

export function setCurrentInstance(inst: InternalRuntimeState | undefined) {
  __currentInstance = inst
}

function ensureHookBucket(target: InternalRuntimeState): Record<string, any> {
  if (!target.__wevuHooks) {
    target.__wevuHooks = Object.create(null)
  }
  return target.__wevuHooks as Record<string, any>
}

function pushHook(
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

export function callHookList(target: InternalRuntimeState, name: string, args: any[] = []) {
  const hooks = target.__wevuHooks
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
        // ignore hook errors
      }
    }
  }
  else if (typeof list === 'function') {
    try {
      list.apply(ctx, args)
    }
    catch {
      // ignore hook errors
    }
  }
}

export function callHookReturn(target: InternalRuntimeState, name: string, args: any[] = []) {
  const hooks = target.__wevuHooks
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
        // ignore
      }
    }
    return out
  }
  return undefined
}

// Lifecycle registration helpers. Must be called synchronously inside setup().
export function onAppShow(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onAppShow() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onAppShow', handler)
}
export function onAppHide(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onAppHide() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onAppHide', handler)
}
export function onAppError(handler: (err?: any) => void) {
  if (!__currentInstance) {
    throw new Error('onAppError() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onAppError', handler)
}
export function onShow(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onShow() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onShow', handler)
}
export function onHide(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onHide() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onHide', handler)
}
export function onUnload(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onUnload() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onUnload', handler)
}
export function onReady(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onReady() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onReady', handler)
}
export function onPageScroll(handler: (opt: any) => void) {
  if (!__currentInstance) {
    throw new Error('onPageScroll() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onPageScroll', handler)
}
export function onRouteDone(handler: (opt?: any) => void) {
  if (!__currentInstance) {
    throw new Error('onRouteDone() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onRouteDone', handler)
}
export function onTabItemTap(handler: (opt: any) => void) {
  if (!__currentInstance) {
    throw new Error('onTabItemTap() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onTabItemTap', handler)
}
export function onSaveExitState(handler: () => any) {
  if (!__currentInstance) {
    throw new Error('onSaveExitState() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onSaveExitState', handler, { single: true } as any)
}
export function onShareAppMessage(handler: (...args: any[]) => any) {
  if (!__currentInstance) {
    throw new Error('onShareAppMessage() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onShareAppMessage', handler, { single: true } as any)
}
export function onShareTimeline(handler: (...args: any[]) => any) {
  if (!__currentInstance) {
    throw new Error('onShareTimeline() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onShareTimeline', handler, { single: true } as any)
}
export function onAddToFavorites(handler: (...args: any[]) => any) {
  if (!__currentInstance) {
    throw new Error('onAddToFavorites() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onAddToFavorites', handler, { single: true } as any)
}

// ============================================================================
// Vue 3 compatible lifecycle aliases
// These map Vue 3 lifecycle names to mini-program specific lifecycles
// ============================================================================

/**
 * Vue 3 compatible: called when the component/page is ready (mounted)
 * Maps to mini-program onReady
 */
export function onMounted(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onMounted() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onReady', handler)
}

/**
 * Vue 3 compatible: called after the component/page updates
 * Note: Mini-programs don't have a true update lifecycle,
 * so this is called after each setData completes
 */
export function onUpdated(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onUpdated() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, '__wevuOnUpdated', handler)
}

/**
 * Vue 3 compatible: called before the component/page is unmounted
 * Note: This is called immediately (synchronously) since mini-programs
 * don't have a before-unload lifecycle
 */
export function onBeforeUnmount(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onBeforeUnmount() must be called synchronously inside setup()')
  }
  // Execute immediately since setup is called during attached/loaded
  handler()
}

/**
 * Vue 3 compatible: called when the component/page is unmounted
 * Maps to mini-program onUnload (pages) or detached (components)
 */
export function onUnmounted(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onUnmounted() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onUnload', handler)
}

/**
 * Vue 3 compatible: called before the component/page mounts
 * Note: This is called immediately (synchronously) before mount
 */
export function onBeforeMount(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onBeforeMount() must be called synchronously inside setup()')
  }
  // Execute immediately since setup is called during attached/loaded
  handler()
}

/**
 * Vue 3 compatible: called before the component/page updates
 * Note: This is called before each setData
 */
export function onBeforeUpdate(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onBeforeUpdate() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, '__wevuOnBeforeUpdate', handler)
}

/**
 * Vue 3 compatible: called when an error is captured
 * Maps to mini-program onError
 */
export function onErrorCaptured(handler: (err: any, instance: any, info: string) => void) {
  if (!__currentInstance) {
    throw new Error('onErrorCaptured() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onAppError', (err?: any) => handler(err, __currentInstance, ''))
}

/**
 * Vue 3 compatible: called when the component is activated
 * Maps to mini-program onShow
 */
export function onActivated(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onActivated() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onShow', handler)
}

/**
 * Vue 3 compatible: called when the component is deactivated
 * Maps to mini-program onHide
 */
export function onDeactivated(handler: () => void) {
  if (!__currentInstance) {
    throw new Error('onDeactivated() must be called synchronously inside setup()')
  }
  pushHook(__currentInstance, 'onHide', handler)
}

/**
 * Vue 3 compatible: called when the server renderer is used
 * Note: Not applicable for mini-programs, kept for API compatibility
 */
export function onServerPrefetch(_handler: () => void) {
  // No-op for mini-programs
  if (!__currentInstance) {
    throw new Error('onServerPrefetch() must be called synchronously inside setup()')
  }
}

// Internal hooks for update lifecycle
export function callUpdateHooks(target: InternalRuntimeState, phase: 'before' | 'after') {
  const hookName = phase === 'before' ? '__wevuOnBeforeUpdate' : '__wevuOnUpdated'
  callHookList(target, hookName)
}
