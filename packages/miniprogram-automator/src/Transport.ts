import type { Buffer } from 'node:buffer'
/**
 * @file WebSocket 传输层实现。
 */
import type WebSocket from 'ws'
import { EventEmitter } from 'node:events'
/** Transport 的实现。 */
export default class Transport extends EventEmitter {
  constructor(private ws: WebSocket) {
    super()
    ws.on('message', (data: string | Buffer | ArrayBuffer | Buffer[]) => {
      this.emit('message', typeof data === 'string' ? data : data.toString())
    })
    ws.on('close', () => {
      this.emit('close')
    })
  }

  send(message: string) {
    this.ws.send(message)
  }

  close() {
    this.ws.close()
  }
}
