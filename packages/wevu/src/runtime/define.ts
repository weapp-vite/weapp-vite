import type {
  ComputedDefinitions,
  DefineComponentOptions,
  MethodDefinitions,
  PageFeatures,
} from './types'
import { createApp } from './app'
import { registerComponent, registerPage } from './register'

/**
 * Component definition returned by defineComponent
 */
export interface ComponentDefinition<D, C, M> {
  /**
   * Mount the component to the mini-program
   * @deprecated Use explicit registration APIs instead
   */
  mount: (features?: PageFeatures) => void

  /**
   * Internal runtime app (for advanced use cases)
   * @internal
   */
  __wevu_runtime: import('./types').RuntimeApp<D, C, M>

  /**
   * Internal options (for advanced use cases)
   * @internal
   */
  __wevu_options: {
    type: 'page' | 'component'
    data: () => D
    computed: C
    methods: M
    watch: Record<string, any> | undefined
    setup: DefineComponentOptions<D, C, M>['setup']
    mpOptions: Record<string, any>
  }
}

/**
 * Define a mini-program component or page with Vue 3 style API
 *
 * @param options - Component definition options
 * @returns Component definition that can be manually registered
 *
 * @example
 * ```ts
 * // Auto-register mode (backward compatible)
 * defineComponent({
 *   data: () => ({ count: 0 }),
 *   setup() {
 *     onMounted(() => console.log('mounted'))
 *   }
 * })
 *
 * // Manual registration mode (new)
 * const MyComponent = defineComponent({
 *   type: 'component',
 *   data: () => ({ count: 0 }),
 *   setup() {
 *     return { doubled: computed(() => count.value * 2) }
 *   }
 * })
 *
 * // Later register manually
 * Component({
 *   behaviors: [MyComponent]
 * })
 * ```
 */
export function defineComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: DefineComponentOptions<D, C, M>,
): ComponentDefinition<D, C, M> {
  const {
    type = 'component',
    data,
    computed,
    methods,
    watch,
    setup,
    ...mpOptions
  } = options

  const runtimeApp = createApp<D, C, M>({
    data,
    computed,
    methods,
  })

  // Setup wrapper for registration
  const setupWrapper = (ctx: any) => {
    const result = setup?.(ctx)
    if (result) {
      applySetupResult(ctx.runtime, ctx.instance, result)
    }
  }

  // Store options for manual registration
  const componentOptions = {
    type: type as 'page' | 'component',
    data: data as () => D,
    computed: computed as C,
    methods: methods as M,
    watch,
    setup: setupWrapper,
    mpOptions,
  }

  // Auto-register for backward compatibility
  if (type === 'component') {
    registerComponent<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptions)
  }
  else {
    registerPage<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptions, undefined)
  }

  // Return component definition for manual registration
  return {
    mount: (_features?: PageFeatures) => {
      // No-op in auto-register mode
      // Kept for backward compatibility
    },
    __wevu_runtime: runtimeApp,
    __wevu_options: componentOptions,
  }
}

/**
 * Define a mini-program page with Vue 3 style API
 *
 * @param options - Page definition options
 * @param features - Page features (listenPageScroll, enableShareAppMessage, etc.)
 * @returns Page definition
 *
 * @example
 * ```ts
 * definePage({
 *   data: () => ({ count: 0 }),
 *   setup() {
 *     const count = ref(0)
 *     onMounted(() => console.log('page mounted'))
 *     return { count }
 *   }
 * }, {
 *   listenPageScroll: true,
 *   enableShareAppMessage: true
 * })
 * ```
 */
export function definePage<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: Omit<DefineComponentOptions<D, C, M>, 'type'>,
  features?: PageFeatures,
): ComponentDefinition<D, C, M> {
  const {
    data,
    computed,
    methods,
    watch,
    setup,
    ...mpOptions
  } = options as DefineComponentOptions<D, C, M>

  const runtimeApp = createApp<D, C, M>({
    data,
    computed,
    methods,
  })

  const setupWrapper = (ctx: any) => {
    const result = setup?.(ctx)
    if (result) {
      applySetupResult(ctx.runtime, ctx.instance, result)
    }
  }

  const componentOptions = {
    type: 'page' as const,
    data: data as () => D,
    computed: computed as C,
    methods: methods as M,
    watch,
    setup: setupWrapper,
    mpOptions,
    features,
  }

  registerPage<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptions, features)

  return {
    mount: () => {},
    __wevu_runtime: runtimeApp,
    __wevu_options: componentOptions,
  }
}

function applySetupResult(runtime: any, _target: any, result: any) {
  Object.keys(result).forEach((key) => {
    const val = (result as any)[key]
    if (typeof val === 'function') {
      ;(runtime.methods as any)[key] = (...args: any[]) => (val as any).apply(runtime.proxy, args)
    }
    else {
      ;(runtime.state as any)[key] = val
    }
  })
}
