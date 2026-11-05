import type { Syntax, TemplateParser } from '@weapp-vite/wxml/core'
import type { LanguageProfile } from '../profiles'
import type { Diagnostic } from '../types'
import type { TemplateTag, TemplateToken } from './types'
import { compileDialect, createParser } from '@weapp-vite/wxml/core'
import { getTemplatePreset, weapp } from '@weapp-vite/wxml/presets'
import { findScriptClosingTag } from '../script/scanner'

const parsers = new WeakMap<readonly string[], { rawTags: readonly string[], bySyntax: Map<Syntax, TemplateParser> }>()

/** 未识别平台的兼容入口保留原有集合；已知平台只使用已解析的 profile。 */
export function templateRawTags(profile?: LanguageProfile): readonly string[] {
  return profile?.rawTags ?? weapp.compatibilityDialect.rawTags
}

/** 显式方言独立于平台选择；没有平台上下文的公开词法接口保持 XML。 */
export function templateSyntax(profile?: LanguageProfile, syntax?: Syntax): Syntax {
  return syntax ?? (profile ? getTemplatePreset(profile.platform).dialect.syntax : 'xml')
}

function parserFor(profile: LanguageProfile | undefined, syntax: Syntax): TemplateParser {
  const rawTags = templateRawTags(profile)
  let cached = parsers.get(rawTags)
  if (!cached || cached.rawTags.length !== rawTags.length || cached.rawTags.some((tag, index) => tag !== rawTags[index])) {
    cached = { rawTags: [...rawTags], bySyntax: new Map() }
    parsers.set(rawTags, cached)
  }
  let parser = cached.bySyntax.get(syntax)
  if (!parser) {
    parser = createParser(compileDialect({ id: `language-service:${syntax}`, syntax, rawTags }), { resolveScriptBoundary: findScriptClosingTag })
    cached.bySyntax.set(syntax, parser)
  }
  return parser
}

/** 分析和格式化共享平台、方言及 AST 边界校验，并保留可变结果数组契约。 */
export function scanTemplateWithProfile(source: string, profile?: LanguageProfile, syntax = templateSyntax(profile)): { tokens: TemplateToken[], diagnostics: Diagnostic[] } {
  const result = parserFor(profile, syntax).scan(source)
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
