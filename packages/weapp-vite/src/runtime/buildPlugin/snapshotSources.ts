import type { MutableCompilerContext } from '../../context'
import { WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID } from '@weapp-core/constants'
import { RESOLVED_VIRTUAL_ID } from '../../plugins/autoRoutes.shared'
import { invalidateFileCache } from '../../plugins/utils/cache'
import { isTemplate } from '../../utils'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

/** 一次性 snapshot 不经过 watchChange，构建前必须刷新整个批次的真实源状态。 */
export async function refreshSnapshotSources(
  ctx: MutableCompilerContext,
  files: Iterable<string>,
  emittedRouteSignature: string | undefined,
) {
  const changedFiles = new Set(Array.from(files, file => normalizeFsResolvedId(file)))
  for (const file of changedFiles) {
    invalidateFileCache(file)
  }
  for (const file of changedFiles) {
    await ctx.autoRoutesService?.handleFileChange(file)
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
