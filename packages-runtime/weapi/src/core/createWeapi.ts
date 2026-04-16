import type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiInstance,
  WeapiMethodSupportQueryOptions,
  WeapiResolvedTarget,
} from './types'
import { getMiniProgramRuntimeGlobalKey, normalizeMiniProgramPlatform, resolveMiniProgramPlatform } from '@weapp-core/shared'
import { detectGlobalAdapter } from './adapter'
import { callMissingApi, callWithError, callWithPromise } from './callBridge'
import { resolveMethodMappingWithMeta } from './methodMapping'
import { createNetworkRequestPolicy } from './networkRequestPolicy'
import { hasCallbacks, isPlainObject, shouldSkipPromise } from './utils'

const INTERNAL_KEYS = new Set<PropertyKey>([
  'setAdapter',
  'getAdapter',
  'platform',
  'raw',
  'resolveTarget',
  'supports',
])

const PLATFORM_ALIASES: Readonly<Record<string, string>> = {
  kuaishou: 'ks',
}

function normalizePlatformName(value?: string) {
  const normalized = normalizeMiniProgramPlatform(value)
  if (!normalized) {
    return undefined
  }
  const miniProgramPlatform = resolveMiniProgramPlatform(normalized)
  if (miniProgramPlatform) {
    return getMiniProgramRuntimeGlobalKey(miniProgramPlatform)
  }
  return PLATFORM_ALIASES[normalized] ?? normalized
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
  const networkPolicy = createNetworkRequestPolicy(() => platformName, options.network)
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

  const resolveTarget = (methodName: string): WeapiResolvedTarget => {
    const runtimeAdapter = resolveAdapter()
    const platform = getPlatform()
    const mappingInfo = resolveMethodMappingWithMeta(platform, methodName, { allowFallback })
    const target = mappingInfo?.target ?? methodName
    const targetMethod = runtimeAdapter
      ? (runtimeAdapter as Record<string, any>)[target]
      : undefined
    const supported = typeof targetMethod === 'function'
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
      if (typeof value !== 'function') {
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
        let runtimeArgs = args
        try {
          runtimeArgs = mappingRule?.mapArgs ? mappingRule.mapArgs(args) : args
        }
        catch (error) {
          const lastArg = args.length > 0 ? args.at(-1) : undefined
          if (hasCallbacks(lastArg)) {
            lastArg.fail?.(error)
            lastArg.complete?.(error)
            return undefined
          }
          return Promise.reject(error)
        }
        if (typeof runtimeMethod !== 'function') {
          return callMissingApi(prop as string, getPlatform(), args)
        }
        if (shouldSkipPromise(prop as string)) {
          const result = runtimeMethod.apply(runtimeAdapter, runtimeArgs)
          return mappingRule?.mapResult ? mappingRule.mapResult(result, runtimeArgs) : result
        }
        const lastArg = runtimeArgs.length > 0 ? runtimeArgs.at(-1) : undefined
        if (hasCallbacks(lastArg)) {
          if (mappingRule?.mapResult && isPlainObject(lastArg)) {
            const options = lastArg as Record<string, any>
            const originalSuccess = options.success
            const originalComplete = options.complete
            options.success = (res: any) => {
              originalSuccess?.(mappingRule.mapResult!(res, runtimeArgs))
            }
            options.complete = (res: any) => {
              originalComplete?.(mappingRule.mapResult!(res, runtimeArgs))
            }
          }
          networkPolicy.bindAdapter(runtimeAdapter as WeapiAdapter)
          const networkCall = networkPolicy.prepareCall(prop as string, runtimeArgs)
          if (networkCall?.blockedError) {
            return callWithError(networkCall.blockedError, runtimeArgs)
          }
          const nextRuntimeArgs = networkCall?.args ?? runtimeArgs
          const invokeRuntime = () => runtimeMethod.apply(runtimeAdapter, nextRuntimeArgs)
          const result = networkCall ? networkCall.invoke(invokeRuntime) : invokeRuntime()
          return mappingRule?.mapResult ? mappingRule.mapResult(result, nextRuntimeArgs) : result
        }
        let networkCall: ReturnType<typeof networkPolicy.prepareCall> | undefined
        return callWithPromise(
          runtimeAdapter as WeapiAdapter,
          runtimeMethod,
          runtimeArgs,
          mappingRule?.mapResult,
          {
            onOptions: (_options, nextArgs) => {
              networkPolicy.bindAdapter(runtimeAdapter as WeapiAdapter)
              networkCall = networkPolicy.prepareCall(prop as string, nextArgs)
              if (networkCall?.blockedError) {
                throw networkCall.blockedError
              }
              if (!networkCall) {
                return
              }
              nextArgs.splice(0, nextArgs.length, ...(networkCall.args as unknown[]))
            },
            invoke: (invoke) => {
              if (networkCall) {
                networkCall.invoke(invoke)
                return
              }
              invoke()
            },
          },
        )
      }
      cache.set(prop, wrapped)
      return wrapped
    },
  })

  return proxy as WeapiInstance<TAdapter>
}
