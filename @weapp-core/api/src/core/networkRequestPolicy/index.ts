import type { WeapiAdapter, WeapiNetworkOptions, WeapiNetworkOverflowPolicy } from '../types'
import type {
  WeapiActiveNetworkCall,
  WeapiNetworkBucket,
  WeapiNetworkTimeoutConfig,
  WeapiPreparedNetworkCall,
  WeapiQueuedNetworkCall,
} from './types'
import { isPlainObject } from '../utils'
import {
  clearTimer,
  createNetworkError,
  resolveBucket,
  resolveHostTimeoutConfig,
  resolveOptionsArg,
  resolveQueueSize,
  resolveTimeoutValue,
  stripRefererHeader,
  toNetworkMethod,
} from './helpers'
import {
  BACKGROUND_INTERRUPT_DELAY,
  DEFAULT_TIMEOUT_CONFIG,
  NETWORK_BUCKET_LIMIT,
} from './types'

/**
 * @description 创建微信网络请求语义策略（超时、并发、前后台中断、referer 过滤）。
 */
export function createNetworkRequestPolicy(
  getPlatform: () => string | undefined,
  options: WeapiNetworkOptions | undefined = undefined,
) {
  const boundAdapters = new WeakSet<object>()
  const activeCalls = new Set<WeapiActiveNetworkCall>()
  const queueByBucket: Record<WeapiNetworkBucket, WeapiQueuedNetworkCall[]> = {
    http: [],
    socket: [],
  }
  const activeCountByBucket: Record<WeapiNetworkBucket, number> = {
    http: 0,
    socket: 0,
  }
  const timeoutConfig: WeapiNetworkTimeoutConfig = {
    ...DEFAULT_TIMEOUT_CONFIG,
    ...resolveHostTimeoutConfig(),
  }
  const overflowPolicy: WeapiNetworkOverflowPolicy = options?.overflowPolicy ?? 'queue'
  const maxQueueSize = resolveQueueSize(options?.maxQueueSize)
  let isBackground = false

  const cleanupCall = (call: WeapiActiveNetworkCall) => {
    if (call.settled) {
      return
    }
    call.settled = true
    activeCalls.delete(call)
    activeCountByBucket[call.bucket] = Math.max(0, activeCountByBucket[call.bucket] - 1)
    clearTimer(call.timeoutTimer)
    clearTimer(call.backgroundTimer)
  }

  const drainQueue = (bucket: WeapiNetworkBucket) => {
    if (isBackground) {
      return
    }
    const limit = NETWORK_BUCKET_LIMIT[bucket]
    const queue = queueByBucket[bucket]
    while (activeCountByBucket[bucket] < limit && queue.length > 0) {
      const queued = queue.shift()
      queued?.start()
    }
  }

  const scheduleBackgroundInterrupt = (call: WeapiActiveNetworkCall) => {
    clearTimer(call.backgroundTimer)
    call.backgroundTimer = setTimeout(() => {
      call.abort?.()
      call.failWith(createNetworkError(call.method, call.platform, 'interrupted'))
    }, BACKGROUND_INTERRUPT_DELAY)
  }

  const clearBackgroundInterrupt = (call: WeapiActiveNetworkCall) => {
    clearTimer(call.backgroundTimer)
    call.backgroundTimer = undefined
  }

  const setBackgroundState = (nextBackground: boolean) => {
    isBackground = nextBackground
    for (const call of activeCalls) {
      if (nextBackground) {
        scheduleBackgroundInterrupt(call)
      }
      else {
        clearBackgroundInterrupt(call)
      }
    }
    if (!nextBackground) {
      drainQueue('http')
      drainQueue('socket')
    }
  }

  const bindAdapter = (adapter?: WeapiAdapter) => {
    if (!adapter || typeof adapter !== 'object') {
      return
    }
    if (boundAdapters.has(adapter)) {
      return
    }
    boundAdapters.add(adapter)
    const onAppHide = (adapter as Record<string, any>).onAppHide
    if (typeof onAppHide === 'function') {
      onAppHide(() => {
        setBackgroundState(true)
      })
    }
    const onAppShow = (adapter as Record<string, any>).onAppShow
    if (typeof onAppShow === 'function') {
      onAppShow(() => {
        setBackgroundState(false)
      })
    }
  }

  const prepareCall = (methodName: string, args: unknown[]): WeapiPreparedNetworkCall | undefined => {
    const networkMethod = toNetworkMethod(methodName)
    if (!networkMethod) {
      return undefined
    }
    const platform = getPlatform()
    if (isBackground) {
      return {
        args,
        blockedError: createNetworkError(methodName, platform, 'interrupted'),
        invoke() {
          return undefined
        },
      }
    }

    const { args: nextArgs, options } = resolveOptionsArg(args)
    if (networkMethod !== 'connectSocket') {
      stripRefererHeader(options)
    }

    const timeout = resolveTimeoutValue(options.timeout, networkMethod, timeoutConfig)
    options.timeout = timeout

    const bucket = resolveBucket(networkMethod)
    const limit = NETWORK_BUCKET_LIMIT[bucket]
    const queue = queueByBucket[bucket]
    if (activeCountByBucket[bucket] >= limit && overflowPolicy === 'strict') {
      return {
        args: nextArgs,
        blockedError: createNetworkError(methodName, platform, `exceed max concurrency limit ${limit}`),
        invoke() {
          return undefined
        },
      }
    }
    if (activeCountByBucket[bucket] >= limit && queue.length >= maxQueueSize) {
      return {
        args: nextArgs,
        blockedError: createNetworkError(methodName, platform, `exceed max queue size ${maxQueueSize}`),
        invoke() {
          return undefined
        },
      }
    }

    const originalSuccess = options.success
    const originalFail = options.fail
    const originalComplete = options.complete

    const call: WeapiActiveNetworkCall = {
      bucket,
      method: networkMethod,
      platform,
      settled: false,
      failWith: (error) => {
        if (call.settled) {
          return
        }
        cleanupCall(call)
        originalFail?.(error)
        originalComplete?.(error)
        drainQueue(bucket)
      },
    }

    options.success = (res: any) => {
      if (call.settled) {
        return
      }
      cleanupCall(call)
      originalSuccess?.(res)
      drainQueue(bucket)
    }
    options.fail = (error: any) => {
      if (call.settled) {
        return
      }
      cleanupCall(call)
      originalFail?.(error)
      drainQueue(bucket)
    }
    options.complete = (res: any) => {
      if (call.settled) {
        return
      }
      cleanupCall(call)
      originalComplete?.(res)
      drainQueue(bucket)
    }

    const startInvoke = (invokeRuntime: () => any) => {
      if (call.settled) {
        return undefined
      }
      activeCountByBucket[bucket] += 1
      activeCalls.add(call)
      call.timeoutTimer = setTimeout(() => {
        call.abort?.()
        call.failWith(createNetworkError(methodName, platform, 'timeout'))
      }, timeout)
      if (isBackground) {
        scheduleBackgroundInterrupt(call)
      }
      try {
        const result = invokeRuntime()
        if (isPlainObject(result) && typeof result.abort === 'function') {
          call.abort = result.abort.bind(result)
        }
        return result
      }
      catch (error) {
        call.failWith(error as { errMsg: string })
        return undefined
      }
    }

    return {
      args: nextArgs,
      invoke(invokeRuntime) {
        if (activeCountByBucket[bucket] < limit) {
          return startInvoke(invokeRuntime)
        }
        if (overflowPolicy !== 'queue') {
          return undefined
        }
        queue.push({
          start: () => startInvoke(invokeRuntime),
        })
        return undefined
      },
    }
  }

  return {
    bindAdapter,
    prepareCall,
  }
}
