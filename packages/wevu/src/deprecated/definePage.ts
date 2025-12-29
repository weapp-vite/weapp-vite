import type {
  ComponentPropsOptions,
  ComputedDefinitions,
  DefineComponentOptions,
  MethodDefinitions,
  PageFeatures,
} from '../runtime/types'
import { createApp } from '../runtime/app'
import { registerPage, runSetupFunction } from '../runtime/register'

/**
 * @deprecated `definePage` 已从 wevu 公共 API 中移除；页面请统一使用 `defineComponent({ type: 'page', ... })`。
 * 该文件仅用于保留旧实现以便迁移对照，不会再由入口导出。
 */
export function definePage<
  P extends ComponentPropsOptions = ComponentPropsOptions,
  D extends object = Record<string, any>,
  C extends ComputedDefinitions = ComputedDefinitions,
  M extends MethodDefinitions = MethodDefinitions,
>(options: Omit<DefineComponentOptions<P, D, C, M>, 'type'>, features?: PageFeatures) {
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

  registerPage<D, C, M>(runtimeApp, methods ?? {}, watch as any, setupWrapper, mpOptions, features)

  return {
    mount: () => {},
    __wevu_runtime: runtimeApp,
    __wevu_options: {
      type: 'page' as const,
      data: data as () => D,
      computed: computed as C,
      methods: methods as M,
      watch,
      setup: setupWrapper,
      mpOptions,
      features,
    },
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
      // ignore
    }
  }
  if (runtime && !runtime.state) {
    try {
      runtime.state = state
    }
    catch {
      // ignore
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
