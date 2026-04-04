import { assertInSetup, ensurePageHookOnInstance, ensurePageShareMenusOnSetup, ensureSinglePageHookOnInstance, pushHook } from './base'

function registerHook(name: string, handler: (...args: any[]) => any, options?: { single?: boolean }) {
  pushHook(assertInSetup(name), name, handler as any, options as any)
}

// 生命周期注册辅助方法：必须在 setup() 同步执行阶段调用
export function onLaunch(handler: (options: WechatMiniprogram.App.LaunchShowOption) => void) {
  registerHook('onLaunch', handler as any)
}

export function onPageNotFound(handler: (options: WechatMiniprogram.App.PageNotFoundOption) => void) {
  registerHook('onPageNotFound', handler as any)
}

export function onUnhandledRejection(handler: WechatMiniprogram.OnUnhandledRejectionCallback) {
  registerHook('onUnhandledRejection', handler as any)
}

export function onThemeChange(handler: WechatMiniprogram.OnThemeChangeCallback) {
  registerHook('onThemeChange', handler as any)
}

export function onMemoryWarning(handler: WechatMiniprogram.OnMemoryWarningCallback) {
  registerHook('onMemoryWarning', handler as any)
}

export function onShow(handler: () => void): void
export function onShow(handler: (options: WechatMiniprogram.App.LaunchShowOption) => void): void
export function onShow(handler: ((options?: any) => void)) {
  registerHook('onShow', handler as any)
}

export function onLoad(handler: WechatMiniprogram.Page.ILifetime['onLoad']) {
  registerHook('onLoad', handler as any)
}

export function onHide(handler: () => void) {
  registerHook('onHide', handler as any)
}

export function onUnload(handler: () => void) {
  registerHook('onUnload', handler as any)
}

export function onReady(handler: () => void) {
  registerHook('onReady', handler as any)
}

export function onPullDownRefresh(handler: WechatMiniprogram.Page.ILifetime['onPullDownRefresh']) {
  registerHook('onPullDownRefresh', handler as any)
}

export function onReachBottom(handler: WechatMiniprogram.Page.ILifetime['onReachBottom']) {
  registerHook('onReachBottom', handler as any)
}

export function onPageScroll(handler: (opt: WechatMiniprogram.Page.IPageScrollOption) => void) {
  const instance = assertInSetup('onPageScroll')
  pushHook(instance, 'onPageScroll', handler as any)
  ensurePageHookOnInstance(instance, 'onPageScroll')
}

export function onRouteDone(handler: WechatMiniprogram.Page.ILifetime['onRouteDone'] | ((opt?: unknown) => void)) {
  registerHook('onRouteDone', handler as any)
}

export function onTabItemTap(handler: (opt: WechatMiniprogram.Page.ITabItemTapOption) => void) {
  registerHook('onTabItemTap', handler as any)
}

export function onResize(handler: (opt: WechatMiniprogram.Page.IResizeOption) => void) {
  registerHook('onResize', handler as any)
}

export function onMoved(handler: () => void) {
  registerHook('onMoved', handler as any)
}

export function onAttached(handler: () => void) {
  registerHook('onAttached', handler as any)
}

export function onDetached(handler: () => void) {
  registerHook('onDetached', handler as any)
}

export function onError(handler: (err: any) => void) {
  registerHook('onError', handler as any)
}

export function onSaveExitState(handler: () => WechatMiniprogram.Page.ISaveExitState) {
  registerHook('onSaveExitState', handler as any, { single: true })
}

export function onShareAppMessage(handler: WechatMiniprogram.Page.ILifetime['onShareAppMessage']) {
  const instance = assertInSetup('onShareAppMessage')
  pushHook(instance, 'onShareAppMessage', handler as any, { single: true } as any)
  ensureSinglePageHookOnInstance(instance, 'onShareAppMessage')
  ensurePageShareMenusOnSetup(instance)
}

export function onShareTimeline(handler: WechatMiniprogram.Page.ILifetime['onShareTimeline']) {
  const instance = assertInSetup('onShareTimeline')
  pushHook(instance, 'onShareTimeline', handler as any, { single: true } as any)
  ensureSinglePageHookOnInstance(instance, 'onShareTimeline')
  ensurePageShareMenusOnSetup(instance)
}

export function onAddToFavorites(handler: WechatMiniprogram.Page.ILifetime['onAddToFavorites']) {
  const instance = assertInSetup('onAddToFavorites')
  pushHook(instance, 'onAddToFavorites', handler as any, { single: true } as any)
  ensureSinglePageHookOnInstance(instance, 'onAddToFavorites')
}
