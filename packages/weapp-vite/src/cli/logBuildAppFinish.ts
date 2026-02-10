import type { ViteDevServer } from 'vite'
import type { ConfigService } from '../context'
import { resolveCommand } from 'package-manager-detector/commands'
import logger, { colors } from '../logger'
import { getProjectConfigFileName } from '../utils'

let logBuildAppFinishOnlyShowOnce = false

export function logBuildAppFinish(
  configService: ConfigService,
  webServer?: ViteDevServer | undefined,
  options: { skipMini?: boolean, skipWeb?: boolean } = {},
) {
  if (logBuildAppFinishOnlyShowOnce) {
    return
  }
  const { skipMini = false, skipWeb = false } = options
  if (skipMini) {
    if (webServer) {
      const urls = webServer.resolvedUrls
      const candidates = urls
        ? [...(urls.local ?? []), ...(urls.network ?? [])]
        : []
      if (candidates.length > 0) {
        logger.success('Web 运行时已启动，浏览器访问：')
        for (const url of candidates) {
          logger.info(`  ➜  ${colors.cyan(url)}`)
        }
      }
      else {
        logger.success('Web 运行时已启动')
      }
    }
    else {
      logger.success('Web 运行时已启动')
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
  logger.success('应用构建完成！预览方式（2 种选其一即可）：')
  logger.info(`执行 ${colors.bold(colors.green(devCommand))} 可以直接在微信开发者工具里打开当前应用`)
  const projectConfigFileName = getProjectConfigFileName(configService.platform)
  logger.info(`或手动打开对应平台开发者工具，导入根目录（${colors.green(projectConfigFileName)} 文件所在目录），即可预览效果`)
  if (!skipWeb && webServer) {
    const urls = webServer.resolvedUrls
    const candidates = urls
      ? [...(urls.local ?? []), ...(urls.network ?? [])]
      : []
    if (candidates.length > 0) {
      logger.success('Web 运行时已启动，浏览器访问：')
      for (const url of candidates) {
        logger.info(`  ➜  ${colors.cyan(url)}`)
      }
    }
    else {
      logger.success('Web 运行时已启动')
    }
  }
  logBuildAppFinishOnlyShowOnce = true
}
