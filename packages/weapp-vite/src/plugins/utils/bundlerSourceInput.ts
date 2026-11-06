import { withRealpathScope } from '../../utils/realpathScope'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { compilerSnapshotSourceId, getCompilerSourceSnapshot, hasCompilerInputObservers, notifyCompilerInput } from './sourceSnapshot'

interface BundlerSourceInputOwner {
  configService: object
  loadedEntrySet?: ReadonlySet<string>
  resolvedEntryMap?: ReadonlyMap<string, unknown>
}

/** 观察 loader 交付的普通脚本；原生入口仍由实际 raw reader 独占输入身份。 */
export function observeBundlerScriptInput(owner: BundlerSourceInputOwner, code: string, id: string): void {
  const { configService } = owner
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
  // 同步归属检查与输入通知共享本次解析；返回后不保留路径身份。
  withRealpathScope(() => {
    const physicalSourceId = compilerSnapshotSourceId(getCompilerSourceSnapshot(configService), sourceId)
    if (
      owner.loadedEntrySet?.has(sourceId)
      || owner.loadedEntrySet?.has(physicalSourceId)
      || owner.resolvedEntryMap?.has(sourceId)
      || owner.resolvedEntryMap?.has(physicalSourceId)
    ) {
      return
    }
    notifyCompilerInput(configService, sourceId, code)
  })
}
