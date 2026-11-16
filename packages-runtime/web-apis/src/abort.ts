import { RequestGlobalsEventTarget } from './shared'

function createAbortError() {
  if (typeof DOMException === 'function') {
    return new DOMException('The operation was aborted.', 'AbortError')
  }
  const error = new Error('The operation was aborted.')
  error.name = 'AbortError'
  return error
}

export class AbortSignalPolyfill extends RequestGlobalsEventTarget {
  aborted = false
  reason: unknown
  onabort: ((event: { type: string }) => void) | null = null

  throwIfAborted() {
    if (this.aborted) {
      throw this.reason === undefined ? createAbortError() : this.reason
    }
  }
}

export class AbortControllerPolyfill {
  readonly signal = new AbortSignalPolyfill()

  abort(reason?: unknown) {
    if (this.signal.aborted) {
      return
    }
    this.signal.aborted = true
    this.signal.reason = reason === undefined ? createAbortError() : reason
    this.signal.dispatchEvent({ type: 'abort' })
  }
}
