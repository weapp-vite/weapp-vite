import type { Plugin } from 'vite'
import type { CompilerContext } from '../../../context'
import path from 'pathe'
import { getReadFileCheckMtime } from '../../../utils/cachePolicy'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { readFile as readFileCached } from '../../utils/cache'
import { createViteResolverAdapter } from '../../utils/viteResolverAdapter'
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

      const sourceId = normalizeFsResolvedId(id)
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
        resolver: createViteResolverAdapter(
          {
            resolve: async (source, importer) => {
              return await this.resolve(source, importer) as any
            },
          },
          { readFile: readFileCached },
          { checkMtime: getReadFileCheckMtime(configService) },
        ),
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
