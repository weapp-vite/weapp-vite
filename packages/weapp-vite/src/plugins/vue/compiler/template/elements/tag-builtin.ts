import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { transformNormalElement } from './tag-normal'
import { transformForElement, transformIfElement } from './tag-structural'

export function transformTransitionElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  context.warnings.push(
    '<transition> component: transitions require animation library or runtime support. Rendering children only.',
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
    '<keep-alive> component: requires runtime state management. Rendering children with marker.',
  )

  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  return `<block data-keep-alive="true">${children}</block>`
}

export function transformTemplateElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  let nameAttr = ''
  let isAttr = ''
  let dataAttr = ''
  let hasOtherDirective = false
  let structuralDirective: DirectiveNode | undefined

  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (prop.name === 'slot') {
        context.warnings.push('<template v-slot> should be a child of a component element; it was ignored.')
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
        const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
        return context.platform.wrapIf(expValue, children)
      }
      if (dir.name === 'else-if' && dir.exp) {
        const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
        const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
        return context.platform.wrapElseIf(expValue, children)
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
