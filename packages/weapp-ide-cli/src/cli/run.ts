import type { ArgvTransform } from '../utils'
import process from 'node:process'
import logger, { colors } from '../logger'
import {
  isOperatingSystemSupported,
  operatingSystemName,
} from '../runtime/platform'
import {
  createAlias,
  createPathCompat,
  execute,
  transformArgv,
} from '../utils'
import { runMinidev } from './minidev'
import { promptForCliPath } from './prompt'
import { resolveCliPath } from './resolver'
import {
  createWechatIdeLoginRequiredExitError,
  formatRetryHotkeyPrompt,
  formatWechatIdeLoginRequiredError,
  isWechatIdeLoginRequiredError,
  waitForRetryKeypress,
} from './retry'

const MINIDEV_NAMESPACE = new Set(['alipay', 'ali', 'minidev'])
const ALIPAY_PLATFORM_ALIASES = new Set(['alipay', 'ali', 'minidev'])

type LoginRetryMode = 'never' | 'once' | 'always'

interface LoginRetryOptions {
  nonInteractive: boolean
  retryMode: LoginRetryMode
  retryTimeoutMs: number
}

function isStdinInteractive() {
  return Boolean(process.stdin && (process.stdin as any).isTTY)
}

const ARG_TRANSFORMS: readonly ArgvTransform[] = [
  createAlias({ find: '-p', replacement: '--project' }),
  createPathCompat('--result-output'),
  createPathCompat('-r'),
  createPathCompat('--qr-output'),
  createPathCompat('-o'),
  createPathCompat('--info-output'),
  createPathCompat('-i'),
]

/**
 * @description CLI 入口解析与分发
 */
export async function parse(argv: string[]) {
  const head = argv[0]

  if (head && MINIDEV_NAMESPACE.has(head)) {
    await runMinidev(argv.slice(1))
    return
  }

  const formattedArgv = transformArgv(argv, ARG_TRANSFORMS)
  const loginRetryOptions = resolveLoginRetryOptions(formattedArgv)
  const runtimeArgv = stripLoginRetryControlFlags(formattedArgv)

  if (shouldDelegateOpenToMinidev(runtimeArgv)) {
    await runMinidev(createMinidevOpenArgv(runtimeArgv))
    return
  }

  if (!isOperatingSystemSupported(operatingSystemName)) {
    logger.warn(`微信web开发者工具不支持当前平台：${operatingSystemName} !`)
    return
  }

  if (head === 'config') {
    await promptForCliPath()
    return
  }

  const { cliPath, source } = await resolveCliPath()

  if (!cliPath) {
    const message
      = source === 'custom'
        ? '在当前自定义路径中未找到微信web开发者命令行工具，请重新指定路径。'
        : `未检测到微信web开发者命令行工具，请执行 ${colors.bold(colors.green('weapp-ide-cli config'))} 指定路径。`
    logger.warn(message)
    await promptForCliPath()
    return
  }

  await runWechatCliWithRetry(cliPath, runtimeArgv, loginRetryOptions)
}

/**
 * @description 运行微信开发者工具 CLI，并在登录失效时允许按键重试。
 */
async function runWechatCliWithRetry(cliPath: string, argv: string[], options: LoginRetryOptions) {
  let retryCount = 0

  while (true) {
    try {
      const result = await execute(cliPath, argv, {
        pipeStdout: false,
        pipeStderr: false,
      })
      if (!isWechatIdeLoginRequiredError(result)) {
        flushExecutionOutput(result)
        return
      }

      const action = await promptLoginRetry(result, options, retryCount)
      if (action === 'retry') {
        retryCount += 1
        logger.info('正在重试连接微信开发者工具...')
        continue
      }
      throw createWechatIdeLoginRequiredExitError(result)
    }
    catch (error) {
      if (!isWechatIdeLoginRequiredError(error)) {
        throw error
      }

      const action = await promptLoginRetry(error, options, retryCount)
      if (action === 'retry') {
        retryCount += 1
        logger.info('正在重试连接微信开发者工具...')
        continue
      }
      throw createWechatIdeLoginRequiredExitError(error)
    }
  }
}

/**
 * @description 提示登录失效并等待用户选择是否重试。
 */
async function promptLoginRetry(errorLike: unknown, options: LoginRetryOptions, retryCount: number) {
  const {
    nonInteractive,
    retryMode,
    retryTimeoutMs,
  } = options

  logger.error('检测到微信开发者工具登录状态失效，请先登录后重试。')
  logger.warn('请先打开微信开发者工具完成登录。')
  logger.warn(formatWechatIdeLoginRequiredError(errorLike))

  if (nonInteractive) {
    logger.error('当前为非交互模式，检测到登录失效后直接失败。')
    return 'cancel' as const
  }

  const shouldAllowRetry = retryMode === 'always' || (retryMode === 'once' && retryCount < 1)

  if (!shouldAllowRetry) {
    logger.info('当前重试策略不允许继续重试。')
    return 'cancel' as const
  }

  logger.info(formatRetryHotkeyPrompt(retryTimeoutMs))
  const action = await waitForRetryKeypress({ timeoutMs: retryTimeoutMs })

  if (action === 'timeout') {
    logger.error(`等待登录重试输入超时（${retryTimeoutMs}ms），已自动取消。`)
    return 'cancel' as const
  }

  if (action !== 'retry') {
    logger.info('已取消重试。完成登录后请重新执行当前命令。')
    return 'cancel' as const
  }

  return 'retry' as const
}

function resolveLoginRetryOptions(argv: readonly string[]): LoginRetryOptions {
  const nonInteractiveFlag = readBooleanFlag(argv, '--non-interactive')
  const ciMode = process.env.CI === 'true'
  const nonTtyStdin = !isStdinInteractive()
  const nonInteractive = nonInteractiveFlag || ciMode || nonTtyStdin

  const retryModeRaw = readOptionValue(argv, '--login-retry')
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
    return 30_000
  }
  return parsed
}

function readBooleanFlag(argv: readonly string[], optionName: string) {
  return argv.includes(optionName)
}

function stripLoginRetryControlFlags(argv: readonly string[]) {
  let next = removeOption(argv, '--login-retry')
  next = removeOption(next, '--login-retry-timeout')
  next = removeOption(next, '--non-interactive')
  return next
}

/**
 * @description 判断 open 指令是否应分发到 minidev
 */
function shouldDelegateOpenToMinidev(argv: readonly string[]) {
  if (argv[0] !== 'open') {
    return false
  }
  const platform = readOptionValue(argv, '--platform')
  if (!platform) {
    return false
  }
  return ALIPAY_PLATFORM_ALIASES.has(platform)
}

/**
 * @description 将 open 命令参数转换为 minidev ide 参数
 */
function createMinidevOpenArgv(argv: readonly string[]) {
  const nextArgv = [...argv]
  nextArgv[0] = 'ide'
  return removeOption(nextArgv, '--platform')
}

/**
 * @description 获取选项值（支持 --option value 和 --option=value）
 */
function readOptionValue(argv: readonly string[], optionName: string) {
  const optionWithEqual = `${optionName}=`
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) {
      continue
    }
    if (token === optionName) {
      const value = argv[index + 1]
      return typeof value === 'string' ? value.trim().toLowerCase() : undefined
    }
    if (token.startsWith(optionWithEqual)) {
      const value = token.slice(optionWithEqual.length)
      return value.trim().toLowerCase()
    }
  }
  return undefined
}

/**
 * @description 删除命令行中的某个选项（支持 --option value 和 --option=value）
 */
function removeOption(argv: readonly string[], optionName: string) {
  const optionWithEqual = `${optionName}=`
  const nextArgv: string[] = []

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token) {
      continue
    }

    if (token === optionName) {
      const nextToken = argv[index + 1]
      if (nextToken && !nextToken.startsWith('-')) {
        index += 1
      }
      continue
    }

    if (token.startsWith(optionWithEqual)) {
      continue
    }

    nextArgv.push(token)
  }

  return nextArgv
}

/**
 * @description 在非登录错误场景回放执行输出。
 */
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
