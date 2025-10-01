import type { HookFormatter, HookLogger, PluginHookName } from './types'

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

export const DEFAULT_THRESHOLD = 0
export const ANONYMOUS_PLUGIN_NAME = 'anonymous-plugin'

export const DEFAULT_FORMATTER: HookFormatter = ({ pluginName, hookName, duration }) => {
  const paddedHook = hookName.padEnd(20)
  const formattedDuration = duration.toFixed(2).padStart(7)
  return `[${pluginName}] ${paddedHook} ⏱ ${formattedDuration} ms`
}

export const DEFAULT_LOGGER: HookLogger = (message) => {
  console.log(message)
}
