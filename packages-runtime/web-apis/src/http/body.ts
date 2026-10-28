import type { RequestGlobalsBlobLike } from '../shared'
import type { HeadersPolyfill } from './headers'
import { isUrlSearchParamsInstance } from '../constructors'
import { createMultipartBoundary, encodeMultipartFormData } from '../multipart'
import { cloneArrayBuffer, cloneArrayBufferView, encodeText, isArrayBufferLike, isBlobLike } from '../shared'
import { ReadableStream } from '../streams'
import { isBodyStreamDisturbed, observeBodyStream } from '../streams/bodyTracking'
import { cloneBodyStream } from '../streams/cloneBody'
import { readBodyStream } from '../streams/readBody'
import { TextDecoderPolyfill } from '../textCodec'
import { BlobPolyfill, FormDataPolyfill } from '../web'

export type RequestBodyLike = string | ArrayBuffer | ArrayBufferView | Blob | RequestGlobalsBlobLike | FormData | FormDataPolyfill | ReadableStream<Uint8Array<ArrayBuffer>> | null | undefined

interface BodyState {
  value: RequestBodyLike
  stream: ReadableStream<Uint8Array<ArrayBuffer>> | null
  used: boolean
  buffered: boolean
}

const bodies = new WeakMap<object, BodyState>()
const bufferedStreams = new WeakSet<ReadableStream>()

export function isReadableBodyStream(value: unknown): value is ReadableStream<Uint8Array<ArrayBuffer>> {
  return typeof value === 'object' && value !== null
    && typeof (value as ReadableStream).getReader === 'function'
    && typeof (value as ReadableStream).tee === 'function'
    && typeof (value as ReadableStream).locked === 'boolean'
}

function isFormData(value: unknown): value is FormData | FormDataPolyfill {
  return value instanceof FormDataPolyfill || (typeof FormData === 'function' && value instanceof FormData)
}

async function bodyBytes(value: RequestBodyLike, multipartBoundary?: string): Promise<ArrayBuffer> {
  if (value == null) {
    return new ArrayBuffer(0)
  }
  if (typeof value === 'string') {
    return encodeText(value)
  }
  if (isArrayBufferLike(value)) {
    return cloneArrayBuffer(value)
  }
  if (ArrayBuffer.isView(value)) {
    return cloneArrayBufferView(value)
  }
  if (isBlobLike(value)) {
    return cloneArrayBuffer(await value.arrayBuffer())
  }
  if (isReadableBodyStream(value)) {
    return readBodyStream(value)
  }
  return (await encodeMultipartFormData(value, multipartBoundary)).body
}

export function initializeBody(owner: HttpBody, input: unknown) {
  let value: RequestBodyLike
  let contentType = ''
  let multipartBoundary: string | undefined
  if (input == null) {
    value = null
  }
  else if (isReadableBodyStream(input)) {
    observeBodyStream(input)
    if (input.locked || isBodyStreamDisturbed(input)) {
      throw new TypeError('Body stream is locked or has already been consumed')
    }
    value = input
  }
  else if (isArrayBufferLike(input)) {
    value = cloneArrayBuffer(input)
  }
  else if (ArrayBuffer.isView(input)) {
    value = cloneArrayBufferView(input)
  }
  else if (isBlobLike(input)) {
    value = input
    contentType = input.type ?? ''
  }
  else if (isFormData(input)) {
    const snapshot = new FormDataPolyfill()
    for (const [name, entry] of input) {
      if (typeof entry === 'string') {
        snapshot.append(name, entry)
      }
      else {
        snapshot.append(name, entry)
      }
    }
    value = snapshot
    multipartBoundary = createMultipartBoundary(owner.headers.get('content-type'))
    contentType = `multipart/form-data; boundary=${multipartBoundary}`
  }
  else if (isUrlSearchParamsInstance(input)) {
    value = input.toString()
    contentType = 'application/x-www-form-urlencoded;charset=UTF-8'
  }
  else {
    value = String(input).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, scalar => scalar.length === 2 ? scalar : '\uFFFD')
    contentType = 'text/plain;charset=UTF-8'
  }
  if (contentType && !owner.headers.has('content-type')) {
    owner.headers.set('content-type', contentType)
  }
  let stream: ReadableStream<Uint8Array<ArrayBuffer>> | null = null
  if (isReadableBodyStream(value)) {
    stream = observeBodyStream(value)
  }
  else if (value !== null) {
    const buffered = value
    stream = observeBodyStream(new ReadableStream<Uint8Array<ArrayBuffer>>({
      async pull(controller) {
        try {
          const bytes = new Uint8Array(await bodyBytes(buffered, multipartBoundary))
          if (bytes.byteLength > 0) {
            controller.enqueue(bytes)
          }
          controller.close()
        }
        catch (error) {
          controller.error(error)
        }
      },
    }, { highWaterMark: 0 }))
  }
  const buffered = !isReadableBodyStream(value) || bufferedStreams.has(value)
  if (stream && buffered) {
    bufferedStreams.add(stream)
  }
  bodies.set(owner, { value, stream, used: false, buffered })
}

export function getBodyValue(owner: object) {
  return bodies.get(owner)?.value
}

/** 小程序宿主只能发送完整请求体；缓冲 Body 的 clone 分支仍属于有限上传。 */
export function isStreamingRequestBody(owner: object) {
  return bodies.get(owner)?.buffered === false
}

export function assertBodyUnused(owner: object) {
  const state = bodies.get(owner)
  if (state?.used || (state?.stream && (state.stream.locked || isBodyStreamDisturbed(state.stream)))) {
    throw new TypeError('Body has already been consumed')
  }
}

/** 在异步转换之前同步占用 body，确保并发读取与请求发送共享消费状态。 */
export function consumeBodyValue(owner: object) {
  assertBodyUnused(owner)
  const state = bodies.get(owner)
  if (state && state.value != null) {
    state.used = true
    if (!isReadableBodyStream(state.value)) {
      // 缓冲上传直接复用原始值，同时终结其公开流，避免发送后再次读取同一 Body。
      void state.stream!.getReader().cancel()
    }
  }
  return state?.value
}

/** clone 的两条分支独立消费，但保留底层取消与错误传播。 */
export function cloneBodyValue(owner: object) {
  assertBodyUnused(owner)
  const state = bodies.get(owner)
  if (!state?.stream) {
    return null
  }
  const [original, clone] = cloneBodyStream(state.stream)
  state.stream = observeBodyStream(original)
  state.value = original
  if (state.buffered) {
    bufferedStreams.add(original)
    bufferedStreams.add(clone)
  }
  return clone
}

/** Request 构造的继承是所有权转移；原请求立即失去读取权，新请求按需拉取。 */
export function transferBodyValue(owner: object) {
  const value = consumeBodyValue(owner)
  if (!isReadableBodyStream(value)) {
    return value
  }
  const reader = value.getReader()
  const transferred = new ReadableStream<Uint8Array<ArrayBuffer>>({
    async pull(controller) {
      try {
        const chunk = await reader.read()
        if (chunk.done) {
          controller.close()
        }
        else {
          controller.enqueue(chunk.value)
        }
      }
      catch (error) {
        controller.error(error)
      }
    },
    cancel: reason => reader.cancel(reason),
  }, { highWaterMark: 0 })
  if (bodies.get(owner)?.buffered) {
    bufferedStreams.add(transferred)
  }
  return transferred
}

/** 仅供 Request/Response 内部复用，不作为包的公开导出。 */
export abstract class HttpBody {
  abstract readonly headers: HeadersPolyfill

  get body(): ReadableStream<Uint8Array<ArrayBuffer>> | null {
    return bodies.get(this)?.stream ?? null
  }

  get bodyUsed() {
    const state = bodies.get(this)
    return state?.used === true || Boolean(state?.stream && isBodyStreamDisturbed(state.stream))
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    assertBodyUnused(this)
    const state = bodies.get(this)
    if (!state?.stream) {
      return new ArrayBuffer(0)
    }
    state.used = true
    return readBodyStream(state.stream)
  }

  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await this.arrayBuffer())
  }

  async text(): Promise<string> {
    return new TextDecoderPolyfill().decode(await this.arrayBuffer())
  }

  async json(): Promise<any> {
    return JSON.parse(await this.text())
  }

  async blob(): Promise<Blob | BlobPolyfill> {
    const bytes = await this.arrayBuffer()
    const contentType = this.headers.get('content-type') ?? ''
    const type = /^[!#$%&'*+.^`|~\w-]+\/[!#$%&'*+.^`|~\w-]+(?:\s*;[^\r\n]*)?$/.test(contentType) ? contentType : ''
    const BlobConstructor = typeof Blob === 'function' ? Blob : BlobPolyfill
    return new BlobConstructor([bytes], { type })
  }

  async formData(): Promise<FormData> {
    throw new TypeError('formData is not supported in Body polyfill')
  }
}

export { readBodyStream } from '../streams/readBody'
