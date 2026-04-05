import type { ScreenshotResult } from 'weapp-ide-cli'
import fs from 'node:fs/promises'
import process from 'node:process'
import { emitKeypressEvents } from 'node:readline'
import path from 'pathe'
import { takeScreenshot } from 'weapp-ide-cli'
import logger, { colors } from '../logger'

export interface StartDevHotkeysOptions {
  cwd: string
  platform?: string
  projectPath: string
}

export interface DevHotkeysSession {
  close: () => void
}

const DEV_SCREENSHOT_DIR = '.tmp/weapp-vite-dev-screenshots'
const DEFAULT_SCREENSHOT_TIMEOUT = 30_000

/**
 * @description 生成开发态快捷键帮助文本。
 */
export function formatDevHotkeyHelp() {
  const key = (value: string) => colors.bold(colors.green(value))
  return `[dev shortcuts] 按 ${key('s')} 截图当前页面，按 ${key('h')} 重新显示帮助`
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

/**
 * @description 执行当前页面截图并输出结果日志。
 */
export async function runScreenshotAction(options: StartDevHotkeysOptions) {
  const outputPath = resolveDevScreenshotOutputPath(options.cwd)
  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  logger.info(`[dev action] 正在截图当前页面，输出到 ${colors.cyan(formatLogPath(options.cwd, outputPath))}`)
  const result = await takeScreenshot({
    projectPath: options.projectPath,
    outputPath,
    timeout: DEFAULT_SCREENSHOT_TIMEOUT,
  })
  logger.success(`[dev action] 当前页面截图完成：${colors.cyan(formatResolvedScreenshotPath(options.cwd, outputPath, result))}`)
}

/**
 * @description 在开发态启动终端快捷键，并将动作输出到本地日志。
 */
export function startDevHotkeys(options: StartDevHotkeysOptions): DevHotkeysSession | undefined {
  if (options.platform !== 'weapp' || !process.stdin.isTTY) {
    return
  }

  emitKeypressEvents(process.stdin)

  const hasSetRawMode = typeof process.stdin.setRawMode === 'function'
  if (hasSetRawMode) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()

  let closed = false
  let running = false

  const printHelp = () => {
    logger.info(formatDevHotkeyHelp())
  }

  const onKeypress = (_str: string, key: { name?: string, ctrl?: boolean } | undefined) => {
    if (!key || closed) {
      return
    }

    if (key.ctrl && key.name === 'c') {
      return
    }

    if (key.name === 'h') {
      printHelp()
      return
    }

    if (key.name !== 's') {
      return
    }

    if (running) {
      logger.warn('[dev action] 当前已有命令在执行，请等待完成后再试。')
      return
    }

    running = true
    void runScreenshotAction(options)
      .catch((error) => {
        logger.error(`[dev action] 截图失败：${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => {
        running = false
        if (!closed) {
          printHelp()
        }
      })
  }

  process.stdin.on('keypress', onKeypress)
  printHelp()

  return {
    close() {
      if (closed) {
        return
      }
      closed = true
      process.stdin.off('keypress', onKeypress)
      if (hasSetRawMode) {
        process.stdin.setRawMode(false)
      }
      process.stdin.pause()
    },
  }
}
