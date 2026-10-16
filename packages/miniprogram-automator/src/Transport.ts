import type { Buffer } from 'node:buffer'
/**
 * @file WebSocket 传输层实现。
 */
import type WebSocket from 'ws'
import { EventEmitter } from 'node:events'
/** Transport 的实现。 */
export default class Transport extends EventEmitter {
  private closed = false
  private terminating = false
  private closing?: Promise<void>
  constructor(private ws: WebSocket) {
    super()
    ws.on('message', (data: string | Buffer | ArrayBuffer | Buffer[]) => {
      this.emit('message', typeof data === 'string' ? data : data.toString())
    })
    ws.on('close', () => {
      this.closed = true
      this.emit('close')
    })
  }

  send(message: string) {
    this.ws.send(message)
  }

  close(): Promise<void> {
    if (this.closing) {
      return this.closing
    }
    if (this.closed || this.ws.readyState === 3) {
      return this.closing = Promise.resolve()
    }
    this.closing = new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout>
      const finish = () => {
        clearTimeout(timer)
        this.off('close', finish)
        resolve()
      }
      timer = setTimeout(() => {
        this.off('close', finish)
        reject(Object.assign(new Error('DevTools websocket did not close within 2000ms'), { code: 'DEVTOOLS_DISCONNECT_TIMEOUT' }))
      }, 2_000)
      this.once('close', finish)
      try {
        if (!this.terminating) {
          this.terminating = true
          // 立即终止本地套接字；只等待关闭事件，不等待宿主关闭握手。
          this.ws.terminate()
        }
      }
      catch (error) {
        this.terminating = false
        clearTimeout(timer)
        this.off('close', finish)
        reject(error)
      }
    }).catch((error: unknown) => {
      this.closing = undefined
      throw error
    })
    return this.closing
  }
}
