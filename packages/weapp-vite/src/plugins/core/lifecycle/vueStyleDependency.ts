import type { CompilerContext } from '../../../context'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { createReadAndParseSfcOptions, readAndParseSfc } from '../../utils/vueSfc'
import { hasSameCssVars } from '../../vue/transform/styleOnly'

/** 在原生入口发射前识别外部样式引起的脚本绑定变化。 */
export async function collectVueStyleScriptChanges(
  ctx: Pick<CompilerContext, 'runtimeState' | 'moduleGraphService'>,
  filename: string,
  configService: CompilerContext['configService'],
) {
  const changedEntries = new Set<string>()
  for (const [entryId, bindings] of ctx.runtimeState.build.hmr.vueEntryStyleBindings) {
    if (!bindings.sources.some(source => normalizeFsResolvedId(source) === filename)) {
      continue
    }
    const { descriptor } = await readAndParseSfc(
      entryId,
      createReadAndParseSfcOptions(ctx.moduleGraphService, configService),
    )
    if (!hasSameCssVars(bindings.expressions, descriptor.cssVars)) {
      changedEntries.add(entryId)
    }
  }
  return changedEntries
}
