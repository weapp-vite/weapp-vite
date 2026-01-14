import type { ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { renderClassAttribute, renderStyleAttribute, transformAttribute } from '../attributes'
import { transformDirective } from '../directives'
import { normalizeWxmlExpressionWithContext } from '../expression'

export function collectElementAttributes(
  node: ElementNode,
  context: TransformContext,
  options?: { forInfo?: ForParseResult, skipSlotDirective?: boolean, extraAttrs?: string[] },
) {
  const { props } = node
  const attrs: string[] = options?.extraAttrs ? [...options.extraAttrs] : []
  let staticClass: string | undefined
  let dynamicClassExp: string | undefined
  let staticStyle: string | undefined
  let dynamicStyleExp: string | undefined
  let vShowExp: string | undefined
  let vTextExp: string | undefined

  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      if (prop.name === 'class' && prop.value?.type === NodeTypes.TEXT) {
        staticClass = prop.value.content
        continue
      }
      if (prop.name === 'style' && prop.value?.type === NodeTypes.TEXT) {
        staticStyle = prop.value.content
        continue
      }
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
      continue
    }
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (options?.skipSlotDirective && prop.name === 'slot') {
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'class'
        && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
      ) {
        dynamicClassExp = prop.exp.content
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'style'
        && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
      ) {
        dynamicStyleExp = prop.exp.content
        continue
      }
      if (prop.name === 'show' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        vShowExp = prop.exp.content
        continue
      }
      if (prop.name === 'text' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        vTextExp = normalizeWxmlExpressionWithContext(prop.exp.content, context)
        continue
      }
      const dir = transformDirective(prop, context, node, options?.forInfo)
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  const classAttr = renderClassAttribute(staticClass, dynamicClassExp, context)
  if (classAttr) {
    attrs.unshift(classAttr)
  }
  const styleAttr = renderStyleAttribute(
    staticStyle,
    dynamicStyleExp,
    vShowExp,
    context,
  )
  if (styleAttr) {
    attrs.unshift(styleAttr)
  }

  return { attrs, vTextExp }
}
