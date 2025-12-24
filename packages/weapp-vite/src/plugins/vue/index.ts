import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { createVueResolverPlugin } from './resolver'
import { createVueTransformPlugin } from './transform'
import { createVueWatchPlugin } from './watch'

const VUE_PLUGIN_NAME = 'weapp-vite:vue'

export interface VuePluginOptions {
  /**
   * 是否启用 Vue 支持
   */
  enable?: boolean
}

export function vuePlugin(ctx: CompilerContext, options?: VuePluginOptions): Plugin[] {
  if (options?.enable === false) {
    return []
  }

  return [
    createVueResolverPlugin(ctx),
    createVueTransformPlugin(ctx),
    createVueWatchPlugin(ctx),
  ]
}

// 别名导出，用于插件流中
export const vue = vuePlugin

export { VUE_PLUGIN_NAME }
