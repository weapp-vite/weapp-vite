import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import path from 'pathe'
import {
  createPageEntryMatcher,
  injectWevuPageFeaturesInJsWithResolver,
} from 'wevu/compiler'
import logger from '../logger'
import { getReadFileCheckMtime } from '../utils/cachePolicy'
import { normalizeFsResolvedId } from '../utils/resolvedId'
import { toAbsoluteId } from '../utils/toAbsoluteId'
import { readFile as readFileCached } from './utils/cache'
import { createViteResolverAdapter } from './utils/viteResolverAdapter'

export function createWevuAutoPageFeaturesPlugin(ctx: CompilerContext): Plugin {
  let matcher: ReturnType<typeof createPageEntryMatcher> | null = null

  return {
    name: 'weapp-vite:wevu:page-features',
    enforce: 'pre',
    async transform(code, id) {
      const configService = ctx.configService
      const scanService = ctx.scanService
      if (!configService || !scanService) {
        return null
      }

      if (!matcher) {
        matcher = createPageEntryMatcher({
          srcRoot: configService.absoluteSrcRoot,
          loadEntries: async () => {
            const appEntry = await scanService.loadAppEntry()
            const subPackages = scanService.loadSubPackages().map(meta => ({
              root: meta.subPackage.root,
              pages: meta.subPackage.pages,
            }))
            const pluginPages = scanService.pluginJson
              ? Object.values((scanService.pluginJson as any).pages ?? {})
              : []
            return {
              pages: appEntry.json?.pages ?? [],
              subPackages,
              pluginPages,
            }
          },
          warn: (message: string) => logger.warn(message),
        })
      }
      const pageMatcher = matcher

      // 注意：app.json 变更会影响 pages 列表，这里直接跟随 scanService 的 dirty 标记。
      if (ctx.runtimeState.scan.isDirty) {
        pageMatcher.markDirty()
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

      const filename = toAbsoluteId(sourceId, configService, undefined, { base: 'cwd' })
      if (!filename || !path.isAbsolute(filename)) {
        return null
      }

      if (!(await pageMatcher.isPageFile(filename))) {
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

export function wevuPlugin(ctx: CompilerContext): Plugin[] {
  return [createWevuAutoPageFeaturesPlugin(ctx)]
}

export const wevu = wevuPlugin

export {
  collectWevuPageFeatureFlags,
  createPageEntryMatcher,
  injectWevuPageFeatureFlagsIntoOptionsObject,
  injectWevuPageFeaturesInJs,
  injectWevuPageFeaturesInJsWithResolver,
} from 'wevu/compiler'
export type { ModuleResolver, WevuPageFeatureFlag, WevuPageHookName } from 'wevu/compiler'
