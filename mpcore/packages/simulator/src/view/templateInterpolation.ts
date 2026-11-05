import { expressionEnd, TemplateLexicalError } from '@weapp-vite/wxml/core'

/** 共享词法边界，保留历史上不完整绑定按字面量显示、闭合但无效表达式交给求值层的行为。 */
export function templateInterpolations(source: string) {
  const ranges: Array<{ start: number, end: number, expression: string }> = []
  let offset = 0
  while (offset < source.length) {
    const start = source.indexOf('{{', offset)
    if (start < 0) {
      break
    }
    let end: number
    try {
      end = expressionEnd(source, start)
    }
    catch (error) {
      if (!(error instanceof TemplateLexicalError)) {
        throw error
      }
      if (!error.recovery) {
        break
      }
      end = error.recovery.end
    }
    ranges.push({ start, end, expression: source.slice(start + 2, end - 2) })
    offset = end
  }
  return ranges
}

export function isTemplateExpression(value: string) {
  const trimmed = value.trim()
  const ranges = templateInterpolations(trimmed)
  return ranges.length === 1 && ranges[0]!.start === 0 && ranges[0]!.end === trimmed.length
}
