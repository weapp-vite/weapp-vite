import process from 'node:process'
import { i18nText } from '../i18n'
import logger from '../logger'
import { execute } from '../utils'
import { readOptionValue, removeOption } from './automator-argv'
import {
  createWechatIdeLoginRequiredExitError,
  formatRetryHotkeyPrompt,
  formatWechatIdeLoginRequiredError,
  isWechatIdeLoginRequiredError,
  waitForRetryKeypress,
} from './retry'

export type LoginRetryMode = 'never' | 'once' | 'always'

interface LoginRetryOptions {
  nonInteractive: boolean
  retryMode: LoginRetryMode
  retryTimeoutMs: number
}

/**
 * @description 运行微信开发者工具 CLI，并在登录失效时允许按键重试。
 */
export async function runWechatCliWithRetry(cliPath: string, argv: string[]) {
  const loginRetryOptions = resolveLoginRetryOptions(argv)
  const runtimeArgv = stripLoginRetryControlFlags(argv)
  let retryCount = 0

  while (true) {
    try {
      const result = await execute(cliPath, runtimeArgv, {
        pipeStdout: false,
        pipeStderr: false,
      })

      if (!isWechatIdeLoginRequiredError(result)) {
        flushExecutionOutput(result)
        return
      }

      const action = await promptLoginRetry(result, loginRetryOptions, retryCount)
      if (action === 'retry') {
        retryCount += 1
        logger.info(i18nText('正在重试连接微信开发者工具...', 'Retrying to connect Wechat DevTools...'))
        continue
      }

      throw createWechatIdeLoginRequiredExitError(result)
    }
    catch (error) {
      if (!isWechatIdeLoginRequiredError(error)) {
        throw error
      }

      const action = await promptLoginRetry(error, loginRetryOptions, retryCount)
      if (action === 'retry') {
        retryCount += 1
        logger.info(i18nText('正在重试连接微信开发者工具...', 'Retrying to connect Wechat DevTools...'))
        continue
      }

      throw createWechatIdeLoginRequiredExitError(error)
    }
  }
}

function resolveLoginRetryOptions(argv: readonly string[]): LoginRetryOptions {
  const nonInteractiveFlag = argv.includes('--non-interactive')
  const ciMode = process.env.CI === 'true'
  const nonTtyStdin = !isStdinInteractive()
  const nonInteractive = nonInteractiveFlag || ciMode || nonTtyStdin

  const retryModeRaw = readOptionValue(argv, '--login-retry')?.toLowerCase()
  const retryMode = normalizeLoginRetryMode(retryModeRaw, nonInteractive)

  const retryTimeoutRaw = readOptionValue(argv, '--login-retry-timeout')
  const retryTimeoutMs = normalizeLoginRetryTimeout(retryTimeoutRaw)

  return {
    nonInteractive,
    retryMode,
    retryTimeoutMs,
  }
}

function normalizeLoginRetryMode(value: string | undefined, nonInteractive: boolean): LoginRetryMode {
  if (value && value !== 'never' && value !== 'once' && value !== 'always') {
    throw new Error(i18nText(
      `不支持的 --login-retry 值: ${value}（仅支持 never/once/always）`,
      `Invalid --login-retry value: ${value} (supported: never/once/always)`,
    ))
  }

  if (value === 'never' || value === 'once' || value === 'always') {
    return value
  }
  return nonInteractive ? 'never' : 'always'
}

function normalizeLoginRetryTimeout(value: string | undefined) {
  if (!value) {
    return 30_000
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(i18nText(
      `无效的 --login-retry-timeout 值: ${value}（必须为正整数）`,
      `Invalid --login-retry-timeout value: ${value} (must be a positive integer)`,
    ))
  }

  return parsed
}

function isStdinInteractive() {
  return Boolean(process.stdin && process.stdin.isTTY)
}

function stripLoginRetryControlFlags(argv: readonly string[]) {
  let next = removeOption(argv, '--login-retry')
  next = removeOption(next, '--login-retry-timeout')
  next = removeOption(next, '--non-interactive')
  return next
}

async function promptLoginRetry(errorLike: unknown, options: LoginRetryOptions, retryCount: number) {
  const { nonInteractive, retryMode, retryTimeoutMs } = options

  logger.error(i18nText(
    '检测到微信开发者工具登录状态失效，请先登录后重试。',
    'Wechat DevTools login has expired. Please login and retry.',
  ))
  logger.warn(i18nText(
    '请先打开微信开发者工具完成登录。',
    'Please open Wechat DevTools and complete login first.',
  ))
  logger.warn(formatWechatIdeLoginRequiredError(errorLike))

  if (nonInteractive) {
    logger.error(i18nText(
      '当前为非交互模式，检测到登录失效后直接失败。',
      'Non-interactive mode enabled, failing immediately on login expiration.',
    ))
    return 'cancel' as const
  }

  const shouldAllowRetry = retryMode === 'always' || (retryMode === 'once' && retryCount < 1)
  if (!shouldAllowRetry) {
    logger.info(i18nText('当前重试策略不允许继续重试。', 'Current retry policy does not allow further retries.'))
    return 'cancel' as const
  }

  logger.info(formatRetryHotkeyPrompt(retryTimeoutMs))
  const action = await waitForRetryKeypress({ timeoutMs: retryTimeoutMs })

  if (action === 'timeout') {
    logger.error(i18nText(
      `等待登录重试输入超时（${retryTimeoutMs}ms），已自动取消。`,
      `Retry prompt timed out (${retryTimeoutMs}ms), canceled automatically.`,
    ))
    return 'cancel' as const
  }

  if (action !== 'retry') {
    logger.info(i18nText(
      '已取消重试。完成登录后请重新执行当前命令。',
      'Retry canceled. Please run the command again after login.',
    ))
    return 'cancel' as const
  }

  return 'retry' as const
}

function flushExecutionOutput(result: unknown) {
  if (!result || typeof result !== 'object') {
    return
  }

  const candidate = result as { stdout?: unknown, stderr?: unknown }
  if (typeof candidate.stdout === 'string' && candidate.stdout) {
    process.stdout.write(candidate.stdout)
  }
  if (typeof candidate.stderr === 'string' && candidate.stderr) {
    process.stderr.write(candidate.stderr)
  }
}
