import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import process from 'node:process'
import logger, { colors } from '../logger'
import { formatAutomatorLoginError, isAutomatorLoginError, isDevtoolsHttpPortError, launchAutomator } from './automator'

export interface ScreenshotOptions {
  projectPath: string
  outputPath?: string
  page?: string
  timeout?: number
}

export interface ScreenshotResult {
  base64?: string
  path?: string
}

/**
 * @description Print help for screenshot command
 */
export function printScreenshotHelp(): void {
  console.log(`
${colors.bold('Usage:')} weapp screenshot [options]

${colors.bold('Options:')}
  -p, --project <path>   Project path (default: current directory)
  -o, --output <path>    Output file path for screenshot
      --page <path>      Navigate to page before taking screenshot
  -t, --timeout <ms>     Connection timeout in milliseconds (default: 30000)
      --json             Output as JSON format
  -h, --help             Show this help message

${colors.bold('Examples:')}
  # Output base64 to stdout
  weapp screenshot -p /path/to/project

  # Save to file
  weapp screenshot -p /path/to/project -o screenshot.png

  # Navigate to page first
  weapp screenshot -p /path/to/project --page pages/index/index

  # JSON output for parsing
  weapp screenshot -p /path/to/project --json
`)
}

/**
 * @description Parse command line arguments for screenshot command
 */
export function parseScreenshotArgs(argv: string[]): ScreenshotOptions {
  const options: ScreenshotOptions = {
    projectPath: process.cwd(),
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '-p' || arg === '--project') {
      options.projectPath = argv[++i] || process.cwd()
      continue
    }

    if (arg?.startsWith('--project=')) {
      options.projectPath = arg.slice('--project='.length) || process.cwd()
      continue
    }

    if (arg === '-o' || arg === '--output') {
      options.outputPath = argv[++i]
      continue
    }

    if (arg?.startsWith('--output=')) {
      options.outputPath = arg.slice('--output='.length)
      continue
    }

    if (arg === '--page') {
      options.page = argv[++i]
      continue
    }

    if (arg?.startsWith('--page=')) {
      options.page = arg.slice('--page='.length)
      continue
    }

    if (arg === '-t' || arg === '--timeout') {
      options.timeout = Number.parseInt(argv[++i] || '30000', 10)
      continue
    }

    if (arg?.startsWith('--timeout=')) {
      options.timeout = Number.parseInt(arg.slice('--timeout='.length), 10)
      continue
    }

    if (arg === '-h' || arg === '--help') {
      printScreenshotHelp()
      process.exit(0)
    }
  }

  return options
}

/**
 * @description Take a screenshot of the miniprogram
 */
export async function takeScreenshot(options: ScreenshotOptions): Promise<ScreenshotResult> {
  const { projectPath, outputPath, page, timeout } = options

  let miniProgram: Awaited<ReturnType<typeof launchAutomator>> | null = null

  try {
    logger.info(`Connecting to DevTools at ${colors.cyan(projectPath)}...`)

    miniProgram = await launchAutomator({
      projectPath,
      timeout,
    })

    if (page) {
      logger.info(`Navigating to page ${colors.cyan(page)}...`)
      await miniProgram.reLaunch(page)
    }

    logger.info('Taking screenshot...')

    const screenshot = await miniProgram.screenshot()

    if (!screenshot) {
      throw new Error('Failed to capture screenshot')
    }

    const base64 = typeof screenshot === 'string'
      ? screenshot
      : Buffer.from(screenshot).toString('base64')

    if (outputPath) {
      await fs.writeFile(outputPath, Buffer.from(base64, 'base64'))
      logger.success(`Screenshot saved to ${colors.cyan(outputPath)}`)
      return { path: outputPath }
    }

    return { base64 }
  }
  catch (error) {
    if (isAutomatorLoginError(error)) {
      logger.error('检测到微信开发者工具登录状态失效，请先登录后重试。')
      logger.warn(formatAutomatorLoginError(error))
      throw new Error('DEVTOOLS_LOGIN_REQUIRED')
    }

    if (isDevtoolsHttpPortError(error)) {
      logger.error('无法连接到微信开发者工具，请确保已开启 HTTP 服务端口。')
      logger.warn('请在微信开发者工具中：设置 -> 安全设置 -> 开启服务端口')
      throw new Error('DEVTOOLS_HTTP_PORT_ERROR')
    }

    throw error
  }
  finally {
    if (miniProgram) {
      await miniProgram.close()
    }
  }
}
