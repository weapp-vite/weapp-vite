import type { LayoutHostBinding, TemplateRefBinding } from '../../capabilities'
import { WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION, WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE } from '@weapp-core/constants'

export interface StatefulHmrRegistrationInputs {
  userObservers?: Record<string, unknown>
  userExport?: unknown
  propsAliases?: Record<string, string>
  propsDerivedKeys?: string[]
  templateRefs?: TemplateRefBinding[]
  layoutHosts?: LayoutHostBinding[]
  setupLifecycle: 'created' | 'attached'
  nativeSlotContext: boolean
}

/** 只向识别原始注册契约的桥接交付生成包装器，旧桥接必须保留兼容错误。 */
export function createStatefulHmrRegistrationContract(bridge: { registrationContractVersion?: unknown }, inputs: StatefulHmrRegistrationInputs) {
  if (bridge.registrationContractVersion !== WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION) {
    throw Object.assign(new Error('Stateful HMR bridge does not support the Wevu registration contract; classic rebuild is required.'), {
      code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE,
    })
  }
  return { version: WEAPP_VITE_STATEFUL_HMR_REGISTRATION_CONTRACT_VERSION, ...inputs }
}
