import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { warn } from '../diagnostics'
import { rejectUnsupportedDynamicBindName, transformBindDirective } from './bind'
import { transformCustomDirective } from './custom'
import { transformModelDirective } from './model'
import { rejectUnsupportedDynamicOnName, transformOnDirective } from './on'
import { transformShowDirective } from './show'

export function omitUnsupportedDynamicDirectiveNames(
  node: ElementNode,
  context: TransformContext,
): ElementNode {
  let compatibleProps: ElementNode['props'] | undefined
  for (let index = 0; index < node.props.length; index++) {
    const prop = node.props[index]!
    const rejected = prop.type === NodeTypes.DIRECTIVE && (
      (prop.name === 'bind' && rejectUnsupportedDynamicBindName(prop, context))
      || (prop.name === 'on' && rejectUnsupportedDynamicOnName(prop, context))
    )
    if (rejected) {
      compatibleProps ??= node.props.slice(0, index)
      continue
    }
    compatibleProps?.push(prop)
  }
  return compatibleProps ? { ...node, props: compatibleProps } : node
}

export function transformDirective(
  node: DirectiveNode,
  context: TransformContext,
  elementNode?: ElementNode,
  forInfo?: ForParseResult,
  options?: {
    isComponent?: boolean
  },
): string | null {
  const { name, exp, arg } = node

  if (name === 'bind') {
    return transformBindDirective(node, context, forInfo, options)
  }

  if (name === 'on') {
    return transformOnDirective(node, context, {
      ...options,
      tagName: elementNode?.tag,
    })
  }

  if (name === 'model') {
    return transformModelDirective(node, context, elementNode, options)
  }

  if (name === 'show') {
    return transformShowDirective(node, context)
  }

  if (name === 'html') {
    warn(context, '小程序不支持 v-html，请使用 rich-text 组件替代。', node.loc)
    return null
  }

  if (name === 'cloak') {
    return null
  }

  if (name === 'once') {
    warn(context, '小程序对 v-once 支持不完整，元素将按普通方式渲染。', node.loc)
    return null
  }

  return transformCustomDirective(name, exp, arg, context, node.loc)
}
