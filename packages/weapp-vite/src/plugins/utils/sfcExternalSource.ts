import type { CompilerContext } from '../../context'
import { normalizeFsResolvedId } from '../../utils/resolvedId'

/** 外部块的语法由 SFC 声明决定；不能因扩展名像模板就交给原生 XML 扫描器。 */
export function isSfcExternalSource(ctx: Pick<CompilerContext, 'runtimeState'>, filename: string) {
  const file = normalizeFsResolvedId(filename)
  return [...ctx.runtimeState.build.hmr.vueEntryStyleBindings?.values() ?? []]
    .some(binding => binding.sources.some(source => normalizeFsResolvedId(source) === file))
}
