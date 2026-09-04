import type {
  AttributeNode,
  ElementNode,
  TextNode,
} from '@vue/compiler-core'
import type { TransformContext, TransformNode } from './types'
import { NodeTypes } from '@vue/compiler-core'
import { escapeWxmlText } from '@weapp-core/shared'
import { recordBindingExpression } from './bindingManifest'
import { transformElement } from './elements'
import { normalizeWxmlExpressionWithContext } from './expression'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from './expression/runtimeBinding'
import { renderMustache } from './mustache'

const NATIVE_FOR_EXPRESSION_RE = /^\s*\{\{([\s\S]+)\}\}\s*$/

function getNativeForAttribute(node: ElementNode, name: string) {
  return node.props.find((prop): prop is AttributeNode => prop.type === NodeTypes.ATTRIBUTE && prop.name === name)
}

function transformElementWithNativeForScope(node: ElementNode, context: TransformContext, transformChild: TransformNode) {
  const forAttr = getNativeForAttribute(node, context.platform.directives.forAttr)
  const match = forAttr?.value?.content.match(NATIVE_FOR_EXPRESSION_RE)
  const listExpression = match?.[1]?.trim()
  if (!listExpression) {
    return transformElement(node, context, transformChild)
  }

  const item = getNativeForAttribute(node, context.platform.directives.forItemAttr)?.value?.content.trim() || 'item'
  const index = getNativeForAttribute(node, context.platform.directives.forIndexAttr)?.value?.content.trim() || 'index'
  context.forStack.push({
    item,
    index,
    listExp: listExpression,
    rawListExp: listExpression,
  })
  context.scopeStack.push(new Set([item, index]))
  try {
    return transformElement(node, context, transformChild)
  }
  finally {
    context.scopeStack.pop()
    context.forStack.pop()
  }
}

function transformText(node: TextNode, _context: TransformContext): string {
  return escapeWxmlText(node.content)
}

function transformInterpolation(node: any, context: TransformContext): string {
  const { content } = node
  if (content.type === NodeTypes.SIMPLE_EXPRESSION) {
    const rawExpValue = content.content
    const runtimeExp = shouldFallbackToRuntimeBinding(rawExpValue, context.templateSafeCallNames)
      ? registerRuntimeBindingExpression(rawExpValue, context, { hint: '插值表达式' })
      : null
    recordBindingExpression(context, {
      kind: 'text',
      expression: rawExpValue,
      outputPath: runtimeExp?.split('[')[0],
      sourceLocation: content.loc,
    })
    const expValue = runtimeExp ?? normalizeWxmlExpressionWithContext(rawExpValue, context)
    return renderMustache(expValue, context)
  }
  /* istanbul ignore next */
  return renderMustache('', context)
}

export function transformNode(node: any, context: TransformContext): string {
  switch (node.type) {
    case NodeTypes.ELEMENT:
      return transformElementWithNativeForScope(node, context, transformNode)

    case NodeTypes.TEXT:
      return transformText(node, context)

    case NodeTypes.INTERPOLATION:
      return transformInterpolation(node, context)

    case NodeTypes.COMMENT:
      // 注释默认移除
      return ''

    default:
      // 未知节点类型，返回空字符串
      /* istanbul ignore next */
      return ''
  }
}
