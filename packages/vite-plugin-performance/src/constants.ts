import type { HookFormatter, HookLogger, PluginHookName } from './types'

/**
 * @description 默认需要包裹的插件 hooks
 */
export const DEFAULT_PLUGIN_HOOKS: PluginHookName[] = [
  'options',
  'config',
  'configResolved',
  'configureServer',
  'buildStart',
  'resolveId',
  'load',
  'transform',
  'buildEnd',
  'generateBundle',
  'renderChunk',
  'writeBundle',
] as const

/**
 * @description 默认耗时阈值（毫秒）
 */
export const DEFAULT_THRESHOLD = 0
/**
 * @description 未命名插件的默认名称
 */
export const ANONYMOUS_PLUGIN_NAME = 'anonymous-plugin'

/**
 * @description 默认日志格式化器
 */
export const DEFAULT_FORMATTER: HookFormatter = ({ pluginName, hookName, duration }) => {
  const paddedHook = hookName.padEnd(20)
  const formattedDuration = duration.toFixed(2).padStart(7)
  return `[${pluginName}] ${paddedHook} ⏱ ${formattedDuration} ms`
}

/**
 * @description 默认日志输出
 */
export const DEFAULT_LOGGER: HookLogger = (message) => {
  console.log(message)
}
