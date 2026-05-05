import type { InlineConfig } from 'vite'
import type { MpPlatform } from '../types'
import logger, { colors } from '../logger'
import { resolveWeappViteTarget } from '../runtimeTarget'

export interface RuntimeTargets {
  runMini: boolean
  runWeb: boolean
  platform?: MpPlatform
  label: string
  rawPlatform?: string
}

export function logRuntimeTarget(
  targets: RuntimeTargets,
  options: { silent?: boolean, resolvedConfigPlatform?: MpPlatform } = {},
) {
  if (options.silent) {
    return
  }
  if (targets.label === 'config') {
    const resolvedPlatform = targets.platform ?? options.resolvedConfigPlatform
    if (resolvedPlatform) {
      logger.info(`目标平台：${colors.green(resolvedPlatform)}`)
      return
    }
    logger.info(`目标平台：使用配置文件中的 ${colors.bold(colors.green('weapp.platform'))}`)
    return
  }
  logger.info(`目标平台：${colors.green(targets.label)}`)
}

export function resolveRuntimeTargets(options: { platform?: string, p?: string }): RuntimeTargets {
  const rawPlatform = typeof options.platform === 'string'
    ? options.platform
    : typeof options.p === 'string'
      ? options.p
      : undefined
  const target = resolveWeappViteTarget(rawPlatform, {
    warn: message => logger.warn(message),
  })

  return {
    runMini: target.runMini,
    runWeb: target.runWeb,
    platform: target.kind === 'miniprogram' ? target.platform as MpPlatform | undefined : undefined,
    label: target.label,
    rawPlatform,
  }
}

export function createInlineConfig(platform: MpPlatform | undefined): InlineConfig | undefined {
  if (!platform) {
    return undefined
  }
  return {
    weapp: {
      platform,
    },
  }
}
