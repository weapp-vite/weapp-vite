import { REQUEST_GLOBAL_PLACEHOLDER_KEY } from '@weapp-core/constants'

type NativeStreams = Pick<typeof globalThis, 'ReadableStream' | 'WritableStream' | 'TransformStream' | 'Response'> & {
  bodyUsed: (this: Response) => boolean
}

function isUsableConstructor(value: unknown) {
  return typeof value === 'function'
    && !(value as unknown as Record<string, unknown>)[REQUEST_GLOBAL_PLACEHOLDER_KEY]
}

/** 安全捕获同一组宿主构造器；缺失全局或惰性属性抛错时整组回退，不重复触发宿主 getter。 */
function resolveNativeStreams(): NativeStreams | undefined {
  try {
    if (typeof globalThis === 'undefined') {
      return
    }
    const { ReadableStream, WritableStream, TransformStream } = globalThis
    if (![ReadableStream, WritableStream, TransformStream].every(isUsableConstructor)) {
      return
    }
    const { Response } = globalThis
    if (!isUsableConstructor(Response)) {
      return
    }
    const bodyUsed = Object.getOwnPropertyDescriptor(Response.prototype, 'bodyUsed')?.get
    if (!bodyUsed) {
      return
    }
    const readable = new ReadableStream({ start(controller) {
      controller.close()
    } })
    const writable = new WritableStream()
    const transform = new TransformStream()
    const response = new Response(readable)
    const compatible = typeof readable.getReader === 'function'
      && typeof readable.tee === 'function'
      && typeof readable.pipeThrough === 'function'
      && typeof writable.getWriter === 'function'
      && typeof writable.abort === 'function'
      && transform.readable instanceof ReadableStream
      && transform.writable instanceof WritableStream
      && response.body === readable
      && bodyUsed.call(response) === false
    if (!compatible) {
      return
    }
    const reader = readable.getReader()
    void reader.read()
    const disturbed = bodyUsed.call(response) === true
    reader.releaseLock()
    if (disturbed) {
      return { ReadableStream, WritableStream, TransformStream, Response, bodyUsed }
    }
  }
  catch {
  }
}

export const nativeStreams = resolveNativeStreams()
