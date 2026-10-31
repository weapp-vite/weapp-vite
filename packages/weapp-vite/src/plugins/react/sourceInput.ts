import type { CompilerContext } from '../../context'
import { observeBundlerScriptInput } from '../utils/bundlerSourceInput'

const REACT_FILE_RE = /\.(?:jsx|tsx)(?:\?.*)?$/

export function isReactTransformSource(id: string): boolean {
  return REACT_FILE_RE.test(id) && !id.includes('/node_modules/')
}

/** JSX 静态模板和脚本转换共用转换前的输入，不把生成的 JS 重新归为源码。 */
export function observeReactSourceInput(ctx: CompilerContext, source: string, id: string): void {
  const hmr = ctx.runtimeState?.build?.hmr
  observeBundlerScriptInput({
    configService: ctx.configService,
    loadedEntrySet: hmr?.loadedEntrySet,
    resolvedEntryMap: hmr?.resolvedEntryMap,
  }, source, id)
}
