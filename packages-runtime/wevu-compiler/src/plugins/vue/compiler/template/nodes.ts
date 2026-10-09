import type {
  AttributeNode,
  ElementNode,
  TextNode,
} from '@vue/compiler-core'
import type { ForParseResult, TransformContext, TransformNode } from './types'
import { NodeTypes } from '@vue/compiler-core'
import { escapeWxmlText } from '@weapp-core/shared'
import { recordBindingExpression } from './bindingManifest'
import { transformElement } from './elements'
import { withForScope, withScope } from './elements/helpers'
import { normalizeJsExpressionWithContext, normalizeWxmlExpressionWithContext } from './expression'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from './expression/runtimeBinding'
import { renderMustache } from './mustache'
import { normalizeNativeForAliases, usesNativeDeclarationContext } from './nativeDeclaration'

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
  const info: ForParseResult = {
    item,
    index,
    listExp: listExpression,
    rawListExp: listExpression,
  }
  let renderNode = node
  if (usesNativeDeclarationContext(context)) {
    info.listExpAst = normalizeJsExpressionWithContext(listExpression, context, { hint: '原生循环列表' }) ?? undefined
    info.rawListExpAst = context.forStack.some(scope => scope.itemAccess)
      ? normalizeJsExpressionWithContext(listExpression, {
        ...context,
        forStack: context.forStack.map(scope => ({ ...scope, itemAccess: undefined })),
      }, { hint: '原生循环原始列表' }) ?? undefined
      : info.listExpAst
    info.listExp = normalizeWxmlExpressionWithContext(listExpression, context)
    const key = getNativeForAttribute(node, context.platform.directives.keyAttr)?.value?.content
    info.effectiveNativeKey = key === undefined
      ? { kind: 'position' }
      : key === context.platform.keyThisValue ? { kind: 'self' } : { kind: 'field', field: key }
    normalizeNativeForAliases(info, context)
    const nativeAttrs = {
      [context.platform.directives.forAttr]: renderMustache(info.listExp, context),
      [context.platform.directives.forItemAttr]: info.item!,
      [context.platform.directives.forIndexAttr]: info.index!,
    }
    renderNode = {
      ...node,
      props: [
        ...node.props.filter(prop => prop.type !== NodeTypes.ATTRIBUTE || !(prop.name in nativeAttrs)),
        ...Object.entries(nativeAttrs).map(([name, content]): AttributeNode => ({
          ...forAttr!,
          name,
          value: { ...forAttr!.value!, content },
        })),
      ],
    }
  }
  const names = [info.item!, info.index!, ...Object.keys(info.itemAliases ?? {})]
  return withForScope(context, info, () => withScope(context, names, () => transformElement(renderNode, context, transformChild)))
}

function transformText(node: TextNode, _context: TransformContext): string {
  return escapeWxmlText(node.content)
}

function transformInterpolation(node: any, context: TransformContext): string {
  const { content } = node
  if (content.type === NodeTypes.SIMPLE_EXPRESSION) {
    const rawExpValue = content.content
    const runtimeExp = shouldFallbackToRuntimeBinding(rawExpValue, context.templateSafeCallNames, context)
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
      return context.preserveComments ? `<!--${node.content}-->` : ''

    default:
      // 未知节点类型，返回空字符串
      /* istanbul ignore next */
      return ''
  }
}
