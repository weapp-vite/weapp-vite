import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext } from '../types'
import { transformBindDirective } from './bind'
import { transformCustomDirective } from './custom'
import { transformModelDirective } from './model'
import { transformOnDirective } from './on'
import { transformShowDirective } from './show'

export function transformDirective(
  node: DirectiveNode,
  context: TransformContext,
  elementNode?: ElementNode,
  forInfo?: ForParseResult,
): string | null {
  const { name, exp, arg } = node

  if (name === 'bind') {
    return transformBindDirective(node, context, forInfo)
  }

  if (name === 'on') {
    return transformOnDirective(node, context)
  }

  if (name === 'model') {
    return transformModelDirective(node, context, elementNode)
  }

  if (name === 'show') {
    return transformShowDirective(node, context)
  }

  if (name === 'html') {
    context.warnings.push('v-html is not supported in mini-programs, use rich-text component instead')
    return null
  }

  if (name === 'cloak') {
    return null
  }

  if (name === 'once') {
    context.warnings.push('v-once is not fully supported in mini-programs, the element will render normally')
    return null
  }

  return transformCustomDirective(name, exp, arg, context)
}
