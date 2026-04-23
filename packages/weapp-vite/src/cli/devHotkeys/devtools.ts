import type { StartDevHotkeysOptions } from './types'
import { closeSharedMiniProgram } from 'weapp-ide-cli'
import logger, { colors } from '../../logger'
import { readLatestHmrProfileSummary } from '../hmrProfileSummary'

async function appendLatestHmrSummary(baseSummary: string, options: StartDevHotkeysOptions) {
  const summary = await readLatestHmrProfileSummary({
    cwd: options.cwd,
    relativeCwd: value => value.replace(`${options.cwd}/`, ''),
    weappViteConfig: options.weappViteConfig,
  })
  if (!summary) {
    return baseSummary
  }
  return `${baseSummary}；${summary.line}`
}

/**
 * @description 重置当前 DevTools automator 共享会话。
 */
export async function runResetDevtoolsSessionAction(options: StartDevHotkeysOptions) {
  logger.info('[dev action] 正在重置当前 DevTools 会话...')
  await closeSharedMiniProgram(options.projectPath)
  logger.success('[dev action] 当前 DevTools 会话已重置。')
  return '已重置当前 DevTools 会话'
}

/**
 * @description 重置共享会话并重开当前项目，以恢复 DevTools 状态。
 */
export async function runResetAndReopenDevtoolsAction(options: StartDevHotkeysOptions) {
  if (!options.openIde) {
    logger.warn('[dev action] 当前 dev 会话未提供重新打开微信开发者工具的能力。')
    return '重置并重开微信开发者工具不可用'
  }

  logger.info('[dev action] 正在重置当前 DevTools 会话并重开项目...')
  await closeSharedMiniProgram(options.projectPath)
  const summary = await options.openIde()
  logger.success('[dev action] 当前 DevTools 会话已重置，并已重新打开项目。')
  return await appendLatestHmrSummary(summary ?? '已重置当前 DevTools 会话并重新打开项目', options)
}

/**
 * @description 手动触发一次当前小程序 dev 重新构建。
 */
export async function runDevRebuildAction(options: StartDevHotkeysOptions) {
  if (!options.rebuild) {
    logger.warn('[dev action] 当前 dev 会话未提供手动重新构建能力。')
    return '手动重新构建不可用'
  }

  logger.info('[dev action] 正在手动重新构建当前小程序产物...')
  const summary = await options.rebuild()
  logger.success('[dev action] 当前小程序产物已手动重新构建。')
  return summary ?? '已手动重新构建当前小程序产物'
}

/**
 * @description 重新打开当前微信开发者工具项目，并主动清理共享 automator 会话。
 */
export async function runOpenIdeAction(options: StartDevHotkeysOptions) {
  if (!options.openIde) {
    logger.warn('[dev action] 当前 dev 会话未提供重新打开微信开发者工具的能力。')
    return '重新打开微信开发者工具不可用'
  }

  logger.info(`[dev action] 正在重新打开微信开发者工具项目：${colors.cyan(options.projectPath)}`)
  await closeSharedMiniProgram(options.projectPath)
  const summary = await options.openIde()
  logger.success('[dev action] 微信开发者工具项目已重新打开。')
  return await appendLatestHmrSummary(summary ?? '已重新打开微信开发者工具项目', options)
}
