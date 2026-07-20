import type { InlineConfig } from 'vite'
import type { ResolvedBackendExecution } from '../backends'
import type { MpPlatform } from '../types'
import { defu } from '@weapp-core/shared'
import { resolveBackendExecution } from '../backends'
import logger, { colors } from '../logger'

export interface RuntimeTargets extends ResolvedBackendExecution {
  platform?: MpPlatform
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
  const execution = resolveBackendExecution(rawPlatform, {
    warn: message => logger.warn(message),
  })
  const miniBackend = execution.get('miniprogram')

  return {
    ...execution,
    platform: miniBackend?.platform as MpPlatform | undefined,
    rawPlatform,
  }
}

export function createInlineConfig(
  execution: RuntimeTargets,
  options: { scope?: string, host?: string | boolean } = {},
): InlineConfig | undefined {
  const configs = execution.entries
    .map(entry => entry.driver.createInlineConfig({
      execution,
      platform: entry.platform,
      scope: options.scope,
      host: options.host,
    }))
    .filter((config): config is InlineConfig => Boolean(config))
  if (configs.length === 0) {
    return undefined
  }
  return configs.slice(1).reduce(
    (merged, config) => defu<InlineConfig, InlineConfig[]>(merged, config),
    configs[0],
  )
}
