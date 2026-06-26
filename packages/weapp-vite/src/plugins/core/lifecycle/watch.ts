import type { ChangeEvent, SubPackageMetaValue } from '../../../types'
import type { CorePluginState } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { configExtensions, supportedCssLangs } from '../../../constants'
import logger from '../../../logger'
import { resolveMultiPlatformProjectConfigDir } from '../../../multiPlatform'
import { DEFAULT_MP_PLATFORM } from '../../../platform'
import { isAutoRoutesGeneratedPath, resolveAutoRoutesManagedOutputPaths } from '../../../runtime/autoRoutesPlugin/generatedPaths'
import { isAutoRoutesPagesRelatedPath, resolveAutoRoutesAliasTargets, resolveAutoRoutesMatcherContext } from '../../../runtime/autoRoutesPlugin/shared'
import { resetTakeImportRegistry } from '../../../runtime/chunkStrategy'
import { getProjectConfigFileName, getProjectPrivateConfigFileName } from '../../../utils'
import { findJsEntry, isTemplate } from '../../../utils/file'
import { resolveVueSfcHasTemplate, resolveVueSfcNonJsonSignature, resolveVueSfcScriptSignature } from '../../../utils/file/vueSfcSignature'
import { createHmrProfileEventId } from '../../../utils/hmrProfile'
import { isSkippableResolvedId, normalizeFsResolvedId } from '../../../utils/resolvedId'
import { invalidateSharedStyleCache } from '../../css/shared/preprocessor'
import { invalidateFileCache } from '../../utils/cache'
import { ensureSidecarWatcher, invalidateEntryForSidecar } from '../../utils/invalidateEntry'
import { collectAffectedScriptsAndImporters } from '../../utils/invalidateEntry/cssGraph'
import { watchedScriptModuleExts, watchedTemplateExts } from '../../utils/invalidateEntry/shared'
import { isLayoutSourcePath } from '../../utils/layoutSourcePath'
import { addNormalizedWatchFiles } from '../../utils/watchFiles'
import { isAppVueFile } from '../../vue/transform/appShell'
import { collectAffectedEntries, collectAffectedEntriesFromSharedChunks, collectAffectedSharedChunks } from '../helpers'

const configSuffixes = configExtensions.map(ext => `.${ext}`)
const styleSuffixes = supportedCssLangs.map(ext => `.${ext}`)
const ATOMIC_SAVE_RECHECK_DELAYS_MS = [20, 60]

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

function invalidateAutoRoutesModuleCache(state: CorePluginState) {
  invalidateFileCache('weapp-vite/auto-routes')
  invalidateFileCache('virtual:weapp-vite-auto-routes')
  invalidateFileCache('\0weapp-vite:auto-routes')

  for (const target of resolveAutoRoutesAliasTargets(state.ctx.configService?.packageInfo?.rootPath)) {
    invalidateFileCache(normalizeFsResolvedId(target))
  }
}

function isConfigFileDependencyChange(state: CorePluginState, normalizedId: string) {
  return state.ctx.configService.configFileDependencies
    .some(dependency => normalizeFsResolvedId(dependency) === normalizedId)
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
    moduleImporters?: Map<string, Set<string>>
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
      options.moduleImporters?.has(id)
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
    resetTakeImportRegistry({ preserveSharedChunkNameCache: configService.isDev })
    if (configService.isDev) {
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
}

async function isVueEntryJsonOnlyUpdate(state: CorePluginState, normalizedId: string) {
  if (!normalizedId.endsWith('.vue')) {
    return false
  }

  const previous = state.ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.get(normalizedId)
  if (!previous) {
    return false
  }

  try {
    const source = await fs.readFile(normalizedId, 'utf-8')
    return resolveVueSfcNonJsonSignature(source, normalizedId) === previous
  }
  catch {
    return false
  }
}

async function isVueEntryLocalAssetOnlyUpdate(state: CorePluginState, normalizedId: string) {
  if (!normalizedId.endsWith('.vue')) {
    return false
  }

  const previous = state.ctx.runtimeState.build.hmr.vueEntryScriptSignatures.get(normalizedId)
  if (!previous) {
    return false
  }

  try {
    const source = await fs.readFile(normalizedId, 'utf-8')
    const currentScript = resolveVueSfcScriptSignature(source, normalizedId)
    return currentScript === previous
  }
  catch {
    return false
  }
}

async function isAppShellTopologyUpdate(state: CorePluginState, normalizedId: string) {
  if (!isAppVueFile(normalizedId)) {
    return false
  }

  const previous = state.ctx.runtimeState.build.hmr.vueEntryHasTemplate.get(normalizedId)
  if (previous === undefined) {
    return false
  }

  try {
    const source = await fs.readFile(normalizedId, 'utf-8')
    const current = resolveVueSfcHasTemplate(source, normalizedId)
    return current !== undefined && current !== previous
  }
  catch {
    return false
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
  const importerGraphAffectedEntryIds = new Set<string>()
  const relativeSrc = configService.relativeAbsoluteSrcRoot(normalizedId)
  const affectedLayoutEntryIds = new Set<string>()
  const dirtyReasonStats = new Map<string, number>()
  const markEntryDirtyWithCause = (
    entryId: string,
    reason: 'direct' | 'dependency' | 'metadata',
    cause: string,
  ) => {
    state.markEntryDirty(entryId, reason)
    if (entryId.endsWith('.vue')) {
      const hmr = ctx.runtimeState.build.hmr
      hmr.dirtyVueEntryIds ??= new Set<string>()
      hmr.dirtyVueEntryIds.add(entryId)
    }
    dirtyReasonStats.set(cause, (dirtyReasonStats.get(cause) ?? 0) + 1)
  }
  const declaredEntryType = state.entriesMap.get(removeExtensionDeep(relativeSrc))?.type
  const isDeletedMissingSelf = event === 'delete' && !await fs.pathExists(normalizedId)
  const isAutoRouteFile = Boolean(ctx.autoRoutesService?.isRouteFile(normalizedId))
  const isTemplateSidecar = Boolean(path.extname(normalizedId) && watchedTemplateExts.has(path.extname(normalizedId)))
  const isScriptModuleSidecar = Array.from(watchedScriptModuleExts).some(suffix => normalizedId.endsWith(suffix))
  const concreteChangedEntryId = isAppVueFile(normalizedId) && scanService.appEntry?.path
    ? normalizeFsResolvedId(scanService.appEntry.path)
    : normalizedId
  let isAppShellTopologyChanged = false
  let handledSidecarMetadataUpdate = false

  const addWxmlImporterEntries = async (startId: string) => {
    const wxmlService = ctx.wxmlService
    if (!wxmlService || typeof wxmlService.getImporters !== 'function') {
      return
    }

    const visited = new Set<string>()
    const queue = [startId]

    while (queue.length) {
      const current = queue.shift()!
      if (visited.has(current)) {
        continue
      }
      visited.add(current)

      const importers = wxmlService.getImporters(current)
      for (const importer of importers) {
        const normalizedImporter = normalizeFsResolvedId(importer)
        if (!visited.has(normalizedImporter)) {
          queue.push(normalizedImporter)
        }

        const ext = path.extname(normalizedImporter)
        if (!ext) {
          continue
        }
        const basePath = normalizedImporter.slice(0, -ext.length)
        const primaryScript = await findJsEntry(basePath)
        if (!primaryScript.path) {
          continue
        }
        const primaryScriptId = normalizeFsResolvedId(primaryScript.path)
        const reason = isLayoutSourcePath(configService.relativeAbsoluteSrcRoot(primaryScriptId))
          ? 'dependency'
          : 'direct'
        if (reason === 'dependency') {
          affectedLayoutEntryIds.add(primaryScriptId)
        }
        else {
          markEntryDirtyWithCause(primaryScriptId, 'metadata', 'wxml-importer')
          handledSidecarMetadataUpdate = true
        }
      }
    }
  }

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
    const appEntryId = scanService.appEntry?.path
      ? normalizeFsResolvedId(scanService.appEntry.path)
      : undefined
    if (!appEntryId || !resolvedEntryMap.has(appEntryId)) {
      return false
    }

    invalidateFileCache(appEntryId)
    invalidateAutoRoutesModuleCache(state)
    ;(loadEntry as any)?.invalidateResolveCache?.()
    ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = undefined
    markEntryDirtyWithCause(appEntryId, 'direct', 'auto-routes-topology')
    return true
  }

  const addCssImporterEntries = async (startId: string) => {
    const { importers, scripts } = await collectAffectedScriptsAndImporters(ctx, startId)

    for (const importer of importers) {
      const normalizedImporter = normalizeFsResolvedId(importer)
      if (
        isCurrentSubPackageFile(configService.relativeAbsoluteSrcRoot(normalizedImporter), subPackageMeta)
        && (loadedEntrySet.has(normalizedImporter) || resolvedEntryMap.has(normalizedImporter))
      ) {
        markScriptDirty(normalizedImporter, 'css-importer')
      }
    }

    for (const script of scripts) {
      markScriptDirty(script, 'css-importer')
    }
  }

  if (isDeletedMissingSelf) {
    ctx.runtimeState.build.hmr.vueEntryHasTemplate.delete(normalizedId)
    ctx.runtimeState.build.hmr.vueEntryNonJsonSignatures.delete(normalizedId)
    ctx.runtimeState.build.hmr.vueEntryScriptSignatures.delete(normalizedId)
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
    const isJsonOnlyVueEntryUpdate = await isVueEntryJsonOnlyUpdate(state, normalizedId)
    const isAutoRoutesStaleAppEntry = isJsonOnlyVueEntryUpdate && isAppEntryAutoRoutesSignatureStale(state, normalizedId)
    isAppShellTopologyChanged = !isJsonOnlyVueEntryUpdate && await isAppShellTopologyUpdate(state, normalizedId)
    const isLocalAssetOnlyVueEntryUpdate = !isJsonOnlyVueEntryUpdate
      && !isAppShellTopologyChanged
      && await isVueEntryLocalAssetOnlyUpdate(state, normalizedId)
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
  const isStyleFile = styleSuffixes.some(suffix => normalizedId.endsWith(suffix))
  const shouldHandleUpdateLikeSidecar = event === 'update' || (event === 'create' && isStyleFile && await fs.pathExists(normalizedId))
  if (shouldHandleUpdateLikeSidecar) {
    const isTemplateFile = isTemplate(normalizedId)
    const configSuffix = configSuffixes.find(suffix => normalizedId.endsWith(suffix))

    if (isTemplateFile) {
      const wxmlService = ctx.wxmlService
      if (wxmlService) {
        await wxmlService.scan(normalizedId)
      }
    }

    if (isTemplateSidecar || isScriptModuleSidecar) {
      await addWxmlImporterEntries(normalizedId)
    }

    const isHtmlTemplateFile = normalizedId.endsWith('.html')

    if (isTemplateFile || configSuffix || isStyleFile || isHtmlTemplateFile) {
      const basePath = configSuffix
        ? normalizedId.slice(0, -configSuffix.length)
        : (() => {
            const ext = path.extname(normalizedId)
            return ext ? normalizedId.slice(0, -ext.length) : normalizedId
          })()
      const primaryScript = await findJsEntry(basePath)
      if (primaryScript.path) {
        markScriptDirty(primaryScript.path, configSuffix ? 'json-sidecar' : isStyleFile ? 'style-sidecar' : 'sidecar-direct')
        handledSidecarMetadataUpdate = true
      }
      else if (configSuffix && markAppEntryForJsonEmit()) {
        handledSidecarMetadataUpdate = true
      }
      else if (isStyleFile) {
        await addCssImporterEntries(normalizedId)
        handledSidecarMetadataUpdate = true
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

    const dependentEntryIds = new Set<string>()

    for (const layoutEntryId of affectedLayoutEntryIds) {
      const dependents = state.layoutEntryDependents.get(layoutEntryId)
      if (!dependents?.size) {
        continue
      }
      for (const entryId of dependents) {
        dependentEntryIds.add(entryId)
      }
    }

    if (dependentEntryIds.size) {
      for (const entryId of affectedLayoutEntryIds) {
        markEntryDirtyWithCause(entryId, 'dependency', 'layout-self')
      }
      for (const entryId of dependentEntryIds) {
        markEntryDirtyWithCause(entryId, 'dependency', 'layout-dependent')
      }
      return [...dirtyReasonStats.entries()].map(([cause, count]) => `${cause}:${count}`)
    }

    for (const entryId of resolvedEntryMap.keys()) {
      markEntryDirtyWithCause(entryId, 'dependency', 'layout-fallback-full')
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
    const isJsonOnlyVueEntryUpdate = event === 'update' && await isVueEntryJsonOnlyUpdate(state, normalizedId)
    const isAutoRoutesStaleAppEntry = isJsonOnlyVueEntryUpdate && isAppEntryAutoRoutesSignatureStale(state, normalizedId)
    const isLocalAssetOnlyVueEntryUpdate = !isJsonOnlyVueEntryUpdate
      && !isAppShellTopologyChanged
      && event === 'update'
      && await isVueEntryLocalAssetOnlyUpdate(state, normalizedId)
    markChangedEntryDirty(
      (isJsonOnlyVueEntryUpdate && !isAutoRoutesStaleAppEntry) || isLocalAssetOnlyVueEntryUpdate ? 'metadata' : 'direct',
      isJsonOnlyVueEntryUpdate
        ? isAutoRoutesStaleAppEntry ? 'entry-auto-routes' : 'entry-json-only'
        : isAppShellTopologyChanged
          ? 'entry-direct'
          : isLocalAssetOnlyVueEntryUpdate
            ? 'entry-local-asset'
            : 'entry-direct',
    )
  }
  else if (state.layoutEntryDependents.size && state.layoutEntryDependents.get(normalizedId)?.size) {
    const affectedEntries = state.layoutEntryDependents.get(normalizedId)
    for (const entryId of affectedEntries!) {
      markEntryDirtyWithCause(entryId, 'dependency', 'layout-dependent')
    }
  }
  else if (state.moduleImporters.size && state.entryModuleIds.size) {
    const affected = collectAffectedEntries(state, normalizedId)
    if (affected.size) {
      for (const entryId of affected) {
        importerGraphAffectedEntryIds.add(entryId)
        markEntryDirtyWithCause(entryId, 'dependency', 'importer-graph')
      }
    }
  }
  const shouldExpandSharedChunkAffected = !dirtyReasonStats.has('sidecar-direct')
    && !dirtyReasonStats.has('json-sidecar')
    && !dirtyReasonStats.has('style-sidecar')
    && !dirtyReasonStats.has('css-importer')
  const sharedChunkAffected = shouldExpandSharedChunkAffected
    ? collectAffectedEntriesFromSharedChunks(state, normalizedId)
    : new Set<string>()
  if (sharedChunkAffected.size) {
    state.hmrState.affectedSharedChunkIds ??= new Set<string>()
    for (const chunkId of collectAffectedSharedChunks(state, normalizedId)) {
      state.hmrState.affectedSharedChunkIds.add(chunkId)
    }
    for (const entryId of sharedChunkAffected) {
      if (importerGraphAffectedEntryIds.has(entryId)) {
        continue
      }
      markEntryDirtyWithCause(entryId, 'dependency', 'shared-chunk-source')
    }
  }
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

    const independentRoot = Array.from(scanService.independentSubPackageMap.keys()).find((root) => {
      return relativeSrc.startsWith(`${root}/`)
    })

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
    if (isSkippableResolvedId(normalizedId)) {
      return
    }
    if (isOutputFileChange(state, normalizedId)) {
      return
    }
    if (isAutoRoutesGeneratedFileChange(state, normalizedId)) {
      return
    }
    const event = await normalizeWatchEvent(normalizedId, change.event, {
      emittedJsonPaths: new Set(
        [...state.jsonEmitFilesMap.values()]
          .map(record => record.entry.jsonPath ? normalizeFsResolvedId(record.entry.jsonPath) : '')
          .filter(Boolean),
      ),
      loadedEntrySet: state.loadedEntrySet,
      moduleImporters: state.moduleImporters,
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
