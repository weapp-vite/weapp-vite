import type { Expression, JSXAttribute, JSXElement } from '@weapp-vite/ast/babelTypes'
import type { TeleportTargetInput } from '../../vue/compiler/template/teleport'
import type { JsxCompileContext, JsxDynamicIslandReason } from './types'
import { ROOT_PORTAL_ENABLE_MIN_SDK_VERSION } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { consumeBaseLibraryHint } from '../../../utils/baseLibrary'
import { resolveTeleportDecision, ROOT_PORTAL_BASE_LIBRARY_HINT_MESSAGE, ROOT_PORTAL_BASE_LIBRARY_HINT_TOPIC, TELEPORT_DEGRADE_CODES } from '../../vue/compiler/template/teleport'
import { normalizeInterpolationExpression, renderMustache } from './ast'
import { compileJsxAttributes, readJsxAttributeExpression } from './attributes'
import { recordJsxBinding } from './bindingManifest'
import { addJsxDiagnostic } from './diagnostics'
import { collectJsxDirectives } from './directives'

const ROOT_PORTAL_TAG = 'root-portal'
const TELEPORT_REMOVED_ATTRIBUTES = new Set(['to', 'defer', 'disabled', 'key'])

function findJsxAttribute(node: JSXElement, name: string): JSXAttribute | undefined {
  return node.openingElement.attributes.find(
    (attribute): attribute is JSXAttribute => t.isJSXAttribute(attribute)
      && t.isJSXIdentifier(attribute.name)
      && attribute.name.name === name,
  )
}

/**
 * 读取 JSX Teleport 的 to 输入：静态字符串可直接映射，其余形式一律降级。
 */
function resolveTeleportTarget(node: JSXElement): TeleportTargetInput {
  const attribute = findJsxAttribute(node, 'to')
  if (!attribute) {
    return { kind: 'missing' }
  }
  const expression = readJsxAttributeExpression(attribute.value)
  if (expression && t.isStringLiteral(expression)) {
    return { kind: 'static', value: expression.value }
  }
  return { kind: 'dynamic' }
}

/**
 * JSX `disabled` 与 root-portal `enable` 语义相反，需要整体取反。
 */
function resolveTeleportEnable(node: JSXElement, context: JsxCompileContext): string {
  const attribute = findJsxAttribute(node, 'disabled')
  if (!attribute) {
    return renderMustache('true', context)
  }
  const expression = readJsxAttributeExpression(attribute.value)
  if (!expression || (t.isBooleanLiteral(expression) && expression.value)) {
    return renderMustache('false', context)
  }
  if (t.isBooleanLiteral(expression)) {
    return renderMustache('true', context)
  }
  recordJsxBinding(context, expression, 'attribute')
  return renderMustache(`!(${normalizeInterpolationExpression(expression, context)})`, context)
}

function resolveTeleportPassthroughAttributes(node: JSXElement): JSXAttribute[] {
  const attributes: JSXAttribute[] = []
  for (const attribute of node.openingElement.attributes) {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)) {
      continue
    }
    const name = attribute.name.name
    if (name.startsWith('v-') || TELEPORT_REMOVED_ATTRIBUTES.has(name)) {
      continue
    }
    attributes.push(attribute)
  }
  return attributes
}

function hasTeleportClassOrStyle(attributes: JSXAttribute[]): boolean {
  return attributes.some(attribute => t.isJSXIdentifier(attribute.name)
    && (attribute.name.name === 'class' || attribute.name.name === 'className' || attribute.name.name === 'style'))
}

export function compileJsxTeleport(
  node: JSXElement,
  context: JsxCompileContext,
  compileJsxChildren: (children: JSXElement['children'], context: JsxCompileContext) => string,
  registerDynamicIsland: (node: Expression, context: JsxCompileContext, reason: JsxDynamicIslandReason) => string,
): string {
  const directives = collectJsxDirectives(node)
  const wrapIf = (content: string) => {
    const expression = directives.get('v-if')
    if (!expression) {
      return content
    }
    recordJsxBinding(context, expression, 'if')
    return context.platform.wrapIf(
      normalizeInterpolationExpression(expression, context),
      content,
      value => renderMustache(value, context),
    )
  }
  if (!context.teleport.enabled) {
    return wrapIf(compileJsxChildren(node.children, context))
  }

  const decision = resolveTeleportDecision({
    supportsRootPortal: context.platform.supportsRootPortal === true,
    to: resolveTeleportTarget(node),
    spread: node.openingElement.attributes.some(attribute => t.isJSXSpreadAttribute(attribute)),
  })
  if (decision.kind === 'degrade') {
    addJsxDiagnostic(context, node, TELEPORT_DEGRADE_CODES[decision.reason], decision.message, context.teleport.unsupported === 'error' ? 'error' : 'warning')
    return wrapIf(compileJsxChildren(node.children, context))
  }

  const dynamicDirective = ['v-for', 'v-slots', 'v-model', 'v-models'].find(name => directives.has(name))
  if (dynamicDirective) {
    if (dynamicDirective === 'v-model' || dynamicDirective === 'v-models') {
      context.bindingManifest.features.model = true
    }
    context.warnings.push(`JSX ${dynamicDirective} 无法直接映射当前静态 WXML，已生成 dynamic island。`)
    return registerDynamicIsland(node as unknown as Expression, context, 'closure')
  }

  // 版本满足时不提示；无法确认版本时同一次构建只提示一次门槛。
  if (consumeBaseLibraryHint(context.baseLibrary, {
    topic: ROOT_PORTAL_BASE_LIBRARY_HINT_TOPIC,
    minimum: ROOT_PORTAL_ENABLE_MIN_SDK_VERSION,
  })) {
    addJsxDiagnostic(context, node, 'WV1010', ROOT_PORTAL_BASE_LIBRARY_HINT_MESSAGE)
  }

  const passthroughAttributes = resolveTeleportPassthroughAttributes(node)
  if (hasTeleportClassOrStyle(passthroughAttributes)) {
    addJsxDiagnostic(context, node, 'WV1009', '<Teleport> 的 class/style 会落在 root-portal 宿主节点上，可能无法按预期作用于内部弹层，建议把样式写在内层节点。')
  }

  const attrs = [
    `enable="${resolveTeleportEnable(node, context)}"`,
    ...compileJsxAttributes(passthroughAttributes, context, { isComponent: false, tagName: ROOT_PORTAL_TAG }),
  ]
  const showExpression = directives.get('v-show')
  if (showExpression) {
    recordJsxBinding(context, showExpression, 'style')
    attrs.push(`hidden="${renderMustache(`!(${normalizeInterpolationExpression(showExpression, context)})`, context)}"`)
  }
  const attrsSegment = attrs.length ? ` ${attrs.join(' ')}` : ''
  const content = compileJsxChildren(node.children, context)
  const element = content
    ? `<${ROOT_PORTAL_TAG}${attrsSegment}>${content}</${ROOT_PORTAL_TAG}>`
    : `<${ROOT_PORTAL_TAG}${attrsSegment} />`
  return wrapIf(element)
}
