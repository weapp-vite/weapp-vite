import type { ResolvedWrapPluginOptions, WrapPluginOptions } from './types'
import {
  ANONYMOUS_PLUGIN_NAME,
  DEFAULT_FORMATTER,
  DEFAULT_LOGGER,
  DEFAULT_PLUGIN_HOOKS,
  DEFAULT_THRESHOLD,
} from './constants'

const hasPerformanceNow = typeof globalThis !== 'undefined' && typeof globalThis.performance?.now === 'function'
const defaultClock = hasPerformanceNow
  ? () => globalThis.performance!.now()
  : () => Date.now()

/**
 * @description 解析插件配置并补全默认值
 */
export function resolveOptions(options: Partial<WrapPluginOptions> = {}): ResolvedWrapPluginOptions {
  const {
    hooks = DEFAULT_PLUGIN_HOOKS,
    threshold = DEFAULT_THRESHOLD,
    silent = options.slient ?? false,
    logger = DEFAULT_LOGGER,
    formatter = DEFAULT_FORMATTER,
    onHookExecution,
    clock = defaultClock,
  } = options

  return {
    hooks,
    threshold,
    silent,
    logger,
    formatter,
    onHookExecution,
    clock,
  }
}

/**
 * @description 解析插件名称（为空时回退默认值）
 */
export function resolvePluginName(rawName: string | undefined) {
  return rawName && rawName.length > 0 ? rawName : ANONYMOUS_PLUGIN_NAME
}
