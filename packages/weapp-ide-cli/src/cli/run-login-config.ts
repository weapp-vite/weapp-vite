import process from 'node:process'
import { i18nText } from '../i18n'
import { readOptionValue, removeOption } from './automator-argv'

export type LoginRetryMode = 'never' | 'once' | 'always'

export interface LoginRetryConfig {
  nonInteractive: boolean
  retryMode: LoginRetryMode
  retryTimeoutMs: number
  runtimeArgv: string[]
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

/**
 * @description 解析登录重试相关控制参数，并产出实际执行微信 CLI 所需的运行时参数。
 */
export function resolveLoginRetryConfig(argv: readonly string[]): LoginRetryConfig {
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
    runtimeArgv: stripLoginRetryControlFlags(argv),
  }
}
