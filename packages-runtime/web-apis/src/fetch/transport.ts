/* eslint-disable ts/no-use-before-define -- 同一请求 owner 的终止函数与传输回调相互引用，统一使用提升的函数声明。 */
import type { WeapiMiniProgramRequestSuccessResult, WeapiMiniProgramRequestTask } from '@wevu/api'
import type { resolveRequestMeta } from './meta'
import { wpi } from '@wevu/api'
import { ResponsePolyfill } from '../http'
import { ReadableStream } from '../streams'
import { toHeaderMap } from './meta'

type RequestMeta = Awaited<ReturnType<typeof resolveRequestMeta>>

/** 缺少真实流式元数据时明确失败，避免把未知 HTTP 状态伪装为成功。 */
export function unsupportedStream(message: string) {
  const error = new Error(message)
  error.name = 'NotSupportedError'
  return error
}

function abortError(signal?: AbortSignal | null) {
  if (signal?.reason !== undefined) {
    return signal.reason
  }
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

function networkError(error: unknown) {
  const message = error && typeof error === 'object' && 'errMsg' in error ? String(error.errMsg) : String(error)
  return new TypeError(message)
}

/** 一个请求持有一个终止状态；返回 Response 不代表底层传输已经结束。 */
export function sendFetchRequest(meta: RequestMeta): Promise<Response> {
  if (meta.signal?.aborted) {
    return Promise.reject(abortError(meta.signal))
  }

  return new Promise<Response>((resolve, reject) => {
    const streaming = meta.miniProgram.enableChunked === true
    let task: WeapiMiniProgramRequestTask | undefined
    let terminated = false
    let responseStarted = false
    let abortPending = false
    let nullBody = meta.method === 'HEAD'
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined
    const body = streaming
      ? new ReadableStream<Uint8Array>({
          start(value) { controller = value },
          cancel() { stop(undefined, true) },
        })
      : null

    function cleanup() {
      meta.signal?.removeEventListener('abort', onAbort)
      task?.offHeadersReceived?.(onHeaders)
      task?.offChunkReceived?.(onChunk)
    }

    function abortTask() {
      if (task) {
        task.abort()
      }
      else {
        abortPending = true
      }
    }

    function stop(error?: unknown, cancel = false) {
      if (terminated) {
        return
      }
      terminated = true
      cleanup()
      if (error !== undefined) {
        controller?.error(error)
        if (!responseStarted) {
          reject(error)
        }
      }
      else if (!cancel) {
        controller?.close()
      }
      if (error !== undefined || cancel) {
        abortTask()
      }
    }

    function onAbort() {
      stop(abortError(meta.signal))
    }

    function respond(data: unknown, status: number, headers: unknown) {
      nullBody ||= [204, 205, 304].includes(status)
      const response = new ResponsePolyfill(nullBody ? null : data as any, {
        status,
        headers: toHeaderMap(headers),
        url: meta.url,
      }) as unknown as Response
      responseStarted = true
      resolve(response)
    }

    function onHeaders(result: WechatMiniprogram.RequestTaskOnHeadersReceivedListenerResult) {
      if (terminated || responseStarted) {
        return
      }
      if (!Number.isInteger(result.statusCode) || result.statusCode! < 200 || result.statusCode! > 599) {
        stop(unsupportedStream('Streaming fetch requires a real HTTP statusCode in onHeadersReceived'))
        return
      }
      respond(body, result.statusCode!, result.header)
    }

    function onChunk(result: { data: ArrayBuffer }) {
      if (terminated || nullBody) {
        return
      }
      if (!responseStarted) {
        stop(unsupportedStream('Streaming fetch requires response headers before chunks'))
        return
      }
      controller!.enqueue(new Uint8Array(result.data).slice())
    }

    function success(result: WeapiMiniProgramRequestSuccessResult) {
      if (terminated) {
        return
      }
      if (streaming && !responseStarted) {
        stop(unsupportedStream('Streaming fetch requires early response headers'))
        return
      }
      if (!streaming) {
        respond(result.data, result.statusCode, result.header)
      }
      stop()
    }

    meta.signal?.addEventListener('abort', onAbort, { once: true })
    // 监听安装与传输回调共用同一 owner；同步失败和取消也必须回收信号监听。
    try {
      const result = wpi.request({
        ...meta.miniProgram,
        url: meta.url,
        method: meta.method,
        header: meta.headers,
        data: meta.body,
        responseType: 'arraybuffer',
        success,
        fail: (error: unknown) => stop(networkError(error)),
      })
      if (result && typeof result.abort === 'function') {
        task = result
      }
      if (abortPending) {
        task?.abort()
      }
      if (terminated) {
        cleanup()
        return
      }
      if (streaming) {
        if (!task || typeof task.onHeadersReceived !== 'function' || typeof task.onChunkReceived !== 'function') {
          stop(unsupportedStream('Streaming fetch requires RequestTask headers and chunk listeners'))
          return
        }
        task.onHeadersReceived(onHeaders)
        if (terminated) {
          return
        }
        task.onChunkReceived(onChunk)
        if (terminated) {
          cleanup()
          return
        }
      }
      if (meta.signal?.aborted) {
        onAbort()
      }
    }
    catch (error) {
      stop(error)
    }
  })
}
