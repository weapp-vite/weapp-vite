/**
 * @file 自动化协议连接实现。
 */
import { EventEmitter } from 'node:events'
import { createDebug } from 'obug'
import WebSocket from 'ws'
import { dateFormat, stringify, uuid } from './internal/compat'
import Transport from './Transport'

const debugProtocol = createDebug('automator:protocol')
const closeErrTip = 'Connection closed, check if wechat web devTools is still running'
const REQUEST_TIMEOUT = 30_000
const CONNECT_TIMEOUT = 30_000
interface PendingCallback {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}
interface SendOptions {
  timeout?: number
}
interface ProtocolResponse {
  id?: string
  method?: string
  error?: {
    message?: string
  }
  result?: any
  params?: any
}
interface ToolInfo {
  version?: string
}
/** Page frame 定向消息失效、需要切换到 App-service Page 协议的 DevTools 版本。 */
const APP_SERVICE_PAGE_PROTOCOL_VERSIONS = new Set([
  '2.01.2510290',
])
/** 仅页面方法调用失效的版本，元素查询仍保留原生组件作用域。 */
// Stable 2.02.2608080 / SDK 3.17.3 的 Page.callMethod 将 Promise 结果序列化为 {}。
// Nightly 2.02.2610082/2.02.2610092 / SDK 3.17.4 的同一协议无法访问真实 Page 方法，沿用 AppService 调用。
const APP_SERVICE_PAGE_METHOD_VERSIONS = new Set(['2.02.2608070', '2.02.2608080', '2.02.2609231', '2.02.2610082', '2.02.2610092'])
/** Connection 的实现。 */
export default class Connection extends EventEmitter {
  private disposed = false
  private callbacks = new Map<string, PendingCallback>()
  private useAppServicePageProtocol = false
  private useAppServicePageMethod = false
  constructor(private transport: Transport) {
    super()
    transport.on('message', this.onMessage)
    transport.on('close', this.onClose)
  }

  send(method: string, params: Record<string, any> = {}, options: SendOptions = {}) {
    if (this.disposed) {
      return Promise.reject(new Error(closeErrTip))
    }
    const id = uuid()
    const payload = stringify({ id, method, params })
    const requestTimeout = options.timeout ?? REQUEST_TIMEOUT
    debugProtocol(`${dateFormat('yyyy-mm-dd HH:MM:ss:l')} SEND ► ${payload}`)
    return new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.callbacks.delete(id)
        const error = new Error(`DevTools did not respond to protocol method ${method} within ${requestTimeout}ms`) as Error & {
          code: string
          method: string
        }
        error.code = 'DEVTOOLS_PROTOCOL_TIMEOUT'
        error.method = method
        reject(error)
      }, requestTimeout)

      this.callbacks.set(id, { resolve, reject, timeout })
      try {
        this.transport.send(payload)
      }
      catch (cause) {
        clearTimeout(timeout)
        this.callbacks.delete(id)
        reject(new Error(closeErrTip, { cause }))
      }
    })
  }

  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true
    this.onClose()
    this.transport.off('message', this.onMessage)
    this.transport.off('close', this.onClose)
    this.transport.close()
  }

  /** 根据 DevTools 版本选择稳定的 Page 协议实现。 */
  configureToolInfo(info: ToolInfo) {
    const version = String(info.version ?? '')
    this.useAppServicePageProtocol = APP_SERVICE_PAGE_PROTOCOL_VERSIONS.has(version)
    this.useAppServicePageMethod = this.useAppServicePageProtocol || APP_SERVICE_PAGE_METHOD_VERSIONS.has(version)
  }

  get prefersAppServicePageProtocol() {
    return this.useAppServicePageProtocol
  }

  /** 页面方法调用独立选择协议，不影响节点查询及其组件作用域。 */
  get prefersAppServicePageMethod() {
    return this.useAppServicePageMethod
  }

  private onMessage = (message: string) => {
    debugProtocol(`${dateFormat('yyyy-mm-dd HH:MM:ss:l')} ◀ RECV ${message}`)
    const payload = JSON.parse(message) as ProtocolResponse
    const { id, method, error, result, params } = payload
    if (!id) {
      this.emit(method!, params)
      return
    }
    const callback = this.callbacks.get(id)
    if (!callback) {
      return
    }
    this.callbacks.delete(id)
    clearTimeout(callback.timeout)
    if (error) {
      callback.reject(new Error(error.message || closeErrTip))
      return
    }
    callback.resolve(result)
  }

  private onClose = () => {
    for (const callback of this.callbacks.values()) {
      clearTimeout(callback.timeout)
      callback.reject(new Error(closeErrTip))
    }
    this.callbacks.clear()
  }

  static create(url: string, timeout = CONNECT_TIMEOUT, signal?: AbortSignal) {
    signal?.throwIfAborted()
    return new Promise<Connection>((resolve, reject) => {
      const ws = new WebSocket(url)
      let settled = false
      let timer: ReturnType<typeof setTimeout>
      let onAbort: () => void
      let onOpen: () => void
      let onClose: () => void
      function cleanup() {
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        ws.off('open', onOpen)
        ws.off('close', onClose)
      }
      function fail(error: unknown) {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        // 握手尚未完成时必须终止套接字，不能等待关闭握手。
        ws.terminate()
        reject(error)
      }
      onAbort = () => {
        fail(signal?.reason)
      }
      onClose = () => {
        fail(new Error('DevTools websocket closed before handshake completed'))
      }
      onOpen = () => {
        if (settled) {
          return
        }
        settled = true
        cleanup()
        resolve(new Connection(new Transport(ws)))
      }
      timer = setTimeout(() => fail(new Error(`Timed out connecting to DevTools websocket ${url} after ${timeout}ms`)), timeout)
      ws.on('open', onOpen)
      // 终止尚未完成的握手也会产生 error；保留监听直到套接字回收。
      ws.on('error', fail)
      ws.on('close', onClose)
      signal?.addEventListener('abort', onAbort, { once: true })
      if (signal?.aborted) {
        onAbort()
      }
    })
  }
}
