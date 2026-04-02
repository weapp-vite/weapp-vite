import { AbortControllerPolyfill } from './abort'
import { fetch as requestGlobalsFetch } from './fetch'
import { HeadersPolyfill, headersToObject } from './http'
import { RequestGlobalsEventTarget, resolveRequestGlobalsHost } from './shared'

type XhrBody = Document | XMLHttpRequestBodyInit | null | undefined

function createProgressEvent(type: string) {
  return { type, lengthComputable: false, loaded: 0, total: 0 }
}

function createError(type: 'error' | 'timeout' | 'abort') {
  const error = new Error(type)
  error.name = type === 'abort'
    ? 'AbortError'
    : type === 'timeout'
      ? 'TimeoutError'
      : 'NetworkError'
  return error
}

function resolveFetch() {
  const host = resolveRequestGlobalsHost()
  return typeof host.fetch === 'function' ? host.fetch.bind(host) : requestGlobalsFetch
}

export class XMLHttpRequestUploadPolyfill extends RequestGlobalsEventTarget {}

export class XMLHttpRequestPolyfill extends RequestGlobalsEventTarget {
  static readonly UNSENT = 0
  static readonly OPENED = 1
  static readonly HEADERS_RECEIVED = 2
  static readonly LOADING = 3
  static readonly DONE = 4

  readonly UNSENT = XMLHttpRequestPolyfill.UNSENT
  readonly OPENED = XMLHttpRequestPolyfill.OPENED
  readonly HEADERS_RECEIVED = XMLHttpRequestPolyfill.HEADERS_RECEIVED
  readonly LOADING = XMLHttpRequestPolyfill.LOADING
  readonly DONE = XMLHttpRequestPolyfill.DONE
  readonly upload = new XMLHttpRequestUploadPolyfill()

  readyState = XMLHttpRequestPolyfill.UNSENT
  response: any = null
  responseText = ''
  responseType: XMLHttpRequestResponseType = ''
  responseURL = ''
  status = 0
  statusText = ''
  timeout = 0
  withCredentials = false
  onreadystatechange: ((event: { type: string }) => void) | null = null
  onabort: ((event: { type: string }) => void) | null = null
  onerror: ((event: { type: string }) => void) | null = null
  onload: ((event: { type: string }) => void) | null = null
  onloadend: ((event: { type: string }) => void) | null = null
  onloadstart: ((event: { type: string }) => void) | null = null
  onprogress: ((event: { type: string }) => void) | null = null
  ontimeout: ((event: { type: string }) => void) | null = null

  private method = 'GET'
  private url = ''
  private readonly requestHeaders = new HeadersPolyfill()
  private responseHeaders = new HeadersPolyfill()
  private requestController: AbortController | AbortControllerPolyfill | null = null
  private timeoutId: ReturnType<typeof setTimeout> | null = null
  private sent = false

  open(method: string, url: string) {
    this.method = String(method || 'GET').toUpperCase()
    this.url = url
    this.status = 0
    this.statusText = ''
    this.response = null
    this.responseText = ''
    this.responseURL = ''
    this.responseHeaders = new HeadersPolyfill()
    this.sent = false
    this.transitionTo(XMLHttpRequestPolyfill.OPENED)
  }

  setRequestHeader(key: string, value: string) {
    if (this.readyState !== XMLHttpRequestPolyfill.OPENED || this.sent) {
      throw new Error('Failed to execute setRequestHeader: invalid readyState')
    }
    this.requestHeaders.append(key, value)
  }

  getAllResponseHeaders() {
    if (this.readyState < XMLHttpRequestPolyfill.HEADERS_RECEIVED) {
      return ''
    }

    let content = ''
    this.responseHeaders.forEach((value, key) => {
      content += `${key}: ${value}\r\n`
    })
    return content
  }

  getResponseHeader(key: string) {
    if (this.readyState < XMLHttpRequestPolyfill.HEADERS_RECEIVED) {
      return null
    }
    return this.responseHeaders.get(key)
  }

  abort() {
    if (!this.requestController) {
      return
    }
    this.requestController.abort()
  }

  async send(body?: XhrBody) {
    if (this.readyState !== XMLHttpRequestPolyfill.OPENED) {
      throw new Error('Failed to execute send: invalid readyState')
    }

    this.sent = true
    this.dispatchEvent({ type: 'loadstart' })
    this.upload.dispatchEvent(createProgressEvent('loadstart'))

    const Controller = typeof AbortController === 'function' ? AbortController : AbortControllerPolyfill
    const controller = new Controller()
    this.requestController = controller

    if (this.timeout > 0) {
      this.timeoutId = setTimeout(() => {
        controller.abort(createError('timeout'))
      }, this.timeout)
    }

    try {
      const response = await resolveFetch()(this.url, {
        method: this.method,
        headers: headersToObject(this.requestHeaders),
        body: body as BodyInit | undefined,
        signal: controller.signal,
      }) as Response

      this.responseHeaders = typeof Headers === 'function' && response.headers instanceof Headers
        ? response.headers as unknown as HeadersPolyfill
        : new HeadersPolyfill(response.headers)
      this.status = response.status
      this.statusText = response.statusText ?? ''
      this.responseURL = response.url ?? this.url
      this.transitionTo(XMLHttpRequestPolyfill.HEADERS_RECEIVED)
      this.transitionTo(XMLHttpRequestPolyfill.LOADING)

      if (this.responseType === 'arraybuffer') {
        this.response = await response.arrayBuffer()
      }
      else {
        const text = await response.text()
        this.responseText = text
        this.response = this.responseType === 'json'
          ? text ? JSON.parse(text) : null
          : text
      }

      this.finish('load')
    }
    catch (error) {
      const reason = controller.signal && 'reason' in controller.signal ? controller.signal.reason : undefined
      if ((controller.signal as AbortSignal | undefined)?.aborted) {
        const type = reason instanceof Error && reason.name === 'TimeoutError' ? 'timeout' : 'abort'
        this.finish(type)
        return
      }

      this.response = null
      this.responseText = ''
      this.status = 0
      this.statusText = ''
      this.transitionTo(XMLHttpRequestPolyfill.DONE)
      this.dispatchEvent({ type: 'error' })
      this.dispatchEvent({ type: 'loadend' })
      throw error
    }
    finally {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId)
        this.timeoutId = null
      }
      this.requestController = null
    }
  }

  private finish(type: 'load' | 'abort' | 'timeout') {
    this.transitionTo(XMLHttpRequestPolyfill.DONE)
    if (type === 'abort') {
      this.dispatchEvent({ type: 'abort' })
    }
    else if (type === 'timeout') {
      this.dispatchEvent({ type: 'timeout' })
    }
    else {
      this.dispatchEvent(createProgressEvent('progress'))
      this.dispatchEvent({ type: 'load' })
    }
    this.dispatchEvent({ type: 'loadend' })
  }

  private transitionTo(nextState: number) {
    this.readyState = nextState
    this.dispatchEvent({ type: 'readystatechange' })
  }
}
