import type { StartDevHotkeysOptions } from './types'
import { closeSharedMiniProgram } from 'weapp-ide-cli'
import logger, { colors } from '../../logger'
import { executeWechatIdeCliCommand } from '../openIde/execute'

type DevtoolsCacheCleanType = 'all' | 'compile'

function formatCacheLabel(cleanType: DevtoolsCacheCleanType) {
  return cleanType === 'all' ? '全部缓存' : 'compile 缓存'
}

/**
 * @description 清理微信开发者工具缓存，并在执行前关闭共享 automator 会话。
 */
export async function runDevtoolsCacheAction(options: StartDevHotkeysOptions, cleanType: DevtoolsCacheCleanType) {
  const cacheLabel = formatCacheLabel(cleanType)
  logger.info(`[dev action] 正在清理微信开发者工具${cacheLabel}...`)
  await closeSharedMiniProgram(options.projectPath)
  await executeWechatIdeCliCommand(['cache', '--clean', cleanType])
  logger.success(`[dev action] 微信开发者工具${cacheLabel}已清理。`)
  return `已清理微信开发者工具${cacheLabel}`
}

/**
 * @description 通知微信开发者工具重新编译当前项目。
 */
export async function runDevtoolsCompileAction(options: StartDevHotkeysOptions) {
  logger.info('[dev action] 正在通知微信开发者工具重新编译当前项目...')
  await executeWechatIdeCliCommand(['compile', '--project', options.projectPath])
  logger.success('[dev action] 微信开发者工具已收到重新编译指令。')
  return '已通知微信开发者工具重新编译当前项目'
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
  return summary ?? '已重新打开微信开发者工具项目'
}
