import type { Plugin } from 'vite'

export type PluginHooks = keyof Plugin

export interface OnHookExecutionParams {
  pluginName: string
  hookName: string
  args: any[]
  duration: number
}

export interface WrapPluginOptions {
  threshold?: number // 阈值，默认100ms
  onHookExecution?: (params: OnHookExecutionParams) => void
  hooks?: PluginHooks[]
  slient?: boolean
}
