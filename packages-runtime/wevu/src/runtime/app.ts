import type { WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import type {
  AppConfig,
  ComputedDefinitions,
  CreateAppOptions,
  MethodDefinitions,
  RuntimeApp,
  WevuPlugin,
} from './types'
import {
  WEVU_BINDING_MANIFEST_KEY,
  WEVU_INLINE_HANDLER,
  WEVU_INLINE_MAP_KEY,
  WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY,
  WEVU_SLOT_OWNER_ID_KEY,
} from '@weapp-core/constants'
import { version } from '../version'
import { createRuntimeMount } from './app/mount'
import { setPendingRuntimeAppRegistration } from './app/pending'
import { resolveBindingManifest } from './bindingManifest'
import { isSetDataHighFrequencyWarningRequested, requireRuntimeCapability } from './capabilities'
import { applyWevuAppDefaults, INTERNAL_DEFAULTS_SCOPE_KEY } from './defaults'
import { getMiniProgramGlobalObject } from './platform'
import { ensureRuntimeAppProvides, setRuntimeAppProvidedValue } from './provideContext'
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
    [WEVU_BINDING_MANIFEST_KEY]: rawBindingManifest,
    [WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY]: scopedSlotOwnerRequired,
    data,
    computed: computedOptions,
    methods,
    setData: setDataOptions,
    watch: appWatch,
    setup: appSetup,
    ...mpOptions
  } = resolvedOptions as typeof resolvedOptions & { [WEVU_SCOPED_SLOT_OWNER_REQUIRED_KEY]?: boolean }
  const bindingManifest: WevuRuntimeBindingManifestV1 | undefined = resolveBindingManifest(rawBindingManifest)
  const resolvedMethods = methods ?? ({} as M)
  const resolvedComputed = computedOptions ?? ({} as C)
  const hasScopedSlotBindings = scopedSlotOwnerRequired === true
    || (Array.isArray(setDataOptions?.pick) && setDataOptions.pick.includes(WEVU_SLOT_OWNER_ID_KEY))
  const methodRecord = resolvedMethods as unknown as Record<string, unknown>
  const inlineMap = methodRecord[WEVU_INLINE_MAP_KEY]
  const hasInlineMetadata = Object.prototype.hasOwnProperty.call(methodRecord, WEVU_INLINE_MAP_KEY)
    && inlineMap
    && typeof inlineMap === 'object'
    && Object.keys(inlineMap).length > 0
  if (
    hasInlineMetadata
    && typeof methodRecord[WEVU_INLINE_HANDLER] !== 'function'
    && typeof (mpOptions as Record<string, unknown>)[WEVU_INLINE_HANDLER] !== 'function'
  ) {
    requireRuntimeCapability('inlineEvents', 'createApp(inline event metadata)')
  }
  if (setDataOptions?.strategy === 'patch') {
    requireRuntimeCapability('patchStrategy', 'createApp(setData.strategy="patch")')
  }
  if (isSetDataHighFrequencyWarningRequested(setDataOptions?.highFrequencyWarning)) {
    requireRuntimeCapability('setDataHighFrequencyWarning', 'createApp(setData.highFrequencyWarning)')
  }
  if (hasScopedSlotBindings) {
    requireRuntimeCapability('scopedSlots', 'createApp(scoped-slot bindings)')
  }

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
    bindingManifest,
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
      setRuntimeAppProvidedValue(runtimeApp, key, value, {
        syncGlobal: defaultsScope !== 'component',
      })
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
    version,
  }

  try {
    ensureRuntimeAppProvides(runtimeApp)
    Object.defineProperty(runtimeApp as Record<string, any>, '__wevuSetDataOptions', {
      value: setDataOptions,
      configurable: true,
      enumerable: false,
      writable: false,
    })
    Object.defineProperty(runtimeApp as Record<string, any>, '__wevuHasTemplateRuntimeBindings', {
      value: hasScopedSlotBindings,
      configurable: true,
      enumerable: false,
      writable: false,
    })
  }
  catch {
    ;(runtimeApp as any).__wevuSetDataOptions = setDataOptions
    ;(runtimeApp as any).__wevuHasTemplateRuntimeBindings = hasScopedSlotBindings
  }

  const registerRuntimeApp = () => {
    const globalObject = getMiniProgramGlobalObject()
    const appRegisterKey = '__wevuAppRegistered'
    const hasRegistered = globalObject ? Boolean(globalObject[appRegisterKey]) : false
    // 开发者工具/HMR 可能重复执行入口，避免多次 App() 导致 AppService 事件监听累积。
    if (!hasRegistered) {
      if (globalObject) {
        globalObject[appRegisterKey] = true
      }
      // 若检测到全局 App 构造器则自动注册小程序 App
      registerApp<D, C, M>(runtimeApp, (methods ?? {}) as any, appWatch as any, appSetup as any, mpOptions as any)
    }
  }

  if (defaultsScope !== 'component' && typeof App === 'function') {
    registerRuntimeApp()
  }
  else if (defaultsScope !== 'component') {
    setPendingRuntimeAppRegistration({
      app: runtimeApp,
      register: registerRuntimeApp,
    })
  }

  return runtimeApp
}
