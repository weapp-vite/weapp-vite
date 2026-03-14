import type { MutableCompilerContext } from '../../context'
import type { AutoRoutes } from '../../types/routes'
import type { CandidateEntry } from './candidates'
import type { AutoRoutesFileEvent } from './watch'
import fs from 'fs-extra'
import path from 'pathe'
import { resolveWeappAutoRoutesConfig } from '../../autoRoutesConfig'
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

interface AutoRoutesPersistentCache {
  version: 1
  snapshot: AutoRoutes
  serialized: string
  moduleCode: string
  typedDefinition: string
  watchFiles: string[]
  watchDirs: string[]
  fileMtims: Record<string, number>
}

const AUTO_ROUTES_CACHE_FILE = '.weapp-vite/auto-routes.cache.json'

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

  function getResolvedConfig() {
    return resolveWeappAutoRoutesConfig(ctx.configService?.weappViteConfig?.autoRoutes)
  }

  function getSubPackageRoots() {
    return Object.keys(ctx.configService?.weappViteConfig?.subPackages ?? {})
  }

  function isEnabled() {
    return Boolean(ctx.configService) && getResolvedConfig().enabled
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
      'const resolveMiniProgramGlobal = () => (globalThis.wx ?? globalThis.tt ?? globalThis.my);',
      'const callRouteMethod = (methodName, option) => {',
      '  const miniProgramGlobal = resolveMiniProgramGlobal();',
      '  const routeMethod = miniProgramGlobal?.[methodName];',
      '  if (typeof routeMethod !== "function") {',
      '    throw new Error("[weapp-vite] 当前运行环境不支持路由方法: " + methodName);',
      '  }',
      '  if (option === undefined) {',
      '    return routeMethod.call(miniProgramGlobal);',
      '  }',
      '  return routeMethod.call(miniProgramGlobal, option);',
      '};',
      'const wxRouter = {',
      '  switchTab(option) { return callRouteMethod("switchTab", option); },',
      '  reLaunch(option) { return callRouteMethod("reLaunch", option); },',
      '  redirectTo(option) { return callRouteMethod("redirectTo", option); },',
      '  navigateTo(option) { return callRouteMethod("navigateTo", option); },',
      '  navigateBack(option) { return callRouteMethod("navigateBack", option); },',
      '};',
      'export { routes, pages, entries, subPackages, wxRouter };',
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

    return path.resolve(configService.absoluteSrcRoot, 'typed-router.d.ts')
  }

  function resolvePersistentCacheBaseDir() {
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

    return baseDir
  }

  function resolvePersistentCachePath() {
    const autoRoutesConfig = getResolvedConfig()
    if (!autoRoutesConfig.persistentCache) {
      return undefined
    }

    const baseDir = resolvePersistentCacheBaseDir()
    if (!baseDir) {
      return undefined
    }

    return path.resolve(baseDir, autoRoutesConfig.persistentCachePath ?? AUTO_ROUTES_CACHE_FILE)
  }

  function resolveDefaultPersistentCachePath() {
    const baseDir = resolvePersistentCacheBaseDir()
    if (!baseDir) {
      return undefined
    }

    return path.resolve(baseDir, AUTO_ROUTES_CACHE_FILE)
  }

  async function readPersistentCache() {
    if (!getResolvedConfig().persistentCache) {
      return undefined
    }
    const cachePath = resolvePersistentCachePath()
    if (!cachePath || !await fs.pathExists(cachePath)) {
      return undefined
    }

    try {
      const cache = await fs.readJson(cachePath) as AutoRoutesPersistentCache
      if (cache?.version !== 1) {
        return undefined
      }
      return cache
    }
    catch {
      return undefined
    }
  }

  async function restorePersistentCache() {
    const cache = await readPersistentCache()
    if (!cache) {
      return false
    }

    const watchFiles = Array.isArray(cache.watchFiles) ? cache.watchFiles : []
    if (watchFiles.length === 0) {
      return false
    }

    for (const filePath of watchFiles) {
      const expectedMtime = cache.fileMtims?.[filePath]
      if (typeof expectedMtime !== 'number' || !Number.isFinite(expectedMtime)) {
        return false
      }

      try {
        const stat = await fs.stat(filePath)
        if (stat.mtimeMs !== expectedMtime) {
          return false
        }
      }
      catch {
        return false
      }
    }

    updateRoutesReference(state.routes, cache.snapshot)
    state.serialized = cache.serialized
    state.moduleCode = cache.moduleCode
    state.typedDefinition = cache.typedDefinition
    updateWatchTargets(state.watchFiles, new Set(watchFiles))
    updateWatchTargets(state.watchDirs, new Set(Array.isArray(cache.watchDirs) ? cache.watchDirs : []))
    state.dirty = false
    state.initialized = true
    state.needsFullRescan = true
    return true
  }

  async function writePersistentCache() {
    const cachePath = resolvePersistentCachePath()
    if (!cachePath || !state.initialized || !getResolvedConfig().persistentCache) {
      return
    }

    const watchFiles = [...state.watchFiles]
    const fileMtims: Record<string, number> = {}
    for (const filePath of watchFiles) {
      try {
        const stat = await fs.stat(filePath)
        fileMtims[filePath] = stat.mtimeMs
      }
      catch {
        return
      }
    }

    const payload: AutoRoutesPersistentCache = {
      version: 1,
      snapshot: cloneRoutes(state.routes),
      serialized: state.serialized,
      moduleCode: state.moduleCode,
      typedDefinition: state.typedDefinition,
      watchFiles,
      watchDirs: [...state.watchDirs],
      fileMtims,
    }

    try {
      await fs.outputJson(cachePath, payload, { spaces: 2 })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`写入 auto-routes 缓存失败: ${message}`)
    }
  }

  async function removePersistentCache() {
    const cachePath = resolvePersistentCachePath() ?? resolveDefaultPersistentCachePath()
    if (!cachePath) {
      return
    }

    try {
      if (await fs.pathExists(cachePath)) {
        await fs.remove(cachePath)
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`移除 auto-routes 缓存失败: ${message}`)
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

  async function writeTypedRouterDefinition() {
    const autoRoutesConfig = getResolvedConfig()
    if (!autoRoutesConfig.enabled || !autoRoutesConfig.typedRouter) {
      await removeTypedRouterDefinition()
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
      await removeTypedRouterDefinition()
      await removePersistentCache()
      return
    }

    if (!getResolvedConfig().persistentCache) {
      await removePersistentCache()
    }

    if (!state.initialized && state.needsFullRescan) {
      const restored = await restorePersistentCache()
      if (restored) {
        await writeTypedRouterDefinition()
        return
      }
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
      await writePersistentCache()
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
