import type { ViteDevServer } from 'vite'
import type { ConfigService } from '../context'
import { resolveCommand } from 'package-manager-detector/commands'
import logger, { colors } from '../logger'
import { getProjectConfigFileName } from '../utils'

let logBuildAppFinishOnlyShowOnce = false

function collectServerUrls(webServer?: ViteDevServer) {
  const urls = webServer?.resolvedUrls
  if (!urls) {
    return []
  }
  return [...(urls.local ?? []), ...(urls.network ?? [])]
}

export function logBuildAppFinish(
  configService: ConfigService,
  webServer?: ViteDevServer | undefined,
  options: { skipMini?: boolean, skipWeb?: boolean, uiUrls?: string[] } = {},
) {
  if (logBuildAppFinishOnlyShowOnce) {
    return
  }
  const { skipMini = false, skipWeb = false, uiUrls = [] } = options
  const webUrls = skipWeb ? [] : collectServerUrls(webServer)
  if (skipMini) {
    logger.success('开发服务已就绪：')
    if (webUrls.length > 0) {
      logger.info(`Web：${colors.cyan(webUrls[0])}`)
    }
    else {
      logger.info('Web：已启动')
    }
    logBuildAppFinishOnlyShowOnce = true
    return
  }

  const { command, args } = resolveCommand(
    configService.packageManager.agent,
    'run',
    ['open'],
  ) ?? {
    command: 'npm',
    args: ['run', 'open'],
  }
  const devCommand = `${command} ${args.join(' ')}`
  logger.success('开发服务已就绪：')
  logger.info(`小程序：执行 ${colors.bold(colors.green(devCommand))}，或手动导入 ${colors.green(getProjectConfigFileName(configService.platform))}`)
  if (uiUrls.length > 0) {
    logger.info(`UI：${colors.cyan(uiUrls[0])}`)
  }
  else if (!skipMini) {
    logger.info('UI：未启用')
  }
  if (webUrls.length > 0) {
    logger.info(`Web：${colors.cyan(webUrls[0])}`)
  }
  const projectConfigFileName = getProjectConfigFileName(configService.platform)
  if (!uiUrls.length && !webUrls.length) {
    logger.info(`提示：手动打开对应平台开发者工具，导入根目录（${colors.green(projectConfigFileName)} 文件所在目录）`)
  }
  logBuildAppFinishOnlyShowOnce = true
}
