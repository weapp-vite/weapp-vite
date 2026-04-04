import type { ArgvTransform } from '../utils'
import { cac } from 'cac'
import { getConfiguredLocale } from '../config/resolver'
import { configureLocaleFromArgv, i18nText, validateLocaleOption } from '../i18n'
import logger, { colors } from '../logger'
import { isOperatingSystemSupported, operatingSystemName } from '../runtime/platform'
import { createAlias, createPathCompat, transformArgv } from '../utils'
import { readOptionValue, removeOption } from './automator-argv'
import {
  CONFIG_COMMAND_NAME,
  MINIDEV_NAMESPACE_COMMAND_NAMES,
  WECHAT_CLI_COMMAND_NAMES,
} from './command-catalog'
import { printCompareHelp } from './compare'
import { handleConfigCommand } from './config-command'
import { runMinidev } from './minidev'
import { promptForCliPath } from './prompt'
import { resolveCliPath } from './resolver'
import { AUTOMATOR_COMMAND_NAMES, getAutomatorCommandHelp, isAutomatorCommand, runAutomatorCommand } from './run-automator'
import { runWechatCliWithRetry } from './run-login'
import { printScreenshotHelp } from './screenshot'
import { validateWechatCliCommandArgs } from './wechat-command-schema'

const MINIDEV_NAMESPACE = new Set<string>(MINIDEV_NAMESPACE_COMMAND_NAMES)
const ALIPAY_PLATFORM_ALIASES = new Set<string>(MINIDEV_NAMESPACE_COMMAND_NAMES)

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
 * @description 基于 cac 注册顶层命令，用于统一识别入口。
 */
export function createCli() {
  const cli = cac('weapp')

  cli.command('help [command]', '显示命令帮助').allowUnknownOptions()

  for (const command of WECHAT_CLI_COMMAND_NAMES) {
    cli.command(command, '微信开发者工具官方命令透传').allowUnknownOptions()
  }

  for (const command of MINIDEV_NAMESPACE_COMMAND_NAMES) {
    cli.command(`${command} [...args]`, '支付宝 minidev 命令透传').allowUnknownOptions()
  }

  cli.command(`${CONFIG_COMMAND_NAME} [...args]`, '配置 weapp-ide-cli').allowUnknownOptions()

  for (const command of AUTOMATOR_COMMAND_NAMES) {
    cli.command(`${command} [...args]`, 'automator 增强命令').allowUnknownOptions()
  }

  return cli
}

async function handleHelpCommand(args: readonly string[]) {
  const targetCommand = args[0]

  if (!targetCommand) {
    createCli().outputHelp()
    return
  }

  if (targetCommand === 'screenshot') {
    printScreenshotHelp()
    return
  }

  if (targetCommand === 'compare') {
    printCompareHelp()
    return
  }

  if (isAutomatorCommand(targetCommand)) {
    const help = getAutomatorCommandHelp(targetCommand)
    if (help) {
      console.log(help)
      return
    }
  }

  createCli().outputHelp()
}

async function handleMissingCliPath(source: 'custom' | 'default' | 'missing') {
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
}

/**
 * @description 判断 open 指令是否应转发到 minidev。
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
 * @description 将 open 命令参数改写为 minidev ide 参数。
 */
function createMinidevOpenArgv(argv: readonly string[]) {
  const nextArgv = [...argv]
  nextArgv[0] = 'ide'
  return removeOption(nextArgv, '--platform')
}

/**
 * @description CLI 入口解析与分发。
 */
export async function parse(argv: string[]) {
  validateLocaleOption(argv)
  configureLocaleFromArgv(argv, await getConfiguredLocale())

  const cli = createCli()
  cli.parse(['node', 'weapp', ...argv], { run: false })

  const matchedCommand = cli.matchedCommandName
  if (matchedCommand === 'help') {
    await handleHelpCommand(cli.args)
    return
  }

  if (matchedCommand && MINIDEV_NAMESPACE.has(matchedCommand)) {
    await runMinidev(argv.slice(1))
    return
  }

  if (matchedCommand === CONFIG_COMMAND_NAME) {
    await handleConfigCommand(argv.slice(1))
    return
  }

  if (matchedCommand && isAutomatorCommand(matchedCommand)) {
    await runAutomatorCommand(matchedCommand, argv.slice(1))
    return
  }

  const formattedArgv = transformArgv(argv, ARG_TRANSFORMS)

  if (shouldDelegateOpenToMinidev(formattedArgv)) {
    await runMinidev(createMinidevOpenArgv(formattedArgv))
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
    await handleMissingCliPath(source)
    return
  }

  await runWechatCliWithRetry(cliPath, formattedArgv)
}
