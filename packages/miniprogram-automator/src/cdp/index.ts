import type { EventEmitter } from 'node:events'

export interface CDPCommandOptions {
  /** 启用通道与执行命令共享的超时预算，单位毫秒。 */
  timeout?: number
}

export type CDPEventListener = (domain: string, event: string, params: any) => void

export interface CDPSession {
  enable: (options?: CDPCommandOptions) => Promise<unknown>
  sendCommand: <T = any>(domain: string, method: string, params?: Record<string, unknown>, options?: CDPCommandOptions) => Promise<T>
  listProtocol: (options?: CDPCommandOptions) => Promise<any>
  onEvent: (listener: CDPEventListener) => () => void
}

type Send = (method: string, params?: Record<string, any>, options?: CDPCommandOptions) => Promise<any>

/** 单个连接共享 CDP 启用状态与订阅；不创建额外 WebSocket。 */
export class CDPController {
  private enabling?: Promise<unknown>
  private enabled = false
  private stopped = false
  private readonly subscriptions = new Set<() => void>()
  readonly session: CDPSession

  constructor(private connection: Pick<EventEmitter, 'on' | 'off'>, private send: Send) {
    connection.on('close', this.stop)
    this.session = {
      enable: options => this.enable(options),
      sendCommand: (domain, method, params = {}, options) => this.request('App.CDPCommand', { domain, method, params }, options),
      listProtocol: options => this.request('App.CDPListProtocol', {}, options),
      onEvent: listener => this.onEvent(listener),
    }
  }

  enable(options?: CDPCommandOptions): Promise<unknown> {
    if (this.stopped) {
      return Promise.reject(new Error('CDP connection closed'))
    }
    try {
      this.validateTimeout(options)
    }
    catch (error) {
      return Promise.reject(error)
    }
    if (!this.enabling) {
      let pending: Promise<unknown>
      try {
        pending = this.send('App.CDPEnable', {}, options)
      }
      catch (error) {
        pending = Promise.reject(error)
      }
      this.enabling = pending.then(
        (result) => {
          this.enabled = true
          return result
        },
        (error: unknown) => {
          this.enabling = undefined
          throw error
        },
      )
    }
    if (options?.timeout === undefined) {
      return this.enabling
    }
    // 共享协议启用请求，每个等待者仍使用自己声明的超时。
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out enabling CDP within ${options.timeout}ms`)), options.timeout)
      this.enabling!.then(resolve, reject).finally(() => clearTimeout(timer))
    })
  }

  /** 日志显式刷新时重新注册事件通道，兼容 AppService 重载。 */
  refresh(options?: CDPCommandOptions) {
    if (this.enabled) {
      this.enabled = false
      this.enabling = undefined
    }
    return this.enable(options)
  }

  stop = () => {
    this.stopped = true
    this.enabled = false
    this.enabling = undefined
    this.connection.off('close', this.stop)
    for (const unsubscribe of this.subscriptions) {
      unsubscribe()
    }
  }

  private async request(method: string, params: Record<string, unknown>, options?: CDPCommandOptions) {
    this.validateTimeout(options)
    const startedAt = Date.now()
    await this.enable(options)
    if (this.stopped) {
      throw new Error('CDP connection closed')
    }
    if (options?.timeout === undefined) {
      return await this.send(method, params)
    }
    const timeout = options.timeout - (Date.now() - startedAt)
    if (timeout <= 0) {
      throw new Error(`Timed out executing ${method} within ${options.timeout}ms`)
    }
    return await this.send(method, params, { timeout })
  }

  private validateTimeout(options?: CDPCommandOptions) {
    if (options?.timeout !== undefined && (!Number.isFinite(options.timeout) || options.timeout <= 0)) {
      throw new RangeError('CDP timeout must be finite and positive')
    }
  }

  private onEvent(listener: CDPEventListener) {
    if (this.stopped) {
      throw new Error('CDP connection closed')
    }
    const receive = (payload: { domain: string, event: string, params: unknown }) => {
      listener(payload.domain, payload.event, payload.params)
    }
    const unsubscribe = () => {
      this.connection.off('App.CDPEvent', receive)
      this.subscriptions.delete(unsubscribe)
    }
    this.subscriptions.add(unsubscribe)
    this.connection.on('App.CDPEvent', receive)
    return unsubscribe
  }
}

const controllers = new WeakMap<object, CDPController>()

/** 一个协议连接仅拥有一份 CDP 状态，包括被不同 MiniProgram 包装的连接。 */
export function getCDPController(connection: Pick<EventEmitter, 'on' | 'off'>, send: Send) {
  let controller = controllers.get(connection)
  if (!controller) {
    controller = new CDPController(connection, send)
    controllers.set(connection, controller)
  }
  return controller
}
