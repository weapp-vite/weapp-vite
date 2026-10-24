import type { ResolvedWechatDevtoolsTarget } from '../../../packages/weapp-ide-cli/src/devtoolsTarget'
import type { InstallationProcessSample, ResourceObservation } from './types'
import process from 'node:process'
import { sampleNativeInstallationProcesses } from './nativeInventory'

/** 非 Darwin 提前返回；Darwin 只使用同一原生身份帧采样链路。 */
export function sampleInstallationProcesses(target: ResolvedWechatDevtoolsTarget, platform = process.platform): Promise<ResourceObservation<InstallationProcessSample>> {
  return platform === 'darwin'
    ? sampleNativeInstallationProcesses(target)
    : Promise.resolve({ status: 'unavailable', reason: `Selected-installation RSS sampling is not implemented for ${platform}.` })
}
