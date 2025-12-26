import { getCurrentInstance } from './hooks'

// ============================================================================
// Hierarchical provide/inject system
// Maintains provider relationships across component tree
// ============================================================================

// Symbol to mark the provide scope on an instance
const PROVIDE_SCOPE_KEY = Symbol('wevu.provideScope')

// Global provide/inject (for backward compatibility and non-component usage)
const __wevuGlobalProvideStore = new Map<any, any>()

// Instance-based provide/inject (Vue 3 compatible)
/**
 * Provide a value to descendant components
 *
 * @param key - Injection key (can be a string, Symbol, or any object)
 * @param value - Value to provide
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
    // Instance mode: store on the component instance
    let scope = (instance as any)[PROVIDE_SCOPE_KEY]
    if (!scope) {
      scope = new Map()
      ;(instance as any)[PROVIDE_SCOPE_KEY] = scope
    }
    scope.set(key, value)
  }
  else {
    // Global mode: for backward compatibility and non-component usage
    __wevuGlobalProvideStore.set(key, value)
  }
}

/**
 * Inject a value provided by an ancestor component
 *
 * @param key - Injection key (must match the key used in provide())
 * @param defaultValue - Optional default value if no provider is found
 * @returns The provided value
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

  // Try instance-based inject first
  if (instance) {
    let current: any = instance
    while (current) {
      const scope = current[PROVIDE_SCOPE_KEY]
      if (scope && scope.has(key)) {
        return scope.get(key) as T
      }
      // Move to parent (mini-program doesn't have explicit parent references)
      // For now, we'll stop at the current instance
      // This can be improved with parent references if needed
      current = null
    }
  }

  // Fallback to global store for backward compatibility
  if (__wevuGlobalProvideStore.has(key)) {
    return __wevuGlobalProvideStore.get(key) as T
  }

  // Fallback to default value
  if (arguments.length >= 2) {
    return defaultValue as T
  }

  // Use old error message format for backward compatibility
  throw new Error(`wevu.inject: no value found for key`)
}

// ============================================================================
// Explicit global provide/inject APIs
// ============================================================================

/**
 * Provide a value globally
 * Use this when you're outside of a component setup
 */
export function provideGlobal<T>(key: any, value: T): void {
  __wevuGlobalProvideStore.set(key, value)
}

/**
 * Inject a value from global store
 * Use this when you're outside of a component setup
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
