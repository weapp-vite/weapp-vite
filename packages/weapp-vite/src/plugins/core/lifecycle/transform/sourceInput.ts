import type { CorePluginState } from '../../helpers'
import { normalizeFsResolvedId } from '../../../../utils/resolvedId'
import { compilerSnapshotSourceId, getCompilerSourceSnapshot, hasCompilerInputObservers, notifyCompilerInput } from '../../../utils/sourceSnapshot'

/** 观察默认 loader 已交付的普通脚本，入口 reader 继续独占原始入口版本。 */
export function observeBundlerSourceInput(state: CorePluginState, code: string, id: string): void {
  const { configService } = state.ctx
  if (!hasCompilerInputObservers(configService)) {
    return
  }
  if (id.includes('\0') || id.includes('?') || id.includes('#') || !/\.[cm]?[jt]sx?$/.test(id)) {
    return
  }
  const sourceId = normalizeFsResolvedId(id)
  if (!sourceId) {
    return
  }
  const physicalSourceId = compilerSnapshotSourceId(getCompilerSourceSnapshot(configService), sourceId)
  if (
    state.loadedEntrySet?.has(sourceId)
    || state.loadedEntrySet?.has(physicalSourceId)
    || state.resolvedEntryMap?.has(sourceId)
    || state.resolvedEntryMap?.has(physicalSourceId)
  ) {
    return
  }
  notifyCompilerInput(configService, sourceId, code)
}
