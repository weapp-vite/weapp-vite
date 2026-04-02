import type { InternalRuntimeState } from '../types'
import { assertInSetup, callHookList, pushHook } from './base'

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
/**
 * 派发更新阶段钩子（框架内部调度入口）。
 * @internal
 */
export function callUpdateHooks(target: InternalRuntimeState, phase: 'before' | 'after') {
  const hookName = phase === 'before' ? '__wevuOnBeforeUpdate' : '__wevuOnUpdated'
  callHookList(target, hookName)
}
