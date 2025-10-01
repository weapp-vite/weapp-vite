import type { Plugin } from 'vite'
import type { HookExecutionContext, PluginHookName, ResolvedWrapPluginOptions, WrapPluginOptions } from './types'
import { resolveOptions, resolvePluginName } from './options'
import { ensureArray, isPromiseLike } from './utils'

export function wrapPlugin(maybePlugin: Plugin, options?: Partial<WrapPluginOptions>): Plugin
export function wrapPlugin(maybePlugin: Plugin[], options?: Partial<WrapPluginOptions>): Plugin[]
export function wrapPlugin(maybePlugin: Plugin | Plugin[], options?: Partial<WrapPluginOptions>): Plugin | Plugin[] {
  const resolvedOptions = resolveOptions(options)
  const plugins = ensureArray(maybePlugin)
  const wrapped = plugins.map(plugin => wrapSinglePlugin(plugin, resolvedOptions))
  return Array.isArray(maybePlugin) ? wrapped : wrapped[0]
}

function wrapSinglePlugin(plugin: Plugin, options: ResolvedWrapPluginOptions): Plugin {
  const wrapped: Plugin = { ...plugin }
  const pluginName = resolvePluginName(plugin.name)
  const hooksToWrap = resolveHooks(plugin, options.hooks)

  for (const hookName of hooksToWrap) {
    const original = plugin[hookName]
    if (typeof original !== 'function') {
      continue
    }

    wrapped[hookName] = function performanceHook(this: unknown, ...args: unknown[]) {
      const start = options.clock()

      const invoke = () => original.apply(this, args as [unknown])
      const finalize = (result: unknown) => {
        reportExecution({ pluginName, hookName, args, start, options })
        return result
      }
      const handleError = (error: unknown) => {
        reportExecution({ pluginName, hookName, args, start, options })
        throw error
      }

      try {
        const result = invoke()
        if (isPromiseLike(result)) {
          return result.then(finalize, handleError)
        }
        return finalize(result)
      }
      catch (error) {
        return handleError(error)
      }
    }
  }

  return wrapped
}

function resolveHooks(plugin: Plugin, hooks: ResolvedWrapPluginOptions['hooks']) {
  if (hooks === 'all') {
    return Object.keys(plugin).filter(key => typeof plugin[key as PluginHookName] === 'function') as PluginHookName[]
  }
  return [...hooks]
}

function reportExecution(params: {
  pluginName: string
  hookName: PluginHookName
  args: unknown[]
  start: number
  options: ResolvedWrapPluginOptions
}) {
  const { pluginName, hookName, args, start, options } = params
  const duration = Math.max(0, options.clock() - start)
  const context: HookExecutionContext = {
    pluginName,
    hookName,
    args,
    duration,
  }

  if (duration >= options.threshold) {
    if (!options.silent) {
      const message = options.formatter(context)
      options.logger(message, context)
    }
    options.onHookExecution?.(context)
  }
}
