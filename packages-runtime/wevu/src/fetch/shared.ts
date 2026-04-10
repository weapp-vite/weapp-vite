import type { RequestLikeInput } from './types'

export const hasOwn = Object.prototype.hasOwnProperty

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function createAbortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

export function encodeText(text: string) {
  if (typeof TextEncoder === 'function') {
    return new TextEncoder().encode(text).buffer
  }
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xFF
  }
  return bytes.buffer
}

export function decodeText(buffer: ArrayBuffer) {
  if (typeof TextDecoder === 'function') {
    return new TextDecoder().decode(buffer)
  }
  const view = new Uint8Array(buffer)
  let text = ''
  for (const byte of view) {
    text += String.fromCharCode(byte)
  }
  return text
}

export function cloneBuffer(buffer: ArrayBuffer) {
  return buffer.slice(0)
}

export function cloneViewBuffer(view: ArrayBufferView) {
  const copied = new Uint8Array(view.byteLength)
  copied.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
  return copied.buffer
}

export function isRequestLikeInput(input: unknown): input is RequestLikeInput {
  return isObject(input) && typeof input.url === 'string'
}
