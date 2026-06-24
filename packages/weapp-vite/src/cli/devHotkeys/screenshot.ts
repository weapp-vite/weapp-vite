import type { ScreenshotResult } from 'weapp-ide-cli'
import type { StartDevHotkeysOptions } from './types'
import fs from 'node:fs/promises'
import path from 'pathe'
import { resolveProjectAutomatorPort, takeScreenshot } from 'weapp-ide-cli'
import logger, { colors } from '../../logger'
import { pauseActiveForwardConsole } from '../forwardConsole'

const DEV_SCREENSHOT_DIR = '.weapp-vite/dev-screenshots'
const DEFAULT_SCREENSHOT_TIMEOUT = 120_000

interface AppJsonShape {
  pages?: unknown
}

/**
 * @description 生成开发态截图输出路径。
 */
export function resolveDevScreenshotOutputPath(cwd: string, now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  return path.join(cwd, DEV_SCREENSHOT_DIR, `screenshot-${stamp}.png`)
}

function formatLogPath(cwd: string, targetPath: string) {
  const relativePath = path.relative(cwd, targetPath)
  if (!relativePath || relativePath.startsWith('..')) {
    return targetPath
  }
  return relativePath
}

function formatResolvedScreenshotPath(cwd: string, fallbackPath: string, result: ScreenshotResult) {
  return formatLogPath(cwd, result.path ?? fallbackPath)
}

async function resolveDefaultScreenshotPage(cwd: string) {
  try {
    const raw = await fs.readFile(path.join(cwd, 'app.json'), 'utf8')
    const appJson = JSON.parse(raw) as AppJsonShape
    const [firstPage] = Array.isArray(appJson.pages) ? appJson.pages : []
    return typeof firstPage === 'string' && firstPage.trim()
      ? firstPage
      : undefined
  }
  catch {
    return undefined
  }
}

/**
 * @description 执行当前页面截图并输出结果日志。
 */
export async function runScreenshotAction(options: StartDevHotkeysOptions) {
  const outputPath = resolveDevScreenshotOutputPath(options.cwd)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  const page = await resolveDefaultScreenshotPage(options.cwd)

  logger.info(`[dev action] 正在截图当前页面，输出到 ${colors.cyan(formatLogPath(options.cwd, outputPath))}`)
  const resumeForwardConsole = await pauseActiveForwardConsole()
  try {
    const result = await takeScreenshot({
      projectPath: options.projectPath,
      fullPage: true,
      ...(page ? { page } : {}),
      preserveProjectRoot: true,
      port: resolveProjectAutomatorPort(options.projectPath),
      retryWithFreshSession: false,
      outputPath,
      timeout: DEFAULT_SCREENSHOT_TIMEOUT,
    })
    const resolvedPath = formatResolvedScreenshotPath(options.cwd, outputPath, result)
    logger.success(`[dev action] 当前页面截图完成：${colors.cyan(resolvedPath)}`)
    return resolvedPath
  }
  finally {
    await resumeForwardConsole?.()
  }
}
