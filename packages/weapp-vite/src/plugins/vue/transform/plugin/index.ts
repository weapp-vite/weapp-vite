import type { Plugin } from 'vite'
import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { createPageEntryMatcher } from '../../../wevu'
import fs from 'fs-extra'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { getSfcCheckMtime, readAndParseSfc } from '../../../utils/vueSfc'
import { VUE_PLUGIN_NAME } from '../../index'
import { emitVueBundleAssets } from '../bundle'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { invalidateResolvedPageLayoutsCache, isLayoutFile } from '../pageLayout'
import { loadScopedSlotModule, resolveScopedSlotVirtualId } from '../scopedSlot'
import { parseWeappVueStyleRequest } from '../styleRequest'
import { registerNativeLayoutChunksForEntry } from './shared'
import { transformVueLikeFile } from './transformFile'

export function createVueTransformPlugin(ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>()
  let pageMatcher: ReturnType<typeof createPageEntryMatcher> | null = null
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()
  const styleBlocksCache = new Map<string, SFCStyleBlock[]>()
  const scopedSlotModules = new Map<string, string>()
  const emittedScopedSlotChunks = new Set<string>()
  const classStyleRuntimeWarned = { value: false }
  const resolveSfcSrc = async (pluginCtx: any, source: string, importer?: string) => {
    if (typeof pluginCtx.resolve !== 'function') {
      return undefined
    }
    const resolved = await pluginCtx.resolve(source, importer)
    return resolved?.id
  }

  const isVueLikeId = (id: string) => id.endsWith('.vue') || id.endsWith('.jsx') || id.endsWith('.tsx')

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
        for (const [cachedId, cached] of compilationCache.entries()) {
          if (cached.isPage) {
            cached.source = undefined
          }
          styleBlocksCache.delete(cachedId)
        }
      }
      if (!isVueLikeId(normalizedId)) {
        return
      }
      if (!fs.existsSync(normalizedId)) {
        compilationCache.delete(normalizedId)
      }
      else {
        const cached = compilationCache.get(normalizedId)
        if (cached) {
          cached.source = undefined
        }
      }
      styleBlocksCache.delete(normalizedId)
    },

    async handleHotUpdate({ file }) {
      if (ctx.configService && isLayoutFile(file, ctx.configService)) {
        invalidateResolvedPageLayoutsCache(ctx.configService.absoluteSrcRoot)
        for (const [cachedId, cached] of compilationCache.entries()) {
          if (cached.isPage) {
            cached.source = undefined
          }
          styleBlocksCache.delete(cachedId)
        }
        return []
      }

      if (!isVueLikeId(file)) {
        return
      }

      if (!fs.existsSync(file)) {
        compilationCache.delete(file)
      }
      else {
        const cached = compilationCache.get(file)
        if (cached) {
          cached.source = undefined
        }
      }
      styleBlocksCache.delete(file)

      return []
    },
  }
}
