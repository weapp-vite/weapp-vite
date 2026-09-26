import { resolveTemplateExpression } from './templateExpression'
import { templateInterpolations } from './templateInterpolation'

export function interpolateTemplateText(input: string, data: Record<string, any>, emptyNull = false) {
  let output = ''
  let offset = 0
  for (const range of templateInterpolations(input)) {
    const value = resolveTemplateExpression(data, range.expression)
    output += input.slice(offset, range.start) + (value === undefined || (emptyNull && value === null) ? '' : String(value))
    offset = range.end
  }
  return output + input.slice(offset)
}
