import type { Plugin } from 'vite'

export type PluginHookName = Extract<keyof Plugin, string>

export interface HookExecutionContext {
  pluginName: string
  hookName: PluginHookName
  args: unknown[]
  duration: number
}

export type HookLogger = (message: string, context: HookExecutionContext) => void
export type HookFormatter = (context: HookExecutionContext) => string
export type HookClock = () => number

export interface WrapPluginOptions {
  /** Wrap only these hooks. Use `all` to wrap every function hook on the plugin. */
  hooks?: PluginHookName[] | 'all'
  /** Minimum duration (ms) required to log or emit notifications. */
  threshold?: number
  /** Disable the default logger output. */
  silent?: boolean
  /** Custom logger called with the formatted message. Defaults to `console.log`. */
  logger?: HookLogger
  /** Custom formatter for the log message. */
  formatter?: HookFormatter
  /** Lifecycle callback invoked after a hook has completed. */
  onHookExecution?: (context: HookExecutionContext) => void
  /** Provide a custom high-resolution clock implementation. */
  clock?: HookClock
  /** @deprecated backwards compatibility typo */
  slient?: boolean
}

export interface ResolvedWrapPluginOptions {
  hooks: PluginHookName[] | 'all'
  threshold: number
  silent: boolean
  logger: HookLogger
  formatter: HookFormatter
  onHookExecution?: (context: HookExecutionContext) => void
  clock: HookClock
}
