import type { CorePluginState } from '../helpers'
import { shouldPublishClassicGeneration } from '../../outputFinalizer/classicGeneration'

/** classic 重新生成完整注册图；历史共享图无法证明新增依赖或 prelude 的消费者完整。 */
export function prepareClassicPublicationEntries(state: CorePluginState) {
  const required = state.hmrState.requiredPublicationEntryIds ??= new Set<string>()
  required.clear()
  if (!state.ctx.scanService.appEntry || !state.hmrState.hasBuiltOnce || state.subPackageMeta || state.buildTarget === 'plugin'
    || state.ctx.runtimeState.build.hmr.fullEntryScan
    || !state.ctx.runtimeState.build.hmr.dirtyEntrySet.size
    || state.resolvedConfig?.build?.write === false
    || state.resolvedConfig?.experimental?.bundledDev === true
    || !shouldPublishClassicGeneration(state.ctx)) {
    return
  }

  for (const entry of state.resolvedEntryMap.keys()) {
    required.add(entry)
  }
}
