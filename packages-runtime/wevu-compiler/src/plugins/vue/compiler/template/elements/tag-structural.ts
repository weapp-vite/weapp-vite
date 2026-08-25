import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { transformBindDirective } from '../directives/bind'
import { createForKeyProjection, resolveNativeForKeyValue } from '../directives/forKey'
import { normalizeJsExpressionWithContext, normalizeWxmlExpressionWithContext } from '../expression'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from '../expression/runtimeBinding'
import { resolveTemplateTagName } from '../htmlTagMapping'
import { renderMustache } from '../mustache'
import { collectElementAttributes } from './attrs'
import { findSlotDirective, FOR_ITEM_ALIAS_PLACEHOLDER, getBindDirectiveExpression, parseForExpression, withForScope, withScope } from './helpers'
import { shouldTransformAsComponentWithSlots, transformComponentWithSlots } from './tag-component'
import { transformNormalElement } from './tag-normal'
import { transformSlotElement } from './tag-slot'

const REGEX_SPECIAL_CHARS_RE = /[.*+?^${}()|[\]\\]/g

function resolveConditionExpression(rawExpValue: string, context: TransformContext, hint: string) {
  const runtimeExp = (context.rewriteScopedSlot || shouldFallbackToRuntimeBinding(rawExpValue, context.templateSafeCallNames))
    ? registerRuntimeBindingExpression(rawExpValue, context, { hint })
    : null
  return runtimeExp ?? normalizeWxmlExpressionWithContext(rawExpValue, context)
}

function resolveListExpression(rawExpValue: string, context: TransformContext, hint: string) {
  const runtimeExp = (context.rewriteScopedSlot || shouldFallbackToRuntimeBinding(rawExpValue, context.templateSafeCallNames))
    ? registerRuntimeBindingExpression(rawExpValue, context, { hint })
    : null
  return runtimeExp ?? normalizeWxmlExpressionWithContext(rawExpValue, context)
}

function requiresRuntimeForKeyProjection(node: ElementNode, context: TransformContext): boolean {
  const forDirective = node.props.find((prop): prop is DirectiveNode => {
    return prop.type === NodeTypes.DIRECTIVE && prop.name === 'for'
  })
  const keyDirective = node.props.find((prop): prop is DirectiveNode => {
    return prop.type === NodeTypes.DIRECTIVE
      && prop.name === 'bind'
      && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
      && prop.arg.content === 'key'
  })
  if (forDirective?.exp?.type === NodeTypes.SIMPLE_EXPRESSION && keyDirective) {
    const forInfo = parseForExpression(forDirective.exp.content)
    const rawKeyExp = getBindDirectiveExpression(keyDirective).trim()
    if (rawKeyExp && !resolveNativeForKeyValue(rawKeyExp, forInfo, context.platform.keyThisValue)) {
      return true
    }
  }
  return node.children.some((child) => {
    return child.type === NodeTypes.ELEMENT
      && requiresRuntimeForKeyProjection(child as ElementNode, context)
  })
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
  if ((context.classStyleRuntime === 'js' || requiresRuntimeForKeyProjection(node, context)) && !forInfo.index) {
    forInfo.index = `__wv_index_${context.forIndexSeed++}`
  }
  const rawListExp = forInfo.listExp?.trim()
  const listExp = forInfo.listExp
    ? resolveListExpression(forInfo.listExp, context, 'v-for 列表')
    : undefined
  const listExpAst = forInfo.listExp
    ? normalizeJsExpressionWithContext(forInfo.listExp, context, { hint: 'v-for 列表' })
    : undefined
  const scopedForInfo: ForParseResult = listExp
    ? { ...forInfo, listExp, rawListExp, listExpAst: listExpAst ?? undefined }
    : { ...forInfo, rawListExp, listExpAst: listExpAst ?? undefined }
  const scopeNames = [
    forInfo.item,
    forInfo.index,
    forInfo.key,
    ...Object.keys(forInfo.itemAliases ?? {}),
  ].filter(Boolean) as string[]

  return withForScope(context, scopedForInfo, () => withScope(context, scopeNames, () => {
    const otherProps = node.props.filter(prop => prop !== forDirective)
    const elementWithoutFor: ElementNode = { ...node, props: otherProps }
    const keyDirective = otherProps.find((prop): prop is DirectiveNode => {
      return prop.type === NodeTypes.DIRECTIVE
        && prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'key'
    })
    const keyProjection = keyDirective
      ? createForKeyProjection(keyDirective, scopedForInfo, context)
      : null
    if (keyProjection) {
      scopedForInfo.itemAccess = keyProjection.itemAccess
      const currentForInfo = context.forStack[context.forStack.length - 1]
      if (currentForInfo) {
        currentForInfo.itemAccess = keyProjection.itemAccess
      }
    }
    const renderElement: ElementNode = keyProjection
      ? {
          ...elementWithoutFor,
          props: otherProps.filter(prop => prop !== keyDirective),
        }
      : elementWithoutFor
    const templateListExp = keyProjection?.listExp ?? listExp
    const extraAttrs: string[] = templateListExp
      ? context.platform.forAttrs(templateListExp, renderTemplateMustache, forInfo.item, forInfo.index)
      : []
    if (keyProjection) {
      extraAttrs.push(keyProjection.keyAttr)
    }

    if (renderElement.tag === 'slot') {
      const slotKeyDirective = keyProjection ? undefined : keyDirective
      const slotElementWithoutForKey: ElementNode = {
        ...renderElement,
        props: renderElement.props.filter(prop => prop !== slotKeyDirective),
      }
      const content = transformSlotElement(slotElementWithoutForKey, context, transformNode)
      const keyAttr = slotKeyDirective
        ? transformBindDirective(slotKeyDirective, context, scopedForInfo)
        : null
      if (keyAttr) {
        extraAttrs.push(keyAttr)
      }
      const attrString = extraAttrs.length ? ` ${extraAttrs.join(' ')}` : ''
      return attrString ? `<block${attrString}>${content}</block>` : content
    }

    const resolvedTag = resolveTemplateTagName(renderElement.tag, context)
    if (shouldTransformAsComponentWithSlots(renderElement, context, resolvedTag)) {
      return transformComponentWithSlots(renderElement, context, transformNode, {
        extraAttrs,
        forInfo: scopedForInfo,
      })
    }

    const { attrs, vTextExp } = collectElementAttributes(renderElement, context, {
      forInfo: scopedForInfo,
      extraAttrs,
      resolvedTag,
    })

    let children = ''
    if (renderElement.children.length > 0) {
      children = renderElement.children
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
