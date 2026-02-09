import type { MpPlatform } from '../types'
import path from 'pathe'
import {
  formatRetryHotkeyPrompt,
  formatWechatIdeLoginRequiredError,
  isWechatIdeLoginRequiredError,
  parse,
  waitForRetryKeypress,
} from 'weapp-ide-cli'
import logger, { colors } from '../logger'

export async function openIde(platform?: MpPlatform, projectPath?: string) {
  const argv = ['open', '-p']
  if (projectPath) {
    argv.push(projectPath)
  }
  if (platform === 'alipay') {
    argv.push('--platform', platform)
  }

  await runWechatIdeOpenWithRetry(argv)
}

/**
 * @description 执行 IDE 打开流程，并在登录失效时允许按键重试。
 */
async function runWechatIdeOpenWithRetry(argv: string[]) {
  let retrying = true

  while (retrying) {
    try {
      await parse(argv)
      return
    }
    catch (error) {
      if (!isWechatIdeLoginRequiredError(error)) {
        logger.error(error)
        return
      }

      logger.error('检测到微信开发者工具登录状态失效，请先登录后重试。')
      logger.warn(formatWechatIdeLoginRequiredError(error))

      logger.info(formatRetryHotkeyPrompt())
      const shouldRetry = await waitForRetryKeypress()

      if (!shouldRetry) {
        logger.warn('已取消重试。完成登录后请重新执行当前命令。')
        retrying = false
        continue
      }

      logger.info(colors.bold(colors.green('正在重试连接微信开发者工具...')))
    }
  }
}

/**
 * @description 根据 mpDistRoot 推导 IDE 项目目录（目录内应包含 project/mini 配置）
 */
export function resolveIdeProjectPath(mpDistRoot?: string) {
  if (!mpDistRoot || !mpDistRoot.trim()) {
    return undefined
  }
  const parent = path.dirname(mpDistRoot)
  if (!parent || parent === '.') {
    return undefined
  }
  return parent
}
