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
    context.warnings.push('小程序不支持 v-html，请使用 rich-text 组件替代。')
    return null
  }

  if (name === 'cloak') {
    return null
  }

  if (name === 'once') {
    context.warnings.push('小程序对 v-once 支持不完整，元素将按普通方式渲染。')
    return null
  }

  return transformCustomDirective(name, exp, arg, context)
}
