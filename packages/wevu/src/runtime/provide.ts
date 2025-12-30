import { getCurrentInstance } from './hooks'

// ============================================================================
// 分层的 provide/inject 机制
// 用于在组件树内维护依赖注入关系，支持组件与全局两种作用域
// ============================================================================

// 标记组件实例提供域的 Symbol，避免与业务字段冲突
const PROVIDE_SCOPE_KEY = Symbol('wevu.provideScope')

// 全局提供/注入存储，用于兼容非组件环境或历史调用
const __wevuGlobalProvideStore = new Map<any, any>()

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
    // 组件内提供：存放到当前实例的 provide 域中
    let scope = (instance as any)[PROVIDE_SCOPE_KEY]
    if (!scope) {
      scope = new Map()
      ;(instance as any)[PROVIDE_SCOPE_KEY] = scope
    }
    scope.set(key, value)
  }
  else {
    // 全局模式：无组件实例时，兼容旧代码和纯函数场景
    __wevuGlobalProvideStore.set(key, value)
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
export function inject<T>(key: any, defaultValue?: T): T {
  const instance = getCurrentInstance()

  // 优先尝试基于实例的注入，找不到再回退全局
  if (instance) {
    let current: any = instance
    while (current) {
      const scope = current[PROVIDE_SCOPE_KEY]
      if (scope && scope.has(key)) {
        return scope.get(key) as T
      }
      // 小程序没有显式父子引用，这里仅尝试当前实例。
      // 若未来补充父级指针，可在此向上遍历。
      current = null
    }
  }

  // 兼容性回退：尝试读取全局存储
  if (__wevuGlobalProvideStore.has(key)) {
    return __wevuGlobalProvideStore.get(key) as T
  }

  // 使用默认值兜底
  if (arguments.length >= 2) {
    return defaultValue as T
  }

  // 保留旧版错误提示格式，避免破坏性改动
  throw new Error(`wevu.inject: no value found for key`)
}

// ============================================================================
// 显式的全局 provide/inject API
// ============================================================================

/**
 * 全局注入值，适用于组件外部调用场景。
 */
export function provideGlobal<T>(key: any, value: T): void {
  __wevuGlobalProvideStore.set(key, value)
}

/**
 * 从全局存储读取值，适用于组件外部调用场景。
 */
export function injectGlobal<T>(key: any, defaultValue?: T): T {
  if (__wevuGlobalProvideStore.has(key)) {
    return __wevuGlobalProvideStore.get(key) as T
  }
  if (arguments.length >= 2) {
    return defaultValue as T
  }
  throw new Error(`injectGlobal() no matching provider for key: ${String(key)}`)
}
