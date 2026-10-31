import type { TemplateExpression, TemplateToken } from './types'
import { expressionEnd } from './expression'
import { scanTemplate } from './scanner'

/** 仅提取文本和属性中的插值，不扫描脚本、注释或 CDATA 内的相似字符。 */
export function collectTemplateExpressions(source: string, tokens: TemplateToken[]): TemplateExpression[] {
  const expressions: TemplateExpression[] = []
  const ranges = tokens.flatMap(token => token.kind === 'text'
    ? [token]
    : token.kind === 'tag'
      ? token.attributes.filter(attribute => attribute.valueStart !== undefined).map(attribute => ({ start: attribute.valueStart!, end: attribute.valueEnd! }))
      : [])
  for (const range of ranges) {
    let cursor = range.start
    while (cursor < range.end) {
      const start = source.indexOf('{{', cursor)
      if (start < 0 || start >= range.end) {
        break
      }
      const end = expressionEnd(source, start)
      expressions.push({ start: start + 2, end: end - 2, fullStart: start, fullEnd: end, source: source.slice(start + 2, end - 2) })
      cursor = end
    }
  }
  return expressions.sort((left, right) => left.start - right.start)
}

/** 为编辑器提供词法准确的表达式区间；不完整文档只返回已安全读取的范围。 */
export function getTemplateExpressions(source: string): TemplateExpression[] {
  const result = scanTemplate(source)
  return collectTemplateExpressions(source, result.tokens)
}
