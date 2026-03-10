import type {
  WeapiNetworkBucket,
  WeapiNetworkMethod,
  WeapiNetworkTimeoutConfig,
} from './types'
import { isPlainObject } from '../utils'
import {
  DEFAULT_MAX_QUEUE_SIZE,
  HTTP_METHODS,
  NETWORK_METHODS,
} from './types'

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

export function resolveQueueSize(value: number | undefined) {
  if (!isFinitePositiveNumber(value)) {
    return DEFAULT_MAX_QUEUE_SIZE
  }
  return Math.max(1, Math.floor(value))
}

export function resolveHostTimeoutConfig(): Partial<WeapiNetworkTimeoutConfig> {
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

export function createNetworkError(methodName: string, platform: string | undefined, reason: string) {
  const prefix = platform ? `${platform}.${methodName}` : methodName
  return {
    errMsg: `${prefix}:fail ${reason}`,
  }
}

export function resolveBucket(methodName: WeapiNetworkMethod): WeapiNetworkBucket {
  return HTTP_METHODS.has(methodName) ? 'http' : 'socket'
}

export function clearTimer(timer?: ReturnType<typeof setTimeout>) {
  if (timer) {
    clearTimeout(timer)
  }
}

export function resolveOptionsArg(args: unknown[]) {
  const nextArgs = args.slice()
  const lastArg = nextArgs.length > 0 ? nextArgs.at(-1) : undefined
  if (isPlainObject(lastArg)) {
    const options = { ...lastArg }
    nextArgs[nextArgs.length - 1] = options
    return { args: nextArgs, options }
  }
  const options: Record<string, any> = {}
  nextArgs.push(options)
  return { args: nextArgs, options }
}

export function stripRefererHeader(options: Record<string, any>) {
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

export function resolveTimeoutValue(
  timeout: unknown,
  method: WeapiNetworkMethod,
  timeoutConfig: WeapiNetworkTimeoutConfig,
) {
  return isFinitePositiveNumber(timeout) ? timeout : timeoutConfig[method]
}

export function toNetworkMethod(name: string): WeapiNetworkMethod | undefined {
  return NETWORK_METHODS.has(name as WeapiNetworkMethod)
    ? (name as WeapiNetworkMethod)
    : undefined
}
