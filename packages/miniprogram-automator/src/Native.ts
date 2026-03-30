/**
 * @file 原生能力桥接封装。
 */
import type Connection from './Connection'
import { EventEmitter } from 'node:events'
/** ISwitchTabOptions 的类型定义。 */
export interface ISwitchTabOptions {
  url: string
}
/** Native 的实现。 */
export default class Native extends EventEmitter {
  constructor(private connection: Connection) {
    super()
  }

  async goHome() {
    return await this.sendNative('goHome')
  }

  async navigateLeft() {
    return await this.sendNative('navigateLeft')
  }

  async confirmModal() {
    return await this.sendNative('confirmModal')
  }

  async cancelModal() {
    return await this.sendNative('cancelModal')
  }

  async switchTab(params: ISwitchTabOptions) {
    return await this.sendNative('switchTab', params)
  }

  async authorizeCancel() {
    return await this.sendNative('authorizeCancel')
  }

  async authorizeAllow() {
    return await this.sendNative('authorizeAllow')
  }

  async closePaymentDialog() {
    return await this.sendNative('closePaymentDialog')
  }

  async shareCancel() {
    return await this.sendNative('shareCancel')
  }

  async shareConfirm() {
    return await this.sendNative('shareConfirm')
  }

  private async send(method: string, params: Record<string, any> = {}) {
    return await this.connection.send(method, params)
  }

  private async sendNative(method: string, data?: Record<string, any>) {
    return await this.send('Tool.native', { method, data })
  }
}
