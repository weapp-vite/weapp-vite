import type { ChangeEvent, SubPackageMetaValue } from '../../../types'
import type { CorePluginState } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import logger from '../../../logger'
import { resolveMultiPlatformProjectConfigDir } from '../../../multiPlatform'
import { DEFAULT_MP_PLATFORM } from '../../../platform'
import { isAutoRoutesGeneratedPath, resolveAutoRoutesManagedOutputPaths } from '../../../runtime/autoRoutesPlugin/generatedPaths'
import { isAutoRoutesPagesRelatedPath, resolveAutoRoutesMatcherContext } from '../../../runtime/autoRoutesPlugin/shared'
import { resolveTouchAppWxssEnabled } from '../../../runtime/buildPlugin/touchAppWxss'
import { resetTakeImportRegistry } from '../../../runtime/chunkStrategy'
import { getProjectConfigFileName, getProjectPrivateConfigFileName } from '../../../utils'
import { findCssEntry, findJsEntry, findVueEntry } from '../../../utils/file'
import { createHmrProfileEventId, recordHmrProfileDuration } from '../../../utils/hmrProfile'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { invalidateSharedStyleCache } from '../../css/shared/preprocessor'
import { invalidateFileCache } from '../../utils/cache'
import { ensureSidecarWatcher, invalidateEntryForSidecar } from '../../utils/invalidateEntry'
import { extractCssImportDependencies } from '../../utils/invalidateEntry/cssGraph'
import { configSuffixes, watchedCssExts, watchedScriptModuleSuffixes, watchedTemplateExts } from '../../utils/invalidateEntry/shared'
import { isLayoutSourcePath } from '../../utils/layoutSourcePath'
import { addNormalizedWatchFiles } from '../../utils/watchFiles'
import { isAppVueFile } from '../../vue/transform/appShell'
import { collectAffectedSharedChunkEntriesAndChunks } from '../helpers'
import { markAppEntryForAutoRoutesTopology as markAppEntryForAutoRoutesTopologyDirty } from './autoRoutesTopology'
import { createVueEntryUpdateInspector } from './vueEntryUpdate'

const ATOMIC_SAVE_RECHECK_DELAYS_MS = [20, 60]
const tailwindContentExtensions = new Set(['.vue', '.wxml', '.js', '.jsx', '.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs'])
const TAILWIND_APP_STYLE_RE = /@import\s+['"]tailwindcss['"]|@source\b|weapp-tailwindcss|tailwindcss\/vite/

interface WatchPathKind {
  configSuffix?: string
  extension: string
  isHtmlTemplate: boolean
  isScriptModuleSidecar: boolean
  isStyle: boolean
  isTemplate: boolean
}

function resolveWatchPathKind(normalizedId: string): WatchPathKind {
  const extension = path.extname(normalizedId)
  let configSuffix: string | undefined
  let isScriptModuleSidecar = false

  for (const suffix of configSuffixes) {
    if (normalizedId.endsWith(suffix)) {
      configSuffix = suffix
      break
    }
  }

  for (const suffix of watchedScriptModuleSuffixes) {
    if (normalizedId.endsWith(suffix)) {
      isScriptModuleSidecar = true
      break
    }
  }

  return {
    configSuffix,
    extension,
    isHtmlTemplate: normalizedId.endsWith('.html'),
    isScriptModuleSidecar,
    isStyle: watchedCssExts.has(extension),
    isTemplate: watchedTemplateExts.has(extension),
  }
}

function isOutputFileChange(state: CorePluginState, normalizedId: string) {
  const outDir = state.ctx.configService?.outDir
  if (!outDir) {
    return false
  }
  const normalizedOutDir = normalizeFsResolvedId(outDir)
  return normalizedId === normalizedOutDir || normalizedId.startsWith(`${normalizedOutDir}/`)
}

function isAutoRoutesGeneratedFileChange(state: CorePluginState, normalizedId: string) {
  const configService = state.ctx.configService
  if (!configService) {
    return false
  }

  return isAutoRoutesGeneratedPath(normalizedId, {
    cwd: configService.cwd,
    absoluteSrcRoot: configService.absoluteSrcRoot,
    managedOutputPaths: resolveAutoRoutesManagedOutputPaths(state.ctx),
  })
}

function isAutoRoutesPagesRelatedChange(state: CorePluginState, normalizedId: string) {
  const configService = state.ctx.configService
  if (!configService) {
    return false
  }

  const { autoRoutesConfig, subPackageRoots } = resolveAutoRoutesMatcherContext(state.ctx)
  return isAutoRoutesPagesRelatedPath(normalizedId, {
    cwd: configService.cwd,
    absoluteSrcRoot: configService.absoluteSrcRoot,
    include: autoRoutesConfig.include,
    managedOutputPaths: resolveAutoRoutesManagedOutputPaths(state.ctx),
    subPackageRoots,
  })
}

function isConfigFileDependencyChange(state: CorePluginState, normalizedId: string) {
  return state.ctx.configService.configFileDependencies
    .some(dependency => normalizeFsResolvedId(dependency) === normalizedId)
}

function shouldRefreshAppStyleForTailwindContent(state: CorePluginState) {
  const configService = state.ctx.configService
  return resolveTouchAppWxssEnabled({
    option: configService.weappViteConfig?.hmr?.touchAppWxss,
    platform: configService.platform,
    packageJson: configService.packageJson ?? {},
    cwd: configService.cwd,
  })
}

async function isTailwindAppStyleSource(stylePath: string) {
  try {
    const source = await fs.readFile(stylePath, 'utf8')
    return TAILWIND_APP_STYLE_RE.test(source)
  }
  catch {
    return false
  }
}

function collectEmittedJsonPaths(state: CorePluginState) {
  const emittedJsonPaths = new Set<string>()
  for (const record of state.jsonEmitFilesMap.values()) {
    const jsonPath = record.entry.jsonPath
    if (jsonPath) {
      emittedJsonPaths.add(normalizeFsResolvedId(jsonPath))
    }
  }
  return emittedJsonPaths
}

function isCurrentSubPackageFile(relativeSrc: string, subPackageMeta: SubPackageMetaValue | null | undefined) {
  const root = subPackageMeta?.subPackage.root
  return !root || relativeSrc === root || relativeSrc.startsWith(`${root}/`)
}

async function normalizeWatchEvent(
  id: string,
  event: ChangeEvent,
  options: {
    emittedJsonPaths?: Set<string>
    loadedEntrySet: Set<string>
    hasModule?: (id: string) => boolean
    resolvedEntryMap: Map<string, unknown>
    sharedChunkSourceModuleIds?: Set<string>
  },
) {
  if (event === 'create' && (options.loadedEntrySet.has(id) || options.resolvedEntryMap.has(id)) && await fs.pathExists(id)) {
    return 'update' satisfies ChangeEvent
  }

  if (
    event === 'create'
    && (
      options.hasModule?.(id)
      || options.sharedChunkSourceModuleIds?.has(id)
    )
    && await fs.pathExists(id)
  ) {
    return 'update' satisfies ChangeEvent
  }

  if (event === 'create' && await fs.pathExists(id)) {
    const ext = path.extname(id)
    if (ext) {
      const basePath = id.slice(0, -ext.length)
      const primaryScript = await findJsEntry(basePath)
      const primaryScriptId = primaryScript.path ? normalizeFsResolvedId(primaryScript.path) : ''
      if (primaryScriptId && options.resolvedEntryMap.has(primaryScriptId)) {
        return 'update' satisfies ChangeEvent
      }
    }

    if (options.emittedJsonPaths?.has(id)) {
      return 'update' satisfies ChangeEvent
    }
  }

  if (event !== 'delete') {
    return event
  }

  for (const delayMs of ATOMIC_SAVE_RECHECK_DELAYS_MS) {
    if (await fs.pathExists(id)) {
      return 'update' satisfies ChangeEvent
    }
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  return await fs.pathExists(id) ? 'update' : event
}

export function createBuildStartHook(state: CorePluginState) {
  const { ctx, subPackageMeta, emitDirtyEntries, buildTarget } = state
  const { configService } = ctx
  const isPluginBuild = buildTarget === 'plugin'

  return async function buildStart(this: any) {
    const startedAt = performance.now()
    try {
      ctx.moduleGraphService?.bindBuildContext(state, this)
      ctx.moduleGraphService?.bindPluginContext(this)
      resetTakeImportRegistry({ preserveSharedChunkNameCache: configService.isDev })
      if (configService.isDev) {
        let sharedChunkAffectedEntryCount = 0
        for (const change of ctx.moduleGraphService?.getPendingChanges?.() ?? []) {
          const sharedChunkAffected = collectAffectedSharedChunkEntriesAndChunks(state, change.file)
          state.hmrState.affectedSharedChunkIds ??= new Set<string>()
          for (const chunkId of sharedChunkAffected.affectedChunks) {
            state.hmrState.affectedSharedChunkIds.add(chunkId)
          }
          for (const entryId of sharedChunkAffected.affectedEntries) {
            state.markEntryDirty(entryId, 'dependency')
            sharedChunkAffectedEntryCount += 1
          }
        }
        if (sharedChunkAffectedEntryCount) {
          const profile = ctx.runtimeState.build.hmr.profile
          profile.dirtyReasonSummary = [
            ...(profile.dirtyReasonSummary ?? []).filter(reason => !reason.startsWith('shared-chunk-source:')),
            `shared-chunk-source:${sharedChunkAffectedEntryCount}`,
          ]
        }
        addNormalizedWatchFiles(this, configService.configFileDependencies)
        if (isPluginBuild) {
          if (configService.absolutePluginRoot) {
            ensureSidecarWatcher(ctx, configService.absolutePluginRoot)
          }
        }
        else {
          const rootDir = subPackageMeta
            ? path.resolve(configService.absoluteSrcRoot, subPackageMeta.subPackage.root)
            : configService.absoluteSrcRoot
          ensureSidecarWatcher(ctx, rootDir)
          if (!subPackageMeta && configService.absolutePluginRoot) {
            ensureSidecarWatcher(ctx, configService.absolutePluginRoot)
          }
        }
      }
      await emitDirtyEntries.call(this)
    }
    finally {
      recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'buildStartMs', performance.now() - startedAt)
    }
  }
}

function isAppEntryAutoRoutesSignatureStale(state: CorePluginState, normalizedId: string) {
  if (!isAppVueFile(normalizedId)) {
    return false
  }

  const currentSignature = state.ctx.autoRoutesService?.getSignature?.()
  const previousSignature = state.ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature
  if (typeof currentSignature !== 'string') {
    return false
  }

  return previousSignature !== currentSignature
}

async function processChangedFile(
  state: CorePluginState,
  id: string,
  event: ChangeEvent,
) {
  const { ctx, subPackageMeta, loadEntry, loadedEntrySet, resolvedEntryMap } = state
  const { scanService, configService, buildService } = ctx
  const normalizedId = normalizeFsResolvedId(id)
  if (isSkippableResolvedId(normalizedId)) {
    return
  }
  const sidecarDirtyFiles = ctx.runtimeState.watcher?.sidecarDirtyFiles
  const sidecarDirtyCause = sidecarDirtyFiles?.get(normalizedId)
  sidecarDirtyFiles?.delete(normalizedId)
  const importerGraphAffectedEntryIds = ctx.moduleGraphService.invalidate(normalizedId)
  const relativeSrc = configService.relativeAbsoluteSrcRoot(normalizedId)
  const affectedLayoutEntryIds = new Set<string>()
  const dirtyReasonStats = new Map<string, number>()
  const markEntryDirtyWithCause = (
    entryId: string,
    reason: 'direct' | 'dependency' | 'metadata',
    cause: string,
  ) => {
    state.markEntryDirty(entryId, reason)
    if (entryId.endsWith('.vue') && reason !== 'dependency') {
      const hmr = ctx.runtimeState.build.hmr
      hmr.dirtyVueEntryIds ??= new Set<string>()
      hmr.dirtyVueEntryIds.add(entryId)
    }
    dirtyReasonStats.set(cause, (dirtyReasonStats.get(cause) ?? 0) + 1)
  }
  const declaredEntryType = state.entriesMap.get(removeExtensionDeep(relativeSrc))?.type
  const isDeletedMissingSelf = event === 'delete' && !await fs.pathExists(normalizedId)
  const isAutoRouteFile = Boolean(ctx.autoRoutesService?.isRouteFile(normalizedId))
  const pathKind = resolveWatchPathKind(normalizedId)
  const isScriptModuleSidecar = pathKind.isScriptModuleSidecar
  const concreteChangedEntryId = isAppVueFile(normalizedId) && scanService.appEntry?.path
    ? normalizeFsResolvedId(scanService.appEntry.path)
    : normalizedId
  const vueEntryUpdateInspector = normalizedId.endsWith('.vue')
    ? createVueEntryUpdateInspector(state, normalizedId)
    : undefined
  let isAppShellTopologyChanged = false
  let handledSidecarMetadataUpdate = false

  const markScriptDirty = (scriptId: string, cause: string) => {
    const normalizedScriptId = normalizeFsResolvedId(scriptId)
    const reason = isLayoutSourcePath(configService.relativeAbsoluteSrcRoot(normalizedScriptId))
      ? 'dependency'
      : 'direct'
    if (reason === 'dependency') {
      affectedLayoutEntryIds.add(normalizedScriptId)
    }
    else {
      const entryReason = cause === 'sidecar-direct' || cause === 'json-sidecar' || cause === 'style-sidecar'
        ? 'metadata'
        : reason
      markEntryDirtyWithCause(normalizedScriptId, entryReason, cause)
    }
  }
  const markChangedEntryDirty = (
    reason: 'direct' | 'metadata',
    cause: string,
  ) => {
    if (isAppVueFile(normalizedId)) {
      if (concreteChangedEntryId !== normalizedId) {
        markEntryDirtyWithCause(concreteChangedEntryId, reason, cause)
        return
      }
    }
    markEntryDirtyWithCause(normalizedId, reason, cause)
  }
  const markAppEntryForJsonEmit = () => {
    const appEntryId = scanService.appEntry?.path
      ? normalizeFsResolvedId(scanService.appEntry.path)
      : undefined
    if (!appEntryId || !resolvedEntryMap.has(appEntryId)) {
      return false
    }

    for (const jsonEmitRecord of state.jsonEmitFilesMap.values()) {
      if (jsonEmitRecord.entry.jsonPath && normalizeFsResolvedId(jsonEmitRecord.entry.jsonPath) === normalizedId) {
        markEntryDirtyWithCause(appEntryId, 'metadata', 'json-sidecar')
        return true
      }
    }

    return false
  }
  const markAppEntryForAutoRoutesTopology = () => {
    return markAppEntryForAutoRoutesTopologyDirty(ctx, {
      loadEntry,
      resolvedEntryMap: resolvedEntryMap as Map<string, unknown>,
      markEntryDirty: entryId => markEntryDirtyWithCause(entryId, 'direct', 'auto-routes-topology'),
    })
  }
  const markAppEntryForTailwindContent = async () => {
    if (event !== 'update' || pathKind.isStyle || pathKind.configSuffix || !tailwindContentExtensions.has(pathKind.extension)) {
      return false
    }
    if (vueEntryUpdateInspector && !await vueEntryUpdateInspector.isTailwindContentUpdate()) {
      return false
    }
    if (!shouldRefreshAppStyleForTailwindContent(state)) {
      return false
    }
    const appEntryId = scanService.appEntry?.path
      ? normalizeFsResolvedId(scanService.appEntry.path)
      : undefined
    if (!appEntryId || appEntryId === normalizedId || !resolvedEntryMap.has(appEntryId)) {
      return false
    }
    const styleEntry = await findCssEntry(appEntryId)
    if (!styleEntry.path) {
      return false
    }
    if (!await isTailwindAppStyleSource(styleEntry.path)) {
      return false
    }
    if (
      concreteChangedEntryId !== appEntryId
      && (loadedEntrySet.has(concreteChangedEntryId) || resolvedEntryMap.has(concreteChangedEntryId))
    ) {
      markEntryDirtyWithCause(concreteChangedEntryId, 'direct', 'tailwind-content')
    }
    markEntryDirtyWithCause(appEntryId, 'metadata', 'tailwind-content')
    invalidateSharedStyleCache()
    return true
  }

  if (isDeletedMissingSelf) {
    ctx.runtimeState.build.hmr.vueEntryHasTemplate.delete(normalizedId)
    ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.delete(normalizedId)
    ctx.runtimeState.build.hmr.vueEntryScriptSignatures.delete(normalizedId)
    ctx.runtimeState.build.hmr.vueEntryStyleIndependentSignatures.delete(normalizedId)
    ctx.runtimeState.build.hmr.vueEntryTailwindContentSignatures?.delete(normalizedId)
    ctx.runtimeState.build.hmr.vueEntryTailwindTemplateContentSignatures?.delete(normalizedId)
    ctx.runtimeState.build.hmr.vueEntryTailwindScriptContentSignatures?.delete(normalizedId)
  }

  if ((event === 'create' || isDeletedMissingSelf) && isAutoRouteFile) {
    const didChangeRoutes = await ctx.autoRoutesService?.handleFileChange(normalizedId, event)
    if (didChangeRoutes) {
      markAppEntryForAutoRoutesTopology()
    }
  }
  else if (
    (event === 'create' || isDeletedMissingSelf)
    && isAutoRoutesPagesRelatedChange(state, normalizedId)
  ) {
    const didChangeRoutes = await ctx.autoRoutesService?.handleFileChange(normalizedId, event === 'create' ? 'create' : 'delete')
    const currentSignature = ctx.autoRoutesService?.getSignature?.()
    const appEntrySignature = ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature
    if (didChangeRoutes || (
      typeof currentSignature === 'string'
      && typeof appEntrySignature === 'string'
      && currentSignature !== appEntrySignature
    )) {
      markAppEntryForAutoRoutesTopology()
    }
  }

  if (
    event === 'update'
    && isAppVueFile(normalizedId)
    && resolvedEntryMap.size
  ) {
    const isJsonOnlyVueEntryUpdate = await vueEntryUpdateInspector!.isJsonOnlyUpdate()
    const isAutoRoutesStaleAppEntry = isJsonOnlyVueEntryUpdate && isAppEntryAutoRoutesSignatureStale(state, normalizedId)
    isAppShellTopologyChanged = !isJsonOnlyVueEntryUpdate && await vueEntryUpdateInspector!.isAppShellTopologyUpdate()
    const isLocalAssetOnlyVueEntryUpdate = !isJsonOnlyVueEntryUpdate
      && !isAppShellTopologyChanged
      && await vueEntryUpdateInspector!.isLocalAssetOnlyUpdate()
    if (isAutoRoutesStaleAppEntry) {
      ;(loadEntry as any)?.invalidateResolveCache?.()
    }
    else if (!isJsonOnlyVueEntryUpdate && !isLocalAssetOnlyVueEntryUpdate) {
      ;(loadEntry as any)?.invalidateResolveCache?.()
      for (const entryId of resolvedEntryMap.keys()) {
        if (entryId === normalizedId || entryId === concreteChangedEntryId) {
          continue
        }
        markEntryDirtyWithCause(entryId, 'dependency', 'app-shell-dependent')
      }
    }
  }

  invalidateFileCache(normalizedId)
  const isSidecarPath = Boolean(
    pathKind.isStyle
    || pathKind.isTemplate
    || pathKind.isHtmlTemplate
    || pathKind.configSuffix
    || isScriptModuleSidecar,
  )
  const isSidecarCreate = event === 'create' && isSidecarPath
  const shouldHandleUpdateLikeSidecar = event === 'update' || isSidecarCreate || (isDeletedMissingSelf && isSidecarPath)
  if (shouldHandleUpdateLikeSidecar) {
    if (pathKind.isStyle && !isDeletedMissingSelf) {
      await extractCssImportDependencies(ctx, normalizedId)
    }

    if (pathKind.isTemplate && !isDeletedMissingSelf) {
      const wxmlService = ctx.wxmlService
      if (wxmlService) {
        await wxmlService.scan(normalizedId)
      }
    }

    if (isSidecarPath && importerGraphAffectedEntryIds.size) {
      const cause = pathKind.configSuffix
        ? 'json-sidecar'
        : pathKind.isStyle
          ? 'style-sidecar'
          : 'sidecar-direct'
      const isLayoutChange = isLayoutSourcePath(relativeSrc)
        || Array.from(importerGraphAffectedEntryIds).some(entryId =>
          isLayoutSourcePath(configService.relativeAbsoluteSrcRoot(entryId)),
        )
      for (const entryId of importerGraphAffectedEntryIds) {
        markEntryDirtyWithCause(
          entryId,
          isLayoutChange ? 'dependency' : 'metadata',
          isLayoutChange
            ? isLayoutSourcePath(configService.relativeAbsoluteSrcRoot(entryId)) ? 'layout-self' : 'layout-dependent'
            : cause,
        )
      }
      handledSidecarMetadataUpdate = true
    }
    else if (isSidecarPath && event === 'update') {
      // Rolldown build-watch 在 watchChange 阶段不暴露上一轮 module graph；
      // 当前 physical id 会在 buildEnd 的有效 graph 生命周期中完成入口追溯。
      handledSidecarMetadataUpdate = true
    }
    else if (isSidecarPath && (event === 'create' || isDeletedMissingSelf)) {
      const basePath = pathKind.configSuffix
        ? normalizedId.slice(0, -pathKind.configSuffix.length)
        : pathKind.extension ? normalizedId.slice(0, -pathKind.extension.length) : normalizedId
      const primaryScript = await findJsEntry(basePath)
      const primaryEntry = primaryScript.path ?? (pathKind.isStyle ? await findVueEntry(basePath) : undefined)
      if (primaryEntry) {
        markScriptDirty(primaryEntry, pathKind.configSuffix ? 'json-sidecar' : pathKind.isStyle ? 'style-sidecar' : 'sidecar-direct')
        handledSidecarMetadataUpdate = true
      }
      else if (pathKind.configSuffix && markAppEntryForJsonEmit()) {
        handledSidecarMetadataUpdate = true
      }
      else {
        ctx.moduleGraphService.requestTopologyRescan(
          event === 'create' ? 'sidecar-create' : 'sidecar-delete',
          normalizedId,
        )
        const topologyRescan = ctx.moduleGraphService.consumeTopologyRescan()
        if (topologyRescan) {
          scanService.markDirty()
          ;(loadEntry as any)?.invalidateResolveCache?.()
          for (const entryId of resolvedEntryMap.keys()) {
            if (isCurrentSubPackageFile(configService.relativeAbsoluteSrcRoot(entryId), subPackageMeta)) {
              markEntryDirtyWithCause(entryId, 'dependency', 'topology-full-rescan')
            }
          }
          handledSidecarMetadataUpdate = true
        }
      }
    }
  }

  if (
    event === 'update'
    && isLayoutSourcePath(relativeSrc)
    && (loadedEntrySet.has(normalizedId) || resolvedEntryMap.has(normalizedId))
  ) {
    affectedLayoutEntryIds.add(normalizedId)
  }

  if (event === 'update' && affectedLayoutEntryIds.size) {
    if (!resolvedEntryMap.size) {
      for (const entryId of affectedLayoutEntryIds) {
        markEntryDirtyWithCause(entryId, 'dependency', 'layout-self')
      }
      return [...dirtyReasonStats.entries()].map(([cause, count]) => `${cause}:${count}`)
    }

    for (const entryId of importerGraphAffectedEntryIds) {
      markEntryDirtyWithCause(
        entryId,
        'dependency',
        affectedLayoutEntryIds.has(entryId) ? 'layout-self' : 'layout-dependent',
      )
    }
    return [...dirtyReasonStats.entries()].map(([cause, count]) => `${cause}:${count}`)
  }

  if (
    !isDeletedMissingSelf
    && isCurrentSubPackageFile(relativeSrc, subPackageMeta)
    && !handledSidecarMetadataUpdate
    && (
      loadedEntrySet.has(normalizedId)
      || loadedEntrySet.has(concreteChangedEntryId)
      || resolvedEntryMap.has(normalizedId)
      || resolvedEntryMap.has(concreteChangedEntryId)
      || declaredEntryType === 'page'
      || declaredEntryType === 'component'
    )
  ) {
    const isJsonOnlyVueEntryUpdate = event === 'update' && vueEntryUpdateInspector
      ? await vueEntryUpdateInspector.isJsonOnlyUpdate()
      : false
    const isAutoRoutesStaleAppEntry = isJsonOnlyVueEntryUpdate && isAppEntryAutoRoutesSignatureStale(state, normalizedId)
    const isLocalAssetOnlyVueEntryUpdate = !isJsonOnlyVueEntryUpdate
      && !isAppShellTopologyChanged
      && event === 'update'
      && (vueEntryUpdateInspector ? await vueEntryUpdateInspector.isLocalAssetOnlyUpdate() : false)
    const isStyleOnlyVueEntryUpdate = isLocalAssetOnlyVueEntryUpdate
      && (vueEntryUpdateInspector ? await vueEntryUpdateInspector.isStyleOnlyUpdate() : false)
    const directDirtyReason = sidecarDirtyCause
      ? 'metadata'
      : (isJsonOnlyVueEntryUpdate && !isAutoRoutesStaleAppEntry) || isLocalAssetOnlyVueEntryUpdate ? 'metadata' : 'direct'
    const directDirtyCause = sidecarDirtyCause
      ?? (isJsonOnlyVueEntryUpdate
        ? isAutoRoutesStaleAppEntry ? 'entry-auto-routes' : 'entry-json-only'
        : isAppShellTopologyChanged
          ? 'entry-direct'
          : isLocalAssetOnlyVueEntryUpdate
            ? isStyleOnlyVueEntryUpdate ? 'entry-style-only' : 'entry-local-asset'
            : 'entry-direct')
    markChangedEntryDirty(
      directDirtyReason,
      directDirtyCause,
    )
  }
  else if (!handledSidecarMetadataUpdate && importerGraphAffectedEntryIds.size) {
    for (const entryId of importerGraphAffectedEntryIds) {
      markEntryDirtyWithCause(entryId, 'dependency', 'importer-graph')
    }
  }
  await markAppEntryForTailwindContent()
  const relativeCwd = configService.relativeCwd(normalizedId)
  let handledByIndependentWatcher = false
  let independentMeta: SubPackageMetaValue | undefined
  const isConfigDependency = isConfigFileDependencyChange(state, normalizedId)

  if (isConfigDependency) {
    ;(loadEntry as any)?.invalidateResolveCache?.()
    scanService.markDirty()
    buildService.requestConfigRestart?.(state.buildTarget)
    for (const entryId of resolvedEntryMap.keys()) {
      markEntryDirtyWithCause(entryId, 'direct', 'config-restart')
    }
  }

  if (event === 'create' || event === 'delete') {
    ;(loadEntry as any)?.invalidateResolveCache?.()
    await invalidateEntryForSidecar(ctx, normalizedId, event)
  }

  if (!subPackageMeta && !configService.weappLibConfig?.enabled) {
    const isMultiPlatformEnabled = configService.multiPlatform.enabled
    const platform = configService.platform ?? DEFAULT_MP_PLATFORM
    const projectConfigFileName = getProjectConfigFileName(platform)
    const projectPrivateConfigFileName = getProjectPrivateConfigFileName(platform)
    let shouldMarkProjectConfigDirty = relativeCwd === projectConfigFileName || relativeCwd === projectPrivateConfigFileName
    if (isMultiPlatformEnabled) {
      const platformConfigDir = resolveMultiPlatformProjectConfigDir(configService.multiPlatform, platform)
      const platformConfigPrefix = `${platformConfigDir}/`
      shouldMarkProjectConfigDirty = relativeCwd.startsWith(platformConfigPrefix)
    }

    if (!isConfigDependency && (relativeSrc === 'app.json' || shouldMarkProjectConfigDirty)) {
      scanService.markDirty()
    }

    let independentRoot: string | undefined
    for (const root of scanService.independentSubPackageMap.keys()) {
      if (relativeSrc.startsWith(`${root}/`)) {
        independentRoot = root
        break
      }
    }

    if (independentRoot) {
      independentMeta = scanService.independentSubPackageMap.get(independentRoot)
      buildService.invalidateIndependentOutput(independentRoot)
      scanService.markIndependentDirty(independentRoot)
      handledByIndependentWatcher = true
      if (independentMeta?.watchSharedStyles !== false) {
        invalidateSharedStyleCache()
      }
    }
  }

  if (subPackageMeta && dirtyReasonStats.size > 0) {
    if (subPackageMeta.watchSharedStyles !== false) {
      invalidateSharedStyleCache()
    }
    logger.success(`[${event}] ${configService.relativeCwd(normalizedId)} --[独立分包 ${subPackageMeta.subPackage.root}]`)
  }
  else if (!subPackageMeta && !handledByIndependentWatcher) {
    logger.success(`[${event}] ${configService.relativeCwd(normalizedId)}`)
  }

  return [...dirtyReasonStats.entries()].map(([cause, count]) => `${cause}:${count}`)
}

export function createWatchChangeHook(state: CorePluginState) {
  return async function watchChange(id: string, change: { event: ChangeEvent }) {
    const startedAt = performance.now()
    const eventId = createHmrProfileEventId()
    const normalizedId = normalizeFsResolvedId(id)
    state.ctx.moduleGraphService?.bindPluginContext(this)
    state.ctx.moduleGraphService?.recordChangedFile?.(normalizedId, change.event)
    if (isSkippableResolvedId(normalizedId)) {
      return
    }
    if (isOutputFileChange(state, normalizedId)) {
      return
    }
    if (isAutoRoutesGeneratedFileChange(state, normalizedId)) {
      return
    }
    const emittedJsonPaths = change.event === 'create'
      ? collectEmittedJsonPaths(state)
      : undefined
    const event = await normalizeWatchEvent(normalizedId, change.event, {
      emittedJsonPaths,
      loadedEntrySet: state.loadedEntrySet,
      hasModule: changedId => state.ctx.moduleGraphService.hasModule(changedId),
      resolvedEntryMap: state.resolvedEntryMap,
      sharedChunkSourceModuleIds: state.ctx.runtimeState.build.hmr.sharedChunkSourceModuleIds,
    })
    state.ctx.runtimeState.build.hmr.profile = {
      ...state.ctx.runtimeState.build.hmr.profile,
      eventId,
      event,
      file: normalizedId,
    }
    const dirtyReasonSummary = await processChangedFile(state, normalizedId, event)
    state.ctx.runtimeState.build.hmr.profile = {
      ...state.ctx.runtimeState.build.hmr.profile,
      eventId,
      event,
      file: normalizedId,
      watchToDirtyMs: performance.now() - startedAt,
      dirtyReasonSummary,
    }
  }
}
