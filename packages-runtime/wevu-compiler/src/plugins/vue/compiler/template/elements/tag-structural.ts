import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { transformBindDirective } from '../directives/bind'
import { normalizeJsExpressionWithContext, normalizeWxmlExpressionWithContext } from '../expression'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from '../expression/runtimeBinding'
import { resolveTemplateTagName } from '../htmlTagMapping'
import { renderMustache } from '../mustache'
import { collectElementAttributes } from './attrs'
import { findSlotDirective, FOR_ITEM_ALIAS_PLACEHOLDER, parseForExpression, withForScope, withScope } from './helpers'
import { shouldTransformAsComponentWithSlots, transformComponentWithSlots } from './tag-component'
import { transformNormalElement } from './tag-normal'
import { transformSlotElement } from './tag-slot'

const REGEX_SPECIAL_CHARS_RE = /[.*+?^${}()|[\]\\]/g

function resolveConditionExpression(rawExpValue: string, context: TransformContext, hint: string) {
  const runtimeExp = (context.rewriteScopedSlot || shouldFallbackToRuntimeBinding(rawExpValue))
    ? registerRuntimeBindingExpression(rawExpValue, context, { hint })
    : null
  return runtimeExp ?? normalizeWxmlExpressionWithContext(rawExpValue, context)
}

function resolveListExpression(rawExpValue: string, context: TransformContext, hint: string) {
  const runtimeExp = (context.rewriteScopedSlot || shouldFallbackToRuntimeBinding(rawExpValue))
    ? registerRuntimeBindingExpression(rawExpValue, context, { hint })
    : null
  return runtimeExp ?? normalizeWxmlExpressionWithContext(rawExpValue, context)
}

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
  const content = elementWithoutIf.tag === 'slot'
    ? transformSlotElement(elementWithoutIf as ElementNode, context, transformNode)
    : slotDirective || templateSlotChildren.length > 0
      ? transformComponentWithSlots(elementWithoutIf as ElementNode, context, transformNode)
      : transformNormalElement(elementWithoutIf as ElementNode, context, transformNode)

  const dir = ifDirective as DirectiveNode
  if (dir.name === 'if' && dir.exp) {
    const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
    const expValue = resolveConditionExpression(rawExpValue, context, 'v-if')
    return context.platform.wrapIf(expValue, content, renderTemplateMustache)
  }
  else if (dir.name === 'else-if' && dir.exp) {
    const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
    const expValue = resolveConditionExpression(rawExpValue, context, 'v-else-if')
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
  if (forInfo.item === FOR_ITEM_ALIAS_PLACEHOLDER) {
    const generatedItem = `__wv_item_${context.forIndexSeed++}`
    forInfo.item = generatedItem
    if (forInfo.itemAliases) {
      const escaped = FOR_ITEM_ALIAS_PLACEHOLDER.replace(REGEX_SPECIAL_CHARS_RE, '\\$&')
      const placeholderRE = new RegExp(`\\b${escaped}\\b`, 'g')
      forInfo.itemAliases = Object.fromEntries(
        Object.entries(forInfo.itemAliases).map(([alias, expression]) => {
          return [alias, expression.replace(placeholderRE, generatedItem)]
        }),
      )
    }
  }
  if (context.classStyleRuntime === 'js' && !forInfo.index) {
    forInfo.index = `__wv_index_${context.forIndexSeed++}`
  }
  const listExp = forInfo.listExp
    ? resolveListExpression(forInfo.listExp, context, 'v-for 列表')
    : undefined
  const listExpAst = forInfo.listExp
    ? normalizeJsExpressionWithContext(forInfo.listExp, context, { hint: 'v-for 列表' })
    : undefined
  const scopedForInfo: ForParseResult = listExp
    ? { ...forInfo, listExp, listExpAst: listExpAst ?? undefined }
    : { ...forInfo, listExpAst: listExpAst ?? undefined }
  const scopeNames = [
    forInfo.item,
    forInfo.index,
    forInfo.key,
    ...Object.keys(forInfo.itemAliases ?? {}),
  ].filter(Boolean) as string[]

  return withForScope(context, scopedForInfo, () => withScope(context, scopeNames, () => {
    const otherProps = node.props.filter(prop => prop !== forDirective)
    const elementWithoutFor: ElementNode = { ...node, props: otherProps }

    const extraAttrs: string[] = listExp
      ? context.platform.forAttrs(listExp, renderTemplateMustache, forInfo.item, forInfo.index)
      : []

    if (elementWithoutFor.tag === 'slot') {
      const keyDirective = elementWithoutFor.props.find((prop): prop is DirectiveNode => {
        return prop.type === NodeTypes.DIRECTIVE
          && prop.name === 'bind'
          && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
          && prop.arg.content === 'key'
      })
      const slotElementWithoutForKey: ElementNode = {
        ...elementWithoutFor,
        props: elementWithoutFor.props.filter((prop) => {
          return prop !== keyDirective
        }),
      }
      const content = transformSlotElement(slotElementWithoutForKey, context, transformNode)
      const keyAttr = keyDirective ? transformBindDirective(keyDirective, context, forInfo) : null
      if (keyAttr) {
        extraAttrs.push(keyAttr)
      }
      const attrString = extraAttrs.length ? ` ${extraAttrs.join(' ')}` : ''
      return attrString ? `<block${attrString}>${content}</block>` : content
    }

    const resolvedTag = resolveTemplateTagName(elementWithoutFor.tag, context)
    if (shouldTransformAsComponentWithSlots(elementWithoutFor, context, resolvedTag)) {
      return transformComponentWithSlots(elementWithoutFor, context, transformNode, { extraAttrs, forInfo })
    }

    const { attrs, vTextExp } = collectElementAttributes(elementWithoutFor, context, {
      forInfo,
      extraAttrs,
      resolvedTag,
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

    const tag = resolvedTag
    const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

    return children
      ? `<${tag}${attrString}>${children}</${tag}>`
      : `<${tag}${attrString} />`
  }))
}
