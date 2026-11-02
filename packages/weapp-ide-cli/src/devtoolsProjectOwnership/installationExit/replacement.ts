import type { ResolvedWechatDevtoolsTarget } from '../../devtoolsTarget'
import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'

export const replacementTargetSchema = z.object({
  cliPath: z.string().min(1),
  appPath: z.string().min(1),
  installationId: z.string().min(1),
  profileDir: z.string().min(1),
  version: z.string().regex(/^\d+(?:\.\d+){2,}$/),
  channel: z.enum(['stable', 'rc', 'nightly']),
}).strict()

/** 显式替换仅允许同一安装路径和 profile 的已知产品元数据变化。 */
export function isPermittedInstallationReplacement(target: ResolvedWechatDevtoolsTarget, replacementTarget: ResolvedWechatDevtoolsTarget) {
  if (!replacementTargetSchema.safeParse(target).success || !replacementTargetSchema.safeParse(replacementTarget).success) {
    return false
  }
  const { version, channel, ...identity } = target
  const { version: replacementVersion, channel: replacementChannel, ...replacementIdentity } = replacementTarget
  return isDeepStrictEqual(identity, replacementIdentity) && (version !== replacementVersion || channel !== replacementChannel)
}

export function assertInstallationReplacement(target: ResolvedWechatDevtoolsTarget, replacementTarget: ResolvedWechatDevtoolsTarget) {
  if (!isPermittedInstallationReplacement(target, replacementTarget)) {
    throw new Error('Installation-exit recovery requires an explicit same-installation replacement with valid changed version or channel metadata.')
  }
}
