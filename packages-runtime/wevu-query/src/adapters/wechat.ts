import type { QueryHost } from '../bindings/plugin'

/** 微信网络类型读取结果。 */
export interface WechatNetworkTypeResult {
  readonly networkType: string
}

/** 微信网络状态变化事件。 */
export interface WechatNetworkStatusResult extends WechatNetworkTypeResult {
  readonly isConnected: boolean
}

/** 查询适配器依赖的最小微信宿主接口。 */
export interface WechatQueryHost {
  getNetworkType: (options: {
    success: (result: WechatNetworkTypeResult) => void
  }) => unknown
  onNetworkStatusChange: (listener: (result: WechatNetworkStatusResult) => void) => void
  /** 取消订阅仅按函数身份匹配，回调入参保持未知以兼容原生签名。 */
  offNetworkStatusChange: (listener: (result: unknown) => void) => void
  onAppShow: (listener: () => void) => void
  offAppShow: (listener: () => void) => void
  onAppHide: (listener: () => void) => void
  offAppHide: (listener: () => void) => void
}

function resolveOnline(result: WechatNetworkTypeResult | WechatNetworkStatusResult): boolean {
  return 'isConnected' in result ? result.isConnected : result.networkType !== 'none'
}

/** 将显式传入的微信宿主适配为查询插件的宿主状态源。 */
export function createWechatQueryHost(host: WechatQueryHost): QueryHost {
  return {
    subscribeOnline(callback) {
      let active = true
      let eventVersion = 0
      const initialVersion = eventVersion
      const onNetworkStatusChange = (result: unknown) => {
        if (
          !active
          || typeof result !== 'object'
          || result === null
          || !('isConnected' in result)
          || typeof result.isConnected !== 'boolean'
        ) {
          return
        }
        eventVersion += 1
        callback(result.isConnected)
      }
      const acceptInitial = (result: WechatNetworkTypeResult) => {
        if (!active || eventVersion !== initialVersion) {
          return
        }
        callback(resolveOnline(result))
      }

      host.onNetworkStatusChange(onNetworkStatusChange)
      try {
        host.getNetworkType({ success: acceptInitial })
      }
      catch (error) {
        active = false
        host.offNetworkStatusChange(onNetworkStatusChange)
        throw error
      }

      return () => {
        if (!active) {
          return
        }
        active = false
        host.offNetworkStatusChange(onNetworkStatusChange)
      }
    },
    subscribeForeground(callback) {
      let active = true
      const onAppShow = () => {
        if (active) {
          callback(true)
        }
      }
      const onAppHide = () => {
        if (active) {
          callback(false)
        }
      }
      host.onAppShow(onAppShow)
      try {
        host.onAppHide(onAppHide)
      }
      catch (error) {
        active = false
        host.offAppShow(onAppShow)
        throw error
      }

      return () => {
        if (!active) {
          return
        }
        active = false
        try {
          host.offAppShow(onAppShow)
        }
        finally {
          host.offAppHide(onAppHide)
        }
      }
    },
  }
}
