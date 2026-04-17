import type {
  WeapiMiniProgramConnectSocketOption,
  WeapiMiniProgramSocketTask,
} from '@wevu/api'
import { wpi } from '@wevu/api'
import { resolveUrlConstructor as resolveHostUrlConstructor, resolveTextEncoderConstructor } from './constructors'
import { cloneArrayBuffer, cloneArrayBufferView, RequestGlobalsEventTarget } from './shared'
import { URLPolyfill } from './url'
import { BlobPolyfill } from './web'

type WebSocketBinaryType = 'blob' | 'arraybuffer'
type WebSocketSendData = string | ArrayBuffer | ArrayBufferView | Blob
type WebSocketMessageData = string | ArrayBuffer | Blob | BlobPolyfill

const WHITESPACE_RE = /\s/u

interface WebSocketCloseEventLike {
  code: number
  reason: string
  type: 'close'
  wasClean: boolean
}

interface WebSocketErrorEventLike {
  error?: unknown
  message?: string
  type: 'error'
}

interface WebSocketMessageEventLike {
  data: WebSocketMessageData
  origin: string
  type: 'message'
}

function isValidProtocol(protocol: string) {
  return [...protocol].every((char) => {
    const code = char.charCodeAt(0)
    return code >= 0x21 && code <= 0x7E && char !== ',' && !WHITESPACE_RE.test(char)
  })
}

function createDomLikeError(name: string, message: string) {
  if (typeof DOMException === 'function') {
    return new DOMException(message, name)
  }
  const error = new Error(message)
  error.name = name
  return error
}

function encodeReasonLength(reason: string) {
  const TextEncoderConstructor = resolveTextEncoderConstructor()
  if (TextEncoderConstructor) {
    return new TextEncoderConstructor().encode(reason).byteLength
  }
  return unescape(encodeURIComponent(reason)).length
}

function normalizeCloseCode(code?: number) {
  if (code == null) {
    return undefined
  }
  if (code === 1000 || (code >= 3000 && code <= 4999)) {
    return code
  }
  throw createDomLikeError('InvalidAccessError', `Failed to execute close: invalid code "${code}"`)
}

function normalizeCloseReason(reason?: string) {
  if (reason == null) {
    return undefined
  }
  const normalized = String(reason)
  if (encodeReasonLength(normalized) > 123) {
    throw createDomLikeError('SyntaxError', 'Failed to execute close: reason is longer than 123 bytes')
  }
  return normalized
}

function resolveUrlConstructor() {
  return resolveHostUrlConstructor() ?? URLPolyfill
}

function normalizeProtocols(protocols?: string | string[]) {
  if (protocols == null) {
    return undefined
  }

  const list = Array.isArray(protocols) ? [...protocols] : [protocols]
  const normalized = list.map(protocol => String(protocol))
  const unique = new Set<string>()

  for (const protocol of normalized) {
    if (!isValidProtocol(protocol)) {
      throw new SyntaxError(`Failed to construct 'WebSocket': invalid subprotocol "${protocol}"`)
    }
    if (unique.has(protocol)) {
      throw new SyntaxError(`Failed to construct 'WebSocket': duplicated subprotocol "${protocol}"`)
    }
    unique.add(protocol)
  }

  return normalized
}

function normalizeUrl(url: string) {
  const ParsedUrl = resolveUrlConstructor()
  const parsed = new ParsedUrl(String(url))
  if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
    throw new SyntaxError(`Failed to construct 'WebSocket': invalid URL "${url}"`)
  }
  if (parsed.hash) {
    throw new SyntaxError(`Failed to construct 'WebSocket': URL contains fragment "${url}"`)
  }
  return parsed.toString()
}

function isSocketTask(value: unknown): value is WeapiMiniProgramSocketTask {
  return typeof value === 'object'
    && value !== null
    && typeof (value as WeapiMiniProgramSocketTask).send === 'function'
    && typeof (value as WeapiMiniProgramSocketTask).close === 'function'
}

function toBinaryPayload(data: WebSocketSendData) {
  if (typeof data === 'string') {
    return data
  }
  if (data instanceof ArrayBuffer) {
    return cloneArrayBuffer(data)
  }
  if (ArrayBuffer.isView(data)) {
    return cloneArrayBufferView(data)
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data.arrayBuffer()
  }
  throw new TypeError('Failed to execute send: data must be a string, ArrayBuffer, ArrayBufferView or Blob')
}

function createErrorEvent(error: { errMsg?: string } | unknown): WebSocketErrorEventLike {
  const message = typeof error === 'object' && error !== null && 'errMsg' in error
    ? String((error as { errMsg?: string }).errMsg ?? '')
    : error instanceof Error
      ? error.message
      : undefined
  return {
    type: 'error',
    error,
    message,
  }
}

function createCloseEvent(result: { code?: number, reason?: string } | undefined): WebSocketCloseEventLike {
  return {
    type: 'close',
    code: result?.code ?? 1000,
    reason: result?.reason ?? '',
    wasClean: (result?.code ?? 1000) === 1000,
  }
}

function createMessageEvent(url: string, data: WebSocketMessageData): WebSocketMessageEventLike {
  const origin = new (resolveUrlConstructor())(url).origin
  return {
    type: 'message',
    data,
    origin,
  }
}

function getRawConnectSocket() {
  const adapter = wpi.getAdapter?.() ?? wpi.raw
  const target = wpi.resolveTarget?.('connectSocket')
  if (!adapter || !target?.supported) {
    return undefined
  }
  const method = (adapter as unknown as Record<string, unknown>)[target.target]
  return typeof method === 'function'
    ? method.bind(adapter) as (options: WeapiMiniProgramConnectSocketOption) => WeapiMiniProgramSocketTask
    : undefined
}

export class WebSocketPolyfill extends RequestGlobalsEventTarget {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly CONNECTING = WebSocketPolyfill.CONNECTING
  readonly OPEN = WebSocketPolyfill.OPEN
  readonly CLOSING = WebSocketPolyfill.CLOSING
  readonly CLOSED = WebSocketPolyfill.CLOSED

  readonly extensions = ''
  readonly protocol = ''
  readonly url: string

  binaryType: WebSocketBinaryType = 'blob'
  bufferedAmount = 0
  readyState = WebSocketPolyfill.CONNECTING

  onclose: ((event: WebSocketCloseEventLike) => void) | null = null
  onerror: ((event: WebSocketErrorEventLike) => void) | null = null
  onmessage: ((event: WebSocketMessageEventLike) => void) | null = null
  onopen: ((event: { type: 'open' }) => void) | null = null

  private socketTask?: WeapiMiniProgramSocketTask

  constructor(url: string, protocols?: string | string[]) {
    super()
    this.url = normalizeUrl(url)
    const connectSocket = getRawConnectSocket()

    if (!connectSocket) {
      throw createDomLikeError('NotSupportedError', 'WebSocket is not supported in the current mini-program runtime')
    }

    const normalizedProtocols = normalizeProtocols(protocols)
    const task = connectSocket({
      url: this.url,
      protocols: normalizedProtocols,
      fail: (error) => {
        this.emitError(error)
        this.closeFromRuntime()
      },
    })

    if (!isSocketTask(task)) {
      throw createDomLikeError('NetworkError', 'Failed to create mini-program SocketTask')
    }

    this.socketTask = task
    task.onOpen(() => {
      if (this.readyState !== WebSocketPolyfill.CONNECTING) {
        return
      }
      this.readyState = WebSocketPolyfill.OPEN
      this.dispatchEvent({ type: 'open' })
    })
    task.onMessage((result) => {
      if (this.readyState === WebSocketPolyfill.CLOSED) {
        return
      }
      const data = typeof result.data === 'string'
        ? result.data
        : this.binaryType === 'arraybuffer'
          ? cloneArrayBuffer(result.data)
          : new BlobPolyfill([cloneArrayBuffer(result.data)])
      this.dispatchEvent(createMessageEvent(this.url, data))
    })
    task.onError((error) => {
      this.emitError(error)
    })
    task.onClose((result) => {
      this.closeFromRuntime(result)
    })
  }

  close(code?: number, reason?: string) {
    if (this.readyState === WebSocketPolyfill.CLOSING || this.readyState === WebSocketPolyfill.CLOSED) {
      return
    }

    const normalizedCode = normalizeCloseCode(code)
    const normalizedReason = normalizeCloseReason(reason)
    this.readyState = WebSocketPolyfill.CLOSING
    this.socketTask?.close({
      code: normalizedCode,
      reason: normalizedReason,
      fail: (error) => {
        this.emitError(error)
      },
    })
  }

  send(data: WebSocketSendData) {
    if (this.readyState === WebSocketPolyfill.CONNECTING) {
      throw createDomLikeError('InvalidStateError', 'Failed to execute send: WebSocket is still in CONNECTING state')
    }
    if (this.readyState !== WebSocketPolyfill.OPEN || !this.socketTask) {
      throw createDomLikeError('InvalidStateError', 'Failed to execute send: WebSocket is not open')
    }

    const payload = toBinaryPayload(data)
    if (payload instanceof Promise) {
      payload.then((resolved) => {
        this.socketTask?.send({
          data: resolved,
          fail: (error) => {
            this.emitError(error)
          },
        })
      }).catch((error) => {
        this.emitError(error)
      })
      return
    }

    this.socketTask.send({
      data: payload,
      fail: (error) => {
        this.emitError(error)
      },
    })
  }

  private closeFromRuntime(result?: { code?: number, reason?: string }) {
    if (this.readyState === WebSocketPolyfill.CLOSED) {
      return
    }
    this.readyState = WebSocketPolyfill.CLOSED
    this.dispatchEvent(createCloseEvent(result))
  }

  private emitError(error: unknown) {
    this.dispatchEvent(createErrorEvent(error))
  }
}
