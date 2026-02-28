import { AUTOMATOR_COMMAND_NAMES } from './run-automator'

export const WECHAT_CLI_COMMAND_NAMES = [
  'open',
  'login',
  'islogin',
  'preview',
  'auto-preview',
  'upload',
  'build-npm',
  'auto',
  'auto-replay',
  'reset-fileutils',
  'close',
  'quit',
  'cache',
  'engine',
  'open-other',
  'build-ipa',
  'build-apk',
  'cloud',
] as const

export const MINIDEV_NAMESPACE_COMMAND_NAMES = ['alipay', 'ali', 'minidev'] as const

export const CONFIG_COMMAND_NAME = 'config' as const

export const WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES = [
  ...WECHAT_CLI_COMMAND_NAMES,
  ...AUTOMATOR_COMMAND_NAMES,
  ...MINIDEV_NAMESPACE_COMMAND_NAMES,
  CONFIG_COMMAND_NAME,
]

const WEAPP_IDE_TOP_LEVEL_COMMAND_SET = new Set(WEAPP_IDE_TOP_LEVEL_COMMAND_NAMES)

/**
 * @description 判断是否为 weapp-ide-cli 支持的顶层命令。
 */
export function isWeappIdeTopLevelCommand(command: string | undefined) {
  return Boolean(command && WEAPP_IDE_TOP_LEVEL_COMMAND_SET.has(command))
}
