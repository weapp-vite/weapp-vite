import { readCustomConfig } from '../config/custom'
import { i18nText } from '../i18n'
import logger, { colors } from '../logger'
import { isOperatingSystemSupported, operatingSystemName } from '../runtime/platform'
import { readOptionValue } from './automator-argv'
import { promptForCliPath } from './prompt'
import { resolveCliPath } from './resolver'
import { runWechatCliWithRetry } from './run-login'
import { bootstrapWechatDevtoolsSettings } from './wechatDevtoolsSettings'

function shouldBootstrapWechatDevtools(command: string | undefined) {
  return command === 'open' || command === 'auto' || command === 'auto-preview'
}

function resolveBooleanCliOption(argv: readonly string[], optionName: string) {
  if (argv.includes(optionName)) {
    return true
  }

  const rawValue = readOptionValue(argv, optionName)
  if (rawValue === undefined) {
    return undefined
  }

  const normalized = rawValue.trim().toLowerCase()
  if (normalized === '' || normalized === 'true' || normalized === '1' || normalized === 'on') {
    return true
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'off') {
    return false
  }
  return true
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

async function maybeBootstrapWechatDevtoolsSettings(argv: readonly string[]) {
  const command = argv[0]
  if (!shouldBootstrapWechatDevtools(command)) {
    return
  }

  const config = await readCustomConfig()
  if (config.autoBootstrapDevtools === false) {
    return
  }

  const projectPath = readOptionValue(argv, '--project')
  const trustProjectOption = resolveBooleanCliOption(argv, '--trust-project')
  const trustProject = trustProjectOption === undefined
    ? config.autoTrustProject ?? false
    : trustProjectOption
  await bootstrapWechatDevtoolsSettings({
    projectPath,
    trustProject,
  })
}

/**
 * @description 执行微信开发者工具 CLI 阶段，包括环境检查、路径解析、bootstrap 与登录重试。
 */
export async function runWechatCliCommand(argv: string[]) {
  if (!isOperatingSystemSupported(operatingSystemName)) {
    logger.warn(i18nText(
      `微信web开发者工具不支持当前平台：${operatingSystemName} !`,
      `Wechat Web DevTools CLI is not supported on current platform: ${operatingSystemName}!`,
    ))
    return
  }

  const { cliPath, source } = await resolveCliPath()
  if (!cliPath) {
    await handleMissingCliPath(source)
    return
  }

  await maybeBootstrapWechatDevtoolsSettings(argv)
  await runWechatCliWithRetry(cliPath, argv)
}
