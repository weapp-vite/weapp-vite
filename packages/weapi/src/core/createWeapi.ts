import type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiCrossPlatformRawAdapter,
  WeapiInstance,
} from './types'
import { detectGlobalAdapter } from './adapter'
import { resolveMethodMapping } from './methodMapping'
import { createNotSupportedError, hasCallbacks, isPlainObject, shouldSkipPromise } from './utils'

const INTERNAL_KEYS = new Set<PropertyKey>([
  'setAdapter',
  'getAdapter',
  'platform',
  'raw',
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
  const cache = new Map<PropertyKey, any>()

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
        ? resolveMethodMapping(platform, prop)
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
        const mappingRule = resolveMethodMapping(platform, prop as string)
        const methodName = mappingRule?.target ?? (prop as string)
        const runtimeMethod = runtimeAdapter
          ? (runtimeAdapter as Record<string, any>)[methodName]
          : undefined
        const runtimeArgs = mappingRule?.mapArgs ? mappingRule.mapArgs(args) : args
        if (typeof runtimeMethod !== 'function') {
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
