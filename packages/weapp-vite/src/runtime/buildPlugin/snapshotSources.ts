import type { CompilerContext, MutableCompilerContext } from '../../context'
import type { ChangeEvent } from '../../types'
import { WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID } from '@weapp-core/constants'
import { fs } from '@weapp-core/shared/fs'
import { invalidateGlassEaselSource } from '../../analyze/glassEasel'
import { RESOLVED_VIRTUAL_ID } from '../../plugins/autoRoutes.shared'
import { invalidateFileCache } from '../../plugins/utils/cache'
import { isTemplate } from '../../utils'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

/** 一次性 snapshot 不经过 watchChange，构建前必须刷新整个批次的真实源状态。 */
export async function refreshSnapshotSources(
  ctx: MutableCompilerContext,
  changes: Iterable<{ file: string, event?: ChangeEvent }>,
  emittedRouteSignature: string | undefined,
) {
  const changedFiles = new Map<string, ChangeEvent | undefined>()
  for (const change of changes) {
    changedFiles.set(normalizeFsResolvedId(change.file), change.event)
  }
  for (const file of changedFiles.keys()) {
    invalidateFileCache(file)
  }
  for (const [file, event] of changedFiles) {
    await ctx.autoRoutesService?.handleFileChange(file)
    if (event === 'delete' && !await fs.pathExists(file)) {
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
  const routeDependentEntries = new Set<string>()
  if (emittedRouteSignature !== routeSignature) {
    for (const id of [RESOLVED_VIRTUAL_ID, WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID]) {
      invalidateFileCache(id)
      ctx.moduleGraphService.recordChangedFile(id, 'update')
      for (const entry of ctx.moduleGraphService.invalidate(id)) {
        routeDependentEntries.add(entry)
      }
    }
  }
  return { routeSignature, routeDependentEntries }
}
