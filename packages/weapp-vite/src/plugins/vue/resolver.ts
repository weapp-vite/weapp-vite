import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { createRequire } from 'node:module'
import process from 'node:process'
import path from 'pathe'
import logger from '../../logger'
import { getPathExistsTtlMs } from '../../utils/cachePolicy'
import { toAbsoluteId } from '../../utils/toAbsoluteId'
import { pathExists as pathExistsCached, readFile as readFileCached } from '../utils/cache'
import { VUE_PLUGIN_NAME } from './index'
import { parseWeappVueStyleRequest, WEAPP_VUE_STYLE_VIRTUAL_PREFIX } from './transform/styleRequest'

const VUE_VIRTUAL_MODULE_PREFIX = '\0vue:'
const LEGACY_WEAPP_VUE_STYLE_VIRTUAL_PREFIX = 'weapp-vite:vue-style:'
let warnedMissingWevu = false
let wevuInstallState: 'unknown' | 'present' | 'missing' = 'unknown'

function hasWevuDependency(ctx: CompilerContext) {
  const packageJson = ctx.configService?.packageJson
  if (!packageJson) {
    return false
  }
  return Boolean(packageJson.dependencies?.wevu || packageJson.devDependencies?.wevu)
}

function ensureWevuInstalled(ctx: CompilerContext) {
  if (wevuInstallState === 'present') {
    return
  }
  if (wevuInstallState === 'missing') {
    return
  }
  if (warnedMissingWevu) {
    return
  }
  if (hasWevuDependency(ctx)) {
    wevuInstallState = 'present'
    return
  }
  const configService = ctx.configService
  const cwd = configService?.cwd ?? process.cwd()
  const require = createRequire(path.join(cwd, 'package.json'))
  try {
    require.resolve('wevu')
    wevuInstallState = 'present'
  }
  catch {
    warnedMissingWevu = true
    wevuInstallState = 'missing'
    logger.warn('[vue] 检测到项目中有 .vue 文件，但未安装 wevu，请安装 wevu 后重试。')
  }
}

export function createVueResolverPlugin(ctx: CompilerContext): Plugin {
  const isWeappVueStyleVirtualId = (id: string) => {
    return id.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX) || id.startsWith(LEGACY_WEAPP_VUE_STYLE_VIRTUAL_PREFIX)
  }

  return {
    name: `${VUE_PLUGIN_NAME}:resolver`,

    async resolveId(id, importer) {
      const configService = ctx.configService
      if (!configService) {
        return null
      }

      const styleRequest = parseWeappVueStyleRequest(id)
      if (styleRequest) {
        ensureWevuInstalled(ctx)
        const queryIndex = id.indexOf('?')
        const query = queryIndex === -1 ? '' : id.slice(queryIndex + 1)
        const absoluteId = toAbsoluteId(styleRequest.filename, configService, importer, { base: 'srcRoot' })
        if (!absoluteId) {
          return isWeappVueStyleVirtualId(id) ? id : null
        }
        return query ? `${absoluteId}?${query}` : absoluteId
      }

      // 处理显式的 .vue 文件引用
      if (id.endsWith('.vue')) {
        ensureWevuInstalled(ctx)
        // 统一将 .vue id 解析为绝对路径，避免相对路径在虚拟模块里丢失 importer 上下文
        const absoluteId = toAbsoluteId(id, configService, importer, { base: 'srcRoot' })
        if (!absoluteId) {
          return null
        }
        // 说明：不再将 .vue 包装成虚拟模块，避免影响 core 插件对入口/额外 chunk 的扫描与发出。
        return absoluteId
      }

      // 处理虚拟模块解析
      if (id.startsWith(VUE_VIRTUAL_MODULE_PREFIX)) {
        return id
      }

      // 处理不带扩展名的路径，检查是否对应 .vue 文件
      // 将相对路径转换为绝对路径
      const absoluteId = toAbsoluteId(id, configService, importer, { base: 'srcRoot' })
      if (!absoluteId) {
        return null
      }

      // 检查 .vue 文件是否存在
      const vuePath = `${absoluteId}.vue`
      if (await pathExistsCached(vuePath, { ttlMs: getPathExistsTtlMs(configService) })) {
        ensureWevuInstalled(ctx)
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
        const absoluteId = toAbsoluteId(actualId, ctx.configService!, undefined, { base: 'cwd' })
        if (!absoluteId) {
          return null
        }

        // 读取并返回实际的 .vue 文件内容
        const code = await readFileCached(absoluteId, {
          checkMtime: ctx.configService?.isDev ?? false,
          encoding: 'utf-8',
        })
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
