import type { CreateWeapiOptions, WeapiAdapter, WeapiInstance } from './types'
import { detectGlobalAdapter } from './adapter'
import { createNotSupportedError, hasCallbacks, isPlainObject, shouldSkipPromise } from './utils'

const INTERNAL_KEYS = new Set<PropertyKey>([
  'setAdapter',
  'getAdapter',
  'platform',
  'raw',
])

function normalizePlatformName(value?: string) {
  return value || undefined
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
) {
  return new Promise((resolve, reject) => {
    const { args: nextArgs, options } = resolveOptionsArg(args)
    let settled = false
    options.success = (res: any) => {
      settled = true
      resolve(res)
    }
    options.fail = (err: any) => {
      settled = true
      reject(err)
    }
    options.complete = (res: any) => {
      if (!settled) {
        resolve(res)
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
export function createWeapi(options: CreateWeapiOptions = {}): WeapiInstance {
  let adapter: WeapiAdapter | undefined = options.adapter
  let platformName: string | undefined = normalizePlatformName(options.platform)
  const cache = new Map<PropertyKey, any>()

  const resolveAdapter = () => {
    if (adapter) {
      return adapter
    }
    const detected = detectGlobalAdapter()
    if (detected.adapter) {
      adapter = detected.adapter
      platformName = platformName ?? normalizePlatformName(detected.platform)
    }
    return adapter
  }

  const setAdapter = (nextAdapter?: WeapiAdapter, nextPlatform?: string) => {
    adapter = nextAdapter
    platformName = normalizePlatformName(nextPlatform)
    cache.clear()
  }

  const getAdapter = () => {
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

      const value = (currentAdapter as Record<string, any>)[prop as string]
      if (typeof value !== 'function') {
        cache.set(prop, value)
        return value
      }

      const wrapped = (...args: unknown[]) => {
        const runtimeAdapter = resolveAdapter()
        const runtimeMethod = runtimeAdapter
          ? (runtimeAdapter as Record<string, any>)[prop as string]
          : undefined
        if (typeof runtimeMethod !== 'function') {
          return callMissingApi(prop as string, getPlatform(), args)
        }
        if (shouldSkipPromise(prop as string)) {
          return runtimeMethod.apply(runtimeAdapter, args)
        }
        const lastArg = args.length > 0 ? args[args.length - 1] : undefined
        if (hasCallbacks(lastArg)) {
          return runtimeMethod.apply(runtimeAdapter, args)
        }
        return callWithPromise(runtimeAdapter as WeapiAdapter, runtimeMethod, args)
      }
      cache.set(prop, wrapped)
      return wrapped
    },
  })

  return proxy as WeapiInstance
}
