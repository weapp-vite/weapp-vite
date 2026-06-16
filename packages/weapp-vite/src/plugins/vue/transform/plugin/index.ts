import type { Plugin } from 'vite'
import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../../context'
import type { createPageEntryMatcher } from '../../../wevu'
import type { ResolvedAppShell } from '../appShell'
import type { CompileVueFileResolvedOptions } from '../compileOptions'
import { fs } from '@weapp-core/shared/fs'
import { createHmrProfileEventId, recordHmrProfileDuration } from '../../../../utils/hmrProfile'
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

const VUE_TRANSFORM_FILTER_RE = /\.(?:vue|tsx|jsx)(?:\?.*)?$/
const VUE_LOAD_FILTER_RE = /^(?:\0weapp-vite:scoped-slot:|.*[?&]weapp-vite-vue(?:[=&]|$))/
const SCOPED_SLOT_VIRTUAL_ID_RE = /^\0weapp-vite:scoped-slot:/

export function createVueTransformPlugin(ctx: CompilerContext): Plugin {
  const compilationCache = new Map<string, { result: VueTransformResult, source?: string, isPage: boolean, autoRoutesSignature?: string }>()
  let appShell: ResolvedAppShell | undefined
  let pageMatcher: ReturnType<typeof createPageEntryMatcher> | null = null
  let scanDirtySynced = false
  const reExportResolutionCache = new Map<string, Map<string, string | undefined>>()
  const compileOptionsCache = new Map<string, CompileVueFileResolvedOptions>()
  const styleBlocksCache = new Map<string, SFCStyleBlock[]>()
  const styleRefreshTokens = new Map<string, number | string>()
  const scopedSlotModules = new Map<string, string>()
  const emittedScopedSlotChunks = new Set<string>()
  const classStyleRuntimeWarned = { value: false }

  return {
    name: `${VUE_PLUGIN_NAME}:transform`,

    async buildStart() {
      scopedSlotModules.clear()
      emittedScopedSlotChunks.clear()
      compileOptionsCache.clear()

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

    resolveId: {
      filter: {
        id: SCOPED_SLOT_VIRTUAL_ID_RE,
      },
      handler(id) {
        return resolveScopedSlotVirtualId(id)
      },
    },

    load: {
      filter: {
        id: VUE_LOAD_FILTER_RE,
      },
      async handler(id) {
        return await loadTransformStyleBlock({
          id,
          pluginCtx: this,
          ctx,
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
    },

    transform: {
      filter: {
        id: VUE_TRANSFORM_FILTER_RE,
      },
      async handler(code, id) {
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
            setAppShell: shell => (appShell = shell),
            pageMatcher,
            setPageMatcher: matcher => (pageMatcher = matcher),
            scanDirtySynced,
            setScanDirtySynced: synced => (scanDirtySynced = synced),
            reExportResolutionCache,
            compileOptionsCache,
            styleBlocksCache,
            styleRefreshTokens,
            scopedSlotModules,
            emittedScopedSlotChunks,
            classStyleRuntimeWarned,
            readAndParseSfc,
            createReadAndParseSfcOptions,
          })
        }
        finally {
          recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'transformMs', performance.now() - startedAt)
        }
      },
    },

    async generateBundle(_options, bundle) {
      await emitVueBundleAssets(bundle as Record<string, any>, {
        ctx,
        pluginCtx: this,
        compilationCache,
        appShell,
        reExportResolutionCache,
        compileOptionsCache,
        classStyleRuntimeWarned,
      })
    },

    watchChange(id, change) {
      const startedAt = performance.now()
      const normalizedId = normalizeFsResolvedId(id)
      handleTransformLayoutInvalidation(normalizedId, {
        configService: ctx.configService,
        compilationCache,
        styleBlocksCache,
        styleRefreshTokens,
        isLayoutFile,
        invalidateResolvedPageLayoutsCache,
      })
      handleTransformVueFileInvalidation(normalizedId, {
        compilationCache,
        styleBlocksCache,
        styleRefreshTokens,
        existsSync: fs.existsSync,
      })
      const profile = ctx.runtimeState?.build?.hmr?.profile
      if (profile && !profile.file) {
        profile.eventId = createHmrProfileEventId()
        profile.event = change?.event ?? 'update'
        profile.file = normalizedId
        profile.watchToDirtyMs = performance.now() - startedAt
      }
    },

    async handleHotUpdate({ file }) {
      if (handleTransformLayoutInvalidation(file, {
        configService: ctx.configService,
        compilationCache,
        styleBlocksCache,
        styleRefreshTokens,
        isLayoutFile,
        invalidateResolvedPageLayoutsCache,
      })) {
        return []
      }

      if (!handleTransformVueFileInvalidation(file, {
        compilationCache,
        styleBlocksCache,
        styleRefreshTokens,
        existsSync: fs.existsSync,
      })) {
        return
      }

      return []
    },
  }
}
