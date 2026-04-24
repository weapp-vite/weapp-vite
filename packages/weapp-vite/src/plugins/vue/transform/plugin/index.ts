import type { Plugin } from 'vite'
import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { createPageEntryMatcher } from '../../../wevu'
import type { CompileVueFileResolvedOptions } from '../compileOptions'
import { fs } from '@weapp-core/shared/fs'
import { recordHmrProfileDuration } from '../../../../utils/hmrProfile'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../../utils/vueSfc'
import { VUE_PLUGIN_NAME } from '../../index'
import { emitVueBundleAssets } from '../bundle'
import { collectFallbackPageEntryIds } from '../fallbackEntries'
import { invalidateResolvedPageLayoutsCache, isLayoutFile } from '../pageLayout'
import { loadScopedSlotModule, resolveScopedSlotVirtualId } from '../scopedSlot'
import { findFirstResolvedVueLikeEntry } from '../shared'
import { parseWeappVueStyleRequest } from '../styleRequest'
import { handleTransformLayoutInvalidation, handleTransformVueFileInvalidation, isVueLikeId, loadTransformStyleBlock, preloadNativeLayoutEntries } from './shared'
import { transformVueLikeFile } from './transformFile'

export function createVueTransformPlugin(ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, { result: VueTransformResult, source?: string, isPage: boolean }>()
  let pageMatcher: ReturnType<typeof createPageEntryMatcher> | null = null
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()
  const compileOptionsCache = new Map<string, CompileVueFileResolvedOptions>()
  const styleBlocksCache = new Map<string, SFCStyleBlock[]>()
  const scopedSlotModules = new Map<string, string>()
  const emittedScopedSlotChunks = new Set<string>()
  const classStyleRuntimeWarned = { value: false }

  return {
    name: `${VUE_PLUGIN_NAME}:transform`,

    async buildStart() {
      scopedSlotModules.clear()
      emittedScopedSlotChunks.clear()

      await preloadNativeLayoutEntries({
        pluginCtx: this,
        ctx,
        configService: ctx.configService,
        scanService: ctx.scanService,
        collectFallbackPageEntryIds: async (configService, scanService) => {
          return Array.from(await collectFallbackPageEntryIds(configService, scanService))
        },
        findFirstResolvedVueLikeEntry,
        pathExists: fs.pathExists,
        readFile: fs.readFile,
      })
    },

    resolveId(id) {
      return resolveScopedSlotVirtualId(id)
    },

    async load(id) {
      return await loadTransformStyleBlock({
        id,
        pluginCtx: this,
        configService: ctx.configService,
        styleBlocksCache,
        loadScopedSlotModule: (id) => {
          const loaded = loadScopedSlotModule(id, scopedSlotModules)
          return loaded?.code ?? null
        },
        scopedSlotModules,
        parseWeappVueStyleRequest: id => parseWeappVueStyleRequest(id) ?? null,
        readAndParseSfc,
        createReadAndParseSfcOptions,
      })
    },

    async transform(code, id) {
      if (!isVueLikeId(id)) {
        return null
      }
      const startedAt = performance.now()

      try {
        return await transformVueLikeFile({
          ctx,
          pluginCtx: this,
          code,
          id,
          compilationCache,
          pageMatcher,
          setPageMatcher: matcher => (pageMatcher = matcher),
          reExportResolutionCache,
          compileOptionsCache,
          styleBlocksCache,
          scopedSlotModules,
          emittedScopedSlotChunks,
          classStyleRuntimeWarned,
        })
      }
      finally {
        recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'transformMs', performance.now() - startedAt)
      }
    },

    async generateBundle(_options, bundle) {
      await emitVueBundleAssets(bundle as Record<string, any>, {
        ctx,
        pluginCtx: this,
        compilationCache,
        reExportResolutionCache,
        compileOptionsCache,
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
