import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import type { ConfigSource } from '../types'
import type { RunWechatCliWithRetryOptions } from './run-login'
import { withMachineE2ELease } from '@weapp-vite/devtools-runtime'
import { readCustomConfig } from '../config/custom'
import { assertWechatDevtoolsHost, resolveWechatDevtoolsTarget } from '../devtoolsTarget'
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

function appendOptionValue(argv: string[], sourceArgv: readonly string[], optionName: string) {
  const value = readOptionValue(sourceArgv, optionName)
  if (value !== undefined) {
    argv.push(optionName, value)
  }
}

function createAutoPreviewWakeArgv(argv: readonly string[], trustProject: boolean | undefined) {
  if (argv[0] !== 'auto-preview') {
    return undefined
  }

  const projectPath = readOptionValue(argv, '--project')
  const appid = readOptionValue(argv, '--appid')
  if (!projectPath && !appid) {
    return undefined
  }

  const wakeArgv = ['open']
  appendOptionValue(wakeArgv, argv, '--project')
  appendOptionValue(wakeArgv, argv, '--appid')
  appendOptionValue(wakeArgv, argv, '--ext-appid')

  if (trustProject === true) {
    wakeArgv.push('--trust-project')
  }

  return wakeArgv
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

async function handleMissingCliPath(source: ConfigSource) {
  if (source === 'environment') {
    throw new Error('WEAPP_IDE_CLI_PATH 指定的开发者工具不可用；已停止，不回退其他安装。')
  }
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

async function maybeBootstrapWechatDevtoolsSettings(argv: readonly string[], target: ResolvedWechatDevtoolsTarget) {
  const command = argv[0]
  if (!shouldBootstrapWechatDevtools(command)) {
    return undefined
  }

  const config = await readCustomConfig()
  if (config.autoBootstrapDevtools === false) {
    return undefined
  }

  const projectPath = readOptionValue(argv, '--project')
  const trustProjectOption = resolveBooleanCliOption(argv, '--trust-project')
  const trustProject = trustProjectOption === undefined
    ? config.autoTrustProject ?? false
    : trustProjectOption
  await bootstrapWechatDevtoolsSettings({
    target,
    projectPath,
    trustProject,
  })

  return {
    trustProject,
  }
}

/** 在动作开始前选择安装，沿用原有平台检查和缺失路径配置提示。 */
export async function resolveWechatCliCommandTarget(options: Pick<RunWechatCliWithRetryOptions, 'target'> = {}) {
  if (!isOperatingSystemSupported(operatingSystemName)) {
    logger.warn(i18nText(
      `微信web开发者工具不支持当前平台：${operatingSystemName} !`,
      `Wechat Web DevTools CLI is not supported on current platform: ${operatingSystemName}!`,
    ))
    return
  }

  let target = options.target
  if (!target) {
    const { cliPath, source } = await resolveCliPath()
    if (!cliPath) {
      await handleMissingCliPath(source)
      return
    }
    target = await resolveWechatDevtoolsTarget({ cliPath })
  }
  return target
}

/**
 * @description 执行微信开发者工具 CLI 阶段，包括环境检查、路径解析、bootstrap 与登录重试。
 */
async function executeWechatCliCommand(argv: string[], options: RunWechatCliWithRetryOptions) {
  const target = await resolveWechatCliCommandTarget(options)
  if (!target) {
    return
  }
  await assertWechatDevtoolsHost(target, { signal: options.signal, timeout: options.timeout })
  const executionOptions = { ...options, target }
  const bootstrapContext = await maybeBootstrapWechatDevtoolsSettings(argv, target)
  const wakeArgv = createAutoPreviewWakeArgv(argv, bootstrapContext?.trustProject)
  if (wakeArgv) {
    await runWechatCliWithRetry(target.cliPath, wakeArgv, executionOptions)
  }

  await runWechatCliWithRetry(target.cliPath, argv, executionOptions)
}

/** 配置预热与原生命令属于同一个宿主操作，排他租约在任何写入之前取得。 */
export async function runWechatCliCommand(argv: string[], options: RunWechatCliWithRetryOptions = {}) {
  return await withMachineE2ELease(() => executeWechatCliCommand(argv, options))
}
