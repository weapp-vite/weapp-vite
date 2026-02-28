import type { ArgvTransform } from '../utils'
import { getConfiguredLocale } from '../config/resolver'
import { configureLocaleFromArgv, i18nText, validateLocaleOption } from '../i18n'
import logger, { colors } from '../logger'
import { isOperatingSystemSupported, operatingSystemName } from '../runtime/platform'
import { createAlias, createPathCompat, transformArgv } from '../utils'
import { readOptionValue, removeOption } from './automator-argv'
import { handleConfigCommand } from './config-command'
import { runMinidev } from './minidev'
import { promptForCliPath } from './prompt'
import { resolveCliPath } from './resolver'
import { isAutomatorCommand, runAutomatorCommand } from './run-automator'
import { runWechatCliWithRetry } from './run-login'
import { printScreenshotHelp } from './screenshot'
import { validateWechatCliCommandArgs } from './wechat-command-schema'

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
 * @description CLI 入口解析与分发。
 */
export async function parse(argv: string[]) {
  validateLocaleOption(argv)
  const configuredLocale = await getConfiguredLocale()
  configureLocaleFromArgv(argv, configuredLocale)
  const command = argv[0]

  if (command && MINIDEV_NAMESPACE.has(command)) {
    await runMinidev(argv.slice(1))
    return
  }

  if (command && isAutomatorCommand(command)) {
    await runAutomatorCommand(command, argv.slice(1))
    return
  }

  if (command === 'help') {
    const targetCommand = argv[1]
    if (targetCommand === 'screenshot') {
      printScreenshotHelp()
      return
    }
    if (isAutomatorCommand(targetCommand)) {
      await runAutomatorCommand(targetCommand, ['--help'])
      return
    }
  }

  const formattedArgv = transformArgv(argv, ARG_TRANSFORMS)

  if (shouldDelegateOpenToMinidev(formattedArgv)) {
    await runMinidev(createMinidevOpenArgv(formattedArgv))
    return
  }

  if (command === 'config') {
    await handleConfigCommand(argv.slice(1))
    return
  }

  if (!isOperatingSystemSupported(operatingSystemName)) {
    logger.warn(i18nText(
      `微信web开发者工具不支持当前平台：${operatingSystemName} !`,
      `Wechat Web DevTools CLI is not supported on current platform: ${operatingSystemName}!`,
    ))
    return
  }

  validateWechatCliCommandArgs(formattedArgv)

  const { cliPath, source } = await resolveCliPath()

  if (!cliPath) {
    const message = source === 'custom'
      ? i18nText(
          '在当前自定义路径中未找到微信web开发者命令行工具，请重新指定路径。',
          'Cannot find Wechat Web DevTools CLI in custom path, please reconfigure it.',
        )
      : i18nText(
          `未检测到微信web开发者命令行工具，请执行 ${colors.bold(colors.green('weapp-ide-cli config'))} 指定路径。`,
          `Wechat Web DevTools CLI not found, please run ${colors.bold(colors.green('weapp-ide-cli config'))} to configure it.`,
        )
    logger.warn(message)
    await promptForCliPath()
    return
  }

  await runWechatCliWithRetry(cliPath, formattedArgv)
}

/**
 * @description 判断 open 指令是否应分发到 minidev。
 */
function shouldDelegateOpenToMinidev(argv: readonly string[]) {
  if (argv[0] !== 'open') {
    return false
  }

  const platform = readOptionValue(argv, '--platform')
  if (!platform) {
    return false
  }

  return ALIPAY_PLATFORM_ALIASES.has(platform.toLowerCase())
}

/**
 * @description 将 open 命令参数转换为 minidev ide 参数。
 */
function createMinidevOpenArgv(argv: readonly string[]) {
  const nextArgv = [...argv]
  nextArgv[0] = 'ide'
  return removeOption(nextArgv, '--platform')
}
