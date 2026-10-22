import type { CorePluginState } from '../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { createDebugger } from '../../../debugger'
import { normalizeSourceId } from '../../../moduleGraph/traversal'
import { getHmrStyleUpdatePlan, mergeHmrStyleUpdatePlan } from '../../../runtime/hmrStyleUpdate'
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
    state.ctx.runtimeState.build.hmr.isRebuild = state.hmrState.hasBuiltOnce
    state.ctx.moduleGraphService.bindBuildContext(state, this)
    // 生产 watch 每轮发布完整目标，不能被单个 sidecar 的诊断范围收窄。
    const replacesOutput = (!state.ctx.configService.isDev && Boolean(state.resolvedConfig?.build.watch))
      || (state.resolvedConfig?.build.emptyOutDir === true && !state.resolvedConfig.build.watch)
      || state.ctx.runtimeState.build.hmr.fullEntryScan === true
      || state.ctx.runtimeState.build.hmr.fullSnapshotOutput === true
    if (replacesOutput) {
      state.hmrState.didEmitAllEntries = true
      state.hmrState.skipSharedChunkRefresh = false
    }
    const pendingChanges = state.ctx.moduleGraphService.getPendingChanges()
    const styleUpdatePlan = getHmrStyleUpdatePlan(state.ctx.configService)
    // 发射计划保留当前构建的文件身份，诊断 profile 不参与业务选择。
    const styleSidecarFiles = new Set<string>()
    state.hmrState.styleSidecarFiles = styleSidecarFiles
    const affectedEntries = new Set<string>()
    const causes = new Map<string, number>()
    // 已发出的脚本 chunk 属于本轮构建计划，不能再按源文件扩展名降级为仅资源更新。
    let metadataOnly = pendingChanges.length > 0 && !state.hmrState.lastEmittedEntryIds?.size

    for (const change of pendingChanges) {
      if (styleUpdatePlan && !styleUpdatePlan.sourceFiles.has(normalizeFsResolvedId(change.file))) {
        continue
      }
      const affected = state.ctx.moduleGraphService.collectAffectedEntries(change.file)
      const cause = resolveChangeCause(state, change.file, affected)
      if (cause === 'style-sidecar' && change.event !== 'delete') {
        styleSidecarFiles.add(normalizeFsResolvedId(change.file))
      }
      if (cause === 'style-sidecar' || cause === 'css-importer') {
        mergeHmrStyleUpdatePlan(state.ctx.configService, {
          styleFiles: [change.file],
          cssImporterOwners: cause === 'css-importer' ? affected : [],
        })
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
      // loader 已确认的元数据 owner 也属于本代发布，物理模块图不能撤销内容编译器归属。
      for (const entryId of state.hmrState.lastHmrEntryIds ?? []) {
        affectedEntries.add(entryId)
      }
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

      if (metadataOnly && !replacesOutput) {
        for (const entryId of affectedEntries) {
          const wasLoaded = state.loadedEntrySet.delete(entryId)
          await state.loadEntry.call(this, entryId, resolveEntryType(state, entryId), { metadataOnly: true })
          // 元数据刷新不能退休已有脚本入口，否则后续无关更新会再次发射它。
          if (wasLoaded) {
            state.loadedEntrySet.add(entryId)
          }
        }
      }
    }

    // JSON/WXML 与发布归属共用最终完整性，全部脚本发射不等于缓存资产也已重发。
    state.ctx.runtimeState.build.hmr.didEmitAllEntries = state.hmrState.didEmitAllEntries
    debug?.(`${subPackageMeta ? `独立分包 ${subPackageMeta.subPackage.root}` : '主包'} ${Array.from(this.getModuleIds()).length} 个模块被编译`)
  }
}
