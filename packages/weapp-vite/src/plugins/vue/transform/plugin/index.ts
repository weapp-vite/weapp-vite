import type { Plugin } from 'vite'
import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { createPageEntryMatcher } from '../../../wevu'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 transform 插件阶段仍统一复用 fs-extra 读写与 exists 判断
import fs from 'fs-extra'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { getSfcCheckMtime, readAndParseSfc } from '../../../utils/vueSfc'
import { VUE_PLUGIN_NAME } from '../../index'
import { emitVueBundleAssets } from '../bundle'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { invalidateResolvedPageLayoutsCache, isLayoutFile } from '../pageLayout'
import { loadScopedSlotModule, resolveScopedSlotVirtualId } from '../scopedSlot'
import { parseWeappVueStyleRequest } from '../styleRequest'
import { invalidatePageLayoutCaches, invalidateVueFileCaches, isVueLikeId, registerNativeLayoutChunksForEntry, resolveSfcSrc } from './shared'
import { transformVueLikeFile } from './transformFile'

export function createVueTransformPlugin(ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>()
  let pageMatcher: ReturnType<typeof createPageEntryMatcher> | null = null
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()
  const styleBlocksCache = new Map<string, SFCStyleBlock[]>()
  const scopedSlotModules = new Map<string, string>()
  const emittedScopedSlotChunks = new Set<string>()
  const classStyleRuntimeWarned = { value: false }

  return {
    name: `${VUE_PLUGIN_NAME}:transform`,

    async buildStart() {
      scopedSlotModules.clear()
      emittedScopedSlotChunks.clear()

      const configService = ctx.configService
      const scanService = ctx.scanService
      if (!configService || !scanService) {
        return
      }

      const entryIds = await collectFallbackPageEntryIds(configService, scanService)
      for (const entryId of entryIds) {
        const candidatePaths = [`${entryId}.vue`, `${entryId}.tsx`, `${entryId}.jsx`]
        for (const candidate of candidatePaths) {
          if (!await fs.pathExists(candidate)) {
            continue
          }
          try {
            const source = await fs.readFile(candidate, 'utf8')
            await registerNativeLayoutChunksForEntry(this, ctx, candidate, source)
          }
          catch {
            // 忽略预扫描失败，交给后续 transform/generateBundle 兜底
          }
          break
        }
      }
    },

    resolveId(id) {
      return resolveScopedSlotVirtualId(id)
    },

    async load(id) {
      const scopedSlot = loadScopedSlotModule(id, scopedSlotModules)
      if (scopedSlot) {
        return scopedSlot
      }

      const parsed = parseWeappVueStyleRequest(id)
      if (!parsed) {
        return null
      }

      const { filename, index } = parsed
      let styles = styleBlocksCache.get(filename)
      if (!styles) {
        try {
          const parsedSfc = await readAndParseSfc(filename, {
            checkMtime: getSfcCheckMtime(ctx.configService),
            resolveSrc: {
              resolveId: (src, importer) => resolveSfcSrc(this, src, importer),
              checkMtime: getSfcCheckMtime(ctx.configService),
            },
          })
          styles = parsedSfc.descriptor.styles
          styleBlocksCache.set(filename, styles)
        }
        catch {
          return null
        }
      }

      const block = styles[index]
      if (!block) {
        return null
      }

      return {
        code: block.content,
        map: null,
      }
    },

    async transform(code, id) {
      if (!isVueLikeId(id)) {
        return null
      }

      return transformVueLikeFile({
        ctx,
        pluginCtx: this,
        code,
        id,
        compilationCache,
        pageMatcher,
        setPageMatcher: matcher => (pageMatcher = matcher),
        reExportResolutionCache,
        styleBlocksCache,
        scopedSlotModules,
        emittedScopedSlotChunks,
        classStyleRuntimeWarned,
        resolveSfcSrc,
      })
    },

    async generateBundle(_options, bundle) {
      await emitVueBundleAssets(bundle as Record<string, any>, {
        ctx,
        pluginCtx: this,
        compilationCache,
        reExportResolutionCache,
        classStyleRuntimeWarned,
      })
    },

    watchChange(id) {
      const normalizedId = normalizeFsResolvedId(id)
      if (ctx.configService && isLayoutFile(normalizedId, ctx.configService)) {
        invalidateResolvedPageLayoutsCache(ctx.configService.absoluteSrcRoot)
        invalidatePageLayoutCaches(ctx.configService, compilationCache, styleBlocksCache)
      }
      if (!isVueLikeId(normalizedId)) {
        return
      }
      invalidateVueFileCaches(normalizedId, compilationCache, styleBlocksCache, {
        existsSync: fs.existsSync,
      })
    },

    async handleHotUpdate({ file }) {
      if (ctx.configService && isLayoutFile(file, ctx.configService)) {
        invalidateResolvedPageLayoutsCache(ctx.configService.absoluteSrcRoot)
        invalidatePageLayoutCaches(ctx.configService, compilationCache, styleBlocksCache)
        return []
      }

      if (!isVueLikeId(file)) {
        return
      }

      invalidateVueFileCaches(file, compilationCache, styleBlocksCache, {
        existsSync: fs.existsSync,
      })

      return []
    },
  }
}
