import { closeWechatIdeProject, isWechatIdeLoginRequiredError } from 'weapp-ide-cli'
import logger from '../../logger'
import { executeWechatIdeCliCommand } from './execute'

/**
 * @description 执行用户显式请求的 CLI close；失败时保留宿主，不升级为系统级退出。
 */
export async function closeIde() {
  try {
    await closeWechatIdeProject()
    return true
  }
  catch (error) {
    if (isWechatIdeLoginRequiredError(error)) {
      try {
        await executeWechatIdeCliCommand(['close'], {
          cancelLevel: 'warn',
          onNonLoginError: retryError => logger.error(retryError),
          onRetry: () => logger.info('正在重试连接微信开发者工具...'),
        })
        return true
      }
      catch (retryError) {
        logger.error(retryError)
      }
    }
    else {
      logger.warn('微信开发者工具 CLI close 执行失败，已保留现有宿主；请在开发者工具中手动关闭目标项目。')
      logger.error(error)
    }

    return false
  }
}
