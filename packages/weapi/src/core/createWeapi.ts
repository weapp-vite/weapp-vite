import type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiInstance,
  WeapiMethodSupportQueryOptions,
  WeapiResolvedTarget,
} from './types'
import { detectGlobalAdapter } from './adapter'
import { isSyntheticMethodSupported, resolveMethodMappingWithMeta } from './methodMapping'
import { createNotSupportedError, hasCallbacks, isPlainObject, shouldSkipPromise } from './utils'

const INTERNAL_KEYS = new Set<PropertyKey>([
  'setAdapter',
  'getAdapter',
  'platform',
  'raw',
  'resolveTarget',
  'supports',
])

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
  alipay: 'my',
  douyin: 'tt',
}

function normalizePlatformName(value?: string) {
  if (!value) {
    return undefined
  }
  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  return PLATFORM_ALIASES[normalized] ?? normalized
}

function resolveOptionsArg(args: unknown[]) {
  const nextArgs = args.slice()
  const lastArg = nextArgs.length > 0 ? nextArgs[nextArgs.length - 1] : undefined
  if (isPlainObject(lastArg)) {
    const options = { ...lastArg }
    nextArgs[nextArgs.length - 1] = options
    return { args: nextArgs, options }
  }
  const options: Record<string, any> = {}
  nextArgs.push(options)
  return { args: nextArgs, options }
}

function callWithPromise(
  context: WeapiAdapter,
  method: (...args: any[]) => any,
  args: unknown[],
  mapResult?: (result: any) => any,
) {
  return new Promise((resolve, reject) => {
    const { args: nextArgs, options } = resolveOptionsArg(args)
    let settled = false
    options.success = (res: any) => {
      settled = true
      resolve(mapResult ? mapResult(res) : res)
    }
    options.fail = (err: any) => {
      settled = true
      reject(err)
    }
    options.complete = (res: any) => {
      if (!settled) {
        resolve(mapResult ? mapResult(res) : res)
      }
    }
    try {
      method.apply(context, nextArgs)
    }
    catch (err) {
      reject(err)
    }
  })
}

function callMissingApi(methodName: string, platform: string | undefined, args: unknown[]) {
  const lastArg = args.length > 0 ? args[args.length - 1] : undefined
  const error = createNotSupportedError(methodName, platform)
  if (hasCallbacks(lastArg)) {
    lastArg.fail?.(error)
    lastArg.complete?.(error)
    return undefined
  }
  return Promise.reject(error)
}

/**
 * @description 创建跨平台 API 实例
 */
export function createWeapi<TAdapter extends WeapiAdapter = WeapiCrossPlatformRawAdapter>(
  options: CreateWeapiOptions<TAdapter> = {},
): WeapiInstance<TAdapter> {
  let adapter: TAdapter | undefined = options.adapter
  let platformName: string | undefined = normalizePlatformName(options.platform)
  const allowFallback = false
  const cache = new Map<PropertyKey, any>()
  const syntheticWindowResizeListeners = new Set<(result: any) => void>()
  let syntheticWindowResizeBridgeReady = false
  let syntheticWindowResizeSnapshot: string | undefined
  const syntheticMemoryWarningListeners = new Set<(result: any) => void>()
  let syntheticMemoryWarningBridgeReady = false
  const resolveAdapter = () => {
    if (adapter) {
      return adapter
    }
    const detected = detectGlobalAdapter()
    if (detected.adapter) {
      adapter = detected.adapter as TAdapter
      platformName = platformName ?? normalizePlatformName(detected.platform)
    }
    return adapter
  }

  const setAdapter = (nextAdapter?: TAdapter, nextPlatform?: string) => {
    adapter = nextAdapter
    platformName = normalizePlatformName(nextPlatform)
    cache.clear()
  }

  const getAdapter = (): TAdapter | undefined => {
    if (!adapter) {
      resolveAdapter()
    }
    return adapter
  }

  const getPlatform = () => {
    if (!platformName) {
      resolveAdapter()
    }
    return platformName
  }

  const hasSyntheticSupport = (platform: string | undefined, methodName: string) => {
    if (platform !== 'my' && platform !== 'tt') {
      return false
    }
    return isSyntheticMethodSupported(platform, methodName)
  }

  const emitSyntheticWindowResize = (result: any) => {
    for (const listener of syntheticWindowResizeListeners) {
      listener(result)
    }
  }

  const emitSyntheticMemoryWarning = (result: any) => {
    for (const listener of syntheticMemoryWarningListeners) {
      listener(result)
    }
  }

  const ensureSyntheticWindowResizeBridge = () => {
    if (syntheticWindowResizeBridgeReady) {
      return
    }
    const runtimeAdapter = resolveAdapter() as Record<string, any> | undefined
    const onAppShow = runtimeAdapter?.onAppShow
    if (typeof onAppShow !== 'function') {
      return
    }
    syntheticWindowResizeBridgeReady = true
    onAppShow(() => {
      const currentAdapter = resolveAdapter() as Record<string, any> | undefined
      const getWindowInfo = currentAdapter?.getWindowInfo
      if (typeof getWindowInfo !== 'function') {
        return
      }
      getWindowInfo({
        success: (result: any) => {
          const nextSnapshot = JSON.stringify({
            pixelRatio: result?.pixelRatio,
            screenHeight: result?.screenHeight,
            screenWidth: result?.screenWidth,
            windowHeight: result?.windowHeight,
            windowWidth: result?.windowWidth,
          })
          if (syntheticWindowResizeSnapshot === undefined) {
            syntheticWindowResizeSnapshot = nextSnapshot
            return
          }
          if (syntheticWindowResizeSnapshot !== nextSnapshot) {
            syntheticWindowResizeSnapshot = nextSnapshot
            emitSyntheticWindowResize(result)
          }
        },
      })
    })
  }

  const ensureSyntheticMemoryWarningBridge = () => {
    if (syntheticMemoryWarningBridgeReady) {
      return
    }
    const runtimeAdapter = resolveAdapter() as Record<string, any> | undefined
    const onMemoryWarning = runtimeAdapter?.onMemoryWarning
    if (typeof onMemoryWarning !== 'function') {
      return
    }
    syntheticMemoryWarningBridgeReady = true
    onMemoryWarning((result: any) => {
      emitSyntheticMemoryWarning(result)
    })
  }

  const invokeSyntheticMethod = (
    platform: string | undefined,
    methodName: string,
    args: unknown[],
  ) => {
    if (!hasSyntheticSupport(platform, methodName)) {
      return {
        handled: false as const,
        result: undefined,
      }
    }
    const invokeSyntheticAsyncSuccess = (payload: Record<string, any>) => {
      const lastArg = args.length > 0 ? args[args.length - 1] : undefined
      if (hasCallbacks(lastArg)) {
        lastArg.success?.(payload)
        lastArg.complete?.(payload)
        return undefined
      }
      return Promise.resolve(payload)
    }
    if (methodName === 'reportAnalytics') {
      return {
        handled: true as const,
        result: invokeSyntheticAsyncSuccess({
          errMsg: 'reportAnalytics:ok',
        }),
      }
    }
    if (methodName === 'offMemoryWarning' && platform === 'tt') {
      const callback = typeof args[0] === 'function' ? args[0] as (result: any) => void : undefined
      if (callback) {
        syntheticMemoryWarningListeners.delete(callback)
      }
      else {
        syntheticMemoryWarningListeners.clear()
      }
      return {
        handled: true as const,
        result: undefined,
      }
    }
    if (methodName === 'onMemoryWarning' && platform === 'tt') {
      const callback = typeof args[0] === 'function' ? args[0] as (result: any) => void : undefined
      if (callback) {
        syntheticMemoryWarningListeners.add(callback)
      }
      ensureSyntheticMemoryWarningBridge()
      return {
        handled: true as const,
        result: undefined,
      }
    }
    if (methodName === 'onWindowResize' && platform === 'my') {
      const callback = typeof args[0] === 'function' ? args[0] as (result: any) => void : undefined
      if (callback) {
        syntheticWindowResizeListeners.add(callback)
      }
      ensureSyntheticWindowResizeBridge()
      return {
        handled: true as const,
        result: undefined,
      }
    }
    if (methodName === 'offWindowResize' && platform === 'my') {
      const callback = typeof args[0] === 'function' ? args[0] as (result: any) => void : undefined
      if (callback) {
        syntheticWindowResizeListeners.delete(callback)
      }
      else {
        syntheticWindowResizeListeners.clear()
      }
      return {
        handled: true as const,
        result: undefined,
      }
    }
    return {
      handled: false as const,
      result: undefined,
    }
  }

  const resolveTarget = (methodName: string): WeapiResolvedTarget => {
    const runtimeAdapter = resolveAdapter()
    const platform = getPlatform()
    const mappingInfo = resolveMethodMappingWithMeta(platform, methodName, { allowFallback })
    const target = mappingInfo?.target ?? methodName
    const targetMethod = runtimeAdapter
      ? (runtimeAdapter as Record<string, any>)[target]
      : undefined
    const supported = typeof targetMethod === 'function'
      || hasSyntheticSupport(platform, methodName)
    const supportLevel = !supported
      ? 'unsupported'
      : mappingInfo?.source === 'fallback'
        ? 'fallback'
        : mappingInfo?.source === 'explicit'
          ? 'mapped'
          : 'native'
    return {
      method: methodName,
      target,
      platform,
      mapped: target !== methodName,
      supported,
      supportLevel,
      semanticAligned: supportLevel === 'native' || supportLevel === 'mapped',
    }
  }

  const supports = (methodName: string, queryOptions: WeapiMethodSupportQueryOptions = {}) => {
    const resolved = resolveTarget(methodName)
    if (queryOptions.semantic === true) {
      return resolved.semanticAligned
    }
    return resolved.supported
  }

  const proxy = new Proxy({}, {
    get(_target, prop) {
      if (prop === Symbol.toStringTag) {
        return 'Weapi'
      }
      if (prop === 'then') {
        return undefined
      }
      if (INTERNAL_KEYS.has(prop)) {
        if (prop === 'setAdapter') {
          return setAdapter
        }
        if (prop === 'getAdapter') {
          return getAdapter
        }
        if (prop === 'platform') {
          return getPlatform()
        }
        if (prop === 'raw') {
          return getAdapter()
        }
        if (prop === 'resolveTarget') {
          return resolveTarget
        }
        if (prop === 'supports') {
          return supports
        }
      }

      if (cache.has(prop)) {
        return cache.get(prop)
      }

      const currentAdapter = resolveAdapter()
      if (!currentAdapter) {
        if (typeof prop !== 'string') {
          return undefined
        }
        return (...args: unknown[]) => callMissingApi(prop, getPlatform(), args)
      }

      const platform = getPlatform()
      const mappingRule = typeof prop === 'string'
        ? resolveMethodMappingWithMeta(platform, prop, { allowFallback })
        : undefined
      const methodName = mappingRule?.target ?? (prop as string)
      const value = (currentAdapter as Record<string, any>)[methodName]
      const syntheticSupported = typeof prop === 'string' && hasSyntheticSupport(platform, prop)
      if (typeof value !== 'function' && !syntheticSupported) {
        if (value === undefined && typeof prop === 'string') {
          const missing = (...args: unknown[]) => callMissingApi(prop, getPlatform(), args)
          cache.set(prop, missing)
          return missing
        }
        cache.set(prop, value)
        return value
      }

      const wrapped = (...args: unknown[]) => {
        const runtimeAdapter = resolveAdapter()
        const platform = getPlatform()
        const mappingInfo = resolveMethodMappingWithMeta(platform, prop as string, { allowFallback })
        const mappingRule = mappingInfo?.rule
        const methodName = mappingInfo?.target ?? (prop as string)
        const runtimeMethod = runtimeAdapter
          ? (runtimeAdapter as Record<string, any>)[methodName]
          : undefined
        const runtimeArgs = mappingRule?.mapArgs ? mappingRule.mapArgs(args) : args
        const preferSynthetic = platform === 'tt'
          && (prop === 'onMemoryWarning' || prop === 'offMemoryWarning')
        if (preferSynthetic) {
          const syntheticResult = invokeSyntheticMethod(platform, prop as string, runtimeArgs)
          if (syntheticResult.handled) {
            return syntheticResult.result
          }
        }
        if (typeof runtimeMethod !== 'function') {
          const syntheticResult = invokeSyntheticMethod(platform, prop as string, runtimeArgs)
          if (syntheticResult.handled) {
            return syntheticResult.result
          }
          return callMissingApi(prop as string, getPlatform(), args)
        }
        if (shouldSkipPromise(prop as string)) {
          const result = runtimeMethod.apply(runtimeAdapter, runtimeArgs)
          return mappingRule?.mapResult ? mappingRule.mapResult(result) : result
        }
        const lastArg = runtimeArgs.length > 0 ? runtimeArgs[runtimeArgs.length - 1] : undefined
        if (hasCallbacks(lastArg)) {
          if (mappingRule?.mapResult && isPlainObject(lastArg)) {
            const options = lastArg as Record<string, any>
            const originalSuccess = options.success
            const originalComplete = options.complete
            options.success = (res: any) => {
              originalSuccess?.(mappingRule.mapResult!(res))
            }
            options.complete = (res: any) => {
              originalComplete?.(mappingRule.mapResult!(res))
            }
          }
          const result = runtimeMethod.apply(runtimeAdapter, runtimeArgs)
          return mappingRule?.mapResult ? mappingRule.mapResult(result) : result
        }
        return callWithPromise(runtimeAdapter as WeapiAdapter, runtimeMethod, runtimeArgs, mappingRule?.mapResult)
      }
      cache.set(prop, wrapped)
      return wrapped
    },
  })

  return proxy as WeapiInstance<TAdapter>
}
