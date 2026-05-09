import type { AttributeNode, DirectiveNode, ElementNode } from '@vue/compiler-core'
import type * as t from '@weapp-vite/ast/babelTypes'
import type { ScopedSlotComponentAsset, TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import {
  WEVU_GENERIC_SLOT_OWNER_ID_ATTR,
  WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR,
  WEVU_GENERIC_SLOT_PROPS_ATTR,
  WEVU_GENERIC_SLOT_PROPS_DATA_ATTR,
  WEVU_GENERIC_SLOT_PROPS_DATA_KEY,
  WEVU_GENERIC_SLOT_SCOPE_ATTR,
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { traverse } from '../../../../../utils/babel'
import { buildClassStyleWxsTag } from '../classStyleRuntime'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { parseBabelExpressionFile } from '../expression/parse'
import { registerRuntimeBindingExpression } from '../expression/runtimeBinding'
import { renderMustache } from '../mustache'
import { collectElementAttributes } from './attrs'
import {
  collectScopePropMapping,
  getBindDirectiveExpression,
  hashString,
  isScopedSlotsDisabled,
  isStructuralDirective,
  toWxmlStringLiteral,
  withSlotProps,
} from './helpers'
import { collectSlotBindingExpressions, parseSlotPropsExpression } from './slotProps'

export type SlotNameInfo = { type: 'default' } | { type: 'static', value: string } | { type: 'dynamic', exp: string }

export interface ScopedSlotDeclaration {
  name: SlotNameInfo
  props: Record<string, string>
  children: any[]
  implicitDefault?: boolean
  condition?: string
}

export function renderSlotNameAttribute(
  info: SlotNameInfo,
  context: TransformContext,
  attrName: 'name' | 'slot',
): string | undefined {
  if (info.type === 'static' && info.value !== 'default') {
    return `${attrName}="${info.value}"`
  }
  if (info.type === 'dynamic') {
    const expValue = normalizeWxmlExpressionWithContext(info.exp, context)
    return `${attrName}="${renderMustache(expValue, context)}"`
  }
  return undefined
}

export function resolveSlotNameFromDirective(slotDirective: DirectiveNode): SlotNameInfo {
  if (!slotDirective.arg) {
    return { type: 'default' }
  }
  if (slotDirective.arg.type !== NodeTypes.SIMPLE_EXPRESSION) {
    return { type: 'default' }
  }
  if (slotDirective.arg.isStatic) {
    return { type: 'static', value: slotDirective.arg.content }
  }
  return { type: 'dynamic', exp: slotDirective.arg.content }
}

export function resolveSlotNameFromSlotElement(node: ElementNode): SlotNameInfo {
  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name') {
      const value = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
      return value ? { type: 'static', value } : { type: 'default' }
    }
    if (prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind') {
      if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === 'name') {
        const raw = getBindDirectiveExpression(prop)
        if (raw) {
          return { type: 'dynamic', exp: raw }
        }
      }
    }
  }
  return { type: 'default' }
}

export function resolveSlotKey(context: TransformContext, info: SlotNameInfo): string {
  if (info.type === 'default') {
    return 'default'
  }
  if (info.type === 'static') {
    return info.value || 'default'
  }
  const key = `dyn-${hashString(info.exp)}`
  context.warnings.push('动态插槽名通过表达式哈希匹配，请确保提供方与使用方的表达式一致。')
  return key
}

export function stringifySlotName(info: SlotNameInfo, context: TransformContext): string {
  if (info.type === 'default') {
    return '\'default\''
  }
  if (info.type === 'static') {
    return info.value === 'default' ? '\'default\'' : `'${info.value}'`
  }
  const normalized = normalizeWxmlExpressionWithContext(info.exp, context)
  return normalized
}

function resolveSlotStaticName(info: SlotNameInfo): string | undefined {
  if (info.type === 'default') {
    return 'default'
  }
  if (info.type === 'static') {
    return info.value || 'default'
  }
  return undefined
}

const SLOT_PRESENCE_IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
const SLOT_OWNER_KEY_RE = /\bwvslotowner(?:\.([A-Z_$][\w$]*)|\[['"]([^'"]+)['"]\])/gi
const SLOT_OWNER_PROP_PREFIX_RE = /\bwvslotownerprop([A-Z_$][\w$]*)\b/gi
const SLOT_PROPS_DATA_KEY_RE = /\bwvslotpropsdata(?:\.([A-Z_$][\w$]*)|\[['"]([^'"]+)['"]\])/gi

function renderOwnerPropSourceExpression(key: string) {
  return SLOT_PRESENCE_IDENTIFIER_RE.test(key)
    ? key
    : `${WEVU_SLOT_OWNER_ID_KEY}['${key.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}']`
}

function createSlotPresenceExpression(info: SlotNameInfo) {
  const slotName = resolveSlotStaticName(info)
  if (!slotName) {
    return undefined
  }
  const access = SLOT_PRESENCE_IDENTIFIER_RE.test(slotName)
    ? `${WEVU_SLOT_NAMES_PROP}.${slotName}`
    : `${WEVU_SLOT_NAMES_PROP}['${slotName.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}']`
  return `${WEVU_SLOT_NAMES_PROP}&&${access}`
}

export function buildSlotDeclaration(
  name: SlotNameInfo,
  propsExp: string | undefined,
  children: any[],
  context: TransformContext,
  options?: {
    implicitDefault?: boolean
    condition?: string
  },
): ScopedSlotDeclaration {
  const props = propsExp ? parseSlotPropsExpression(propsExp, context) : {}
  return { name, props, children, implicitDefault: options?.implicitDefault, condition: options?.condition }
}

function collectOwnerMemberKey(node: t.MemberExpression | t.OptionalMemberExpression, ownerKeys: Set<string>, slotPropKeys: Set<string>) {
  const object = node.object
  if (object.type !== 'Identifier' || (object.name !== 'wvslotowner' && object.name !== 'wvslotpropsdata')) {
    return
  }
  const property = node.property
  if (!node.computed && property.type === 'Identifier') {
    if (object.name === 'wvslotpropsdata' && slotPropKeys.has(property.name)) {
      return
    }
    ownerKeys.add(property.name)
  }
  else if (node.computed && property.type === 'StringLiteral') {
    if (object.name === 'wvslotpropsdata' && slotPropKeys.has(property.value)) {
      return
    }
    ownerKeys.add(property.value)
  }
}

function collectScopedSlotOwnerKeys(template: string, slotPropKeys: Set<string>): string[] | undefined {
  const ownerKeys = new Set<string>()
  let match = SLOT_OWNER_KEY_RE.exec(template)
  while (match) {
    const key = match[1] ?? match[2]
    if (key) {
      ownerKeys.add(key)
    }
    match = SLOT_OWNER_KEY_RE.exec(template)
  }
  SLOT_OWNER_KEY_RE.lastIndex = 0
  match = SLOT_OWNER_PROP_PREFIX_RE.exec(template)
  while (match) {
    const key = match[1]
    if (key) {
      ownerKeys.add(key)
    }
    match = SLOT_OWNER_PROP_PREFIX_RE.exec(template)
  }
  SLOT_OWNER_PROP_PREFIX_RE.lastIndex = 0
  const computedExpressions = template.match(/\{\{([\s\S]*?)\}\}/g) ?? []
  for (const raw of computedExpressions) {
    const expression = raw.slice(2, -2).trim()
    const parsed = parseBabelExpressionFile(expression)
    if (!parsed) {
      continue
    }
    traverse(parsed.ast, {
      MemberExpression(path) {
        collectOwnerMemberKey(path.node, ownerKeys, slotPropKeys)
      },
      OptionalMemberExpression(path) {
        collectOwnerMemberKey(path.node as any, ownerKeys, slotPropKeys)
      },
    })
  }
  return ownerKeys.size ? [...ownerKeys].sort((a, b) => a.localeCompare(b)) : undefined
}

function collectScopedSlotPropsDataKeys(template: string): string[] {
  const keys = new Set<string>()
  let match = SLOT_PROPS_DATA_KEY_RE.exec(template)
  while (match) {
    const key = match[1] ?? match[2]
    if (key) {
      keys.add(key)
    }
    match = SLOT_PROPS_DATA_KEY_RE.exec(template)
  }
  SLOT_PROPS_DATA_KEY_RE.lastIndex = 0
  return [...keys].sort((a, b) => a.localeCompare(b))
}

function renderScopedSlotPropsDataReadyGuard(keys: string[]) {
  if (!keys.length) {
    return undefined
  }
  return keys
    .map((key) => {
      const access = SLOT_PRESENCE_IDENTIFIER_RE.test(key)
        ? `${WEVU_GENERIC_SLOT_PROPS_DATA_KEY}.${key}`
        : `${WEVU_GENERIC_SLOT_PROPS_DATA_KEY}[${toWxmlStringLiteral(key)}]`
      return `${access}!==undefined`
    })
    .join('&&')
}

export function createScopedSlotComponent(
  context: TransformContext,
  slotKey: string,
  props: Record<string, string>,
  children: any[],
  transformNode: TransformNode,
): { componentName: string, slotKey: string, asset: ScopedSlotComponentAsset } {
  const ownerHash = hashString(context.filename)
  const index = context.scopedSlotComponents.length
  const id = `${slotKey}-${index}`
  const componentName = `scoped-slot-${ownerHash}-${slotKey}-${index}`
  const asset: ScopedSlotComponentAsset = {
    id,
    componentName,
    slotKey,
    template: '',
  }
  context.scopedSlotComponents.push(asset)
  const scopedContext: TransformContext = {
    ...context,
    scopedSlotComponents: context.scopedSlotComponents,
    componentGenerics: {},
    scopeStack: [],
    slotPropStack: [],
    rewriteScopedSlot: true,
    classStyleBindings: [],
    runtimeBindingCache: new Map(),
    runtimeBindingPrefix: 'wvslotbind',
    classStyleWxs: false,
    forStack: [],
    forIndexSeed: 0,
    inlineExpressions: [],
    inlineExpressionSeed: 0,
    scopedSlotOwnerRuntimeBindingTarget: context,
  }
  const scopeMapping = collectScopePropMapping(context)
  const slotMapping = {
    ...scopeMapping,
    ...props,
  }
  let template = withSlotProps(scopedContext, slotMapping, () => {
    return children.map(child => transformNode(child, scopedContext)).join('')
  })
  const slotPropsDataReadyGuard = renderScopedSlotPropsDataReadyGuard(collectScopedSlotPropsDataKeys(template))
  if (slotPropsDataReadyGuard) {
    template = scopedContext.platform.wrapIf(slotPropsDataReadyGuard, template, exp => renderMustache(exp, scopedContext))
  }
  if (scopedContext.classStyleWxs) {
    const ext = scopedContext.classStyleWxsExtension || 'wxs'
    const helperTag = buildClassStyleWxsTag(ext, scopedContext.classStyleWxsSrc)
    template = `${helperTag}\n${template}`
  }
  asset.template = template
  asset.componentGenerics = Object.keys(scopedContext.componentGenerics).length ? scopedContext.componentGenerics : undefined
  asset.classStyleBindings = scopedContext.classStyleBindings.length ? scopedContext.classStyleBindings : undefined
  asset.classStyleWxs = scopedContext.classStyleWxs || undefined
  asset.inlineExpressions = scopedContext.inlineExpressions.length ? scopedContext.inlineExpressions : undefined
  asset.ownerKeys = collectScopedSlotOwnerKeys(template, new Set(Object.values(slotMapping)))
  if (asset.ownerKeys?.length) {
    asset.ownerPropsExpression = `[${asset.ownerKeys.map(key => `'${key}',${renderOwnerPropSourceExpression(key)}`).join(',')}]`
  }
  return { componentName, slotKey, asset }
}

function injectAttributeIntoOpeningTag(source: string, attr: string): string | null {
  if (!source.startsWith('<') || source.startsWith('</') || source.startsWith('<!--')) {
    return null
  }

  let tagNameEnd = 1
  while (tagNameEnd < source.length) {
    const char = source[tagNameEnd]
    if (char === ' ' || char === '\n' || char === '\r' || char === '\t' || char === '/' || char === '>') {
      break
    }
    tagNameEnd += 1
  }

  if (tagNameEnd <= 1) {
    return null
  }

  return `${source.slice(0, tagNameEnd)} ${attr}${source.slice(tagNameEnd)}`
}

function createSlotAttributeNode(sourceNode: ElementNode, attr: string): AttributeNode | null {
  const match = /^slot="([\s\S]*)"$/.exec(attr)
  if (!match) {
    return null
  }
  return {
    type: NodeTypes.ATTRIBUTE,
    name: 'slot',
    nameLoc: sourceNode.loc,
    value: {
      type: NodeTypes.TEXT,
      content: match[1]!,
      loc: sourceNode.loc,
    },
    loc: sourceNode.loc,
  }
}

function injectSlotAttributeIntoStructuralElementNode(
  child: any,
  slotAttr: string,
  transformNode: TransformNode,
  context: TransformContext,
): string | null {
  if (child.type !== NodeTypes.ELEMENT || child.tag === 'template') {
    return null
  }
  const sourceNode = child as ElementNode
  const structural = isStructuralDirective(sourceNode)
  if (structural.type !== 'if' || structural.directive?.name !== 'if' || !structural.directive.exp) {
    return null
  }
  const slotAttribute = createSlotAttributeNode(sourceNode, slotAttr)
  if (!slotAttribute) {
    return null
  }
  const elementWithoutIf: ElementNode = {
    ...sourceNode,
    props: [slotAttribute, ...sourceNode.props.filter(prop => prop !== structural.directive)],
  }
  const rawExpValue = structural.directive.exp.type === NodeTypes.SIMPLE_EXPRESSION
    ? structural.directive.exp.content
    : ''
  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
  const tag = sourceNode.tag
  const { attrs, vTextExp } = collectElementAttributes(elementWithoutIf, context, {
    skipSlotDirective: true,
  })
  let children = ''
  if (sourceNode.children.length > 0) {
    children = sourceNode.children
      .map(childNode => transformNode(childNode, context))
      .join('')
  }
  if (vTextExp !== undefined) {
    children = renderMustache(vTextExp, context)
  }
  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''
  const element = children
    ? `<${tag}${attrString}>${children}</${tag}>`
    : `<${tag}${attrString} />`
  return element.replace(/^<([^\s>/]+)/, `<$1 ${context.platform.directives.ifAttr}="${renderMustache(expValue, context)}"`)
}

function isRenderableFallbackChild(child: any): boolean {
  if (child.type === NodeTypes.COMMENT) {
    return false
  }
  if (child.type === NodeTypes.TEXT) {
    return child.content.trim().length > 0
  }
  return true
}

export function renderSlotFallback(
  decl: ScopedSlotDeclaration,
  context: TransformContext,
  transformNode: TransformNode,
): string {
  const slotAttr = renderSlotNameAttribute(decl.name, context, 'slot')
  const wrapCondition = (content: string) => {
    return decl.condition ? context.platform.wrapIf(decl.condition, content, exp => renderMustache(exp, context)) : content
  }

  if (!slotAttr) {
    const rawContent = decl.children
      .map(child => transformNode(child, context))
      .join('')
    if (!rawContent) {
      return ''
    }
    return wrapCondition(rawContent)
  }

  const renderableChildren = decl.children.filter(isRenderableFallbackChild)
  if (!renderableChildren.length) {
    return ''
  }

  if (!context.slotSingleRootNoWrapper) {
    const rawContent = decl.children
      .map(child => transformNode(child, context))
      .join('')
    if (!rawContent) {
      return ''
    }
    return wrapCondition(`<view ${slotAttr}>${rawContent}</view>`)
  }

  if (renderableChildren.length === 1) {
    const child = renderableChildren[0]!
    if (child.type === NodeTypes.ELEMENT && isStructuralDirective(child as ElementNode).type) {
      const projected = injectSlotAttributeIntoStructuralElementNode(child, slotAttr, transformNode, context)
      if (projected) {
        return wrapCondition(projected)
      }
    }
    const projected = injectAttributeIntoOpeningTag(transformNode(child, context), slotAttr)
    if (projected) {
      return wrapCondition(projected)
    }
  }

  const content = renderableChildren
    .map(child => transformNode(child, context))
    .join('')

  // 真机 / DevTools 运行时里，多节点 fallback 通过 `<block slot="...">` 投影并不稳定，
  // 某些布局场景（尤其父级是 flex）会直接丢失整组内容，因此这里只对“单根节点”做无包裹下推；
  // 只要出现多节点，就退回真实 `<view>` 容器，优先保证投影可见性和兼容性。
  return wrapCondition(`<view ${slotAttr}>${content}</view>`)
}

export function transformSlotElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  if (isScopedSlotsDisabled(context)) {
    // eslint-disable-next-line ts/no-use-before-define
    return transformSlotElementPlain(node, context, transformNode)
  }
  const slotNameInfo = resolveSlotNameFromSlotElement(node)
  const slotBindingExps = collectSlotBindingExpressions(node, context)
  const slotPropsExp = slotBindingExps.props

  let fallbackContent = ''
  if (node.children.length > 0) {
    fallbackContent = node.children
      .map(child => transformNode(child, context))
      .join('')
  }

  const slotAttrs: string[] = []
  const nameAttr = renderSlotNameAttribute(slotNameInfo, context, 'name')
  if (nameAttr) {
    slotAttrs.push(nameAttr)
  }

  const slotAttrString = slotAttrs.length ? ` ${slotAttrs.join(' ')}` : ''
  let slotTag = `<slot${slotAttrString} />`
  const slotPresentExp = fallbackContent ? createSlotPresenceExpression(slotNameInfo) : undefined

  if (fallbackContent && !slotPropsExp && !slotPresentExp) {
    slotTag = `<slot${slotAttrString}>${fallbackContent}</slot>`
  }

  const shouldUseNativeSlotOutlet = !slotPropsExp && context.scopedSlotsRequireProps
  if (shouldUseNativeSlotOutlet) {
    if (fallbackContent && slotPresentExp) {
      return `${context.platform.wrapIf(slotPresentExp, slotTag, exp => renderMustache(exp, context))}${context.platform.wrapElse(fallbackContent)}`
    }
    return slotTag
  }

  const slotKey = resolveSlotKey(context, slotNameInfo)
  const genericKey = `scoped-slots-${slotKey}`
  context.componentGenerics[genericKey] = true

  const slotPropsFallbackExp = slotPropsExp ?? WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR
  const slotPropsDataExp = slotPropsExp && slotBindingExps.data
    ? registerRuntimeBindingExpression(slotBindingExps.data, context, {
      hint: 'scoped slot props data',
      prefix: `${WEVU_GENERIC_SLOT_PROPS_DATA_ATTR}_`,
    }) ?? slotPropsFallbackExp
    : WEVU_GENERIC_SLOT_PROPS_DATA_KEY
  const scopedAttrs = [
    `${WEVU_GENERIC_SLOT_OWNER_ID_ATTR}="${renderMustache(WEVU_GENERIC_SLOT_OWNER_ID_ATTR, context)}"`,
    `${WEVU_GENERIC_SLOT_PROPS_ATTR}="${renderMustache(slotPropsFallbackExp, context)}"`,
    `${WEVU_GENERIC_SLOT_PROPS_DATA_ATTR}="${renderMustache(slotPropsDataExp, context)}"`,
  ]
  if (context.slotMultipleInstance) {
    scopedAttrs.push(`${WEVU_GENERIC_SLOT_SCOPE_ATTR}="${renderMustache(WEVU_SLOT_SCOPE_KEY, context)}"`)
  }
  scopedAttrs.push(`${WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR}="${renderMustache(WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR, context)}"`)
  const scopedAttrString = scopedAttrs.length ? ` ${scopedAttrs.join(' ')}` : ''
  const scopedTag = context.platform.wrapIf(
    WEVU_GENERIC_SLOT_OWNER_ID_ATTR,
    `<${genericKey}${scopedAttrString} />`,
    exp => renderMustache(exp, context),
  )
  const projectedContent = slotPropsExp ? scopedTag : `${slotTag}${scopedTag}`

  if (fallbackContent && slotPresentExp) {
    return `${context.platform.wrapIf(slotPresentExp, projectedContent, exp => renderMustache(exp, context))}${context.platform.wrapElse(fallbackContent)}`
  }

  return projectedContent
}

export function transformSlotElementPlain(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const slotNameInfo = resolveSlotNameFromSlotElement(node)
  const hasScopeBindings = node.props.some((prop) => {
    if (prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind') {
      return prop.arg?.type !== NodeTypes.SIMPLE_EXPRESSION || prop.arg.content !== 'name'
    }
    return false
  })
  if (hasScopeBindings) {
    context.warnings.push('已禁用作用域插槽参数，插槽绑定将被忽略。')
  }

  const fallbackContent = node.children
    .map(child => transformNode(child, context))
    .join('')

  const slotAttrs: string[] = []
  const nameAttr = renderSlotNameAttribute(slotNameInfo, context, 'name')
  if (nameAttr) {
    slotAttrs.push(nameAttr)
  }
  const slotAttrString = slotAttrs.length ? ` ${slotAttrs.join(' ')}` : ''
  return fallbackContent
    ? `<slot${slotAttrString}>${fallbackContent}</slot>`
    : `<slot${slotAttrString} />`
}
