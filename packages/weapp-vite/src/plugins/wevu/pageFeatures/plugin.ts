import type { Plugin } from 'vite'
import type { CompilerContext } from '../../../context'
import path from 'pathe'
import { normalizeViteId } from '../../../utils/viteId'
import { readFile as readFileCached } from '../../utils/cache'
import { injectWevuPageFeaturesInJsWithResolver } from './inject'
import { createPageEntryMatcher } from './matcher'

export function createWevuAutoPageFeaturesPlugin(ctx: CompilerContext): Plugin {
  const matcher = createPageEntryMatcher(ctx)

  return {
    name: 'weapp-vite:wevu:page-features',
    enforce: 'pre',
    async transform(code, id) {
      const configService = ctx.configService
      const scanService = ctx.scanService
      if (!configService || !scanService) {
        return null
      }

      // 注意：app.json 变更会影响 pages 列表，这里直接跟随 scanService 的 dirty 标记。
      if (ctx.runtimeState.scan.isDirty) {
        matcher.markDirty()
      }

      const sourceId = normalizeViteId(id, { stripVueVirtualPrefix: true })
      if (!sourceId) {
        return null
      }
      if (sourceId.endsWith('.vue')) {
        return null
      }
      if (!/\.[cm]?[jt]sx?$/.test(sourceId)) {
        return null
      }

      const filename = path.isAbsolute(sourceId)
        ? sourceId
        : path.resolve(configService.cwd, sourceId)

      if (!(await matcher.isPageFile(filename))) {
        return null
      }

      const result = await injectWevuPageFeaturesInJsWithResolver(code, {
        id: filename,
        resolver: {
          resolveId: async (source, importer) => {
            const resolved = await this.resolve(source, importer)
            return resolved ? resolved.id : undefined
          },
          loadCode: async (resolvedId) => {
            const clean = normalizeViteId(resolvedId, { stripVueVirtualPrefix: true })
            if (!clean || clean.startsWith('\0') || clean.startsWith('node:')) {
              return undefined
            }
            try {
              return await readFileCached(clean, { checkMtime: configService.isDev })
            }
            catch {
              return undefined
            }
          },
        },
      })
      if (!result.transformed) {
        return null
      }

      return {
        code: result.code,
        map: null,
      }
    },
  }
}
