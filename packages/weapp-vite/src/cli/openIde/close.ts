import { execFile } from 'node:child_process'
import process from 'node:process'
import { promisify } from 'node:util'
import path from 'pathe'
import { getConfig, isWechatIdeLoginRequiredError, parse } from 'weapp-ide-cli'
import logger from '../../logger'
import { executeWechatIdeCliCommand } from './execute'

const execFileAsync = promisify(execFile)

async function closeIdeByAppleScript() {
  if (process.platform !== 'darwin') {
    return false
  }

  const appName = process.env.WEAPP_DEVTOOLS_APP_NAME || 'wechatwebdevtools'
  try {
    await execFileAsync('osascript', ['-e', `tell application "${appName}" to quit`])
    return true
  }
  catch {
    return false
  }
}

async function closeIdeByProcessKill(cliPath: string | null) {
  if (!cliPath) {
    return false
  }

  const appContentsRoot = cliPath.includes('.app/')
    ? cliPath.slice(0, cliPath.indexOf('.app/') + '.app'.length)
    : path.dirname(path.dirname(cliPath))

  try {
    await execFileAsync('pkill', ['-f', appContentsRoot])
    return true
  }
  catch {
    return false
  }
}

/**
 * @description 关闭微信开发者工具，并在 CLI 不可用时回退到系统级关闭。
 */
export async function closeIde() {
  const config = await getConfig()
  const cliPath = config.cliPath?.trim() ? config.cliPath : null

  try {
    await parse(['close'])
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
      logger.warn('微信开发者工具 CLI close 执行失败，尝试回退为系统级关闭。')
      logger.error(error)
    }

    if (await closeIdeByAppleScript()) {
      logger.info('已回退为系统级关闭微信开发者工具。')
      return true
    }

    if (await closeIdeByProcessKill(cliPath)) {
      logger.info('已回退为进程级关闭微信开发者工具。')
      return true
    }

    return false
  }
}
