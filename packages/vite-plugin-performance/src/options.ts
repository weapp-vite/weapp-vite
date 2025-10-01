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

export function resolvePluginName(rawName: string | undefined) {
  return rawName && rawName.length > 0 ? rawName : ANONYMOUS_PLUGIN_NAME
}
