import type { Diagnostic } from '../types'
import type { ScriptAnalysis, ScriptInput, ScriptOptions } from './types'
import { getLanguageProfile } from '../profiles'
import { collectScriptFacts } from './facts'
import { parseScript, resolveScriptProfile } from './parse'
import { checkScriptReferences, checkScriptRules } from './rules'

export function analyzeScript(input: ScriptInput): ScriptAnalysis
export function analyzeScript(source: string, fileName: string, options?: ScriptOptions): ScriptAnalysis
/** 只报告有平台依据的限制；未知 SJS 平台不借用其他宿主的语法或 API 规则。 */
export function analyzeScript(input: string | ScriptInput, name?: string, explicitOptions: ScriptOptions = {}): ScriptAnalysis {
  const source = typeof input === 'string' ? input : input.source
  const fileName = typeof input === 'string' ? name ?? 'script.js' : input.fileName
  const options = typeof input === 'string' ? explicitOptions : { ...input.options, ...input, platform: input.platform ?? input.options?.platform }
  const profile = resolveScriptProfile(fileName, options)
  const parsed = parseScript(source, fileName, profile)
  const diagnostics: Diagnostic[] = []
  if (parsed.diagnostic) {
    diagnostics.push(parsed.diagnostic)
  }
  if (profile.dialect === 'sjs' && !options.platform) {
    diagnostics.push({ code: 'script/platform-required', message: 'SJS 扩展名由多个平台共用；请指定平台以启用对应方言检查。', severity: 'warning', start: 0, end: 0 })
  }
  if (profile.sourceKind === 'native' && profile.dialect !== 'javascript' && options.platform && !getLanguageProfile(options.platform).scriptExtensions.includes(`.${profile.dialect}`)) {
    diagnostics.push({ code: 'script/platform-dialect', message: `${options.platform} 未登记原生 ${profile.dialect.toUpperCase()} 支持；请明确配置正确平台，或使用需要构建的 .${profile.dialect}.ts/.js 源码。`, severity: 'error', start: 0, end: 0 })
  }
  if (parsed.ast) {
    diagnostics.push(...checkScriptRules(parsed.ast, source, profile, options))
  }
  const facts = parsed.ast ? collectScriptFacts(parsed.ast) : { references: [], symbols: [], imports: [], externalUses: [] }
  diagnostics.push(...checkScriptReferences(facts.references, profile, options))
  diagnostics.sort((left, right) => left.start - right.start || left.code.localeCompare(right.code))
  return { diagnostics, valid: !diagnostics.some(diagnostic => diagnostic.severity === 'error'), dialect: profile.dialect, sourceKind: profile.sourceKind, ...facts }
}
