import type { MutableCompilerContext } from '../../context'
import type { AutoRoutes } from '../../types/routes'
import type { CandidateEntry } from './candidates'
import type { AutoRoutesFileEvent } from './watch'
import fs from 'fs-extra'
import path from 'pathe'
import { logger } from '../../context/shared'
import { requireConfigService } from '../utils/requireConfigService'
import { cloneCandidate, collectCandidates } from './candidates'
import { cloneRoutes, createTypedRouterDefinition, scanRoutes, updateRoutesReference } from './routes'
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

function updateWatchTargets(target: Set<string>, next: Set<string>) {
  target.clear()
  for (const item of next) {
    target.add(item)
  }
}

export function createAutoRoutesService(ctx: MutableCompilerContext): AutoRoutesService {
  const state = ctx.runtimeState.autoRoutes
  let pendingScan: Promise<void> | undefined
  const emptySnapshot: AutoRoutes = {
    pages: [],
    entries: [],
    subPackages: [],
  }
  let lastWrittenTypedDefinition: string | undefined
  let mutationVersion = 0

  function flagDirty() {
    mutationVersion += 1
    state.dirty = true
  }

  function isEnabled() {
    return ctx.configService?.weappViteConfig?.autoRoutes === true
  }

  function resetState() {
    updateRoutesReference(state.routes, emptySnapshot)
    state.serialized = JSON.stringify(emptySnapshot, null, 2)
    state.typedDefinition = createTypedRouterDefinition(emptySnapshot)
    state.moduleCode = [
      'const routes = ',
      state.serialized,
      ';',
      'const pages = routes.pages;',
      'const entries = routes.entries;',
      'const subPackages = routes.subPackages;',
      'export { routes, pages, entries, subPackages };',
      'export default routes;',
    ].join('\n')
    updateWatchTargets(state.watchFiles, new Set())
    updateWatchTargets(state.watchDirs, new Set())
    state.dirty = false
    state.initialized = true
    pendingScan = undefined
    state.candidates.clear()
    state.needsFullRescan = true
    mutationVersion = 0
  }

  function resolveTypedRouterOutputPath() {
    const configService = ctx.configService
    if (!configService) {
      return undefined
    }

    const baseDir = typeof configService.configFilePath === 'string'
      ? path.dirname(configService.configFilePath)
      : configService.cwd

    if (!baseDir) {
      return undefined
    }

    return path.resolve(baseDir, 'typed-router.d.ts')
  }

  async function writeTypedRouterDefinition() {
    if (!isEnabled()) {
      return
    }

    const outputPath = resolveTypedRouterOutputPath()
    if (!outputPath) {
      return
    }

    const nextContent = state.typedDefinition
    if (!nextContent || nextContent === lastWrittenTypedDefinition) {
      return
    }

    try {
      await fs.outputFile(outputPath, nextContent, 'utf8')
      lastWrittenTypedDefinition = nextContent
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`写入 typed-router.d.ts 失败: ${message}`)
    }
  }

  async function removeTypedRouterDefinition() {
    const outputPath = resolveTypedRouterOutputPath()
    if (!outputPath) {
      lastWrittenTypedDefinition = undefined
      return
    }

    try {
      if (await fs.pathExists(outputPath)) {
        await fs.remove(outputPath)
      }
      lastWrittenTypedDefinition = undefined
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`移除 typed-router.d.ts 失败: ${message}`)
    }
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

    const absoluteSrcRoot = configService.absoluteSrcRoot
    const searchRoots = state.needsFullRescan && state.watchDirs.size > 0
      ? state.watchDirs.values()
      : undefined
    const candidates = await collectCandidates(absoluteSrcRoot, searchRoots)

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
      await removeTypedRouterDefinition()
      return
    }

    const registryUpdated = await ensureCandidateRegistry()
    if (registryUpdated) {
      flagDirty()
    }

    if (!state.dirty) {
      await (pendingScan ?? Promise.resolve())
      await writeTypedRouterDefinition()
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
      await writeTypedRouterDefinition()
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
