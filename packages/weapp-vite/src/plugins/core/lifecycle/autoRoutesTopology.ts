import type { MutableCompilerContext } from '../../../context'
import {
  WEVU_AUTO_ROUTES_MODULE_ID,
  WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID,
  WEVU_AUTO_ROUTES_VIRTUAL_MODULE_ID,
} from '@weapp-core/constants'
import { resolveAutoRoutesAliasTargets } from '../../../runtime/autoRoutesPlugin/shared'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { invalidateFileCache } from '../../utils/cache'

/**
 * 标记 app 入口依赖的 auto-routes 拓扑已变化。
 */
export function markAppEntryForAutoRoutesTopology(ctx: MutableCompilerContext, options: {
  loadEntry?: unknown
  markEntryDirty: (entryId: string, reason: 'direct') => void
  resolvedEntryMap: Map<string, unknown>
}) {
  const appEntryId = ctx.scanService?.appEntry?.path
    ? normalizeFsResolvedId(ctx.scanService.appEntry.path)
    : undefined

  if (appEntryId) {
    invalidateFileCache(appEntryId)
  }
  invalidateFileCache('weapp-vite/auto-routes')
  invalidateFileCache('virtual:weapp-vite-auto-routes')
  invalidateFileCache('\0weapp-vite:auto-routes')
  invalidateFileCache(WEVU_AUTO_ROUTES_MODULE_ID)
  invalidateFileCache(WEVU_AUTO_ROUTES_VIRTUAL_MODULE_ID)
  invalidateFileCache(WEVU_AUTO_ROUTES_RESOLVED_MODULE_ID)

  for (const target of resolveAutoRoutesAliasTargets(ctx.configService?.packageInfo?.rootPath)) {
    invalidateFileCache(normalizeFsResolvedId(target))
  }

  const loadEntry = options.loadEntry
  if (
    loadEntry
    && typeof loadEntry === 'object'
    && 'invalidateResolveCache' in loadEntry
    && typeof loadEntry.invalidateResolveCache === 'function'
  ) {
    loadEntry.invalidateResolveCache()
  }
  ctx.runtimeState.build.hmr.appEntryAutoRoutesSignature = undefined

  if (!appEntryId || !options.resolvedEntryMap.has(appEntryId)) {
    return false
  }

  options.markEntryDirty(appEntryId, 'direct')
  return true
}
