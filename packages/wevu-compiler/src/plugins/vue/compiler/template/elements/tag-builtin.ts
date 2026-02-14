import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from '../expression/runtimeBinding'
import { renderMustache } from '../mustache'
import { transformNormalElement } from './tag-normal'
import { transformForElement, transformIfElement } from './tag-structural'

function resolveConditionExpression(rawExpValue: string, context: TransformContext, hint: string) {
  const runtimeExp = shouldFallbackToRuntimeBinding(rawExpValue)
    ? registerRuntimeBindingExpression(rawExpValue, context, { hint })
    : null
  return runtimeExp ?? normalizeWxmlExpressionWithContext(rawExpValue, context)
}

export function transformTransitionElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  context.warnings.push(
    '<transition> 组件：过渡效果需要动画库或运行时支持，仅渲染子节点。',
  )

  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  if (node.children.length === 1) {
    return children
  }

  return children || ''
}

export function transformKeepAliveElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  context.warnings.push(
    '<keep-alive> 组件：需要运行时状态管理，渲染子节点并添加标记。',
  )

  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  return `<block data-keep-alive="true">${children}</block>`
}

export function transformTemplateElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const renderTemplateMustache = (exp: string) => renderMustache(exp, context)
  let nameAttr = ''
  let isAttr = ''
  let dataAttr = ''
  let hasOtherDirective = false
  let structuralDirective: DirectiveNode | undefined

  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (prop.name === 'slot') {
        context.warnings.push('<template v-slot> 应作为组件元素的子节点；已忽略。')
        continue
      }
      hasOtherDirective = true
      if (!structuralDirective && (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else' || prop.name === 'for')) {
        structuralDirective = prop
      }
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name') {
      nameAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'is') {
      isAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'data') {
      dataAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
  }

  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  if (!nameAttr && !isAttr && !dataAttr) {
    if (structuralDirective?.name === 'for') {
      return transformForElement({ ...node, tag: 'block' } as ElementNode, context, transformNode)
    }
    if (structuralDirective && (structuralDirective.name === 'if' || structuralDirective.name === 'else-if' || structuralDirective.name === 'else')) {
      const dir = structuralDirective
      const base = node.props.filter(prop => prop !== dir)
      const fakeNode: ElementNode = { ...node, tag: 'block', props: base }
      if (dir.name === 'if' && dir.exp) {
        const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
        const expValue = resolveConditionExpression(rawExpValue, context, 'template v-if')
        return context.platform.wrapIf(expValue, children, renderTemplateMustache)
      }
      if (dir.name === 'else-if' && dir.exp) {
        const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
        const expValue = resolveConditionExpression(rawExpValue, context, 'template v-else-if')
        return context.platform.wrapElseIf(expValue, children, renderTemplateMustache)
      }
      if (dir.name === 'else') {
        return context.platform.wrapElse(children)
      }
      return transformIfElement(fakeNode, context, transformNode)
    }
    if (hasOtherDirective) {
      return transformNormalElement(node, context, transformNode).replace(/<template/g, '<block').replace(/<\/template>/g, '</block>')
    }
    return children
  }

  const attrs: string[] = []
  if (nameAttr) {
    attrs.push(`name="${nameAttr}"`)
  }
  if (isAttr) {
    attrs.push(`is="${isAttr}"`)
  }
  if (dataAttr) {
    attrs.push(`data="${dataAttr}"`)
  }

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''
  return `<template${attrString}>${children}</template>`
}
