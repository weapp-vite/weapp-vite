import type { Diagnostic } from '../types'
import type { TemplateTag, TemplateToken } from './types'
import { scan } from '@weapp-vite/wxml'
import { findScriptClosingTag } from '../script/scanner'

/** 复用共享 XML 词法结果，同时保留语言服务公开的可变数组契约。 */
export function scanTemplate(source: string): { tokens: TemplateToken[], diagnostics: Diagnostic[] } {
  const result = scan(source, { syntax: 'xml', resolveScriptBoundary: findScriptClosingTag })
  for (const token of result.tokens) {
    if (token.kind === 'tag' && !token.attributes.length) {
      // 基础包复用冻结空数组；每个语言服务标签需要独立的可变属性列表。
      ;(token as TemplateTag).attributes = []
    }
  }
  return result as { tokens: TemplateToken[], diagnostics: Diagnostic[] }
}
