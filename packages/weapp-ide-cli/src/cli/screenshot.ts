import type { ScreenshotOptions } from './commands'
import { i18nText } from '../i18n'
import { colors } from '../logger'
import { parseAutomatorArgs, readOptionValue } from './automator-argv'

/**
 * @description Print help for screenshot command
 */
export function printScreenshotHelp(): void {
  console.log(i18nText(`
${colors.bold('Usage:')} weapp screenshot [options]

${colors.bold('参数:')}
  -p, --project <path>   项目路径（默认：当前目录）
  -o, --output <path>    截图输出文件路径
      --page <path>      截图前先跳转页面
  -t, --timeout <ms>     连接超时时间（默认：30000）
      --json             以 JSON 格式输出
      --lang <lang>      语言切换：zh | en（默认：zh）
  -h, --help             显示此帮助信息

${colors.bold('示例:')}
  # 输出 base64 到 stdout
  weapp screenshot -p /path/to/project

  # 保存到文件
  weapp screenshot -p /path/to/project -o screenshot.png

  # 先跳转页面再截图
  weapp screenshot -p /path/to/project --page pages/index/index

  # 以 JSON 输出便于脚本解析
  weapp screenshot -p /path/to/project --json
`, `
${colors.bold('Usage:')} weapp screenshot [options]

${colors.bold('Options:')}
  -p, --project <path>   Project path (default: current directory)
  -o, --output <path>    Output file path for screenshot
      --page <path>      Navigate to page before taking screenshot
  -t, --timeout <ms>     Connection timeout in milliseconds (default: 30000)
      --json             Output as JSON format
      --lang <lang>      Language: zh | en (default: zh)
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
`))
}

/**
 * @description Parse command line arguments for screenshot command
 */
export function parseScreenshotArgs(argv: string[]): ScreenshotOptions {
  const parsed = parseAutomatorArgs(argv)

  return {
    projectPath: parsed.projectPath,
    timeout: parsed.timeout,
    outputPath: readOptionValue(argv, '-o') || readOptionValue(argv, '--output'),
    page: readOptionValue(argv, '--page'),
  }
}

/**
 * @description 运行截图命令并处理输出格式。
 */
export async function runScreenshot(argv: string[]) {
  if (argv.includes('-h') || argv.includes('--help')) {
    printScreenshotHelp()
    return
  }

  const options = parseScreenshotArgs(argv)
  const isJsonOutput = argv.includes('--json')
  const { takeScreenshot } = await import('./commands')

  const result = await takeScreenshot(options)

  if (isJsonOutput) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (result.base64) {
    console.log(result.base64)
  }
}

export { takeScreenshot } from './commands'
export type { ScreenshotOptions, ScreenshotResult } from './commands'
