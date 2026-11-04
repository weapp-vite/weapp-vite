import type { Syntax } from '@weapp-vite/wxml'
import type { TemplateExpression, TemplateToken } from './types'
import { expressionEnd } from '@weapp-vite/wxml'
import { scanTemplate } from './scanner'

/** 沿用已扫描的 token 与方言；属性引号仅供内部语义校验使用。 */
export function visitTemplateExpressions(source: string, tokens: TemplateToken[], syntax: Syntax, visit: (expression: TemplateExpression, quote?: string) => void): void {
  const ranges = tokens.flatMap(token => token.kind === 'text'
    ? [{ start: token.start, end: token.end, quote: undefined }]
    : token.kind === 'tag'
      ? token.attributes.filter(attribute => attribute.valueStart !== undefined).map(attribute => ({ start: attribute.valueStart!, end: attribute.valueEnd!, quote: attribute.quote }))
      : [])
  for (const range of ranges) {
    let cursor = range.start
    while (cursor < range.end) {
      const start = source.indexOf('{{', cursor)
      if (start < 0 || start >= range.end) {
        break
      }
      const end = expressionEnd(source, start, true, syntax, range.quote)
      visit({ start: start + 2, end: end - 2, fullStart: start, fullEnd: end, source: source.slice(start + 2, end - 2) }, range.quote)
      cursor = end
    }
  }
}

/** 保留原始表达式与 UTF-16 范围，不扫描脚本、注释或 CDATA 中的相似字符。 */
export function collectTemplateExpressions(source: string, tokens: TemplateToken[], syntax: Syntax = 'xml'): TemplateExpression[] {
  const expressions: TemplateExpression[] = []
  visitTemplateExpressions(source, tokens, syntax, expression => expressions.push(expression))
  return expressions.sort((left, right) => left.start - right.start)
}

/** 为编辑器提供词法准确的表达式区间；不完整文档只返回已安全读取的范围。 */
export function getTemplateExpressions(source: string): TemplateExpression[] {
  const result = scanTemplate(source)
  return collectTemplateExpressions(source, result.tokens)
}
