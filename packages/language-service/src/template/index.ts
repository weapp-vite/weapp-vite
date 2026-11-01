import type { DocumentInput } from '../types'
import type { TemplateAnalysis, TemplateTag } from './types'
import { getLanguageProfile, resolveLanguageProfile } from '../profiles'
import { collectTemplateExpressions } from './expressions'
import { collectTemplateMetadata } from './references'
import { scanTemplate } from './scanner'
import { validateTemplate } from './validate'

export { getTemplateExpressions } from './expressions'
export { formatTemplate, formatTemplateResult } from './format'
export { getTemplateScriptInput } from './input'
export { scanTemplate } from './scanner'
export type { TemplateAnalysis, TemplateAttribute, TemplateBinding, TemplateExpression, TemplateFormatOptions, TemplateFormatResult, TemplateRaw, TemplateReference, TemplateScope, TemplateScript, TemplateTag, TemplateToken } from './types'

/** 分析模板结构与平台作用域，不执行脚本、不加载项目配置。 */
export function analyzeTemplate(input: DocumentInput): TemplateAnalysis {
  const profile = input.platform ? getLanguageProfile(input.platform) : resolveLanguageProfile(input.fileName, input.options)
  const { tokens, diagnostics } = scanTemplate(input.source)
  diagnostics.push(...validateTemplate(input.source, tokens, profile))
  return {
    platform: profile?.platform,
    valid: diagnostics.every(diagnostic => diagnostic.severity !== 'error'),
    diagnostics,
    tokens,
    elements: tokens.filter((token): token is TemplateTag => token.kind === 'tag' && !token.closing),
    expressions: collectTemplateExpressions(input.source, tokens),
    ...collectTemplateMetadata(input.source, tokens, profile),
  }
}
