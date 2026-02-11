import type { TransformContext } from './types'

export function renderMustache(expression: string, context: Pick<TransformContext, 'mustacheInterpolation'>): string {
  return context.mustacheInterpolation === 'spaced'
    ? `{{ ${expression} }}`
    : `{{${expression}}}`
}
