import type { OutputBundle, OutputChunk } from 'rolldown'
import type { RuntimeChunkDuplicatePayload, SharedChunkDuplicatePayload } from '../../../../runtime/chunkStrategy'
import type { SubPackageMetaValue } from '../../../../types'
import type { CorePluginState } from '../../helpers'
import type { BundleChunkSnapshot } from '../../helpers/bundle'
import type { ChunkScriptAnalysisCache } from './rewrite'
import process from 'node:process'
import { resolveAstEngine } from '../../../../ast'
import logger from '../../../../logger'
import { parseLogicalEntryId } from '../../../../moduleGraph/protocol'
import { shouldRewriteBundleNpmImports } from '../../../../platform'
import { applyRuntimeChunkLocalization, applySharedChunkStrategy, DEFAULT_SHARED_CHUNK_STRATEGY } from '../../../../runtime/chunkStrategy'
import { resolveRequestRuntimeOptions } from '../../../../runtime/config/internal/injectRequestGlobals'
import { resolveNpmBuildCandidateDependencyRecordSync } from '../../../../runtime/npmPlugin/service'
import { toPosixPath } from '../../../../utils'
import { recordHmrProfileDuration } from '../../../../utils/hmrProfile'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { emitStyleSidecarAsset } from '../../../css'
import { normalizePreprocessorStyleAssets, pruneUneventedDevHmrChunks } from '../../../outputFinalizer'
import {
  createBundleChunkSnapshot,
  filterPluginBundleOutputs,
  flushIndependentBuilds,
  formatBytes,
  refreshPartialSharedChunkImporters,
  refreshSharedChunkImporters,
  removeImplicitPagePreloads,
  rewriteWevuInternalRuntimeImports,
  stabilizeWevuRuntimeChunkAccess,
  syncChunkImportsFromRequireCalls,
} from '../../helpers'
import { injectAppPreludeCode, resolveAppPreludeCode, resolveAppPreludeOptions } from './appPrelude'
import { PRETTY_NODE_MODULES_RE } from './constants'
import {
  collapseRequestGlobalsRuntimeSupportChunk,
  injectAxiosFetchAdapterEnv,
  injectRequestGlobalsAppRegistration,
  injectRequestGlobalsBundleRuntime,
  injectRequestGlobalsLocalBindings,
  injectRequestGlobalsPassiveBindings,
  inlineRequestGlobalsAppRegisteredInstallerChunks,
} from './requestGlobals'
import {
  rewriteBundleDynamicGlobalResolution,
  rewriteBundleNpmImportsByPlatform,
  rewriteBundleNpmImportsToLocalRoots,
  rewriteBundlePlatformApi,
  rewriteChunkNpmImportsToLocalRoot,
  rewriteJsonNpmImportsToLocalRoot,
  warmupBundleScriptAnalysis,
} from './rewrite'

function resolveInjectWeapiGlobalName(state: CorePluginState) {
  const injectWeapi = state.ctx.configService.weappViteConfig?.injectWeapi
  if (!injectWeapi) {
    return null
  }
  const enabled = typeof injectWeapi === 'object' ? injectWeapi.enabled === true : injectWeapi === true
  if (!enabled || typeof injectWeapi !== 'object' || injectWeapi.replaceWx !== true) {
    return null
  }
  return injectWeapi.globalName?.trim() || 'wpi'
}

function hasChunkOutputs(bundle: OutputBundle) {
  return Object.values(bundle).some(output => output?.type === 'chunk')
}

function pruneHmrMetadataOnlyChunks(bundle: OutputBundle, state: CorePluginState) {
  if (
    !state.ctx.configService.isDev
    || !state.hmrState.hasBuiltOnce
    || !state.hmrState.skipSharedChunkRefresh
  ) {
    return hasChunkOutputs(bundle)
  }

  for (const [fileName, output] of Object.entries(bundle)) {
    if (output?.type === 'chunk') {
      delete bundle[fileName]
    }
  }
  return false
}

function isAssetOnlyDevHmrBundle(hasChunkOutput: boolean, state: CorePluginState) {
  return state.ctx.configService.isDev
    && state.hmrState.hasBuiltOnce
    && state.hmrState.skipSharedChunkRefresh
    && !hasChunkOutput
}

function isStableHmrSharedChunk(fileName: string) {
  return fileName.startsWith('weapp-vendors/')
    || (!fileName.includes('/') && fileName !== 'app.js')
}

function isRuntimeVendorSharedChunk(fileName: string) {
  return fileName.startsWith('weapp-vendors/')
    && /(?:^|[-/])[\w-]*runtime[\w-]*(?:[-.]|$)/.test(fileName)
}

function addEmittedChunkFileName(
  emittedChunkFileNames: Set<string> | undefined,
  fileName: string,
  chunk: OutputChunk,
) {
  if (!emittedChunkFileNames) {
    return
  }
  emittedChunkFileNames.add(fileName)
  if (chunk.fileName) {
    emittedChunkFileNames.add(chunk.fileName)
  }
}

function isCurrentStyleSidecarUpdate(state: CorePluginState) {
  return state.ctx.runtimeState?.build?.hmr?.profile?.dirtyReasonSummary?.some(item => item.startsWith('style-sidecar:')) === true
}

export function createSubPackageMatcher(subPackageRoots: string[]) {
  const candidates = subPackageRoots.map(root => ({
    prefix: `${root}/`,
    root,
  }))
  const cache = new Map<string, string | undefined>()

  return function matchSubPackage(filePath: string) {
    const cached = cache.get(filePath)
    if (cached !== undefined || cache.has(filePath)) {
      return cached
    }

    let matched: string | undefined
    for (const { prefix, root } of candidates) {
      if (filePath === root || filePath.startsWith(prefix)) {
        matched = root
        break
      }
    }
    cache.set(filePath, matched)
    return matched
  }
}

function createBundleChunkResolver(bundle: OutputBundle) {
  const chunksByFileName = new Map<string, OutputChunk>()
  for (const [fileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    chunksByFileName.set(fileName, chunk)
    if (chunk.fileName) {
      chunksByFileName.set(chunk.fileName, chunk)
    }
  }

  return (fileName: string) => chunksByFileName.get(fileName)
}

async function emitCurrentStyleSidecarAsset(this: any, state: CorePluginState, bundle: OutputBundle) {
  if (!isCurrentStyleSidecarUpdate(state)) {
    return
  }
  const currentFile = state.ctx.runtimeState.build.hmr.profile.file
  if (typeof currentFile !== 'string') {
    return
  }
  await emitStyleSidecarAsset(state.ctx, this, bundle, currentFile, state.resolvedConfig)
}

function resolveImportedChunkId(importerFileName: string, imported: string) {
  if (!imported.startsWith('.')) {
    return imported
  }
  const importerSegments = importerFileName.split('/')
  importerSegments.pop()
  for (const segment of imported.split('/')) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      importerSegments.pop()
      continue
    }
    importerSegments.push(segment)
  }
  return importerSegments.join('/')
}

function collectResolvedImportedChunkIds(
  importedChunkIds: Set<string>,
  importerFileName: string,
  imports: unknown,
) {
  if (!Array.isArray(imports)) {
    return
  }
  for (const imported of imports) {
    if (typeof imported !== 'string') {
      continue
    }
    importedChunkIds.add(resolveImportedChunkId(importerFileName, imported))
  }
}

export function isActiveHmrEntryFacade(
  facadeModuleId: string | null | undefined,
  activeEntryIds: Set<string> | undefined,
) {
  if (!facadeModuleId || !activeEntryIds?.size) {
    return false
  }
  if (activeEntryIds.has(facadeModuleId)) {
    return true
  }
  const sourceId = parseLogicalEntryId(facadeModuleId)?.sourceId
  return sourceId ? activeEntryIds.has(normalizeFsResolvedId(sourceId)) : false
}

export function collectActiveHmrImportedChunkIds(bundle: OutputBundle, activeEntryIds?: Set<string>) {
  if (!activeEntryIds?.size) {
    return new Set<string>()
  }
  const importedChunkIds = new Set<string>()
  for (const [bundleFileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    const chunk = output as OutputChunk
    if (!isActiveHmrEntryFacade(chunk.facadeModuleId, activeEntryIds)) {
      continue
    }
    const importerFileName = chunk.fileName || bundleFileName
    collectResolvedImportedChunkIds(importedChunkIds, importerFileName, chunk.imports)
    collectResolvedImportedChunkIds(importedChunkIds, importerFileName, chunk.dynamicImports)
  }
  return importedChunkIds
}

export function mergeActiveHmrEntryIds(
  lastHmrEntryIds: Set<string> | undefined,
  lastEmittedEntryIds: Set<string> | undefined,
) {
  if (!lastHmrEntryIds?.size) {
    return lastEmittedEntryIds
  }
  if (!lastEmittedEntryIds?.size) {
    return lastHmrEntryIds
  }
  return new Set([...lastHmrEntryIds, ...lastEmittedEntryIds])
}

function resolveActiveHmrEntryIds(state: CorePluginState) {
  return mergeActiveHmrEntryIds(
    state.hmrState.lastHmrEntryIds,
    state.hmrState.lastEmittedEntryIds,
  )
}

function shouldRewriteDevHmrChunk(
  fileName: string,
  output: OutputBundle[string],
  state: CorePluginState,
  activeEntryIds: Set<string> | undefined,
  activeImportedChunkIds: Set<string>,
) {
  if (output?.type !== 'chunk') {
    return true
  }

  if (!activeEntryIds?.size) {
    return true
  }

  const chunk = output as OutputChunk
  if (isActiveHmrEntryFacade(chunk.facadeModuleId, activeEntryIds)) {
    return true
  }
  if (state.hmrState.affectedSharedChunkIds?.has(fileName) || state.hmrState.affectedSharedChunkIds?.has(chunk.fileName)) {
    return true
  }
  return activeImportedChunkIds.has(fileName)
}

function resolveDevHmrRewriteBundle(
  bundle: OutputBundle,
  state: CorePluginState,
  precomputedActiveImportedChunkIds?: Set<string>,
) {
  if (
    !state.ctx.configService.isDev
    || !state.hmrState.hasBuiltOnce
    || state.hmrState.didEmitAllEntries
  ) {
    return bundle
  }

  const rewriteBundle: OutputBundle = {}
  const activeEntryIds = resolveActiveHmrEntryIds(state)
  const activeImportedChunkIds = precomputedActiveImportedChunkIds
    ?? collectActiveHmrImportedChunkIds(bundle, activeEntryIds)
  for (const [fileName, output] of Object.entries(bundle)) {
    if (shouldRewriteDevHmrChunk(fileName, output, state, activeEntryIds, activeImportedChunkIds)) {
      rewriteBundle[fileName] = output
    }
  }
  return rewriteBundle
}

function createDevHmrRuntimeRewriteSnapshot(
  bundle: OutputBundle,
  rewriteBundle: OutputBundle,
) {
  if (bundle === rewriteBundle) {
    return createBundleChunkSnapshot(bundle)
  }

  const fullSnapshot = createBundleChunkSnapshot(bundle)
  const rewriteSnapshot = createBundleChunkSnapshot(rewriteBundle)
  return {
    ...rewriteSnapshot,
    chunkFileNames: fullSnapshot.chunkFileNames,
    vendorChunks: fullSnapshot.vendorChunks,
    wevuChunks: fullSnapshot.wevuChunks,
    wevuChunkFileNames: fullSnapshot.wevuChunkFileNames,
  } satisfies BundleChunkSnapshot
}

export function shouldWarmupBundleScriptAnalysis(options: {
  rewritesBundleNpmImports: boolean
  hasNpmBuildCandidateDependencies: boolean
  hasLocalRootNpmRewriteTargets: boolean
  hasPlatformApiRewrite: boolean
}) {
  return !options.rewritesBundleNpmImports && (
    options.hasNpmBuildCandidateDependencies
    || options.hasLocalRootNpmRewriteTargets
    || options.hasPlatformApiRewrite
  )
}

function prunePartialHmrStableSharedChunks(bundle: OutputBundle, state: CorePluginState) {
  if (
    !state.ctx.configService.isDev
    || !state.hmrState.hasBuiltOnce
    || state.hmrState.didEmitAllEntries
    || state.hmrState.skipSharedChunkRefresh
    || !state.hmrState.lastEmittedEntryIds?.size
  ) {
    return undefined
  }

  const activeEntryIds = resolveActiveHmrEntryIds(state)
  const activeImportedChunkIds = new Set<string>()
  const pendingRuntimeVendorChunks: Array<{ fileName: string, chunk: OutputChunk }> = []
  const emittedChunkFileNames = state.ctx.runtimeState?.build?.hmr?.lastEmittedChunkFileNames
  for (const [fileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }

    const chunk = output as OutputChunk
    if (isActiveHmrEntryFacade(chunk.facadeModuleId, activeEntryIds)) {
      const importerFileName = chunk.fileName || fileName
      addEmittedChunkFileName(emittedChunkFileNames, fileName, chunk)
      collectResolvedImportedChunkIds(activeImportedChunkIds, importerFileName, chunk.imports)
      collectResolvedImportedChunkIds(activeImportedChunkIds, importerFileName, chunk.dynamicImports)
    }

    if (!isStableHmrSharedChunk(fileName)) {
      continue
    }
    const knownImporters = state.hmrSharedChunkImporters.get(fileName)
    if (!knownImporters?.size) {
      delete bundle[fileName]
      continue
    }

    const isAffectedSharedChunk = state.hmrState.affectedSharedChunkIds?.has(fileName) === true
      || (output.fileName ? state.hmrState.affectedSharedChunkIds?.has(output.fileName) === true : false)
    if (isAffectedSharedChunk) {
      addEmittedChunkFileName(emittedChunkFileNames, fileName, chunk)
      continue
    }

    if (isRuntimeVendorSharedChunk(fileName)) {
      pendingRuntimeVendorChunks.push({ fileName, chunk })
      continue
    }

    let isCompleteSharedChunkRefresh = true
    for (const entryId of knownImporters) {
      if (!activeEntryIds?.has(entryId)) {
        isCompleteSharedChunkRefresh = false
        break
      }
    }
    if (!isCompleteSharedChunkRefresh) {
      delete bundle[fileName]
      continue
    }

    addEmittedChunkFileName(emittedChunkFileNames, fileName, chunk)
  }

  for (const { fileName, chunk } of pendingRuntimeVendorChunks) {
    if (activeImportedChunkIds.has(fileName) || (chunk.fileName ? activeImportedChunkIds.has(chunk.fileName) : false)) {
      addEmittedChunkFileName(emittedChunkFileNames, fileName, chunk)
      continue
    }

    const knownImporters = state.hmrSharedChunkImporters.get(fileName)
    let isCompleteSharedChunkRefresh = true
    for (const entryId of knownImporters ?? []) {
      if (!activeEntryIds?.has(entryId)) {
        isCompleteSharedChunkRefresh = false
        break
      }
    }
    if (!isCompleteSharedChunkRefresh) {
      delete bundle[fileName]
      continue
    }

    addEmittedChunkFileName(emittedChunkFileNames, fileName, chunk)
  }
  return activeImportedChunkIds
}

function retainFullEntryHmrChunks(bundle: OutputBundle, state: CorePluginState) {
  if (
    !state.ctx.configService.isDev
    || !state.hmrState.hasBuiltOnce
    || !state.hmrState.didEmitAllEntries
  ) {
    return
  }

  const emittedChunkFileNames = state.ctx.runtimeState?.build?.hmr?.lastEmittedChunkFileNames
  if (!emittedChunkFileNames?.size) {
    return
  }

  for (const [fileName, output] of Object.entries(bundle)) {
    if (output?.type !== 'chunk') {
      continue
    }
    addEmittedChunkFileName(emittedChunkFileNames, fileName, output as OutputChunk)
  }
}

export function createGenerateBundleHook(state: CorePluginState, isPluginBuild: boolean) {
  const { ctx, subPackageMeta } = state
  const { scanService, configService } = ctx
  const astEngine = resolveAstEngine(configService.weappViteConfig)
  const injectRequestGlobalsOptions = resolveRequestRuntimeOptions({
    appPrelude: configService.weappViteConfig?.appPrelude,
    webRuntime: configService.weappViteConfig?.injectWebRuntimeGlobals,
    injectRequestGlobals: configService.weappViteConfig?.injectRequestGlobals,
  }, configService.packageJson, message => logger.warn(message))
  const npmBuildCandidateDependencies = resolveNpmBuildCandidateDependencyRecordSync(ctx, configService.packageJson)

  return async function generateBundle(this: any, _options: any, bundle: any) {
    const startedAt = performance.now()
    try {
      ctx.moduleGraphService?.bindBuildContext(state, this)
      ctx.moduleGraphService?.bindPluginContext(this)
      const rolldownBundle = bundle as unknown as OutputBundle
      const scriptAnalysisCache: ChunkScriptAnalysisCache = new WeakMap()
      await flushIndependentBuilds.call(this, state)
      const hasChunkOutput = pruneHmrMetadataOnlyChunks(rolldownBundle, state)
      await emitCurrentStyleSidecarAsset.call(this, state, rolldownBundle)
      const assetOnlyDevHmrBundle = isAssetOnlyDevHmrBundle(hasChunkOutput, state)

      if (isPluginBuild) {
        filterPluginBundleOutputs(rolldownBundle, configService)
        if (!shouldRewriteBundleNpmImports(configService.platform)) {
          warmupBundleScriptAnalysis(rolldownBundle, {
            astEngine,
            cache: scriptAnalysisCache,
          })
          for (const output of Object.values(rolldownBundle)) {
            if (output?.type === 'chunk') {
              rewriteChunkNpmImportsToLocalRoot(output as OutputChunk, '', undefined, npmBuildCandidateDependencies, {
                analysisCache: scriptAnalysisCache,
                astEngine,
                basedir: configService.cwd,
              })
            }
          }
          rewriteJsonNpmImportsToLocalRoot(rolldownBundle, '', undefined, npmBuildCandidateDependencies, configService.cwd)
        }
        normalizePreprocessorStyleAssets(
          rolldownBundle,
          state.ctx.configService.outputExtensions?.wxss,
          asset => this.emitFile(asset),
        )
        return
      }

      const sharedStartedAt = performance.now()
      let activeImportedChunkIds: Set<string> | undefined
      if (!subPackageMeta) {
        const sharedStrategy = configService.weappViteConfig?.chunks?.sharedStrategy ?? DEFAULT_SHARED_CHUNK_STRATEGY
        const shouldLogChunks = configService.weappViteConfig?.chunks?.logOptimization ?? true
        const subPackageRoots = [...scanService.subPackageMap.keys()].filter(Boolean)
        const duplicateWarningBytes = Number(configService.weappViteConfig?.chunks?.duplicateWarningBytes ?? 0)
        const shouldWarnOnDuplicate = Number.isFinite(duplicateWarningBytes) && duplicateWarningBytes > 0
        let redundantBytesTotal = 0

        if (configService.isDev && (state.hmrSharedChunksMode === 'auto' || state.hmrSharedChunksMode === 'full')) {
          const forceFullSharedChunkRefresh = process.env.WEAPP_VITE_FORCE_FULL_HMR_SHARED_CHUNKS === '1'
          if (
            assetOnlyDevHmrBundle
            && !forceFullSharedChunkRefresh
          ) {
          // 纯模板、样式、JSON 宏更新不会产出新的 JS chunk；此时刷新 shared chunk 图会让
          // DevTools hotreload 误认为页面 JS/vendor 也需要替换，产生新旧模块短暂错位。
          }
          else if (
            state.hmrSharedChunksMode === 'full'
            || state.hmrState.didEmitAllEntries
            || !state.hmrState.hasBuiltOnce
          ) {
            refreshSharedChunkImporters(rolldownBundle, state)
          }
          else if (forceFullSharedChunkRefresh) {
            refreshSharedChunkImporters(rolldownBundle, state)
          }
          else if (state.hmrState.lastHmrEntryIds?.size) {
            refreshPartialSharedChunkImporters(rolldownBundle, state, state.hmrState.lastHmrEntryIds)
          }
          else if (state.hmrState.lastEmittedEntryIds?.size) {
            refreshPartialSharedChunkImporters(rolldownBundle, state, state.hmrState.lastEmittedEntryIds)
          }
          state.hmrState.hasBuiltOnce = true
        }
        activeImportedChunkIds = prunePartialHmrStableSharedChunks(rolldownBundle, state)
        retainFullEntryHmrChunks(rolldownBundle, state)
        pruneUneventedDevHmrChunks(ctx, rolldownBundle)

        if (assetOnlyDevHmrBundle) {
          state.hmrState.affectedSharedChunkIds?.clear()
          normalizePreprocessorStyleAssets(
            rolldownBundle,
            state.ctx.configService.outputExtensions?.wxss,
            asset => this.emitFile(asset),
          )
          return
        }

        const matchSubPackage = createSubPackageMatcher(subPackageRoots)
        const resolveBundleChunk = createBundleChunkResolver(rolldownBundle)

        const resolveSharedChunkLabel = (sharedFileName: string, finalFileName: string) => {
          const prettifyModuleLabel = (label: string) => {
            const normalized = toPosixPath(label)
            const match = normalized.match(PRETTY_NODE_MODULES_RE)
            return match?.[1] || label
          }
          const chunk = resolveBundleChunk(sharedFileName) ?? resolveBundleChunk(finalFileName)
          if (!chunk) {
            return finalFileName
          }
          const seenModuleLabels = new Set<string>()
          const preview: string[] = []
          let moduleLabelCount = 0
          for (const id in chunk.modules ?? {}) {
            if (!id || id.startsWith('\0')) {
              continue
            }
            const label = configService.relativeAbsoluteSrcRoot(id)
            if (!label || seenModuleLabels.has(label)) {
              continue
            }
            seenModuleLabels.add(label)
            moduleLabelCount += 1
            if (preview.length < 3) {
              preview.push(prettifyModuleLabel(label))
            }
          }
          if (moduleLabelCount === 0) {
            return chunk.fileName || finalFileName
          }
          const suffix = moduleLabelCount > preview.length ? ` 等 ${moduleLabelCount} 个模块` : ''
          return `${preview.join('、')}${suffix}`
        }

        const runtimeLocalizationRoots = new Set<string>()
        const handleDuplicate = ({
          duplicates,
          ignoredMainImporters,
          chunkBytes,
          redundantBytes,
          retainedInMain,
          sharedFileName,
          requiresRuntimeLocalization,
        }: SharedChunkDuplicatePayload) => {
          if (shouldWarnOnDuplicate) {
            const duplicateCount = duplicates.length
            const computedRedundant = typeof redundantBytes === 'number'
              ? redundantBytes
              : typeof chunkBytes === 'number'
                ? chunkBytes * Math.max(duplicateCount - 1, 0)
                : 0
            redundantBytesTotal += computedRedundant
          }
          if (requiresRuntimeLocalization) {
            for (const { fileName } of duplicates) {
              const match = matchSubPackage(fileName)
              if (match) {
                runtimeLocalizationRoots.add(match)
              }
            }
          }
          if (!shouldLogChunks) {
            return
          }
          const subPackageSet = new Set<string>()
          let totalReferences = 0
          for (const { fileName, importers } of duplicates) {
            totalReferences += importers.length
            const match = matchSubPackage(fileName)
            if (match) {
              subPackageSet.add(match)
            }
          }
          const subPackageList = [...subPackageSet].join('、') || '相关分包'
          const ignoredHint = ignoredMainImporters?.length ? `，忽略主包引用：${ignoredMainImporters.join('、')}` : ''
          logger.info(`[分包] 分包 ${subPackageList} 共享模块已复制到各自 weapp-shared/common.js（${totalReferences} 处引用${ignoredHint}）`)
          if (retainedInMain) {
            logger.warn(`[分包] 模块 ${sharedFileName} 同时被主包引用，因此仍保留在主包 common.js，并复制到 ${subPackageList}，请确认是否需要将源代码移动到主包或公共目录。`)
          }
        }

        applySharedChunkStrategy.call(this, rolldownBundle, {
          strategy: sharedStrategy,
          subPackageRoots,
          onDuplicate: handleDuplicate,
          onFallback: shouldLogChunks
            ? ({ reason, importers, sharedFileName, finalFileName }) => {
                const involvedSubs = new Set<string>()
                let hasMainReference = false
                for (const importer of importers) {
                  const match = matchSubPackage(importer)
                  if (match) {
                    involvedSubs.add(match)
                  }
                  else {
                    hasMainReference = true
                  }
                }
                const segments: string[] = []
                if (involvedSubs.size) {
                  segments.push(`分包 ${[...involvedSubs].join('、')}`)
                }
                if (hasMainReference) {
                  segments.push('主包')
                }
                const scope = segments.join('、') || '主包'
                const sharedChunkLabel = resolveSharedChunkLabel(sharedFileName, finalFileName)
                if (reason === 'main-package') {
                  logger.info(`[分包] ${scope} 共享模块 ${sharedChunkLabel}（${importers.length} 处引用）已提升到主包 common.js`)
                }
                else {
                  logger.info(`[分包] 仅主包使用共享模块 ${sharedChunkLabel}（${importers.length} 处引用），保留在主包 common.js`)
                }
              }
            : undefined,
        })

        applyRuntimeChunkLocalization.call(this, rolldownBundle, {
          subPackageRoots,
          forceRoots: runtimeLocalizationRoots,
          onDuplicate: shouldLogChunks
            ? ({ duplicates, runtimeFileName }: RuntimeChunkDuplicatePayload) => {
                const subPackageSet = new Set<string>()
                for (const { fileName } of duplicates) {
                  const match = matchSubPackage(fileName)
                  if (match) {
                    subPackageSet.add(match)
                  }
                }
                const subPackageList = [...subPackageSet].join('、') || '相关分包'
                logger.info(`[分包] 分包 ${subPackageList} 已本地化 ${runtimeFileName} 依赖，避免跨包 runtime 引用。`)
              }
            : undefined,
        })

        if (shouldWarnOnDuplicate && redundantBytesTotal > duplicateWarningBytes) {
          logger.warn(`[分包] 分包复制共享模块产生冗余体积 ${formatBytes(redundantBytesTotal)}，已超过阈值 ${formatBytes(duplicateWarningBytes)}，建议调整分包划分或运行 weapp-vite analyze 定位问题。`)
        }
      }
      recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'generateSharedMs', performance.now() - sharedStartedAt)

      const preloadBundleSnapshot = createBundleChunkSnapshot(rolldownBundle)
      removeImplicitPagePreloads(rolldownBundle, {
        configService,
        entriesMap: state.entriesMap,
      }, preloadBundleSnapshot)

      const rewriteStartedAt = performance.now()
      const rewriteBundle = resolveDevHmrRewriteBundle(rolldownBundle, state, activeImportedChunkIds)
      const subPackageMap = scanService.subPackageMap ?? new Map<string, SubPackageMetaValue>()
      const localSubPackageMetas = [...subPackageMap.values()]
        .filter(meta => Array.isArray(meta?.subPackage?.dependencies) && meta.subPackage.dependencies.length > 0)
      const hasNpmBuildCandidateDependencies = npmBuildCandidateDependencies
        ? Object.keys(npmBuildCandidateDependencies).some(() => true)
        : false
      const hasLocalRootNpmRewriteTargets = localSubPackageMetas.length > 0
      const rewritesBundleNpmImports = shouldRewriteBundleNpmImports(configService.platform)
      const injectWeapiGlobalName = resolveInjectWeapiGlobalName(state)
      const needsScriptAnalysisWarmup = shouldWarmupBundleScriptAnalysis({
        rewritesBundleNpmImports,
        hasNpmBuildCandidateDependencies,
        hasLocalRootNpmRewriteTargets,
        hasPlatformApiRewrite: Boolean(injectWeapiGlobalName),
      })
      if (needsScriptAnalysisWarmup) {
        warmupBundleScriptAnalysis(rewriteBundle, {
          astEngine,
          cache: scriptAnalysisCache,
        })
      }
      if (rewritesBundleNpmImports) {
        rewriteBundleNpmImportsByPlatform(
          configService.platform,
          rewriteBundle,
          npmBuildCandidateDependencies,
          configService.weappViteConfig?.npm?.alipayNpmMode,
          { astEngine, analysisCache: scriptAnalysisCache },
        )
      }
      else if (hasNpmBuildCandidateDependencies || hasLocalRootNpmRewriteTargets) {
        rewriteBundleNpmImportsToLocalRoots(
          rewriteBundle,
          npmBuildCandidateDependencies,
          localSubPackageMetas.map(meta => ({
            root: meta.subPackage.root,
            dependencies: meta.subPackage.dependencies,
          })),
          {
            analysisCache: scriptAnalysisCache,
            astEngine,
            basedir: configService.cwd,
          },
        )
      }

      if (injectWeapiGlobalName) {
        rewriteBundlePlatformApi(rewriteBundle, injectWeapiGlobalName, {
          analysisCache: scriptAnalysisCache,
          astEngine,
        })
      }
      rewriteBundleDynamicGlobalResolution(rewriteBundle)

      const installerChunks = injectRequestGlobalsOptions?.targets?.length
        ? injectRequestGlobalsBundleRuntime(
            rolldownBundle,
            injectRequestGlobalsOptions.targets,
            injectRequestGlobalsOptions.mode,
            injectRequestGlobalsOptions.networkDefaults,
          )
        : new Map<string, string>()
      if (injectRequestGlobalsOptions?.targets?.length) {
        injectRequestGlobalsPassiveBindings(rolldownBundle, installerChunks, injectRequestGlobalsOptions.targets, injectRequestGlobalsOptions.mode, state.entriesMap)
        injectRequestGlobalsLocalBindings(
          rolldownBundle,
          installerChunks,
          injectRequestGlobalsOptions.targets,
          injectRequestGlobalsOptions.mode,
          state.entriesMap,
          injectRequestGlobalsOptions.networkDefaults,
        )
        injectAxiosFetchAdapterEnv(rolldownBundle)
        injectRequestGlobalsAppRegistration(rolldownBundle, installerChunks)
        collapseRequestGlobalsRuntimeSupportChunk(rolldownBundle)
      }

      const appPreludePath = scanService.appEntry?.preludePath
      const shouldInjectRequestGlobalsPrelude = injectRequestGlobalsOptions?.prelude === true
      const appPreludeOptions = resolveAppPreludeOptions(state)
      const shouldRunAppPrelude = (appPreludeOptions.enabled && Boolean(appPreludePath))
        || shouldInjectRequestGlobalsPrelude
      const preservedRequestGlobalsInstallerChunks = shouldRunAppPrelude
        ? injectAppPreludeCode(
            rolldownBundle,
            await resolveAppPreludeCode(appPreludePath, {
              importMetaDefineRegistry: configService.importMetaDefineRegistry,
              relativePath: appPreludePath
                ? configService.relativeAbsoluteSrcRoot(appPreludePath)
                : undefined,
            }),
            {
              ...appPreludeOptions,
              enabled: appPreludeOptions.enabled || shouldInjectRequestGlobalsPrelude,
            },
            state,
            {
              enabled: shouldInjectRequestGlobalsPrelude,
              installerChunks,
              mode: injectRequestGlobalsOptions?.mode ?? 'explicit',
              networkDefaults: injectRequestGlobalsOptions?.networkDefaults,
              targets: injectRequestGlobalsOptions?.targets ?? [],
            },
            asset => this.emitFile(asset),
          )
        : new Set<string>()
      if (injectRequestGlobalsOptions?.targets?.length) {
        inlineRequestGlobalsAppRegisteredInstallerChunks(rolldownBundle, installerChunks, preservedRequestGlobalsInstallerChunks)
      }

      const runtimeRewriteBundle = resolveDevHmrRewriteBundle(rolldownBundle, state, activeImportedChunkIds)
      const finalBundleSnapshot = createDevHmrRuntimeRewriteSnapshot(rolldownBundle, runtimeRewriteBundle)
      rewriteWevuInternalRuntimeImports(runtimeRewriteBundle, {
        runtimeFileName: state.ctx.runtimeState?.build?.output?.wevuInternalRuntimeFileName,
        runtimeFileNames: state.ctx.runtimeState?.build?.output?.wevuInternalRuntimeFileNames,
        onRuntimeFileName(fileName) {
          const outputState = state.ctx.runtimeState?.build?.output
          if (outputState) {
            outputState.wevuInternalRuntimeFileName = fileName
          }
        },
        onRuntimeModuleFileName(moduleId, fileName) {
          const outputState = state.ctx.runtimeState?.build?.output
          if (outputState) {
            outputState.wevuInternalRuntimeFileNames ??= new Map<string, string>()
            outputState.wevuInternalRuntimeFileNames.set(moduleId, fileName)
          }
        },
      }, finalBundleSnapshot)
      stabilizeWevuRuntimeChunkAccess(runtimeRewriteBundle, finalBundleSnapshot)
      syncChunkImportsFromRequireCalls(runtimeRewriteBundle, finalBundleSnapshot)
      normalizePreprocessorStyleAssets(
        rolldownBundle,
        state.ctx.configService.outputExtensions?.wxss,
        asset => this.emitFile(asset),
      )
      recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'generateRewriteMs', performance.now() - rewriteStartedAt)
      state.hmrState.affectedSharedChunkIds?.clear()

      if (configService.weappViteConfig?.debug?.watchFiles) {
        const watcherService = ctx.watcherService
        const watcherRoot = subPackageMeta?.subPackage.root ?? '/'
        const watcher = watcherService?.getRollupWatcher(watcherRoot)
        let watchFiles: string[] | undefined
        if (watcher && typeof (watcher as any).getWatchFiles === 'function') {
          watchFiles = await (watcher as any).getWatchFiles()
        }
        else if (state.watchFilesSnapshot.length) {
          watchFiles = state.watchFilesSnapshot
        }
        if (watchFiles && watchFiles.length) {
          configService.weappViteConfig.debug.watchFiles(watchFiles, subPackageMeta)
        }
        state.watchFilesSnapshot = []
      }
    }
    finally {
      recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'generateBundleMs', performance.now() - startedAt)
      if (!subPackageMeta) {
        ctx.moduleGraphService?.clearPendingChanges()
      }
    }
  }
}
