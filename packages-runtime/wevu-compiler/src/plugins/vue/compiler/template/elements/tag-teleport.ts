import type { AttributeNode, DirectiveNode, ElementNode, SimpleExpressionNode } from '@vue/compiler-core'
import type { CompilerDiagnosticCode } from '../../../../../types/diagnostics'
import type { TeleportDegradeReason, TeleportTargetInput } from '../teleport'
import type { TransformContext, TransformNode } from '../types'
import { ConstantTypes, NodeTypes } from '@vue/compiler-core'
import { ROOT_PORTAL_ENABLE_MIN_SDK_VERSION, ROOT_PORTAL_MIN_SDK_VERSION } from '@weapp-core/constants'
import { warn } from '../diagnostics'
import { renderMustache } from '../mustache'
import { supportsRootPortal } from '../platforms'
import { resolveTeleportDecision } from '../teleport'
import { isStructuralDirective } from './helpers'
import { transformNormalElement } from './tag-normal'
import { transformForElement, transformIfElement } from './tag-structural'

const TELEPORT_TAGS = new Set(['teleport'])
const ROOT_PORTAL_TAG = 'root-portal'
const TELEPORT_REMOVED_ATTRIBUTES = new Set(['to', 'defer', 'disabled'])
const TELEPORT_REMOVED_DIRECTIVE_ARGS = new Set(['to', 'defer', 'disabled'])

const TELEPORT_DEGRADE_CODES: Record<TeleportDegradeReason, CompilerDiagnosticCode> = {
  'platform': 'WV1008',
  'dynamic-to': 'WV1005',
  'spread': 'WV1006',
  'missing-to': 'WV1004',
  'empty-target': 'WV1007',
  'target': 'WV1007',
}

/**
 * 判断模板标签是否为 Vue Teleport，标签匹配不区分大小写。
 */
export function isTeleportTag(tag: string): boolean {
  return TELEPORT_TAGS.has(tag.toLowerCase())
}

function findAttribute(node: ElementNode, name: string): AttributeNode | undefined {
  return node.props.find((prop): prop is AttributeNode => prop.type === NodeTypes.ATTRIBUTE && prop.name === name)
}

function findBindDirective(node: ElementNode, arg: string): DirectiveNode | undefined {
  return node.props.find((prop): prop is DirectiveNode => {
    return prop.type === NodeTypes.DIRECTIVE
      && prop.name === 'bind'
      && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
      && prop.arg.isStatic
      && prop.arg.content === arg
  })
}

/**
 * 判断节点是否使用了 v-bind 对象展开（编译器归一化为无 arg 的 bind 指令）。
 */
function findSpreadBindDirective(node: ElementNode): DirectiveNode | undefined {
  return node.props.find((prop): prop is DirectiveNode => {
    return prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind' && !prop.arg
  })
}

function isTeleportRemovedProp(prop: ElementNode['props'][number]): boolean {
  if (prop.type === NodeTypes.ATTRIBUTE) {
    return TELEPORT_REMOVED_ATTRIBUTES.has(prop.name)
  }
  return prop.type === NodeTypes.DIRECTIVE
    && prop.name === 'bind'
    && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
    && prop.arg.isStatic
    && TELEPORT_REMOVED_DIRECTIVE_ARGS.has(prop.arg.content)
}

function createSimpleExpression(content: string, isStatic: boolean, node: ElementNode): SimpleExpressionNode {
  return {
    type: NodeTypes.SIMPLE_EXPRESSION,
    content,
    isStatic,
    constType: isStatic ? ConstantTypes.CAN_STRINGIFY : ConstantTypes.NOT_CONSTANT,
    loc: node.loc,
  }
}

function createStaticAttribute(name: string, value: string, node: ElementNode): AttributeNode {
  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    nameLoc: node.loc,
    value: {
      type: NodeTypes.TEXT,
      content: value,
      loc: node.loc,
    },
    loc: node.loc,
  }
}

function createEnableDirective(expression: string, node: ElementNode): DirectiveNode {
  return {
    type: NodeTypes.DIRECTIVE,
    name: 'bind',
    rawName: ':enable',
    exp: createSimpleExpression(expression, false, node),
    arg: createSimpleExpression('enable', true, node),
    modifiers: [],
    loc: node.loc,
  }
}

/**
 * Teleport 的 disabled 与 root-portal 的 enable 语义相反，需要整体取反。
 * 这里只生成取反表达式，具体归一化与运行时绑定交给属性转换链路按当前作用域处理。
 */
function resolveEnableProp(
  disabledAttribute: AttributeNode | undefined,
  disabledDirective: DirectiveNode | undefined,
  node: ElementNode,
  context: TransformContext,
): AttributeNode | DirectiveNode {
  if (disabledAttribute) {
    return createStaticAttribute('enable', renderMustache('false', context), node)
  }
  const rawExp = disabledDirective?.exp?.type === NodeTypes.SIMPLE_EXPRESSION
    ? disabledDirective.exp.content.trim()
    : ''
  if (!rawExp || rawExp === 'false') {
    return createStaticAttribute('enable', renderMustache('true', context), node)
  }
  if (rawExp === 'true') {
    return createStaticAttribute('enable', renderMustache('false', context), node)
  }
  return createEnableDirective(`!(${rawExp})`, node)
}

function mapTeleportNode(
  node: ElementNode,
  enableProp: AttributeNode | DirectiveNode,
): ElementNode {
  return {
    ...node,
    tag: ROOT_PORTAL_TAG,
    props: [
      enableProp,
      ...node.props.filter(prop => !isTeleportRemovedProp(prop)),
    ],
  }
}

/**
 * 读取 Teleport 的 to 输入；对象展开不参与静态解析。
 */
function resolveTeleportTarget(node: ElementNode): TeleportTargetInput {
  const toAttribute = findAttribute(node, 'to')
  if (toAttribute) {
    return {
      kind: 'static',
      value: toAttribute.value?.type === NodeTypes.TEXT ? toAttribute.value.content : '',
    }
  }
  if (findBindDirective(node, 'to')) {
    return { kind: 'dynamic' }
  }
  return { kind: 'missing' }
}

/**
 * class/style 会透传到 root-portal 宿主节点，需要单独提示语义差异。
 */
function hasTeleportClassOrStyle(node: ElementNode): boolean {
  return node.props.some((prop) => {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      return prop.name === 'class' || prop.name === 'style'
    }
    return prop.type === NodeTypes.DIRECTIVE
      && prop.name === 'bind'
      && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
      && prop.arg.isStatic
      && (prop.arg.content === 'class' || prop.arg.content === 'style')
  })
}

/**
 * 降级时保留 Teleport 自身的结构指令语义，移除只有在 Web Teleport 上才有意义的属性。
 */
function transformDegradedTeleport(
  node: ElementNode,
  context: TransformContext,
  transformNode: TransformNode,
): string {
  const degradedNode: ElementNode = {
    ...node,
    tag: 'template',
    props: node.props.filter(prop => !isTeleportRemovedProp(prop)),
  }
  const { type } = isStructuralDirective(degradedNode)
  if (type === 'if') {
    return transformIfElement(degradedNode, context, transformNode)
  }
  if (type === 'for') {
    return transformForElement({ ...degradedNode, tag: 'block' } as ElementNode, context, transformNode)
  }
  return node.children.map(child => transformNode(child, context)).join('')
}

/**
 * 将 Vue Teleport 映射为小程序原生 root-portal；不可映射时剥掉标签并原位渲染子节点。
 */
export function transformTeleportElement(
  node: ElementNode,
  context: TransformContext,
  transformNode: TransformNode,
): string {
  // 关闭映射时直接剥掉 Teleport 标签并原位渲染，避免生成宿主无法识别的 <teleport> 标签。
  if (!context.teleport.enabled) {
    return transformDegradedTeleport(node, context, transformNode)
  }

  const decision = resolveTeleportDecision({
    supportsRootPortal: supportsRootPortal(context.platform),
    to: resolveTeleportTarget(node),
    spread: Boolean(findSpreadBindDirective(node)),
  })

  if (decision.kind === 'degrade') {
    warn(context, decision.message, node.loc, 'template', {
      code: TELEPORT_DEGRADE_CODES[decision.reason],
      severity: context.teleport.unsupported === 'error' ? 'error' : 'warning',
    })
    return transformDegradedTeleport(node, context, transformNode)
  }

  if (hasTeleportClassOrStyle(node)) {
    warn(
      context,
      '<Teleport> 的 class/style 会落在 root-portal 宿主节点上，可能无法按预期作用于内部弹层，建议把样式写在内层节点。',
      node.loc,
      'template',
      { code: 'WV1009' },
    )
  }

  const enableProp = resolveEnableProp(
    findAttribute(node, 'disabled'),
    findBindDirective(node, 'disabled'),
    node,
    context,
  )

  // 编译期只能确认映射结果，无法获知运行时基础库，因此提示一次版本门槛。
  if (!context.teleportBaseLibraryHinted) {
    context.teleportBaseLibraryHinted = true
    warn(
      context,
      `<Teleport> 已映射为 root-portal，需要微信基础库 ≥ ${ROOT_PORTAL_MIN_SDK_VERSION}，其中 enable 属性需要 ≥ ${ROOT_PORTAL_ENABLE_MIN_SDK_VERSION}。`,
      node.loc,
      'template',
      { code: 'WV1010' },
    )
  }

  const mappedNode = mapTeleportNode(node, enableProp)
  const { type } = isStructuralDirective(mappedNode)
  if (type === 'if') {
    return transformIfElement(mappedNode, context, transformNode)
  }
  if (type === 'for') {
    return transformForElement(mappedNode, context, transformNode)
  }
  return transformNormalElement(mappedNode, context, transformNode)
}
