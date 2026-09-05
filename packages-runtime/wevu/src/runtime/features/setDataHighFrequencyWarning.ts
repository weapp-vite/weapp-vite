import type { RuntimeCapabilityRegistry } from '../capabilities'
import { registerRuntimeCapability } from '../capabilities'
import { createSetDataHighFrequencyWarningMonitor } from '../register/setDataFrequencyWarning'

const setDataHighFrequencyWarningHooks: NonNullable<RuntimeCapabilityRegistry['setDataHighFrequencyWarning']> = {
  createMonitor: createSetDataHighFrequencyWarningMonitor,
}

/**
 * 安装可选的 setData 高频告警能力。
 */
export function installSetDataHighFrequencyWarning(): void {
  registerRuntimeCapability('setDataHighFrequencyWarning', setDataHighFrequencyWarningHooks)
}
