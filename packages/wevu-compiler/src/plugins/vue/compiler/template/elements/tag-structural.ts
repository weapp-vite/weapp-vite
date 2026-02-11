import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeJsExpressionWithContext, normalizeWxmlExpressionWithContext } from '../expression'
import { renderMustache } from '../mustache'
import { collectElementAttributes } from './attrs'
import { findSlotDirective, parseForExpression, withForScope, withScope } from './helpers'
import { transformComponentWithSlots } from './tag-component'
import { transformNormalElement } from './tag-normal'

export function transformIfElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const renderTemplateMustache = (exp: string) => renderMustache(exp, context)
  const ifDirective = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE
      && (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else'),
  )

  if (!ifDirective) {
    /* istanbul ignore next */
    return transformNormalElement(node, context, transformNode)
  }

  const otherProps = node.props.filter(prop => prop !== ifDirective)
  const elementWithoutIf = { ...node, props: otherProps }

  const slotDirective = findSlotDirective(elementWithoutIf)
  const templateSlotChildren = elementWithoutIf.children.filter(
    child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
  )
  const content = slotDirective || templateSlotChildren.length > 0
    ? transformComponentWithSlots(elementWithoutIf as ElementNode, context, transformNode)
    : transformNormalElement(elementWithoutIf as ElementNode, context, transformNode)

  const dir = ifDirective as DirectiveNode
  if (dir.name === 'if' && dir.exp) {
    const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
    const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
    return context.platform.wrapIf(expValue, content, renderTemplateMustache)
  }
  else if (dir.name === 'else-if' && dir.exp) {
    const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
    const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
    return context.platform.wrapElseIf(expValue, content, renderTemplateMustache)
  }
  else if (dir.name === 'else') {
    return context.platform.wrapElse(content)
  }

  return content
}

export function transformForElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const renderTemplateMustache = (exp: string) => renderMustache(exp, context)
  const forDirective = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE && prop.name === 'for',
  ) as DirectiveNode | undefined

  if (!forDirective || !forDirective.exp) {
    return transformNormalElement(node, context, transformNode)
  }

  const expValue = forDirective.exp.type === NodeTypes.SIMPLE_EXPRESSION ? forDirective.exp.content : ''
  const forInfo = parseForExpression(expValue)
  if (context.classStyleRuntime === 'js' && !forInfo.index) {
    forInfo.index = `__wv_index_${context.forIndexSeed++}`
  }
  const listExp = forInfo.listExp ? normalizeWxmlExpressionWithContext(forInfo.listExp, context) : undefined
  const listExpAst = forInfo.listExp
    ? normalizeJsExpressionWithContext(forInfo.listExp, context, { hint: 'v-for 列表' })
    : undefined
  const scopedForInfo: ForParseResult = listExp
    ? { ...forInfo, listExp, listExpAst: listExpAst ?? undefined }
    : { ...forInfo, listExpAst: listExpAst ?? undefined }
  const scopeNames = [forInfo.item, forInfo.index, forInfo.key].filter(Boolean) as string[]

  return withForScope(context, scopedForInfo, () => withScope(context, scopeNames, () => {
    const otherProps = node.props.filter(prop => prop !== forDirective)
    const elementWithoutFor: ElementNode = { ...node, props: otherProps }

    const extraAttrs: string[] = listExp
      ? context.platform.forAttrs(listExp, renderTemplateMustache, forInfo.item, forInfo.index)
      : []

    const slotDirective = findSlotDirective(elementWithoutFor)
    const templateSlotChildren = elementWithoutFor.children.filter(
      child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
    )
    if (slotDirective || templateSlotChildren.length > 0) {
      return transformComponentWithSlots(elementWithoutFor, context, transformNode, { extraAttrs, forInfo })
    }

    const { attrs, vTextExp } = collectElementAttributes(elementWithoutFor, context, {
      forInfo,
      extraAttrs,
    })

    let children = ''
    if (elementWithoutFor.children.length > 0) {
      children = elementWithoutFor.children
        .map(child => transformNode(child, context))
        .join('')
    }
    if (vTextExp !== undefined) {
      children = renderMustache(vTextExp, context)
    }

    const { tag } = elementWithoutFor
    const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

    return children
      ? `<${tag}${attrString}>${children}</${tag}>`
      : `<${tag}${attrString} />`
  }))
}
