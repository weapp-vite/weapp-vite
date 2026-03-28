import type { Plugin } from 'vite'
import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { createPageEntryMatcher } from '../../../wevu'
// eslint-disable-next-line e18e/ban-dependencies -- 当前 transform 插件阶段仍统一复用 fs-extra 读写与 exists 判断
import fs from 'fs-extra'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../../utils/vueSfc'
import { VUE_PLUGIN_NAME } from '../../index'
import { emitVueBundleAssets } from '../bundle'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { invalidateResolvedPageLayoutsCache, isLayoutFile } from '../pageLayout'
import { loadScopedSlotModule, resolveScopedSlotVirtualId } from '../scopedSlot'
import { findFirstResolvedVueLikeEntry } from '../shared'
import { parseWeappVueStyleRequest } from '../styleRequest'
import { ensureSfcStyleBlocks, handleTransformLayoutInvalidation, handleTransformVueFileInvalidation, isVueLikeId, registerNativeLayoutChunksForEntry } from './shared'
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
        const entryFilePath = await findFirstResolvedVueLikeEntry(entryId, {
          resolve: async candidate => await fs.pathExists(candidate) ? candidate : undefined,
        })
        if (!entryFilePath) {
          continue
        }
        try {
          const source = await fs.readFile(entryFilePath, 'utf8')
          await registerNativeLayoutChunksForEntry(this, ctx, entryFilePath, source)
        }
        catch {
          // 忽略预扫描失败，交给后续 transform/generateBundle 兜底
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
      let styles: SFCStyleBlock[]
      try {
        styles = await ensureSfcStyleBlocks(filename, styleBlocksCache, {
          load: async target => (
            await readAndParseSfc(target, {
              ...createReadAndParseSfcOptions(this, ctx.configService),
            })
          ).descriptor.styles,
        })
      }
      catch {
        return null
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
      handleTransformLayoutInvalidation(normalizedId, {
        configService: ctx.configService,
        compilationCache,
        styleBlocksCache,
        isLayoutFile,
        invalidateResolvedPageLayoutsCache,
      })
      handleTransformVueFileInvalidation(normalizedId, {
        compilationCache,
        styleBlocksCache,
        existsSync: fs.existsSync,
      })
    },

    async handleHotUpdate({ file }) {
      if (handleTransformLayoutInvalidation(file, {
        configService: ctx.configService,
        compilationCache,
        styleBlocksCache,
        isLayoutFile,
        invalidateResolvedPageLayoutsCache,
      })) {
        return []
      }

      if (!handleTransformVueFileInvalidation(file, {
        compilationCache,
        styleBlocksCache,
        existsSync: fs.existsSync,
      })) {
        return
      }

      return []
    },
  }
}
