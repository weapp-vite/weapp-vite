import type { AttributeNode, DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'

import { recordBindingExpression } from '../bindingManifest'
import { warn } from '../diagnostics'
import { transformNormalElement } from './tag-normal'
import { transformForElement, transformIfElement } from './tag-structural'

const TEMPLATE_OPEN_RE = /<template/g
const TEMPLATE_CLOSE_RE = /<\/template>/g
const MUSTACHE_EXPRESSION_RE = /\{\{([\s\S]*?)\}\}/g
const TEMPLATE_DATA_SPREAD_RE = /^\.\.\./

function recordTemplateAttributeBindings(
  prop: AttributeNode,
  context: TransformContext,
) {
  const value = prop.value?.content
  if (!value?.includes('{{')) {
    return
  }
  for (const match of value.matchAll(MUSTACHE_EXPRESSION_RE)) {
    const expression = match[1]?.trim().replace(TEMPLATE_DATA_SPREAD_RE, '')
    if (!expression) {
      continue
    }
    recordBindingExpression(context, {
      kind: 'attribute',
      expression,
      sourceLocation: prop.value?.loc,
    })
  }
}

export function transformTransitionElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  warn(context, '<transition> 组件：过渡效果需要动画库或运行时支持，仅渲染子节点。', node.loc)

  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  if (node.children.length === 1) {
    return children
  }

  return children || ''
}

export function transformKeepAliveElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  warn(context, '<keep-alive> 组件：需要运行时状态管理，渲染子节点并添加标记。', node.loc)

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
        warn(context, '<template v-slot> 应作为组件元素的子节点；已忽略。', prop.loc)
        continue
      }
      hasOtherDirective = true
      if (!structuralDirective && (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else' || prop.name === 'for')) {
        structuralDirective = prop
      }
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name') {
      recordTemplateAttributeBindings(prop, context)
      nameAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'is') {
      recordTemplateAttributeBindings(prop, context)
      isAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'data') {
      recordTemplateAttributeBindings(prop, context)
      dataAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
  }

  if (!nameAttr && !isAttr && !dataAttr) {
    if (structuralDirective?.name === 'for') {
      return transformForElement({ ...node, tag: 'block' } as ElementNode, context, transformNode)
    }
    if (structuralDirective && ['if', 'else-if', 'else'].includes(structuralDirective.name)) {
      return transformIfElement(node, context, transformNode)
    }
    if (hasOtherDirective) {
      return transformNormalElement(node, context, transformNode).replace(TEMPLATE_OPEN_RE, '<block').replace(TEMPLATE_CLOSE_RE, '</block>')
    }
    return node.children.map(child => transformNode(child, context)).join('')
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
  const children = node.children.map(child => transformNode(child, context)).join('')
  return `<template${attrString}>${children}</template>`
}
