import type { MiniProgramRuntimeCapabilities, MpPlatform } from '@weapp-core/shared/platforms/runtime'
import type { MiniProgramGlobal } from './globals'
import { ALIPAY_RUNTIME_DESCRIPTOR, DEFAULT_RUNTIME_CAPABILITIES, TT_RUNTIME_DESCRIPTOR } from '@weapp-core/shared/platforms/runtime'
import { getDetectedMiniProgramRuntimeCapabilities, getMiniProgramGlobalObject, resolveDetectedMiniProgramPlatform } from './generic'
import { getAlipayGlobalObject, getBaiduGlobalObject, getDouyinCompatibleGlobalObject, getJdGlobalObject, getWechatGlobalObject, getXhsGlobalObject } from './globals'

type ImportMetaWithEnv = ImportMeta & { env?: { PLATFORM?: string } }

// 保持目标判断直接位于函数选择处，发布与应用二次打包均可消除非目标模块。
export const getCurrentMiniProgramGlobalObject: () => MiniProgramGlobal | undefined
  = (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'weapp' || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'web'
    ? getWechatGlobalObject
    : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'alipay'
        ? getAlipayGlobalObject
        : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'tt'
            ? getDouyinCompatibleGlobalObject
            : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'swan'
                ? getBaiduGlobalObject
                : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'jd'
                    ? getJdGlobalObject
                    : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'xhs'
                        ? getXhsGlobalObject
                        : getMiniProgramGlobalObject

export const resolveCurrentMiniProgramPlatform: () => MpPlatform | undefined
  = (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'weapp' || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'web'
    ? () => 'weapp'
    : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'alipay'
        ? () => 'alipay'
        : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'tt'
            ? () => 'tt'
            : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'swan'
                ? () => 'swan'
                : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'jd'
                    ? () => 'jd'
                    : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'xhs'
                        ? () => 'xhs'
                        : resolveDetectedMiniProgramPlatform

export const getCurrentMiniProgramRuntimeCapabilities: () => MiniProgramRuntimeCapabilities
  = (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'alipay'
    ? () => ALIPAY_RUNTIME_DESCRIPTOR.runtime.capabilities
    : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'tt'
        ? () => TT_RUNTIME_DESCRIPTOR.runtime.capabilities
        : (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'weapp'
          || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'swan'
          || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'jd'
          || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'xhs'
          || (import.meta as ImportMetaWithEnv).env?.PLATFORM === 'web'
            ? () => DEFAULT_RUNTIME_CAPABILITIES
            : getDetectedMiniProgramRuntimeCapabilities
