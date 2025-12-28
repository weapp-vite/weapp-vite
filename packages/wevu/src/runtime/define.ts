import type {
  ComponentPropsOptions,
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
    setup: DefineComponentOptions<ComponentPropsOptions, D, C, M>['setup']
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
export function defineComponent<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
>(options: DefineComponentOptions<P, D, C, M>): ComponentDefinition<D, C, M> {
  const {
    data,
    computed,
    methods,
    watch,
    setup,
    props,
    ...mpOptions
  } = options

  const mpOptionsWithProps = normalizeProps(mpOptions, props)

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
    mpOptions: mpOptionsWithProps,
  }

  // Always register as Component
  registerComponent<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptionsWithProps)

  // Return component definition for manual registration
  return {
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
export function definePage<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
>(options: Omit<DefineComponentOptions<P, D, C, M>, 'type'>, features?: PageFeatures): ComponentDefinition<D, C, M> {
  const {
    data,
    computed,
    methods,
    watch,
    setup,
    props: _props,
    ...mpOptions
  } = options

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
  const methods = runtime?.methods ?? Object.create(null)
  const state = runtime?.state ?? Object.create(null)
  if (runtime && !runtime.methods) {
    try {
      runtime.methods = methods
    }
    catch {
      // ignore if readonly
    }
  }
  if (runtime && !runtime.state) {
    try {
      runtime.state = state
    }
    catch {
      // ignore if readonly
    }
  }
  Object.keys(result).forEach((key) => {
    const val = (result as any)[key]
    if (typeof val === 'function') {
      ;(methods as any)[key] = (...args: any[]) => (val as any).apply(runtime?.proxy ?? runtime, args)
    }
    else {
      ;(state as any)[key] = val
    }
  })
  if (runtime) {
    runtime.methods = runtime.methods ?? methods
    runtime.state = runtime.state ?? state
  }
}

/**
 * Create a wevu component from Vue SFC options
 * This is a compatibility function for weapp-vite Vue SFC compilation
 *
 * @param options - Component options (may include properties for mini-program)
 */
export function createWevuComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: DefineComponentOptions<ComponentPropsOptions, D, C, M> & { properties?: Record<string, any> },
): void {
  const {
    properties,
    props,
    ...restOptions
  } = options

  // Merge properties into mpOptions
  const finalOptions = normalizeProps(restOptions, props, properties)

  // Use defineComponent to register the component
  defineComponent(finalOptions)
}

function normalizeProps(
  baseOptions: Record<string, any>,
  props?: ComponentPropsOptions,
  explicitProperties?: Record<string, any>,
) {
  if (explicitProperties || !props) {
    return {
      ...baseOptions,
      ...(explicitProperties ? { properties: explicitProperties } : {}),
    }
  }

  const properties: Record<string, any> = {}
  Object.entries(props).forEach(([key, definition]) => {
    if (definition === null || definition === undefined) {
      return
    }
    if (Array.isArray(definition) || typeof definition === 'function') {
      properties[key] = { type: definition }
      return
    }
    if (typeof definition === 'object') {
      const propOptions: Record<string, any> = {}
      if ('type' in definition && definition.type !== undefined) {
        propOptions.type = (definition as any).type
      }
      const defaultValue = 'default' in definition ? (definition as any).default : (definition as any).value
      if (defaultValue !== undefined) {
        propOptions.value = typeof defaultValue === 'function' ? (defaultValue as any)() : defaultValue
      }
      properties[key] = propOptions
    }
  })

  return {
    ...baseOptions,
    properties,
  }
}
