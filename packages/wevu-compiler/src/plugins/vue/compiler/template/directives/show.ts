import type { DirectiveNode } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext } from '../expression'

export function transformShowDirective(node: DirectiveNode, context: TransformContext): string | null {
  const { exp } = node
  if (!exp) {
    return null
  }
  const rawExpValue = exp.type === NodeTypes.SIMPLE_EXPRESSION ? exp.content : ''
  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
  return `style="{{${expValue} ? '' : 'display: none'}}"`
}
