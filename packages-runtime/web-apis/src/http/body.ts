import type { RequestGlobalsBlobLike } from '../shared'
import type { HeadersPolyfill } from './headers'
import { isUrlSearchParamsInstance } from '../constructors'
import { encodeMultipartFormData } from '../multipart'
import { cloneArrayBuffer, cloneArrayBufferView, decodeText, encodeText, isArrayBufferLike, isBlobLike } from '../shared'
import { BlobPolyfill, FormDataPolyfill } from '../web'

export type RequestBodyLike = string | ArrayBuffer | ArrayBufferView | Blob | RequestGlobalsBlobLike | FormData | FormDataPolyfill | null | undefined

interface BodyState {
  value: RequestBodyLike
  used: boolean
}

const bodies = new WeakMap<object, BodyState>()

function isFormData(value: unknown): value is FormData | FormDataPolyfill {
  return value instanceof FormDataPolyfill || (typeof FormData === 'function' && value instanceof FormData)
}

export function initializeBody(owner: HttpBody, input: unknown) {
  let value: RequestBodyLike
  let contentType = ''
  if (input == null) {
    value = null
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
    value = input
  }
  else if (isUrlSearchParamsInstance(input)) {
    value = input.toString()
    contentType = 'application/x-www-form-urlencoded;charset=UTF-8'
  }
  else {
    value = String(input)
    contentType = 'text/plain;charset=UTF-8'
  }
  if (contentType && !owner.headers.has('content-type')) {
    owner.headers.set('content-type', contentType)
  }
  bodies.set(owner, { value, used: false })
}

export function getBodyValue(owner: object) {
  return bodies.get(owner)?.value
}

export function assertBodyUnused(owner: object) {
  if (bodies.get(owner)?.used) {
    throw new TypeError('Body has already been consumed')
  }
}

/** 在异步转换之前同步占用 body，确保并发读取与请求发送共享消费状态。 */
export function consumeBodyValue(owner: object) {
  assertBodyUnused(owner)
  const state = bodies.get(owner)
  if (state && state.value != null) {
    state.used = true
  }
  return state?.value
}

async function bodyBytes(value: RequestBodyLike): Promise<ArrayBuffer> {
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
  return (await encodeMultipartFormData(value)).body
}

/** 仅供 Request/Response 内部复用，不作为包的公开导出。 */
export abstract class HttpBody {
  abstract readonly headers: HeadersPolyfill

  get body(): ReadableStream<Uint8Array> | null {
    return null
  }

  get bodyUsed() {
    return bodies.get(this)?.used === true
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return bodyBytes(consumeBodyValue(this))
  }

  async bytes(): Promise<Uint8Array<ArrayBuffer>> {
    return new Uint8Array(await this.arrayBuffer())
  }

  async text(): Promise<string> {
    return decodeText(await this.arrayBuffer())
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
