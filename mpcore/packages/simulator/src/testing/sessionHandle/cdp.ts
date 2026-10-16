import type { HeadlessTestingProtocolOptions } from './protocol'
import { HeadlessTestingProtocolUnsupportedError } from './protocol'

export type HeadlessTestingCDPEventListener = (domain: string, event: string, params: unknown) => void

export interface HeadlessTestingCDP {
  enable: (options?: HeadlessTestingProtocolOptions) => Promise<unknown>
  sendCommand: <T = unknown>(domain: string, method: string, params?: Record<string, unknown>, options?: HeadlessTestingProtocolOptions) => Promise<T>
  listProtocol: <T = unknown>(options?: HeadlessTestingProtocolOptions) => Promise<T>
  onEvent: (listener: HeadlessTestingCDPEventListener) => () => void
}

interface CDPTarget {
  send: <T = unknown>(method: string, params?: Record<string, unknown>, options?: HeadlessTestingProtocolOptions) => Promise<T>
}

/** 保留官方调用形状；当前后端的 enable 会明确报告不支持。 */
export function createHeadlessTestingCDP(target: CDPTarget, assertActive: () => void): HeadlessTestingCDP {
  let enabling: Promise<unknown> | undefined
  const enable = (options?: HeadlessTestingProtocolOptions) => {
    enabling ??= target.send('App.CDPEnable', {}, options).catch((error: unknown) => {
      enabling = undefined
      throw error
    })
    return enabling
  }
  return {
    enable,
    async sendCommand<T>(domain: string, method: string, params: Record<string, unknown> = {}, options?: HeadlessTestingProtocolOptions) {
      await enable(options)
      return await target.send<T>('App.CDPCommand', { domain, method, params }, options)
    },
    async listProtocol<T>(options?: HeadlessTestingProtocolOptions) {
      await enable(options)
      return await target.send<T>('App.CDPListProtocol', {}, options)
    },
    onEvent() {
      assertActive()
      throw new HeadlessTestingProtocolUnsupportedError('App.CDPEvent')
    },
  }
}
