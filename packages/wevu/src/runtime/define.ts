import type {
  ComputedDefinitions,
  DefineComponentOptions,
  MethodDefinitions,
  PageFeatures,
} from './types'
import { createApp } from './app'
import { registerComponent, registerPage, runSetupFunction } from './register'

/**
 * Component definition returned by defineComponent
 */
export interface ComponentDefinition<
  D extends object,
  C extends ComputedDefinitions,
  M extends MethodDefinitions,
> {
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
    data: () => D
    computed: C
    methods: M
    watch: Record<string, any> | undefined
    setup: DefineComponentOptions<D, C, M>['setup']
    mpOptions: Record<string, any>
  }
}

/**
 * Define a mini-program component with Vue 3 style API
 *
 * Always registers as a Component (not Page). Use definePage() for pages.
 *
 * @param options - Component definition options
 * @returns Component definition that can be manually registered
 *
 * @example
 * ```ts
 * defineComponent({
 *   data: () => ({ count: 0 }),
 *   setup() {
 *     onMounted(() => console.log('mounted'))
 *   }
 * })
 * ```
 */
export function defineComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: DefineComponentOptions<D, C, M>,
): ComponentDefinition<D, C, M> {
  const {
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
    const result = runSetupFunction(setup, ctx?.props ?? {}, ctx)
    if (result) {
      applySetupResult(ctx.runtime, ctx.instance, result)
    }
  }

  // Store options for manual registration
  const componentOptions = {
    data: data as () => D,
    computed: computed as C,
    methods: methods as M,
    watch,
    setup: setupWrapper,
    mpOptions,
  }

  // Always register as Component
  registerComponent<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptions)

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
    const result = runSetupFunction(setup, ctx?.props ?? {}, ctx)
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

/**
 * Create a wevu component from Vue SFC options
 * This is a compatibility function for weapp-vite Vue SFC compilation
 *
 * @param options - Component options (may include properties for mini-program)
 */
export function createWevuComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: DefineComponentOptions<D, C, M> & { properties?: Record<string, any> },
): void {
  const {
    properties,
    ...restOptions
  } = options

  // Merge properties into mpOptions
  const finalOptions = {
    ...restOptions,
    ...(properties ? { properties } : {}),
  }

  // Use defineComponent to register the component
  defineComponent(finalOptions)
}
