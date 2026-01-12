import type { InternalRuntimeState } from './types'

// 仅供同步 setup() 调用期间使用的当前实例引用
let __currentInstance: InternalRuntimeState | undefined
let __currentSetupContext: any | undefined
export function getCurrentInstance<T extends InternalRuntimeState = InternalRuntimeState>(): T | undefined {
  return __currentInstance as T | undefined
}

export function setCurrentInstance(inst: InternalRuntimeState | undefined) {
  __currentInstance = inst
}

export function getCurrentSetupContext<T = any>(): T | undefined {
  return __currentSetupContext as T | undefined
}

export function setCurrentSetupContext(ctx: any | undefined) {
  __currentSetupContext = ctx
}

function assertInSetup(name: string): InternalRuntimeState {
  if (!__currentInstance) {
    throw new Error(`${name}() 必须在 setup() 的同步阶段调用`)
  }
  return __currentInstance
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
        // 忽略单个 hook 抛出的异常，继续执行后续 hook
      }
    }
    return out
  }
  return undefined
}

// 生命周期注册辅助方法：必须在 setup() 同步执行阶段调用
export function onLaunch(handler: (options: WechatMiniprogram.App.LaunchShowOption) => void) {
  pushHook(assertInSetup('onLaunch'), 'onLaunch', handler as any)
}

export function onPageNotFound(handler: (options: WechatMiniprogram.App.PageNotFoundOption) => void) {
  pushHook(assertInSetup('onPageNotFound'), 'onPageNotFound', handler as any)
}

export function onUnhandledRejection(handler: WechatMiniprogram.OnUnhandledRejectionCallback) {
  pushHook(assertInSetup('onUnhandledRejection'), 'onUnhandledRejection', handler as any)
}

export function onThemeChange(handler: WechatMiniprogram.OnThemeChangeCallback) {
  pushHook(assertInSetup('onThemeChange'), 'onThemeChange', handler as any)
}

export function onShow(handler: () => void): void
export function onShow(handler: (options: WechatMiniprogram.App.LaunchShowOption) => void): void
export function onShow(handler: ((options?: any) => void)) {
  pushHook(assertInSetup('onShow'), 'onShow', handler as any)
}
export function onLoad(handler: WechatMiniprogram.Page.ILifetime['onLoad']) {
  pushHook(assertInSetup('onLoad'), 'onLoad', handler as any)
}
export function onHide(handler: () => void) {
  pushHook(assertInSetup('onHide'), 'onHide', handler as any)
}
export function onUnload(handler: () => void) {
  pushHook(assertInSetup('onUnload'), 'onUnload', handler as any)
}
export function onReady(handler: () => void) {
  pushHook(assertInSetup('onReady'), 'onReady', handler as any)
}
export function onPullDownRefresh(handler: WechatMiniprogram.Page.ILifetime['onPullDownRefresh']) {
  pushHook(assertInSetup('onPullDownRefresh'), 'onPullDownRefresh', handler as any)
}
export function onReachBottom(handler: WechatMiniprogram.Page.ILifetime['onReachBottom']) {
  pushHook(assertInSetup('onReachBottom'), 'onReachBottom', handler as any)
}
export function onPageScroll(handler: (opt: WechatMiniprogram.Page.IPageScrollOption) => void) {
  pushHook(assertInSetup('onPageScroll'), 'onPageScroll', handler as any)
}
export function onRouteDone(handler: WechatMiniprogram.Page.ILifetime['onRouteDone'] | ((opt?: unknown) => void)) {
  pushHook(assertInSetup('onRouteDone'), 'onRouteDone', handler as any)
}
export function onTabItemTap(handler: (opt: WechatMiniprogram.Page.ITabItemTapOption) => void) {
  pushHook(assertInSetup('onTabItemTap'), 'onTabItemTap', handler as any)
}
export function onResize(handler: (opt: WechatMiniprogram.Page.IResizeOption) => void) {
  pushHook(assertInSetup('onResize'), 'onResize', handler as any)
}
export function onMoved(handler: () => void) {
  pushHook(assertInSetup('onMoved'), 'onMoved', handler as any)
}
export function onError(handler: (err: any) => void) {
  pushHook(assertInSetup('onError'), 'onError', handler as any)
}
export function onSaveExitState(handler: () => WechatMiniprogram.Page.ISaveExitState) {
  pushHook(assertInSetup('onSaveExitState'), 'onSaveExitState', handler as any, { single: true } as any)
}
export function onShareAppMessage(handler: WechatMiniprogram.Page.ILifetime['onShareAppMessage']) {
  pushHook(assertInSetup('onShareAppMessage'), 'onShareAppMessage', handler as any, { single: true } as any)
}
export function onShareTimeline(handler: WechatMiniprogram.Page.ILifetime['onShareTimeline']) {
  pushHook(assertInSetup('onShareTimeline'), 'onShareTimeline', handler as any, { single: true } as any)
}
export function onAddToFavorites(handler: WechatMiniprogram.Page.ILifetime['onAddToFavorites']) {
  pushHook(assertInSetup('onAddToFavorites'), 'onAddToFavorites', handler as any, { single: true } as any)
}

// ============================================================================
// 与 Vue 3 对齐的生命周期别名
// 将 Vue 3 的生命周期名称映射到小程序对应的钩子
// ============================================================================

/**
 * Vue 3 对齐：组件/页面已挂载，映射小程序 onReady
 */
export function onMounted(handler: () => void) {
  pushHook(assertInSetup('onMounted'), 'onReady', handler)
}

/**
 * Vue 3 对齐：组件/页面更新后触发。
 * 小程序没有专用 update 生命周期，这里在每次 setData 完成后调用。
 */
export function onUpdated(handler: () => void) {
  pushHook(assertInSetup('onUpdated'), '__wevuOnUpdated', handler)
}

/**
 * Vue 3 对齐：卸载前触发。
 * 小程序无 before-unload 生命周期，setup 时同步执行以保持语义。
 */
export function onBeforeUnmount(handler: () => void) {
  assertInSetup('onBeforeUnmount')
  // 在 setup 期间立即执行，等价于“已进入挂载流程”
  handler()
}

/**
 * Vue 3 对齐：组件/页面卸载；映射到页面 onUnload 或组件 detached
 */
export function onUnmounted(handler: () => void) {
  pushHook(assertInSetup('onUnmounted'), 'onUnload', handler)
}

/**
 * Vue 3 对齐：挂载前；setup 时同步触发以模拟 beforeMount 语义
 */
export function onBeforeMount(handler: () => void) {
  assertInSetup('onBeforeMount')
  // 在 setup 期间立即执行
  handler()
}

/**
 * Vue 3 对齐：更新前；在每次 setData 前触发
 */
export function onBeforeUpdate(handler: () => void) {
  pushHook(assertInSetup('onBeforeUpdate'), '__wevuOnBeforeUpdate', handler)
}

/**
 * Vue 3 对齐：错误捕获；映射到小程序 onError
 */
export function onErrorCaptured(handler: (err: any, instance: any, info: string) => void) {
  const instance = assertInSetup('onErrorCaptured')
  pushHook(instance, 'onError', (err?: any) => handler(err, instance, ''))
}

/**
 * Vue 3 对齐：组件激活；映射到小程序 onShow
 */
export function onActivated(handler: () => void) {
  pushHook(assertInSetup('onActivated'), 'onShow', handler)
}

/**
 * Vue 3 对齐：组件失活；映射到小程序 onHide
 */
export function onDeactivated(handler: () => void) {
  pushHook(assertInSetup('onDeactivated'), 'onHide', handler)
}

/**
 * Vue 3 对齐：服务端渲染前置钩子。
 * 小程序无此场景，保留空实现以保持 API 兼容。
 */
export function onServerPrefetch(_handler: () => void) {
  // 小程序环境不执行任何逻辑
  assertInSetup('onServerPrefetch')
}

// 内部更新钩子派发：before/after 阶段统一入口
export function callUpdateHooks(target: InternalRuntimeState, phase: 'before' | 'after') {
  const hookName = phase === 'before' ? '__wevuOnBeforeUpdate' : '__wevuOnUpdated'
  callHookList(target, hookName)
}
