import type { ArgvTransform } from '../utils'
import logger from '../logger'
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
  extractExecutionErrorText,
  isWechatIdeLoginRequiredError,
  waitForRetryKeypress,
} from './retry'

const MINIDEV_NAMESPACE = new Set(['alipay', 'ali', 'minidev'])
const ALIPAY_PLATFORM_ALIASES = new Set(['alipay', 'ali', 'minidev'])

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

  if (shouldDelegateOpenToMinidev(formattedArgv)) {
    await runMinidev(createMinidevOpenArgv(formattedArgv))
    return
  }

  if (!isOperatingSystemSupported(operatingSystemName)) {
    logger.log(`微信web开发者工具不支持当前平台：${operatingSystemName} !`)
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
        : '未检测到微信web开发者命令行工具，请执行 `weapp-ide-cli config` 指定路径。'
    logger.log(message)
    await promptForCliPath()
    return
  }

  await runWechatCliWithRetry(cliPath, formattedArgv)
}

/**
 * @description 运行微信开发者工具 CLI，并在登录失效时允许按键重试。
 */
async function runWechatCliWithRetry(cliPath: string, argv: string[]) {
  let retrying = true

  while (retrying) {
    try {
      await execute(cliPath, argv)
      return
    }
    catch (error) {
      if (!isWechatIdeLoginRequiredError(error)) {
        throw error
      }

      logger.error('检测到微信开发者工具登录状态失效，请先登录后重试。')
      logger.log('请先打开微信开发者工具完成登录。')

      const detail = extractExecutionErrorText(error)
      if (detail) {
        logger.log(detail)
      }

      logger.log('按 r 重试，按 q / Esc / Ctrl+C 退出。')
      const shouldRetry = await waitForRetryKeypress()

      if (!shouldRetry) {
        logger.log('已取消重试。完成登录后请重新执行当前命令。')
        retrying = false
        continue
      }

      logger.log('正在重试连接微信开发者工具...')
    }
  }
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
