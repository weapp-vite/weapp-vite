import type { CompilerContext } from '../../context'
import type { GlassEaselAnalysisFact, GlassEaselDiagnostic, GlassEaselNativeScriptUpdate } from './types'
import { analyzeScript } from './index'
import { normalizeOutputFileName, normalizeSourceId, outputOwner, replaceAnalysis } from './state'

export type { GlassEaselNativeScriptModule, GlassEaselNativeScriptUpdate } from './types'

const nativeSourceOwnerPrefix = 'native-source:'

export function isNativeScriptAnalysisOwner(
  owner: string,
  analysis: GlassEaselAnalysisFact,
): boolean {
  if (owner.startsWith(nativeSourceOwnerPrefix)) {
    return analysis.kind === 'source'
  }
  const mainOutputPrefix = outputOwner('main', '')
  return analysis.kind === 'output'
    && analysis.scope === 'main'
    && owner.startsWith(mainOutputPrefix)
    && owner.slice(mainOutputPrefix.length).endsWith('.js')
}

function analyzeOutputModule(file: string, code: string): GlassEaselDiagnostic[] {
  // moduleGraph 代码不能定位原始源码或最终 chunk；只报告可靠的文件身份。
  return analyzeScript(file, code).map(({ line: _line, column: _column, ...diagnostic }) => diagnostic)
}

/** 用 DevEngine 当前完整模块事实替换受影响的 GlassEasel 脚本诊断。 */
export function refreshGlassEaselNativeScripts(
  ctx: CompilerContext,
  updates: readonly GlassEaselNativeScriptUpdate[],
): void {
  for (const update of updates) {
    if (update.sourceOnly) {
      const owner = `${nativeSourceOwnerPrefix}${update.file}`
      if (update.modules.length === 0) {
        ctx.runtimeState.glassEasel.analysisByOwner.delete(owner)
        continue
      }
      const sourceIds = new Set(update.modules.map(module => normalizeSourceId(module.id)))
      replaceAnalysis(ctx, owner, {
        kind: 'source',
        detected: false,
        diagnostics: update.modules.flatMap(module => analyzeOutputModule(module.id, module.code)),
        sourceIds,
      })
      continue
    }

    const file = normalizeOutputFileName(update.file)
    const sourceIds = new Set<string>([file])
    const diagnostics: GlassEaselDiagnostic[] = []
    for (const module of update.modules) {
      sourceIds.add(normalizeSourceId(module.id))
      ctx.runtimeState.glassEasel.analysisByOwner.delete(`${nativeSourceOwnerPrefix}${module.id}`)
      diagnostics.push(...analyzeOutputModule(file, module.code))
    }
    replaceAnalysis(ctx, outputOwner('main', file), {
      kind: 'output',
      scope: 'main',
      detected: false,
      diagnostics,
      sourceIds,
    })
  }
}
