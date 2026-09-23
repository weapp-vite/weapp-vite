import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { getMiniProgramRuntimeGlobalObject, resolveCurrentMiniProgramPlatform } from '../../platform'
import { registerAlipayComponentDefinition } from './alipayRegistration'

type ImportMetaWithEnv = ImportMeta & { env?: { PLATFORM?: string } }
type RegisterComponentDefinition = (componentDefinition: Record<string, any>, isPage: boolean) => void

function registerWechatCompatibleComponentDefinition(componentDefinition: Record<string, any>) {
  const statefulHmrBridge = getMiniProgramRuntimeGlobalObject()?.[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
  if (typeof statefulHmrBridge?.Component === 'function') {
    statefulHmrBridge.Component(componentDefinition)
    return
  }
  Component(componentDefinition)
}

function registerDetectedComponentDefinition(componentDefinition: Record<string, any>, isPage: boolean) {
  if (resolveCurrentMiniProgramPlatform() === 'alipay') {
    registerAlipayComponentDefinition(componentDefinition, isPage)
    return
  }
  registerWechatCompatibleComponentDefinition(componentDefinition)
}

/**
 * 按编译目标选择宿主注册器，未声明目标时保留运行时探测。
 * 支付宝页面使用 Page 契约，Web 由自己的 Component bridge 接管。
 */
export const registerNativeComponentDefinition: RegisterComponentDefinition
  = (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'alipay'
    ? registerAlipayComponentDefinition
    : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'weapp'
      || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'tt'
      || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'swan'
      || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'jd'
      || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'xhs'
      || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'web'
        ? registerWechatCompatibleComponentDefinition
        : registerDetectedComponentDefinition
