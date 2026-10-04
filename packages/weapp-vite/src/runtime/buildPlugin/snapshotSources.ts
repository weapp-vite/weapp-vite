import type { CompilerContext, MutableCompilerContext } from '../../context'
import type { ChangeEvent } from '../../types'
import { WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/fs'
import { invalidateGlassEaselSource } from '../../analyze/glassEasel'
import { resolveAutoRoutesWatchChangeEvent, RESOLVED_VIRTUAL_ID } from '../../plugins/autoRoutes.shared'
import { invalidateFileCache } from '../../plugins/utils/cache'
import { configSuffixes } from '../../plugins/utils/invalidateEntry/shared'
import { isTemplate } from '../../utils'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { resolveScanAppBasename } from '../scanPlugin/service'
import { hasEntryTopologyChange } from './entryTopology'

function isAppConfigSource(ctx: MutableCompilerContext, file: string) {
  const appBasename = normalizeFsResolvedId(resolveScanAppBasename(ctx.configService!.absoluteSrcRoot))
  const normalizedFile = normalizeFsResolvedId(file)
  return configSuffixes.some(suffix => normalizedFile === `${appBasename}${suffix}`)
}

/** 一次性 snapshot 不经过 watchChange，构建前必须刷新整个批次的真实源状态。 */
export async function refreshSnapshotSources(
  ctx: MutableCompilerContext,
  changes: Iterable<{ file: string, event?: ChangeEvent }>,
  emittedRouteSignature: string | undefined,
  emittedEntryTopology?: ReadonlyMap<string, string>,
) {
  const changedFiles = new Map<string, ChangeEvent | undefined>()
  for (const change of changes) {
    changedFiles.set(normalizeFsResolvedId(change.file), change.event)
  }
  const deletedFiles = new Set<string>()
  for (const [file, event] of changedFiles) {
    invalidateFileCache(file)
    if (event === 'delete' && !await fs.pathExists(file)) {
      deletedFiles.add(file)
    }
  }
  const entryTopologyChanged = await hasEntryTopologyChange(ctx, changedFiles.keys(), emittedEntryTopology, deletedFiles)
  if (entryTopologyChanged) {
    // options 钩子先于 buildStart 读取页面 input，必须先撤销扫描快照。
    ctx.scanService?.markDirty()
  }
  for (const [file, event] of changedFiles) {
    // module-graph provider 直接调度 snapshot 时不会经过 lifecycle watchChange；
    // 先失效入口缓存，确保本批次重建读取最新 app.json/app.json.ts，尤其是
    // 页面拓扑和 workers 配置删除场景。
    if (isAppConfigSource(ctx, file)) {
      ctx.scanService?.markDirty()
    }
    await ctx.autoRoutesService?.handleFileChange(file, resolveAutoRoutesWatchChangeEvent(event) ?? event)
    if (deletedFiles.has(file)) {
      // 完整 snapshot 不再从入口缓存重新发射已经删除的源文件。
      ctx.runtimeState.build.hmr.resolvedEntryMap.delete(file)
      ctx.runtimeState.build.hmr.loadedEntrySet.delete(file)
      ctx.runtimeState.wxml.tokenMap.delete(file)
      // snapshot 在构建服务完成上下文初始化后执行。
      const compilerContext = ctx as CompilerContext
      invalidateGlassEaselSource(compilerContext, file)
      continue
    }
    if (isTemplate(file)) {
      await ctx.wxmlService?.scan(file)
    }
  }
  const routeSignature = ctx.autoRoutesService?.getSignature()
  const routeTopologyChanged = emittedRouteSignature !== routeSignature
  const routeDependentEntries = new Set<string>()
  if (routeTopologyChanged) {
    // JSON/WXML 的结构事件可能先于脚本目录 watcher 抵达；options 必须读取同一份新路由。
    ctx.scanService?.markDirty()
    for (const id of [RESOLVED_VIRTUAL_ID, WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID]) {
      invalidateFileCache(id)
      ctx.moduleGraphService.recordChangedFile(id, 'update')
      for (const entry of ctx.moduleGraphService.invalidate(id)) {
        routeDependentEntries.add(entry)
      }
    }
  }
  return { routeSignature, routeTopologyChanged, routeDependentEntries, entryTopologyChanged }
}
