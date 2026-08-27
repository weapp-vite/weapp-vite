import type { WeapiAdapter } from './types'
import { createNotSupportedError, hasCallbacks, isPlainObject } from './utils'

export interface CallWithPromiseHooks {
  onOptions?: (options: Record<string, any>, nextArgs: unknown[]) => void
  invoke?: (invoke: () => any) => void
  onInvokeResult?: (result: any) => void
  onInvokeError?: (error: unknown) => void
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

/**
 * @description 将错误按小程序回调风格分发；若无回调则返回 reject Promise。
 */
export function callWithError(error: unknown, args: unknown[]) {
  const lastArg = args.length > 0 ? args[args.length - 1] : undefined
  if (hasCallbacks(lastArg)) {
    lastArg.fail?.(error)
    lastArg.complete?.(error)
    return undefined
  }
  return Promise.reject(error)
}

/**
 * @description 统一 Promise 调用桥接，支持在 options/runtime result 阶段注入 hook。
 */
export function callWithPromise(
  context: WeapiAdapter,
  method: (...args: any[]) => any,
  args: unknown[],
  mapResult?: (result: any, args?: unknown[]) => any,
  hooks?: CallWithPromiseHooks,
) {
  return new Promise((resolve, reject) => {
    const { args: nextArgs, options } = resolveOptionsArg(args)
    let settled = false
    options.success = (res: any) => {
      settled = true
      resolve(mapResult ? mapResult(res, args) : res)
    }
    options.fail = (err: any) => {
      settled = true
      reject(err)
    }
    options.complete = (res: any) => {
      if (!settled) {
        resolve(mapResult ? mapResult(res, args) : res)
      }
    }
    try {
      hooks?.onOptions?.(options, nextArgs)
      const invoke = () => {
        try {
          const invokeResult = method.apply(context, nextArgs)
          hooks?.onInvokeResult?.(invokeResult)
          return invokeResult
        }
        catch (err) {
          hooks?.onInvokeError?.(err)
          reject(err)
          return undefined
        }
      }
      if (hooks?.invoke) {
        hooks.invoke(invoke)
      }
      else {
        invoke()
      }
    }
    catch (err) {
      hooks?.onInvokeError?.(err)
      reject(err)
    }
  })
}

/**
 * @description 处理方法缺失时的回调/Promise 行为。
 */
export function callMissingApi(methodName: string, platform: string | undefined, args: unknown[]) {
  return callWithError(createNotSupportedError(methodName, platform), args)
}
