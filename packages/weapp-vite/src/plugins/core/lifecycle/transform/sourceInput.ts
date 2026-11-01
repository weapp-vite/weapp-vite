import type { CorePluginState } from '../../helpers'
import { isReactTransformSource } from '../../../react/sourceInput'
import { observeBundlerScriptInput } from '../../../utils/bundlerSourceInput'

/** 观察默认 loader 已交付的普通脚本，入口 reader 继续独占原始入口版本。 */
export function observeBundlerSourceInput(state: CorePluginState, code: string, id: string): void {
  const { configService } = state.ctx
  if (configService.weappViteConfig?.react && isReactTransformSource(id)) {
    return
  }
  observeBundlerScriptInput({ configService, loadedEntrySet: state.loadedEntrySet, resolvedEntryMap: state.resolvedEntryMap }, code, id)
}
