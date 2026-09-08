import type { CorePluginState } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { createDebugger } from '../../../debugger'
import { normalizeSourceId } from '../../../moduleGraph/traversal'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { configSuffixes, watchedCssExts, watchedTemplateExts } from '../../utils/invalidateEntry/shared'
import { isLayoutSourcePath } from '../../utils/layoutSourcePath'

const debug = createDebugger('weapp-vite:core')

function resolveEntryType(state: CorePluginState, entryId: string) {
  const relativeBase = removeExtensionDeep(state.ctx.configService.relativeAbsoluteSrcRoot(entryId))
  const declaredType = state.entriesMap.get(relativeBase)?.type
  if (declaredType === 'page' || declaredType === 'component') {
    return declaredType
  }
  return state.hmrRootInputIds.has(normalizeSourceId(entryId)) ? 'app' as const : 'component' as const
}

function resolveChangeCause(
  state: CorePluginState,
  file: string,
  affectedEntries: Iterable<string>,
) {
  const normalized = normalizeFsResolvedId(file)
  if (configSuffixes.some(suffix => normalized.endsWith(suffix))) {
    return 'json-sidecar'
  }
  const extension = path.extname(normalized)
  if (watchedCssExts.has(extension)) {
    const styleBase = removeExtensionDeep(normalized)
    const isDirectStyleSidecar = Array.from(affectedEntries).some((entryId) => {
      return removeExtensionDeep(normalizeFsResolvedId(entryId)) === styleBase
    })
    return isDirectStyleSidecar ? 'style-sidecar' : 'css-importer'
  }
  if (watchedTemplateExts.has(extension)) {
    return isLayoutSourcePath(state.ctx.configService.relativeAbsoluteSrcRoot(normalized))
      ? 'layout-dependent'
      : 'sidecar-direct'
  }
  if (state.ctx.moduleGraphService.isLogicalLayoutEntry(normalized)) {
    return 'layout-script'
  }
  if (isLayoutSourcePath(state.ctx.configService.relativeAbsoluteSrcRoot(normalized))) {
    return 'layout-dependent'
  }
  if (state.resolvedEntryMap.has(normalized)) {
    return 'entry-direct'
  }
  return 'importer-graph'
}

export function createBuildEndHook(state: CorePluginState) {
  const { subPackageMeta } = state

  return async function buildEnd(this: any) {
    state.ctx.moduleGraphService.bindBuildContext(state, this)
    // 一次性构建清空 outDir 时必须保留全量输出，不能被单个 sidecar 的诊断范围收窄。
    // watch 构建仅在启动时清目录，后续更新仍遵循增量契约。
    const replacesOutput = state.resolvedConfig?.build.emptyOutDir === true && !state.resolvedConfig.build.watch
    if (replacesOutput) {
      state.hmrState.didEmitAllEntries = true
      state.hmrState.skipSharedChunkRefresh = false
      state.ctx.runtimeState.build.hmr.didEmitAllEntries = true
    }
    const pendingChanges = state.ctx.moduleGraphService.getPendingChanges()
    // 发射计划保留当前构建的文件身份，诊断 profile 不参与业务选择。
    const styleSidecarFiles = new Set<string>()
    state.hmrState.styleSidecarFiles = styleSidecarFiles
    const affectedEntries = new Set<string>()
    const causes = new Map<string, number>()
    let metadataOnly = pendingChanges.length > 0

    for (const change of pendingChanges) {
      const affected = state.ctx.moduleGraphService.collectAffectedEntries(change.file)
      const cause = resolveChangeCause(state, change.file, affected)
      if (cause === 'style-sidecar' && change.event !== 'delete') {
        styleSidecarFiles.add(normalizeFsResolvedId(change.file))
      }
      causes.set(cause, (causes.get(cause) ?? 0) + affected.size)
      if (cause === 'entry-direct' || cause === 'importer-graph' || cause === 'layout-script') {
        metadataOnly = false
      }
      for (const entryId of affected) {
        if (!state.resolvedEntryMap.has(entryId)) {
          continue
        }
        affectedEntries.add(entryId)
      }
    }

    if (affectedEntries.size) {
      const hmr = state.ctx.runtimeState.build.hmr
      state.hmrState.lastHmrEntryIds = new Set(affectedEntries)
      hmr.lastHmrEntryIds = new Set(affectedEntries)
      state.hmrState.didEmitAllEntries = replacesOutput
      state.hmrState.skipSharedChunkRefresh = metadataOnly && !replacesOutput
      const summary = [...causes.entries()].map(([cause, count]) => `${cause}:${count}`)
      hmr.profile = {
        ...hmr.profile,
        dirtyCount: affectedEntries.size,
        emittedCount: metadataOnly ? affectedEntries.size : hmr.profile.emittedCount,
        pendingCount: metadataOnly ? affectedEntries.size : hmr.profile.pendingCount,
        dirtyReasonSummary: summary,
      }

      if (metadataOnly) {
        for (const entryId of affectedEntries) {
          state.loadedEntrySet.delete(entryId)
          await state.loadEntry.call(this, entryId, resolveEntryType(state, entryId), { metadataOnly: true })
        }
      }
    }

    await state.ctx.moduleGraphService.syncDevGraph(this)

    debug?.(`${subPackageMeta ? `独立分包 ${subPackageMeta.subPackage.root}` : '主包'} ${Array.from(this.getModuleIds()).length} 个模块被编译`)
  }
}
