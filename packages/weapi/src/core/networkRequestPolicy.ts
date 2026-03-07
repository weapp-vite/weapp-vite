import type { WeapiAdapter } from './types'
import { isPlainObject } from './utils'

type WeapiNetworkMethod = 'request' | 'uploadFile' | 'downloadFile' | 'connectSocket'
type WeapiNetworkBucket = 'http' | 'socket'
interface WeapiNetworkTimeoutConfig {
  request: number
  uploadFile: number
  downloadFile: number
  connectSocket: number
}
interface WeapiActiveNetworkCall {
  bucket: WeapiNetworkBucket
  method: WeapiNetworkMethod
  platform?: string
  settled: boolean
  timeoutTimer?: ReturnType<typeof setTimeout>
  backgroundTimer?: ReturnType<typeof setTimeout>
  abort?: () => void
  failWith: (error: { errMsg: string }) => void
}

export interface WeapiPreparedNetworkCall {
  args: unknown[]
  blockedError?: { errMsg: string }
  onInvokeResult: (result: unknown) => void
  onInvokeError: () => void
}
const NETWORK_METHODS = new Set<WeapiNetworkMethod>(['request', 'uploadFile', 'downloadFile', 'connectSocket'])
const HTTP_METHODS = new Set<WeapiNetworkMethod>(['request', 'uploadFile', 'downloadFile'])
const DEFAULT_TIMEOUT_CONFIG: WeapiNetworkTimeoutConfig = { request: 60_000, uploadFile: 60_000, downloadFile: 60_000, connectSocket: 60_000 }
const NETWORK_BUCKET_LIMIT: Record<WeapiNetworkBucket, number> = { http: 10, socket: 5 }
const BACKGROUND_INTERRUPT_DELAY = 5_000
function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function resolveHostTimeoutConfig(): Partial<WeapiNetworkTimeoutConfig> {
  const hostConfig = (globalThis as any).__wxConfig
  const networkTimeout = hostConfig?.networkTimeout
  if (!isPlainObject(networkTimeout)) {
    return {}
  }
  const result: Partial<WeapiNetworkTimeoutConfig> = {}
  if (isFinitePositiveNumber(networkTimeout.request)) {
    result.request = networkTimeout.request
  }
  if (isFinitePositiveNumber(networkTimeout.uploadFile)) {
    result.uploadFile = networkTimeout.uploadFile
  }
  if (isFinitePositiveNumber(networkTimeout.downloadFile)) {
    result.downloadFile = networkTimeout.downloadFile
  }
  if (isFinitePositiveNumber(networkTimeout.connectSocket)) {
    result.connectSocket = networkTimeout.connectSocket
  }
  return result
}
function createNetworkError(methodName: string, platform: string | undefined, reason: string) {
  const prefix = platform ? `${platform}.${methodName}` : methodName
  return {
    errMsg: `${prefix}:fail ${reason}`,
  }
}
function resolveBucket(methodName: WeapiNetworkMethod): WeapiNetworkBucket {
  return HTTP_METHODS.has(methodName) ? 'http' : 'socket'
}
function clearTimer(timer?: ReturnType<typeof setTimeout>) {
  if (timer) {
    clearTimeout(timer)
  }
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
function stripRefererHeader(options: Record<string, any>) {
  if (!isPlainObject(options.header)) {
    return
  }
  const nextHeader: Record<string, any> = {}
  for (const [key, value] of Object.entries(options.header)) {
    if (key.toLowerCase() === 'referer') {
      continue
    }
    nextHeader[key] = value
  }
  options.header = nextHeader
}
function toNetworkMethod(name: string): WeapiNetworkMethod | undefined {
  return NETWORK_METHODS.has(name as WeapiNetworkMethod) ? (name as WeapiNetworkMethod) : undefined
}

/**
 * @description 创建微信网络请求语义策略（超时、并发、前后台中断、referer 过滤）。
 */
export function createNetworkRequestPolicy(getPlatform: () => string | undefined) {
  const boundAdapters = new WeakSet<object>()
  const activeCalls = new Set<WeapiActiveNetworkCall>()
  const activeCountByBucket: Record<WeapiNetworkBucket, number> = {
    http: 0,
    socket: 0,
  }
  const timeoutConfig: WeapiNetworkTimeoutConfig = { ...DEFAULT_TIMEOUT_CONFIG, ...resolveHostTimeoutConfig() }
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
        onInvokeResult() {},
        onInvokeError() {},
      }
    }

    const { args: nextArgs, options } = resolveOptionsArg(args)
    if (networkMethod !== 'connectSocket') {
      stripRefererHeader(options)
    }

    const timeout = isFinitePositiveNumber(options.timeout)
      ? options.timeout
      : timeoutConfig[networkMethod]
    options.timeout = timeout

    const bucket = resolveBucket(networkMethod)
    const limit = NETWORK_BUCKET_LIMIT[bucket]
    if (activeCountByBucket[bucket] >= limit) {
      return {
        args: nextArgs,
        blockedError: createNetworkError(methodName, platform, `exceed max concurrency limit ${limit}`),
        onInvokeResult() {},
        onInvokeError() {},
      }
    }
    activeCountByBucket[bucket] += 1

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
      },
    }
    activeCalls.add(call)

    options.success = (res: any) => {
      if (call.settled) {
        return
      }
      cleanupCall(call)
      originalSuccess?.(res)
    }
    options.fail = (error: any) => {
      if (call.settled) {
        return
      }
      cleanupCall(call)
      originalFail?.(error)
    }
    options.complete = (res: any) => {
      if (call.settled) {
        return
      }
      cleanupCall(call)
      originalComplete?.(res)
    }

    call.timeoutTimer = setTimeout(() => {
      call.abort?.()
      call.failWith(createNetworkError(methodName, platform, 'timeout'))
    }, timeout)

    if (isBackground) {
      scheduleBackgroundInterrupt(call)
    }

    return {
      args: nextArgs,
      onInvokeResult(result) {
        if (isPlainObject(result) && typeof result.abort === 'function') {
          call.abort = result.abort.bind(result)
        }
      },
      onInvokeError() {
        cleanupCall(call)
      },
    }
  }

  return {
    bindAdapter,
    prepareCall,
  }
}
