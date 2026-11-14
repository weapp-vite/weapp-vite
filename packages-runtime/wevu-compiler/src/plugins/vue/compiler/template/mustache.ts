import type { TransformContext } from './types'

export function renderMustache(expression: string, context: Pick<TransformContext, 'mustacheInterpolation'>): string {
  if (context.mustacheInterpolation === 'spaced') {
    return `{{ ${expression} }}`
  }

  const compactExpression = expression.endsWith('}') ? `${expression} ` : expression
  return `{{${compactExpression}}}`
}
