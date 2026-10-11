import type { CorePluginState } from '../../helpers'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { normalizeSourceId } from '../../../../moduleGraph/traversal'
import { getSelectedAutoRouteSource } from '../../../../runtime/autoRoutesPlugin/selection'
import { withRealpathScope } from '../../../../utils/realpathScope'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { resolveRootEntryBasename } from './weapi'

/** 先按入口声明筛选；同一次同步身份查询复用真实路径，不跨异步解析保留。 */
export function resolveLoadEntryIdentity(state: CorePluginState, sourceId: string) {
  return withRealpathScope(() => {
    const { ctx, subPackageMeta } = state
    const { configService } = ctx
    const relativeBasename = removeExtensionDeep(configService.relativeAbsoluteSrcRoot(sourceId))
    const selectedPageSource = getSelectedAutoRouteSource(ctx, sourceId)
    const declaredEntry = state.entriesMap?.get(relativeBasename)
    const isRootBasename = relativeBasename === resolveRootEntryBasename(state)
    const isEntryCandidate = isRootBasename || selectedPageSource !== undefined
      || Boolean(declaredEntry) || Boolean(subPackageMeta?.entries.includes(relativeBasename))
    // 普通业务依赖不参与入口物理身份匹配，仍由后续 load/transform 管线处理。
    const physicalSourceId = isEntryCandidate ? normalizeSourceId(sourceId) : undefined
    const isSelectedPageSource = !selectedPageSource || normalizeSourceId(selectedPageSource) === physicalSourceId
    // 父入口的声明可能暂时指向父源码；实际解析记录优先于这种占位信息。
    const declaredPath = declaredEntry?.path && normalizeFsResolvedId(
      configService.absoluteSrcRoot ? path.resolve(configService.absoluteSrcRoot, declaredEntry.path) : declaredEntry.path,
    )
    const hasPhysicalDeclaration = declaredPath
      && removeExtensionDeep(configService.relativeAbsoluteSrcRoot(declaredPath)) === relativeBasename
    return {
      relativeBasename,
      selectedPageSource,
      physicalSourceId,
      isSelectedPageSource,
      declaredEntry,
      declaredPath,
      hasPhysicalDeclaration,
      isRootBasename,
    }
  })
}
