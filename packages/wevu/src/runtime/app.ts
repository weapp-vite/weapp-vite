import type {
  AppConfig,
  ComputedDefinitions,
  CreateAppOptions,
  MethodDefinitions,
  RuntimeApp,
  WevuPlugin,
} from './types'
import { createRuntimeMount } from './app/mount'
import { applyWevuAppDefaults, INTERNAL_DEFAULTS_SCOPE_KEY } from './defaults'
import { getMiniProgramGlobalObject } from './platform'
import { setGlobalProvidedValue } from './provide'
import { registerApp } from './register'

export function createApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  options: CreateAppOptions<D, C, M>,
): RuntimeApp<D, C, M> {
  const defaultsScope = (options as any)[INTERNAL_DEFAULTS_SCOPE_KEY] as string | undefined
  const resolvedOptions = defaultsScope === 'component'
    ? options
    : applyWevuAppDefaults(options)
  const {
    [INTERNAL_DEFAULTS_SCOPE_KEY]: _ignoredDefaultsScope,
    data,
    computed: computedOptions,
    methods,
    setData: setDataOptions,
    watch: appWatch,
    setup: appSetup,
    ...mpOptions
  } = resolvedOptions
  const resolvedMethods = methods ?? ({} as M)
  const resolvedComputed = computedOptions ?? ({} as C)

  const installedPlugins = new Set<WevuPlugin>()
  const appUnmountCleanups = new Set<() => void>()
  let appUnmounted = false
  const appConfig: AppConfig = { globalProperties: {} }
  const mount = createRuntimeMount<D, C, M>({
    data,
    resolvedComputed,
    resolvedMethods,
    appConfig,
    setDataOptions,
  })

  const runtimeApp: RuntimeApp<D, C, M> = {
    mount,
    use(plugin: WevuPlugin, ...options: any[]) {
      if (!plugin || installedPlugins.has(plugin)) {
        return runtimeApp
      }
      installedPlugins.add(plugin)
      if (typeof plugin === 'function') {
        plugin(runtimeApp, ...options)
      }
      else if (typeof plugin.install === 'function') {
        plugin.install(runtimeApp, ...options)
      }
      else {
        throw new TypeError('插件必须是函数，或包含 install 方法的对象')
      }
      return runtimeApp
    },
    provide(key: any, value: any) {
      setGlobalProvidedValue(key, value)
      return runtimeApp
    },
    onUnmount(cleanup: () => void) {
      if (typeof cleanup !== 'function') {
        throw new TypeError('onUnmount 只接受函数')
      }
      if (appUnmounted) {
        cleanup()
        return runtimeApp
      }
      appUnmountCleanups.add(cleanup)
      return runtimeApp
    },
    unmount() {
      if (appUnmounted) {
        return
      }
      appUnmounted = true
      for (const cleanup of appUnmountCleanups) {
        cleanup()
      }
      appUnmountCleanups.clear()
    },
    config: appConfig,
  }

  const hasGlobalApp = typeof App === 'function'

  try {
    Object.defineProperty(runtimeApp as Record<string, any>, '__wevuSetDataOptions', {
      value: setDataOptions,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(runtimeApp as any).__wevuSetDataOptions = setDataOptions
  }

  if (hasGlobalApp) {
    const globalObject = getMiniProgramGlobalObject()
    const hasWxConfig = typeof globalObject?.__wxConfig !== 'undefined'
    const appRegisterKey = '__wevuAppRegistered'
    const hasRegistered = hasWxConfig && globalObject
      ? Boolean(globalObject[appRegisterKey])
      : false
    // 开发者工具/HMR 可能重复执行入口，避免多次 App() 导致 AppService 事件监听累积。
    if (!hasRegistered) {
      if (hasWxConfig && globalObject) {
        globalObject[appRegisterKey] = true
      }
      // 若检测到全局 App 构造器则自动注册小程序 App
      registerApp<D, C, M>(runtimeApp, (methods ?? {}) as any, appWatch as any, appSetup as any, mpOptions as any)
    }
  }

  return runtimeApp
}
