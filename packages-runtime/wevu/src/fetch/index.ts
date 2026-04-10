import type { WevuFetchInit, WevuFetchInput } from './types'
import { wpi } from '@wevu/api'
import { resolveRequestMeta } from './body'
import { createFetchResponse, normalizeResponseHeaders } from './response'
import { createAbortError, isObject } from './shared'

function isRequestTask(value: unknown): value is WechatMiniprogram.RequestTask {
  return isObject(value) && typeof value.abort === 'function'
}

/**
 * @description 使用 @wevu/api 的 request 能力实现 fetch 语义对齐
 */
export function fetch(input: WevuFetchInput, init?: WevuFetchInit): Promise<Response> {
  return resolveRequestMeta(input, init).then((meta) => {
    if (meta.signal?.aborted) {
      return Promise.reject(createAbortError())
    }

    return new Promise<Response>((resolve, reject) => {
      let settled = false
      let aborted = false
      let requestTask: WechatMiniprogram.RequestTask | undefined

      const onAbort = () => {
        if (settled) {
          return
        }
        aborted = true
        requestTask?.abort()
        settled = true
        reject(createAbortError())
      }

      if (meta.signal) {
        meta.signal.addEventListener('abort', onAbort, { once: true })
      }

      const cleanup = () => {
        if (meta.signal) {
          meta.signal.removeEventListener('abort', onAbort)
        }
      }

      const requestResult = wpi.request({
        url: meta.url,
        method: meta.method,
        header: meta.headers,
        data: meta.body,
        responseType: 'arraybuffer',
        success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
          if (settled) {
            return
          }
          settled = true
          cleanup()
          resolve(createFetchResponse(res.data, res.statusCode, normalizeResponseHeaders(res.header), meta.url))
        },
        fail: (err: unknown) => {
          if (settled) {
            return
          }
          settled = true
          cleanup()
          if (aborted) {
            reject(createAbortError())
            return
          }
          const message = isObject(err) && typeof err.errMsg === 'string'
            ? err.errMsg
            : String(err)
          reject(new TypeError(message))
        },
      })
      requestTask = isRequestTask(requestResult) ? requestResult : undefined
    })
  })
}

export type { WevuFetchInit, WevuFetchInput } from './types'
