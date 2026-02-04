import type { Plugin } from 'vite'

/**
 * @description Vite 插件 hook 名称
 */
export type PluginHookName = Extract<keyof Plugin, string>

/**
 * @description hook 执行上下文
 */
export interface HookExecutionContext {
  pluginName: string
  hookName: PluginHookName
  args: unknown[]
  duration: number
}

/**
 * @description 日志输出函数
 */
export type HookLogger = (message: string, context: HookExecutionContext) => void
/**
 * @description 日志格式化函数
 */
export type HookFormatter = (context: HookExecutionContext) => string
/**
 * @description 自定义计时函数
 */
export type HookClock = () => number

export interface WrapPluginOptions {
  /** 仅包裹这些 hooks；传入 `all` 表示包裹插件上的所有函数 hook。 */
  hooks?: PluginHookName[] | 'all'
  /** 触发日志/通知的最小耗时（毫秒）。 */
  threshold?: number
  /** 关闭默认日志输出。 */
  silent?: boolean
  /** 自定义日志函数，默认使用 `console.log`。 */
  logger?: HookLogger
  /** 自定义日志格式化函数。 */
  formatter?: HookFormatter
  /** hook 执行完成后的回调。 */
  onHookExecution?: (context: HookExecutionContext) => void
  /** 自定义高精度计时函数。 */
  clock?: HookClock
  /** @deprecated 兼容旧拼写 */
  slient?: boolean
}

/**
 * @description 解析后的插件配置
 */
export interface ResolvedWrapPluginOptions {
  hooks: PluginHookName[] | 'all'
  threshold: number
  silent: boolean
  logger: HookLogger
  formatter: HookFormatter
  onHookExecution?: (context: HookExecutionContext) => void
  clock: HookClock
}
