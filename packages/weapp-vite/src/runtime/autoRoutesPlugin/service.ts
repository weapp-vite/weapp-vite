import type { MutableCompilerContext } from '../../context'
import type { AutoRoutes } from '../../types/routes'
import type { CandidateEntry } from './candidates'
import type { ScanRoutesOptions } from './routes'
import type { AutoRoutesFileEvent } from './watch'
import { fs } from '@weapp-core/shared/fs'
import { mayContainPageDeclaration } from 'wevu/compiler'
import { resolveWeappAutoRoutesConfig } from '../../autoRoutesConfig'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { requireConfigService } from '../utils/requireConfigService'
import { cloneCandidate, collectCandidates } from './candidates'
import { cloneRoutes, createAutoRoutesTopologyKey, scanRoutes, updateRoutesReference } from './routes'
import {
  removePersistentCache,
  removeTypedRouterDefinition,
  restorePersistentCache,
  writePersistentCache,
  writeTypedRouterDefinition,
} from './service/persistence'
import {
  resetAutoRoutesState,
  updatePageDeclarationDependencies,
  updateWatchTargets,
} from './service/shared'
import { getAutoRoutesSubPackageRoots } from './subPackageRoots'
import { matchesRouteFile, updateCandidateFromFile } from './watch'

type PageDeclarationSourceResolver = NonNullable<ScanRoutesOptions['resolvePageDeclarationSource']>

export interface AutoRoutesService {
  ensureFresh: () => Promise<void>
  markDirty: () => void
  getSnapshot: () => AutoRoutes
  getReference: () => AutoRoutes
  getSignature: () => string
  getModuleCode: () => string
  getNamedModuleCode: () => string
  getWatchFiles: () => Iterable<string>
  getWatchDirectories: () => Iterable<string>
  /** 返回声明源对应的全部逻辑页面源文件。 */
  getPageDeclarationOwners: (filePath: string) => Iterable<string>
  isRouteFile: (filePath: string) => boolean
  isPageSource: (filePath: string) => boolean
  /** 判断文件是否属于逻辑页面声明或其外部脚本依赖。 */
  isPageDeclarationSource: (filePath: string) => boolean
  /** 注册当前构建上下文已有的模块解析器。 */
  setPageDeclarationSourceResolver: (resolve?: PageDeclarationSourceResolver) => void
  handleFileChange: (filePath: string, event?: AutoRoutesFileEvent) => Promise<boolean>
  isInitialized: () => boolean
  isEnabled: () => boolean
}

export function createAutoRoutesService(ctx: MutableCompilerContext): AutoRoutesService {
  const state = ctx.runtimeState.autoRoutes
  let pendingScan: Promise<void> | undefined
  let pendingRefresh: Promise<void> | undefined
  let lastWrittenTypedDefinition: string | undefined
  let resolvePageDeclarationSource: PageDeclarationSourceResolver | undefined
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

  async function mayChangePageDeclaration(sourcePath: string) {
    if (!state.pageSourceFiles.has(sourcePath)) {
      return false
    }
    if (state.namedRouteSourceFiles.has(sourcePath)) {
      return true
    }
    try {
      const source = await fs.readFile(sourcePath, 'utf8')
      return mayContainPageDeclaration(source)
    }
    catch {
      return true
    }
  }

  function getPageDeclarationOwners(filePath: string) {
    const sourcePath = normalizeFsResolvedId(filePath)
    const dependencyOwners = state.pageDeclarationDependencies.get(sourcePath)
    if (dependencyOwners) {
      return [...dependencyOwners]
    }
    return state.pageSourceFiles.has(sourcePath) ? [sourcePath] : []
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

  async function refresh() {
    if (!isEnabled()) {
      if (
        state.dirty
        || !state.initialized
        || state.routes.pages.length > 0
        || state.routes.entries.length > 0
        || state.routes.subPackages.length > 0
        || state.namedRoutes.length > 0
      ) {
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

    let registryUpdated = false
    if (!state.initialized && state.needsFullRescan) {
      registryUpdated = await ensureCandidateRegistry()
      const topologyKey = createAutoRoutesTopologyKey(
        ctx,
        state.candidates as Map<string, CandidateEntry>,
      )
      const restoreVersion = mutationVersion
      const isRestoreCurrent = () => {
        return mutationVersion === restoreVersion
          && topologyKey === createAutoRoutesTopologyKey(
            ctx,
            state.candidates as Map<string, CandidateEntry>,
          )
      }
      const restored = await restorePersistentCache(
        ctx,
        state,
        topologyKey,
        isRestoreCurrent,
        Boolean(resolvePageDeclarationSource),
      )
      if (restored && isRestoreCurrent()) {
        lastWrittenTypedDefinition = await writeTypedRouterDefinition(ctx, state.typedDefinition, lastWrittenTypedDefinition)
        if (isRestoreCurrent()) {
          return
        }
      }
    }

    if (!registryUpdated) {
      registryUpdated = await ensureCandidateRegistry()
    }
    if (registryUpdated) {
      flagDirty()
    }
    if (!state.dirty) {
      await (pendingScan ?? Promise.resolve())
      if (!state.dirty) {
        lastWrittenTypedDefinition = await writeTypedRouterDefinition(
          ctx,
          state.typedDefinition,
          lastWrittenTypedDefinition,
        )
      }
      return
    }

    while (state.dirty) {
      if (!pendingScan) {
        const versionSnapshot = mutationVersion
        pendingScan = scanRoutes(
          ctx,
          state.candidates as Map<string, CandidateEntry>,
          { resolvePageDeclarationSource },
        )
          .then((result) => {
            if (mutationVersion !== versionSnapshot) {
              return
            }
            updateRoutesReference(state.routes, result.snapshot)
            state.namedRoutes = result.namedRoutes
            state.serialized = result.serialized
            state.moduleCode = result.moduleCode
            state.namedModuleCode = result.namedModuleCode
            state.signature = result.signature
            state.typedDefinition = result.typedDefinition
            state.topologyKey = result.topologyKey
            updatePageDeclarationDependencies(
              state.pageDeclarationDependencies,
              result.pageDeclarationDependencies,
            )
            state.pageDeclarationFingerprints.clear()
            for (const [sourceFile, fingerprint] of result.pageDeclarationFingerprints) {
              state.pageDeclarationFingerprints.set(sourceFile, fingerprint)
            }
            state.usesOpaquePageDeclarationResolver = result.usesOpaquePageDeclarationResolver
            updateWatchTargets(state.pageSourceFiles, result.pageSourceFiles)
            updateWatchTargets(state.namedRouteSourceFiles, result.namedRouteSourceFiles)
            updateWatchTargets(state.watchFiles, result.watchFiles)
            updateWatchTargets(state.watchDirs, result.watchDirs)
            state.dirty = false
            state.initialized = true
          })
          .catch((error: unknown) => {
            if (mutationVersion === versionSnapshot) {
              throw error
            }
          })
          .finally(() => {
            pendingScan = undefined
          })
      }

      await pendingScan
    }
    const publicationVersion = mutationVersion
    if (!state.dirty) {
      lastWrittenTypedDefinition = await writeTypedRouterDefinition(
        ctx,
        state.typedDefinition,
        lastWrittenTypedDefinition,
      )
    }
    if (!state.dirty && mutationVersion === publicationVersion) {
      await writePersistentCache(ctx, state)
    }
  }

  async function ensureFresh() {
    do {
      // 扫描与产物发布共用一个所有者；写入期间的新变更必须随后发布。
      pendingRefresh ??= refresh().finally(() => {
        pendingRefresh = undefined
      })
      await pendingRefresh
    } while (state.dirty)
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
      return state.signature
    },

    getModuleCode() {
      return state.moduleCode
    },

    getNamedModuleCode() {
      return state.namedModuleCode
    },

    getWatchFiles() {
      return state.watchFiles.values()
    },

    getWatchDirectories() {
      return state.watchDirs.values()
    },

    getPageDeclarationOwners(filePath: string) {
      return isEnabled() ? getPageDeclarationOwners(filePath) : []
    },

    isRouteFile(filePath: string) {
      return isEnabled()
        && (getPageDeclarationOwners(filePath).length > 0 || matchesRouteFile(ctx, filePath))
    },

    isPageSource(filePath: string) {
      const sourcePath = normalizeFsResolvedId(filePath)
      return isEnabled() && state.pageSourceFiles.has(sourcePath)
    },

    isPageDeclarationSource(filePath: string) {
      return isEnabled() && getPageDeclarationOwners(filePath).length > 0
    },

    setPageDeclarationSourceResolver(resolve?: PageDeclarationSourceResolver) {
      resolvePageDeclarationSource = resolve
    },

    async handleFileChange(filePath: string, event?: AutoRoutesFileEvent) {
      if (!isEnabled()) {
        return false
      }
      const sourcePath = normalizeFsResolvedId(filePath)
      if (state.pageDeclarationDependencies.has(sourcePath)) {
        flagDirty()
        await ensureFresh()
        return true
      }
      if (!matchesRouteFile(ctx, filePath)) {
        return false
      }

      const changed = await updateCandidateFromFile(
        ctx,
        state.candidates as Map<string, CandidateEntry>,
        filePath,
        event,
        markNeedsFullRescan,
      )
      if (
        !changed
        && !state.needsFullRescan
        && !state.dirty
        && !await mayChangePageDeclaration(sourcePath)
      ) {
        return false
      }
      flagDirty()
      await ensureFresh()
      return true
    },

    isInitialized() {
      return state.initialized && !state.dirty
    },

    isEnabled() {
      return isEnabled()
    },
  }
}
