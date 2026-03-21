import type { MutableCompilerContext } from '../../context'
import type { AutoRoutes } from '../../types/routes'
import type { CandidateEntry } from './candidates'
import type { AutoRoutesFileEvent } from './watch'
import { resolveWeappAutoRoutesConfig } from '../../autoRoutesConfig'
import { requireConfigService } from '../utils/requireConfigService'
import { cloneCandidate, collectCandidates } from './candidates'
import { cloneRoutes, scanRoutes, updateRoutesReference } from './routes'
import { removePersistentCache, removeTypedRouterDefinition, restorePersistentCache, writePersistentCache, writeTypedRouterDefinition } from './service/persistence'
import { resetAutoRoutesState, updateWatchTargets } from './service/shared'
import { getAutoRoutesSubPackageRoots } from './subPackageRoots'
import { matchesRouteFile, updateCandidateFromFile } from './watch'

export interface AutoRoutesService {
  ensureFresh: () => Promise<void>
  markDirty: () => void
  getSnapshot: () => AutoRoutes
  getReference: () => AutoRoutes
  getSignature: () => string
  getModuleCode: () => string
  getWatchFiles: () => Iterable<string>
  getWatchDirectories: () => Iterable<string>
  isRouteFile: (filePath: string) => boolean
  handleFileChange: (filePath: string, event?: AutoRoutesFileEvent) => Promise<void>
  isInitialized: () => boolean
  isEnabled: () => boolean
}

export function createAutoRoutesService(ctx: MutableCompilerContext): AutoRoutesService {
  const state = ctx.runtimeState.autoRoutes
  let pendingScan: Promise<void> | undefined
  let lastWrittenTypedDefinition: string | undefined
  let mutationVersion = 0

  function flagDirty() {
    mutationVersion += 1
    state.dirty = true
  }

  function getResolvedConfig() {
    return resolveWeappAutoRoutesConfig(ctx.configService?.weappViteConfig?.autoRoutes)
  }

  function getSubPackageRoots() {
    return getAutoRoutesSubPackageRoots(ctx)
  }

  function isEnabled() {
    return Boolean(ctx.configService) && getResolvedConfig().enabled
  }

  function resetState() {
    resetAutoRoutesState(state)
    pendingScan = undefined
    mutationVersion = 0
  }

  function markNeedsFullRescan() {
    state.needsFullRescan = true
  }

  async function ensureCandidateRegistry(): Promise<boolean> {
    const configService = requireConfigService(ctx, '扫描路由前必须初始化 configService。')

    if (!isEnabled()) {
      if (state.candidates.size > 0) {
        state.candidates.clear()
      }
      state.needsFullRescan = true
      return false
    }

    if (!state.needsFullRescan && state.candidates.size > 0) {
      return false
    }

    state.loadingAppConfig = true
    try {
      await ctx.scanService?.loadAppEntry?.()
    }
    catch { }
    finally {
      state.loadingAppConfig = false
    }

    const absoluteSrcRoot = configService.absoluteSrcRoot
    // 全量重扫必须从 srcRoot 开始，不能只扫描历史 watchDirs；
    // 否则新增同级 pages 目录（例如 pages/foo -> pages/bar）会被漏掉。
    const candidates = await collectCandidates(absoluteSrcRoot, getResolvedConfig().include, getSubPackageRoots())

    state.candidates.clear()
    for (const candidate of candidates.values()) {
      state.candidates.set(candidate.base, cloneCandidate(candidate))
    }

    state.needsFullRescan = false
    return true
  }

  async function ensureFresh() {
    if (!isEnabled()) {
      if (state.dirty || !state.initialized || state.routes.pages.length > 0 || state.routes.entries.length > 0 || state.routes.subPackages.length > 0) {
        resetState()
      }
      const removed = await removeTypedRouterDefinition(ctx)
      if (removed) {
        lastWrittenTypedDefinition = undefined
      }
      await removePersistentCache(ctx)
      return
    }

    if (!getResolvedConfig().persistentCache) {
      await removePersistentCache(ctx)
    }

    if (!state.initialized && state.needsFullRescan) {
      const restored = await restorePersistentCache(ctx, state)
      if (restored) {
        lastWrittenTypedDefinition = await writeTypedRouterDefinition(ctx, state.typedDefinition, lastWrittenTypedDefinition)
        return
      }
    }

    const registryUpdated = await ensureCandidateRegistry()
    if (registryUpdated) {
      flagDirty()
    }

    if (!state.dirty) {
      await (pendingScan ?? Promise.resolve())
      lastWrittenTypedDefinition = await writeTypedRouterDefinition(ctx, state.typedDefinition, lastWrittenTypedDefinition)
      return
    }

    while (state.dirty) {
      if (!pendingScan) {
        const versionSnapshot = mutationVersion
        pendingScan = scanRoutes(ctx, state.candidates as Map<string, CandidateEntry>)
          .then((result) => {
            updateRoutesReference(state.routes, result.snapshot)
            state.serialized = result.serialized
            state.moduleCode = result.moduleCode
            state.typedDefinition = result.typedDefinition
            updateWatchTargets(state.watchFiles, result.watchFiles)
            updateWatchTargets(state.watchDirs, result.watchDirs)
            if (mutationVersion === versionSnapshot) {
              state.dirty = false
            }
            state.initialized = true
          })
          .finally(() => {
            pendingScan = undefined
          })
      }

      await pendingScan
      lastWrittenTypedDefinition = await writeTypedRouterDefinition(ctx, state.typedDefinition, lastWrittenTypedDefinition)
      await writePersistentCache(ctx, state)
    }
  }

  return {
    async ensureFresh() {
      await ensureFresh()
    },

    markDirty() {
      markNeedsFullRescan()
      flagDirty()
    },

    getSnapshot() {
      return cloneRoutes(state.routes)
    },

    getReference() {
      return state.routes
    },

    getSignature() {
      return state.serialized
    },

    getModuleCode() {
      return state.moduleCode
    },

    getWatchFiles() {
      return state.watchFiles.values()
    },

    getWatchDirectories() {
      return state.watchDirs.values()
    },

    isRouteFile(filePath: string) {
      return isEnabled() && matchesRouteFile(ctx, filePath)
    },

    async handleFileChange(filePath: string, event?: AutoRoutesFileEvent) {
      if (!isEnabled()) {
        return
      }

      if (!matchesRouteFile(ctx, filePath)) {
        return
      }

      const changed = await updateCandidateFromFile(
        ctx,
        state.candidates as Map<string, CandidateEntry>,
        filePath,
        event,
        markNeedsFullRescan,
      )
      if (!changed && !state.needsFullRescan) {
        return
      }

      flagDirty()
      await ensureFresh()
    },

    isInitialized() {
      return state.initialized && !state.dirty
    },

    isEnabled() {
      return isEnabled()
    },
  }
}
