import type { Syntax } from '@weapp-vite/wxml'
import type { LanguageProfile } from '../profiles'
import type { Diagnostic } from '../types'
import type { TemplateTag, TemplateToken } from './types'
import { scan } from '@weapp-vite/wxml'
import { findScriptClosingTag } from '../script/scanner'

const compatibilityRawTags = ['wxs', 'sjs', 'ks', 'filter', 'script', 'import-sjs'] as const

/** 未识别平台的兼容入口保留原有集合；已知平台只使用已解析的 profile。 */
export function templateRawTags(profile?: LanguageProfile): readonly string[] {
  return profile?.rawTags ?? compatibilityRawTags
}

/** 显式方言独立于平台选择；没有平台上下文的公开词法接口保持 XML。 */
export function templateSyntax(profile?: LanguageProfile, syntax?: Syntax): Syntax {
  return syntax ?? (profile?.platform === 'weapp' ? 'legacy' : 'xml')
}

/** 分析和格式化共享平台、方言及 AST 边界校验，并保留可变结果数组契约。 */
export function scanTemplateWithProfile(source: string, profile?: LanguageProfile, syntax = templateSyntax(profile)): { tokens: TemplateToken[], diagnostics: Diagnostic[] } {
  const result = scan(source, { platform: profile?.platform, syntax, rawTags: templateRawTags(profile), resolveScriptBoundary: findScriptClosingTag })
  for (const token of result.tokens) {
    if (token.kind === 'tag' && !token.attributes.length) {
      // 基础包复用冻结空数组；每个语言服务标签需要独立的可变属性列表。
      ;(token as TemplateTag).attributes = []
    }
  }
  return result as { tokens: TemplateToken[], diagnostics: Diagnostic[] }
}

/** 公开兼容入口固定使用 XML 与历史原文标签集合。 */
export function scanTemplate(source: string): { tokens: TemplateToken[], diagnostics: Diagnostic[] } {
  return scanTemplateWithProfile(source, undefined, 'xml')
}
