import type { ComputedDefinitions, DefineAppOptions, InternalRuntimeState, MethodDefinitions, MiniProgramAppOptions, RuntimeApp } from '../types'
import type { WatchMap } from './watch'
import { callHookList } from '../hooks'
import { getMiniProgramGlobalObject } from '../platform'
import { runInlineExpression } from './inline'
import { mountRuntimeInstance } from './runtimeInstance'

const MEMORY_WARNING_LISTENER_KEY = '__wevuOnMemoryWarningListener'

function bindMemoryWarningListener(target: InternalRuntimeState) {
  const hooks = target.__wevuHooks as Record<string, any> | undefined
  const hasMemoryWarningHook = Boolean(hooks?.onMemoryWarning)
  const wxGlobal = getMiniProgramGlobalObject()
  const onMemoryWarning = wxGlobal?.onMemoryWarning
  const offMemoryWarning = wxGlobal?.offMemoryWarning
  if (typeof onMemoryWarning !== 'function') {
    return
  }

  const existing = (target as any)[MEMORY_WARNING_LISTENER_KEY]
  if (typeof existing === 'function' && typeof offMemoryWarning === 'function') {
    try {
      offMemoryWarning(existing)
    }
    catch {
      // 忽略平台差异导致的取消监听异常
    }
  }

  if (!hasMemoryWarningHook) {
    delete (target as any)[MEMORY_WARNING_LISTENER_KEY]
    return
  }

  const listener = (result: WechatMiniprogram.OnMemoryWarningListenerResult) => {
    callHookList(target, 'onMemoryWarning', [result])
  }
  ;(target as any)[MEMORY_WARNING_LISTENER_KEY] = listener
  onMemoryWarning(listener)
}

/**
 * 注册 App 入口（框架内部使用）。
 * @internal
 */
export function registerApp<D extends object, C extends ComputedDefinitions, M extends MethodDefinitions>(
  runtimeApp: RuntimeApp<D, C, M>,
  methods: MethodDefinitions,
  watch: WatchMap | undefined,
  setup: DefineAppOptions<D, C, M>['setup'],
  mpOptions: MiniProgramAppOptions,
) {
  if (typeof App !== 'function') {
    throw new TypeError('createApp 需要全局 App 构造器可用')
  }

  const methodNames = Object.keys(methods ?? {})
  const appOptions: Record<string, any> = {
    ...mpOptions,
  }

  appOptions.globalData = appOptions.globalData ?? {}

  if (!appOptions.__weapp_vite_inline) {
    appOptions.__weapp_vite_inline = function __weapp_vite_inline(this: InternalRuntimeState, event: any) {
      const runtime = (this as any).__wevu
      const ctx = runtime?.proxy ?? this
      const inlineMap = runtime?.methods?.__weapp_vite_inline_map
      return runInlineExpression(ctx, undefined, event, inlineMap)
    }
  }

  const userOnLaunch = appOptions.onLaunch
  appOptions.onLaunch = function onLaunch(this: InternalRuntimeState, ...args: any[]) {
    mountRuntimeInstance(this, runtimeApp, watch, setup)
    bindMemoryWarningListener(this)
    callHookList(this, 'onLaunch', args)
    if (typeof userOnLaunch === 'function') {
      userOnLaunch.apply(this, args)
    }
  }

  const userOnShow = appOptions.onShow
  appOptions.onShow = function onShow(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onShow', args)
    if (typeof userOnShow === 'function') {
      userOnShow.apply(this, args)
    }
  }

  const userOnHide = appOptions.onHide
  appOptions.onHide = function onHide(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onHide', args)
    if (typeof userOnHide === 'function') {
      userOnHide.apply(this, args)
    }
  }

  const userOnError = appOptions.onError
  appOptions.onError = function onError(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onError', args)
    if (typeof userOnError === 'function') {
      userOnError.apply(this, args)
    }
  }

  const userOnPageNotFound = (appOptions as any).onPageNotFound
  ;(appOptions as any).onPageNotFound = function onPageNotFound(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onPageNotFound', args)
    if (typeof userOnPageNotFound === 'function') {
      userOnPageNotFound.apply(this, args)
    }
  }

  const userOnUnhandledRejection = (appOptions as any).onUnhandledRejection
  ;(appOptions as any).onUnhandledRejection = function onUnhandledRejection(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onUnhandledRejection', args)
    if (typeof userOnUnhandledRejection === 'function') {
      userOnUnhandledRejection.apply(this, args)
    }
  }

  const userOnThemeChange = (appOptions as any).onThemeChange
  ;(appOptions as any).onThemeChange = function onThemeChange(this: InternalRuntimeState, ...args: any[]) {
    callHookList(this, 'onThemeChange', args)
    if (typeof userOnThemeChange === 'function') {
      userOnThemeChange.apply(this, args)
    }
  }

  for (const methodName of methodNames) {
    const userMethod = appOptions[methodName]
    appOptions[methodName] = function runtimeMethod(this: InternalRuntimeState, ...args: any[]) {
      const runtime = this.__wevu
      let result: unknown
      const bound = runtime?.methods?.[methodName]
      if (bound) {
        result = bound.apply(runtime.proxy, args)
      }
      if (typeof userMethod === 'function') {
        return userMethod.apply(this, args)
      }
      return result
    }
  }

  App(appOptions)
}
