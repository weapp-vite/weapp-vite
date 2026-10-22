import type { CompilerGenerateResult } from 'weapp-tailwindcss/core'

/** raw 生成结果已经包含上游最终扫描计划，不能再按默认根扩大显式来源范围。 */
export function resolveTailwindContentSourceRules(result: Pick<CompilerGenerateResult, 'sources'>, outDir?: string) {
  const sources = result.sources.map(source => ({ ...source }))
  if (outDir) {
    sources.push({ base: outDir, pattern: '**/*', negated: true })
  }
  return sources
}
