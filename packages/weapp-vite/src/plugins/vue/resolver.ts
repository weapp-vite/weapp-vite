import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { createRequire } from 'node:module'
import process from 'node:process'
import path from 'pathe'
import { resolveVueSfcHmrSignatures } from 'wevu/compiler'
import logger from '../../logger'
import { storeVueSfcHmrSignatures } from '../../runtime/storeVueSfcHmrSignatures'
import { getPathExistsTtlMs } from '../../utils/cachePolicy'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { toAbsoluteId } from '../../utils/toAbsoluteId'
import { pathExists as pathExistsCached, readFile as readFileCached } from '../utils/cache'
import { VUE_PLUGIN_NAME } from './index'
import { isVueLikeFile, VUE_LIKE_EXTENSIONS } from './transform/shared'
import { parseWeappVueStyleRequest, WEAPP_VUE_STYLE_VIRTUAL_PREFIX } from './transform/styleRequest'

const VUE_VIRTUAL_MODULE_PREFIX = '\0vue:'
const LEGACY_WEAPP_VUE_STYLE_VIRTUAL_PREFIX = 'weapp-vite:vue-style:'
const WINDOWS_ABSOLUTE_PATH_RE = /^[A-Z]:[\\/]/i
let warnedMissingWevu = false
let wevuInstallState: 'unknown' | 'present' | 'missing' = 'unknown'

function isExplicitFileRequest(id: string) {
  return id.startsWith('.')
    || id.startsWith('/')
    || WINDOWS_ABSOLUTE_PATH_RE.test(id)
  // 说明：像 `@/foo.vue`、`~/foo.vue`、`#imports`、`pkg/subpath` 这类非显式文件请求
  // 应交给 Vite 的 alias/tsconfigPaths/其他 resolver 继续处理，避免被误当作 srcRoot 相对路径。
}

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
  const require = createRequire(path.resolve(cwd, 'package.json'))
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

export function createVueResolverPlugin(ctx: CompilerContext, options: { react?: boolean } = {}): Plugin {
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

      // 处理显式的 .vue/.tsx/.jsx 文件引用
      if (isVueLikeFile(id)) {
        if (options.react && /\.(?:jsx|tsx)(?:\?.*)?$/.test(id)) {
          return null
        }
        ensureWevuInstalled(ctx)
        if (!isExplicitFileRequest(id)) {
          return null
        }
        // 统一将 vue-like id 解析为绝对路径，避免相对路径在虚拟模块里丢失 importer 上下文
        const absoluteId = toAbsoluteId(id, configService, importer, { base: 'srcRoot' })
        if (!absoluteId) {
          return null
        }
        // 说明：不再将 vue-like 文件包装成虚拟模块，避免影响 core 插件对入口/额外 chunk 的扫描与发出。
        return absoluteId
      }

      // 处理虚拟模块解析
      if (id.startsWith(VUE_VIRTUAL_MODULE_PREFIX)) {
        return id
      }

      // 处理不带扩展名的路径，检查是否对应 .vue 文件
      if (!isExplicitFileRequest(id)) {
        return null
      }
      // 将相对路径转换为绝对路径
      const absoluteId = toAbsoluteId(id, configService, importer, { base: 'srcRoot' })
      if (!absoluteId) {
        return null
      }

      // 检查 vue-like 文件是否存在
      for (const ext of VUE_LIKE_EXTENSIONS) {
        const vueLikePath = `${absoluteId}${ext}`
        if (await pathExistsCached(vueLikePath, { ttlMs: getPathExistsTtlMs(configService) })) {
          ensureWevuInstalled(ctx)
          // 对于页面入口，返回实际的文件路径（不使用虚拟模块 ID）
          // 这样 loadEntry 函数可以正确读取文件
          return vueLikePath
        }
      }

      return null
    },

    async load(id) {
      const legacyVirtual = id.startsWith(VUE_VIRTUAL_MODULE_PREFIX)
      const absoluteId = legacyVirtual
        ? toAbsoluteId(id.slice(VUE_VIRTUAL_MODULE_PREFIX.length), ctx.configService!, undefined, { base: 'cwd' })
        : ctx.configService?.isDev && !id.startsWith('\0') && id.endsWith('.vue') && path.isAbsolute(id)
          ? normalizeFsResolvedId(id)
          : undefined
      if (!absoluteId) {
        return null
      }

      const code = await readFileCached(absoluteId, {
        checkMtime: ctx.configService?.isDev ?? false,
        encoding: 'utf-8',
      })
      const hmr = ctx.runtimeState?.build?.hmr
      if (ctx.configService?.isDev && hmr && absoluteId.endsWith('.vue')) {
        // 基线必须来自交给后续 transform 的同一份原始内容，不能在 transform 时重读磁盘。
        storeVueSfcHmrSignatures(hmr, normalizeFsResolvedId(absoluteId), resolveVueSfcHmrSignatures(code, absoluteId))
      }
      return legacyVirtual ? { code, moduleSideEffects: false } : { code }
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
