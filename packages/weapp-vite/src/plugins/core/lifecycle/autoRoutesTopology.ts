import type { CompilerContext } from '../../../context'
import { resolveAutoRoutesAliasTargets } from '../../../runtime/autoRoutesPlugin/shared'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { invalidateFileCache } from '../../utils/cache'

/**
 * 标记 app 入口依赖的 auto-routes 拓扑已变化。
 */
export function markAppEntryForAutoRoutesTopology(ctx: CompilerContext, options: {
  loadEntry?: unknown
  markEntryDirty: (entryId: string, reason: 'direct') => void
  resolvedEntryMap: Map<string, unknown>
}) {
  const appEntryId = ctx.scanService?.appEntry?.path
    ? normalizeFsResolvedId(ctx.scanService.appEntry.path)
    : undefined
  if (!appEntryId || !options.resolvedEntryMap.has(appEntryId)) {
    return false
  }

  invalidateFileCache(appEntryId)
  invalidateFileCache('weapp-vite/auto-routes')
  invalidateFileCache('virtual:weapp-vite-auto-routes')
  invalidateFileCache('\0weapp-vite:auto-routes')

  for (const target of resolveAutoRoutesAliasTargets(ctx.configService?.packageInfo?.rootPath)) {
    invalidateFileCache(normalizeFsResolvedId(target))
  }

  ;(options.loadEntry as any)?.invalidateResolveCache?.()
  ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = undefined
  options.markEntryDirty(appEntryId, 'direct')
  return true
}
