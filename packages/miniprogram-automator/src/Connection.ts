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
/** Connection 的实现。 */
export default class Connection extends EventEmitter {
  private callbacks = new Map<string, PendingCallback>()
  constructor(private transport: Transport) {
    super()
    transport.on('message', this.onMessage)
    transport.on('close', this.onClose)
  }

  send(method: string, params: Record<string, any> = {}, options: SendOptions = {}) {
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
      catch {
        clearTimeout(timeout)
        this.callbacks.delete(id)
        reject(new Error(closeErrTip))
      }
    })
  }

  dispose() {
    this.transport.close()
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

  static create(url: string, timeout = CONNECT_TIMEOUT) {
    return new Promise<Connection>((resolve, reject) => {
      const ws = new WebSocket(url)
      let settled = false
      const timer = setTimeout(() => {
        if (settled) {
          return
        }
        settled = true
        ws.close()
        reject(new Error(`Timed out connecting to DevTools websocket ${url} after ${timeout}ms`))
      }, timeout)
      ws.on('open', () => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        resolve(new Connection(new Transport(ws)))
      })
      ws.on('error', (error) => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        reject(error)
      })
    })
  }
}
