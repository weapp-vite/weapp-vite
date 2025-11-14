import type {
  ComputedDefinitions,
  DefineComponentOptions,
  MethodDefinitions,
  PageFeatures,
} from './types'
import { createApp } from './app'
import { registerComponent, registerPage } from './register'

export function defineComponent<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: DefineComponentOptions<D, C, M>,
) {
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

  // Immediately register for backward compatibility
  const setupWrapper = (ctx: any) => {
    const result = setup?.(ctx)
    if (result) {
      applySetupResult(ctx.runtime, ctx.instance, result)
    }
  }
  if (type === 'component') {
    registerComponent<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptions)
  }
  else {
    registerPage<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptions, undefined)
  }

  // Keep mount() for API symmetry; it's a no-op now.
  return {
    mount: (_features?: PageFeatures) => {},
  }
}

export function definePage<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: Omit<DefineComponentOptions<D, C, M>, 'type'>,
  features?: PageFeatures,
) {
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
  registerPage<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptions, features)
  return {
    mount: () => {},
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
