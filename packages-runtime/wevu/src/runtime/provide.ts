import { getCurrentInstance } from './hooks'
import {
  getInstanceProvides,
  isRuntimeAppInstance,
} from './provideContext'
import {
  getGlobalProvidedValue,
  hasGlobalProvidedValue,
  setGlobalProvidedValue,
} from './provideStore'

// ============================================================================
// 分层的 provide/inject 机制
// 用于在组件树内维护依赖注入关系，支持组件与全局两种作用域
// ============================================================================

export { setGlobalProvidedValue } from './provideStore'

/**
 * 判断当前是否存在可用的注入上下文。
 *
 * wevu 的依赖注入上下文来自同步 `setup()` 阶段的当前实例。
 */
export function hasInjectionContext(): boolean {
  return Boolean(getCurrentInstance())
}

/**
 * 在组件上下文中向后代注入值（与 Vue 3 行为兼容），若没有当前实例则回落到全局存储。
 *
 * @param key 注入键，可为字符串、Symbol 或对象
 * @param value 提供的值
 *
 * @example
 * ```ts
 * defineComponent({
 *   setup() {
 *     provide(TOKEN_KEY, { data: 'value' })
 *   }
 * })
 * ```
 */
export function provide<T>(key: any, value: T): void {
  const instance = getCurrentInstance()

  if (instance) {
    getInstanceProvides(instance)[key as PropertyKey] = value
    if (isRuntimeAppInstance(instance)) {
      setGlobalProvidedValue(key, value)
    }
  }
  else {
    // 全局模式：无组件实例时，兼容旧代码和纯函数场景
    setGlobalProvidedValue(key, value)
  }
}

/**
 * 从祖先组件（或全局存储）读取提供的值。
 *
 * @param key 注入键，需与 provide 使用的键保持一致
 * @param defaultValue 未找到提供者时的默认值
 * @returns 匹配到的值或默认值
 *
 * @example
 * ```ts
 * defineComponent({
 *   setup() {
 *     const data = inject(TOKEN_KEY)
 *     const value = inject('key', 'default')
 *   }
 * })
 * ```
 */
export function inject<T>(key: any, defaultValue: T): T
export function inject<T>(key: any): T | undefined
export function inject<T>(key: any, defaultValue?: T): T | undefined {
  const instance = getCurrentInstance()

  // 优先尝试基于实例的注入，找不到再回退全局
  if (instance) {
    const provides = getInstanceProvides(instance)
    if (key in provides) {
      return provides[key as PropertyKey] as T
    }
  }

  // 兼容性回退：尝试读取全局存储
  if (hasGlobalProvidedValue(key)) {
    return getGlobalProvidedValue(key)
  }

  // 使用默认值兜底
  if (arguments.length >= 2) {
    return defaultValue as T
  }

  const warn = globalThis.console?.warn
  if (typeof warn === 'function') {
    warn(`wevu.inject：未找到对应 key 的值：${String(key)}`)
  }

  return undefined
}

// ============================================================================
// 显式的全局 provide/inject API
// ============================================================================

/**
 * 全局注入值，适用于历史兼容场景。
 *
 * @deprecated 已弃用，仅用于兼容/过渡。推荐优先使用 `provide()`，
 * 在无实例上下文时 `provide()` 会自动回落到全局存储。
 */
export function provideGlobal<T>(key: any, value: T): void {
  setGlobalProvidedValue(key, value)
}

/**
 * 从全局存储读取值，适用于历史兼容场景。
 *
 * @deprecated 已弃用，仅用于兼容/过渡。推荐优先使用 `inject()`，
 * 在无实例上下文时 `inject()` 会自动从全局存储读取。
 */
export function injectGlobal<T>(key: any, defaultValue?: T): T {
  if (hasGlobalProvidedValue(key)) {
    return getGlobalProvidedValue(key)
  }
  if (arguments.length >= 2) {
    return defaultValue as T
  }
  throw new Error(`injectGlobal()：未找到对应 key 的 provider：${String(key)}`)
}
