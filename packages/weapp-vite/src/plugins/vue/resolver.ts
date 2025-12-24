import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { VUE_PLUGIN_NAME } from './index'

const VUE_VIRTUAL_MODULE_PREFIX = '\0vue:'

export function createVueResolverPlugin(_ctx: CompilerContext): Plugin {
  return {
    name: `${VUE_PLUGIN_NAME}:resolver`,

    resolveId(id) {
      // 处理 .vue 文件引用
      if (id.endsWith('.vue')) {
        // 返回虚拟模块 ID
        return `${VUE_VIRTUAL_MODULE_PREFIX}${id}`
      }

      // 处理虚拟模块解析
      if (id.startsWith(VUE_VIRTUAL_MODULE_PREFIX)) {
        return id
      }

      return null
    },

    async load(id) {
      // 加载虚拟模块时，返回实际 .vue 文件的内容
      // 这里由 transform 插件处理
      if (id.startsWith(VUE_VIRTUAL_MODULE_PREFIX)) {
        const actualId = id.slice(VUE_VIRTUAL_MODULE_PREFIX.length)
        return {
          // 返回一个占位符，实际内容由 transform 处理
          code: `// ${actualId} will be transformed`,
          moduleSideEffects: false,
        }
      }

      return null
    },
  }
}

export function getVirtualModuleId(source: string): string {
  return `${VUE_VIRTUAL_MODULE_PREFIX}${source}`
}

export function getSourceFromVirtualId(id: string): string {
  if (id.startsWith(VUE_VIRTUAL_MODULE_PREFIX)) {
    return id.slice(VUE_VIRTUAL_MODULE_PREFIX.length)
  }
  return id
}
