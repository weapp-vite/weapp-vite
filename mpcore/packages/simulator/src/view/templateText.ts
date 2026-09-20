import { resolveTemplateExpression } from './templateExpression'

const TEMPLATE_INTERPOLATION_RE = /\{\{([^{}]+)\}\}/g

export function interpolateTemplateText(input: string, data: Record<string, any>) {
  return input.replace(TEMPLATE_INTERPOLATION_RE, (_match, expression: string) => {
    const value = resolveTemplateExpression(data, expression)
    return value === undefined ? '' : String(value)
  })
}
