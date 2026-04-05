import type { Buffer } from 'node:buffer'
import type { ScreenshotOptions } from './commands'
import type { ComparePngWithBaselineResult } from './imageDiff'
import process from 'node:process'
import { i18nText } from '../i18n'
import { colors } from '../logger'
import { parseAutomatorArgs, readOptionValue } from './automator-argv'
import { captureScreenshotBuffer } from './commands'
import { comparePngWithBaseline } from './imageDiff'

export interface CompareOptions extends ScreenshotOptions {
  baselinePath: string
  currentOutputPath?: string
  diffOutputPath?: string
  threshold: number
  maxDiffPixels?: number
  maxDiffRatio?: number
}

export interface CompareResult {
  passed: boolean
  baselinePath: string
  currentPath?: string
  diffPath?: string
  width: number
  height: number
  diffPixels: number
  diffRatio: number
  threshold: number
  maxDiffPixels?: number
  maxDiffRatio?: number
}

function createCliError(message: string, exitCode: number, cause?: unknown) {
  const error = new Error(message, cause ? { cause } : undefined) as Error & { exitCode: number }
  error.exitCode = exitCode
  return error
}

function parseNonNegativeInteger(rawValue: string | undefined, optionName: string) {
  if (rawValue == null) {
    return undefined
  }

  const value = Number(rawValue)
  if (!Number.isInteger(value) || value < 0) {
    throw createCliError(
      i18nText(
        `${optionName} 必须是大于等于 0 的整数`,
        `${optionName} must be an integer greater than or equal to 0`,
      ),
      2,
    )
  }

  return value
}

function parseRatio(rawValue: string | undefined, optionName: string) {
  if (rawValue == null) {
    return undefined
  }

  const value = Number(rawValue)
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw createCliError(
      i18nText(
        `${optionName} 必须是 0 到 1 之间的数字`,
        `${optionName} must be a number between 0 and 1`,
      ),
      2,
    )
  }

  return value
}

/**
 * @description 输出 compare 命令帮助信息。
 */
export function printCompareHelp(): void {
  console.log(i18nText(`
${colors.bold('Usage:')} weapp compare [options]

${colors.bold('参数:')}
  -p, --project <path>           项目路径（默认：当前目录）
      --baseline <path>          基准图路径（必填）
      --current-output <path>    当前截图输出路径
      --diff-output <path>       diff 图片输出路径
      --page <path>              对比前先跳转页面
      --full-page                对比时使用整页长截图
      --threshold <number>       pixelmatch threshold（默认：0.1）
      --max-diff-pixels <count>  最大允许差异像素数
      --max-diff-ratio <number>  最大允许差异占比（0-1）
  -t, --timeout <ms>             连接超时时间（默认：30000）
      --json                     以 JSON 格式输出
      --lang <lang>              语言切换：zh | en（默认：zh）
  -h, --help                     显示此帮助信息

${colors.bold('规则:')}
  - 必须提供 --baseline
  - 必须至少提供 --max-diff-pixels 或 --max-diff-ratio 之一
  - baseline 与当前截图尺寸不一致时直接失败

${colors.bold('示例:')}
  weapp compare -p ./dist/build/mp-weixin --page pages/index/index --full-page --baseline .screenshots/baseline/index.full.png --current-output .screenshots/current/index.full.png --diff-output .screenshots/diff/index.full.diff.png --max-diff-pixels 100 --json

  weapp compare -p ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --current-output .screenshots/current/index.png --diff-output .screenshots/diff/index.diff.png --max-diff-pixels 100 --json

  weapp compare -p ./dist/build/mp-weixin --baseline .screenshots/baseline/index.png --max-diff-ratio 0.001
`, `
${colors.bold('Usage:')} weapp compare [options]

${colors.bold('Options:')}
  -p, --project <path>           Project path (default: current directory)
      --baseline <path>          Baseline image path (required)
      --current-output <path>    Output file path for current screenshot
      --diff-output <path>       Output file path for diff image
      --page <path>              Navigate to page before comparison
      --full-page                Use stitched full-page screenshots for comparison
      --threshold <number>       Pixelmatch threshold (default: 0.1)
      --max-diff-pixels <count>  Maximum allowed diff pixels
      --max-diff-ratio <number>  Maximum allowed diff ratio (0-1)
  -t, --timeout <ms>             Connection timeout in milliseconds (default: 30000)
      --json                     Output as JSON format
      --lang <lang>              Language: zh | en (default: zh)
  -h, --help                     Show this help message

${colors.bold('Rules:')}
  - --baseline is required
  - At least one of --max-diff-pixels or --max-diff-ratio is required
  - Baseline and current screenshot must have identical dimensions

${colors.bold('Examples:')}
  weapp compare -p ./dist/build/mp-weixin --page pages/index/index --full-page --baseline .screenshots/baseline/index.full.png --current-output .screenshots/current/index.full.png --diff-output .screenshots/diff/index.full.diff.png --max-diff-pixels 100 --json

  weapp compare -p ./dist/build/mp-weixin --page pages/index/index --baseline .screenshots/baseline/index.png --current-output .screenshots/current/index.png --diff-output .screenshots/diff/index.diff.png --max-diff-pixels 100 --json

  weapp compare -p ./dist/build/mp-weixin --baseline .screenshots/baseline/index.png --max-diff-ratio 0.001
`))
}

/**
 * @description 解析 compare 命令参数。
 */
export function parseCompareArgs(argv: string[]): CompareOptions {
  const parsed = parseAutomatorArgs(argv)
  const baselinePath = readOptionValue(argv, '--baseline')

  if (!baselinePath) {
    throw createCliError(
      i18nText('compare 命令缺少 --baseline 参数', 'Missing --baseline option for compare command'),
      2,
    )
  }

  const threshold = parseRatio(
    readOptionValue(argv, '--threshold'),
    '--threshold',
  ) ?? 0.1
  const maxDiffPixels = parseNonNegativeInteger(
    readOptionValue(argv, '--max-diff-pixels'),
    '--max-diff-pixels',
  )
  const maxDiffRatio = parseRatio(
    readOptionValue(argv, '--max-diff-ratio'),
    '--max-diff-ratio',
  )

  if (maxDiffPixels == null && maxDiffRatio == null) {
    throw createCliError(
      i18nText(
        'compare 命令至少需要提供 --max-diff-pixels 或 --max-diff-ratio 之一',
        'compare command requires at least one of --max-diff-pixels or --max-diff-ratio',
      ),
      2,
    )
  }

  return {
    projectPath: parsed.projectPath,
    timeout: parsed.timeout,
    page: readOptionValue(argv, '--page'),
    fullPage: argv.includes('--full-page'),
    baselinePath,
    currentOutputPath: readOptionValue(argv, '--current-output'),
    diffOutputPath: readOptionValue(argv, '--diff-output'),
    threshold,
    maxDiffPixels,
    maxDiffRatio,
  }
}

function resolveComparePassed(
  diff: ComparePngWithBaselineResult,
  options: CompareOptions,
) {
  if (options.maxDiffPixels != null && diff.diffPixels > options.maxDiffPixels) {
    return false
  }

  if (options.maxDiffRatio != null && diff.diffRatio > options.maxDiffRatio) {
    return false
  }

  return true
}

function printCompareSummary(result: CompareResult) {
  const summary = result.passed
    ? i18nText(
        `compare passed: diffPixels=${result.diffPixels} diffRatio=${result.diffRatio}`,
        `compare passed: diffPixels=${result.diffPixels} diffRatio=${result.diffRatio}`,
      )
    : i18nText(
        `compare failed: diffPixels=${result.diffPixels} diffRatio=${result.diffRatio}`,
        `compare failed: diffPixels=${result.diffPixels} diffRatio=${result.diffRatio}`,
      )

  console.log(summary)

  const pathSummary = [
    `baseline=${result.baselinePath}`,
    result.currentPath ? `current=${result.currentPath}` : undefined,
    result.diffPath ? `diff=${result.diffPath}` : undefined,
  ].filter(Boolean).join(' ')

  if (pathSummary) {
    console.log(pathSummary)
  }
}

/**
 * @description 运行 compare 命令并输出对比结果。
 */
export async function runCompare(argv: string[]): Promise<void> {
  if (argv.includes('-h') || argv.includes('--help')) {
    printCompareHelp()
    return
  }

  const options = parseCompareArgs(argv)
  let currentPngBuffer: Buffer
  try {
    currentPngBuffer = await captureScreenshotBuffer(options)
  }
  catch (error) {
    throw createCliError(
      error instanceof Error ? error.message : i18nText('截图失败', 'Failed to capture screenshot'),
      3,
      error,
    )
  }

  let diff: ComparePngWithBaselineResult
  try {
    diff = await comparePngWithBaseline({
      baselinePath: options.baselinePath,
      currentPngBuffer,
      currentOutputPath: options.currentOutputPath,
      diffOutputPath: options.diffOutputPath,
      threshold: options.threshold,
    })
  }
  catch (error) {
    throw createCliError(
      error instanceof Error ? error.message : i18nText('截图对比失败', 'Screenshot comparison failed'),
      3,
      error,
    )
  }

  const result: CompareResult = {
    passed: resolveComparePassed(diff, options),
    baselinePath: options.baselinePath,
    currentPath: diff.currentPath,
    diffPath: diff.diffPath,
    width: diff.width,
    height: diff.height,
    diffPixels: diff.diffPixels,
    diffRatio: diff.diffRatio,
    threshold: options.threshold,
    maxDiffPixels: options.maxDiffPixels,
    maxDiffRatio: options.maxDiffRatio,
  }

  if (argv.includes('--json')) {
    console.log(JSON.stringify(result, null, 2))
  }
  else {
    printCompareSummary(result)
  }

  if (!result.passed) {
    process.exitCode = 1
  }
}
