import type {
  ComputedDefinitions,
  DefineAppOptions,
  InternalRuntimeState,
  MethodDefinitions,
  MiniProgramAppOptions,
  MiniProgramMemoryWarningResult,
  RuntimeApp,
} from '../types'
import type { WatchMap } from './watch'
import {
  WEVU_HOOKS_KEY,
  WEVU_INLINE_HANDLER,
  WEVU_INLINE_MAP_KEY,
  WEVU_IS_APP_INSTANCE_KEY,
} from '@weapp-core/constants'
import { callHookList } from '../hooks'
import { getMiniProgramGlobalObject, supportsCurrentMiniProgramRuntimeCapability } from '../platform'
import { runInlineExpression } from './inline'
import { mountRuntimeInstance } from './runtimeInstance'

const APP_GLOBAL_LISTENER_STORE_KEY = '__wevuAppGlobalListeners'
const MEMORY_WARNING_LISTENER_KEY = '__wevuOnMemoryWarningListener'

function bindMemoryWarningListener(target: InternalRuntimeState) {
  const hooks = target[WEVU_HOOKS_KEY] as Record<string, any> | undefined
  const hasMemoryWarningHook = Boolean(hooks?.onMemoryWarning)
  if (!supportsCurrentMiniProgramRuntimeCapability('appMemoryWarningListener')) {
    delete (target as any)[MEMORY_WARNING_LISTENER_KEY]
    return
  }
  const miniProgramGlobal = getMiniProgramGlobalObject()
  const onMemoryWarning = miniProgramGlobal?.onMemoryWarning
  const offMemoryWarning = miniProgramGlobal?.offMemoryWarning
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

  const listener = (result: MiniProgramMemoryWarningResult) => {
    callHookList(target, 'onMemoryWarning', [result])
  }
  ;(target as any)[MEMORY_WARNING_LISTENER_KEY] = listener
  onMemoryWarning(listener)
}

function bindAppGlobalListener(target: InternalRuntimeState, options: {
  hookName: 'onError' | 'onPageNotFound' | 'onUnhandledRejection' | 'onThemeChange'
  onApiName: 'onError' | 'onPageNotFound' | 'onUnhandledRejection' | 'onThemeChange'
  offApiName: 'offError' | 'offPageNotFound' | 'offUnhandledRejection' | 'offThemeChange'
  capabilityName: 'appErrorListener' | 'appPageNotFoundListener' | 'appUnhandledRejectionListener' | 'appThemeChangeListener'
  userHandler?: ((...args: any[]) => any) | undefined
}) {
  const { hookName, onApiName, offApiName, capabilityName, userHandler } = options
  const hooks = target[WEVU_HOOKS_KEY] as Record<string, any> | undefined
  const hasHook = Boolean(hooks?.[hookName])
  const store = ((target as any)[APP_GLOBAL_LISTENER_STORE_KEY] ??= Object.create(null)) as Record<string, ((...args: any[]) => void) | undefined>
  const existing = store[hookName]
  if (!supportsCurrentMiniProgramRuntimeCapability(capabilityName)) {
    delete store[hookName]
    delete (target as any)[hookName]
    return
  }
  const miniProgramGlobal = getMiniProgramGlobalObject()
  const onApi = miniProgramGlobal?.[onApiName]
  const offApi = miniProgramGlobal?.[offApiName]

  if (typeof existing === 'function' && typeof offApi === 'function') {
    try {
      offApi(existing)
    }
    catch {
      // 忽略平台差异导致的取消监听异常
    }
  }

  if (!hasHook && typeof userHandler !== 'function') {
    delete store[hookName]
    return
  }

  const dispatch = (...args: any[]) => {
    callHookList(target, hookName, args)
    if (typeof userHandler === 'function') {
      userHandler.apply(target, args)
    }
  }

  ;(target as any)[hookName] = dispatch
  store[hookName] = dispatch

  if (typeof onApi === 'function') {
    onApi(dispatch)
  }
}

function bindAppGlobalListeners(
  target: InternalRuntimeState,
  handlers: {
    onError?: ((...args: any[]) => any) | undefined
    onPageNotFound?: ((...args: any[]) => any) | undefined
    onUnhandledRejection?: ((...args: any[]) => any) | undefined
    onThemeChange?: ((...args: any[]) => any) | undefined
  },
) {
  bindAppGlobalListener(target, {
    hookName: 'onError',
    onApiName: 'onError',
    offApiName: 'offError',
    capabilityName: 'appErrorListener',
    userHandler: handlers.onError,
  })
  bindAppGlobalListener(target, {
    hookName: 'onPageNotFound',
    onApiName: 'onPageNotFound',
    offApiName: 'offPageNotFound',
    capabilityName: 'appPageNotFoundListener',
    userHandler: handlers.onPageNotFound,
  })
  bindAppGlobalListener(target, {
    hookName: 'onUnhandledRejection',
    onApiName: 'onUnhandledRejection',
    offApiName: 'offUnhandledRejection',
    capabilityName: 'appUnhandledRejectionListener',
    userHandler: handlers.onUnhandledRejection,
  })
  bindAppGlobalListener(target, {
    hookName: 'onThemeChange',
    onApiName: 'onThemeChange',
    offApiName: 'offThemeChange',
    capabilityName: 'appThemeChangeListener',
    userHandler: handlers.onThemeChange,
  })
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

  if (!appOptions[WEVU_INLINE_HANDLER]) {
    appOptions[WEVU_INLINE_HANDLER] = function __weapp_vite_inline(this: InternalRuntimeState, event: any) {
      const runtime = (this as any).__wevu
      const ctx = runtime?.proxy ?? this
      const inlineMap = runtime?.methods?.[WEVU_INLINE_MAP_KEY]
      return runInlineExpression(ctx, undefined, event, inlineMap)
    }
  }

  const userOnLaunch = appOptions.onLaunch
  const userOnError = appOptions.onError
  const userOnPageNotFound = (appOptions as any).onPageNotFound
  const userOnUnhandledRejection = (appOptions as any).onUnhandledRejection
  const userOnThemeChange = (appOptions as any).onThemeChange
  appOptions.onLaunch = function onLaunch(this: InternalRuntimeState, ...args: any[]) {
    this[WEVU_IS_APP_INSTANCE_KEY] = true
    mountRuntimeInstance(this, runtimeApp, watch, setup)
    bindMemoryWarningListener(this)
    bindAppGlobalListeners(this, {
      onError: userOnError,
      onPageNotFound: userOnPageNotFound,
      onUnhandledRejection: userOnUnhandledRejection,
      onThemeChange: userOnThemeChange,
    })
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

  delete appOptions.onError
  delete (appOptions as any).onPageNotFound
  delete (appOptions as any).onUnhandledRejection
  delete (appOptions as any).onThemeChange

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
