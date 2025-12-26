import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import fs from 'fs-extra'
import path from 'pathe'
import { VUE_PLUGIN_NAME } from './index'

const VUE_VIRTUAL_MODULE_PREFIX = '\0vue:'

export function createVueResolverPlugin(ctx: CompilerContext): Plugin {
  return {
    name: `${VUE_PLUGIN_NAME}:resolver`,

    async resolveId(id, importer) {
      const configService = ctx.configService
      if (!configService) {
        return null
      }

      // 处理显式的 .vue 文件引用
      if (id.endsWith('.vue')) {
        // 返回虚拟模块 ID
        return `${VUE_VIRTUAL_MODULE_PREFIX}${id}`
      }

      // 处理虚拟模块解析
      if (id.startsWith(VUE_VIRTUAL_MODULE_PREFIX)) {
        return id
      }

      // 处理不带扩展名的路径，检查是否对应 .vue 文件
      // 将相对路径转换为绝对路径
      let absoluteId = id
      if (!path.isAbsolute(id)) {
        if (importer && path.isAbsolute(importer)) {
          absoluteId = path.resolve(path.dirname(importer), id)
        }
        else {
          absoluteId = path.resolve(configService.absoluteSrcRoot, id)
        }
      }

      // 检查 .vue 文件是否存在
      const vuePath = `${absoluteId}.vue`
      if (await fs.pathExists(vuePath)) {
        // 对于页面入口，返回实际的文件路径（不使用虚拟模块 ID）
        // 这样 loadEntry 函数可以正确读取文件
        return vuePath
      }

      return null
    },

    async load(id) {
      // 加载虚拟模块时，返回实际 .vue 文件的内容
      if (id.startsWith(VUE_VIRTUAL_MODULE_PREFIX)) {
        const actualId = id.slice(VUE_VIRTUAL_MODULE_PREFIX.length)

        // 将相对路径转换为绝对路径
        const absoluteId = path.isAbsolute(actualId)
          ? actualId
          : path.resolve(ctx.configService!.cwd, actualId)

        // 读取并返回实际的 .vue 文件内容
        const code = await fs.readFile(absoluteId, 'utf-8')
        return {
          code,
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
