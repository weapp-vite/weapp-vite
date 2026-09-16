import type { HeadlessWxNetworkRequestTask, HeadlessWxRequestOption, HeadlessWxRequestSuccessResult } from '../../host'

type HeadersCallback = Parameters<NonNullable<HeadlessWxNetworkRequestTask['onHeadersReceived']>>[0]
type ChunkCallback = Parameters<NonNullable<HeadlessWxNetworkRequestTask['onChunkReceived']>>[0]
/** mock 与显式网络桥接共用终止状态；终止后不再分发 headers/chunk。 */
export function createRequestTask(option: HeadlessWxRequestOption, onAbort: () => void = () => {}) {
  const headers = new Set<HeadersCallback>()
  const chunks = new Set<ChunkCallback>()
  let settled = false
  function finish(result: HeadlessWxRequestSuccessResult | Error, success: boolean) {
    if (settled) {
      return
    }
    settled = true
    headers.clear()
    chunks.clear()
    try {
      if (success) {
        option.success?.(result as HeadlessWxRequestSuccessResult)
      }
      else {
        option.fail?.(result as Error)
      }
    }
    finally {
      option.complete?.(result)
    }
  }
  const task: Required<HeadlessWxNetworkRequestTask> = {
    abort() {
      if (settled) {
        return
      }
      const error = Object.assign(new Error('request:fail abort'), { errMsg: 'request:fail abort' })
      try {
        finish(error, false)
      }
      finally {
        onAbort()
      }
    },
    onHeadersReceived(callback) {
      headers.add(callback)
    },
    offHeadersReceived(callback) {
      if (callback) {
        headers.delete(callback)
      }
      else {
        headers.clear()
      }
    },
    onChunkReceived(callback) {
      chunks.add(callback)
    },
    offChunkReceived(callback) {
      if (callback) {
        chunks.delete(callback)
      }
      else {
        chunks.clear()
      }
    },
  }
  return {
    task,
    get settled() {
      return settled
    },
    headers(result: Parameters<HeadersCallback>[0]) {
      if (settled) {
        return
      }
      for (const callback of Array.from(headers)) {
        if (!settled && headers.has(callback)) {
          callback(result)
        }
      }
    },
    chunk(data: ArrayBuffer) {
      if (settled || !option.enableChunked) {
        return
      }
      for (const callback of Array.from(chunks)) {
        if (!settled && chunks.has(callback)) {
          callback({ data: data.slice(0) })
        }
      }
    },
    succeed(result: HeadlessWxRequestSuccessResult) {
      finish(result, true)
    },
    fail(error: Error) {
      finish(Object.assign(error, { errMsg: 'errMsg' in error ? error.errMsg : error.message }), false)
    },
  }
}
