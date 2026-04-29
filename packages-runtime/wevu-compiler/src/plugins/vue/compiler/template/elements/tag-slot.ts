import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import {
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ATTR,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_PROPS_ATTR,
  WEVU_SLOT_SCOPE_ATTR,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { buildClassStyleWxsTag } from '../classStyleRuntime'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { renderMustache } from '../mustache'
import {
  collectScopePropMapping,
  getBindDirectiveExpression,
  hashString,
  isScopedSlotsDisabled,
  withSlotProps,
} from './helpers'
import { collectSlotBindingExpression, parseSlotPropsExpression } from './slotProps'

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

export function createScopedSlotComponent(
  context: TransformContext,
  slotKey: string,
  props: Record<string, string>,
  children: any[],
  transformNode: TransformNode,
): { componentName: string, slotKey: string } {
  const ownerHash = hashString(context.filename)
  const index = context.scopedSlotComponents.length
  const id = `${slotKey}-${index}`
  const componentName = `scoped-slot-${ownerHash}-${slotKey}-${index}`
  const scopedContext: TransformContext = {
    ...context,
    scopedSlotComponents: [],
    componentGenerics: {},
    scopeStack: [],
    slotPropStack: [],
    rewriteScopedSlot: true,
    classStyleBindings: [],
    classStyleWxs: false,
    forStack: [],
    forIndexSeed: 0,
    inlineExpressions: [],
    inlineExpressionSeed: 0,
  }
  const scopeMapping = collectScopePropMapping(context)
  const slotMapping = {
    ...scopeMapping,
    ...props,
  }
  let template = withSlotProps(scopedContext, slotMapping, () => {
    return children.map(child => transformNode(child, scopedContext)).join('')
  })
  if (scopedContext.classStyleWxs) {
    const ext = scopedContext.classStyleWxsExtension || 'wxs'
    const helperTag = buildClassStyleWxsTag(ext, scopedContext.classStyleWxsSrc)
    template = `${helperTag}\n${template}`
  }
  context.scopedSlotComponents.push({
    id,
    componentName,
    slotKey,
    template,
    classStyleBindings: scopedContext.classStyleBindings.length ? scopedContext.classStyleBindings : undefined,
    classStyleWxs: scopedContext.classStyleWxs || undefined,
    inlineExpressions: scopedContext.inlineExpressions.length ? scopedContext.inlineExpressions : undefined,
  })
  return { componentName, slotKey }
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

export function renderSlotFallback(
  decl: ScopedSlotDeclaration,
  context: TransformContext,
  transformNode: TransformNode,
): string {
  const rawRenderedChildren = decl.children
    .map(child => ({
      code: transformNode(child, context),
    }))
  const rawContent = rawRenderedChildren.map(item => item.code).join('')
  if (!rawContent) {
    return ''
  }

  const slotAttr = renderSlotNameAttribute(decl.name, context, 'slot')
  const wrapCondition = (content: string) => {
    return decl.condition ? context.platform.wrapIf(decl.condition, content, exp => renderMustache(exp, context)) : content
  }

  if (!slotAttr) {
    return wrapCondition(rawContent)
  }

  if (!context.slotSingleRootNoWrapper) {
    return wrapCondition(`<view ${slotAttr}>${rawContent}</view>`)
  }

  const renderedChildren = rawRenderedChildren
    .filter(item => item.code.trim().length > 0)
  if (!renderedChildren.length) {
    return ''
  }

  const content = renderedChildren.map(item => item.code).join('')

  if (renderedChildren.length === 1) {
    const projected = injectAttributeIntoOpeningTag(renderedChildren[0]!.code, slotAttr)
    if (projected) {
      return wrapCondition(projected)
    }
  }

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
  let slotPropsExp = collectSlotBindingExpression(node, context)

  let fallbackContent = ''
  if (node.children.length > 0) {
    fallbackContent = node.children
      .map(child => transformNode(child, context))
      .join('')
  }

  if (slotPropsExp && fallbackContent) {
    context.warnings.push('不支持作用域插槽的兜底内容，已忽略。')
    fallbackContent = ''
  }
  const slotAttrs: string[] = []
  const nameAttr = renderSlotNameAttribute(slotNameInfo, context, 'name')
  if (nameAttr) {
    slotAttrs.push(nameAttr)
  }

  const slotAttrString = slotAttrs.length ? ` ${slotAttrs.join(' ')}` : ''
  let slotTag = `<slot${slotAttrString} />`

  if (fallbackContent) {
    const slotPresentExp = createSlotPresenceExpression(slotNameInfo)
    if (!slotPropsExp && slotPresentExp) {
      slotTag = `${context.platform.wrapIf(slotPresentExp, slotTag, exp => renderMustache(exp, context))}${context.platform.wrapElse(fallbackContent)}`
    }
    else {
      slotTag = `<slot${slotAttrString}>${fallbackContent}</slot>`
    }
  }

  if (!slotPropsExp && (context.scopedSlotsRequireProps || slotNameInfo.type !== 'default')) {
    return slotTag
  }

  const slotKey = resolveSlotKey(context, slotNameInfo)
  const genericKey = `scoped-slots-${slotKey}`
  context.componentGenerics[genericKey] = true

  slotPropsExp = slotPropsExp ?? '[]'
  const scopedAttrs = [
    `${context.platform.directives.ifAttr}="${renderMustache(WEVU_SLOT_OWNER_ID_PROP, context)}"`,
    `${WEVU_SLOT_OWNER_ATTR}="${renderMustache(WEVU_SLOT_OWNER_ID_PROP, context)}"`,
    `${WEVU_SLOT_PROPS_ATTR}="${renderMustache(slotPropsExp, context)}"`,
  ]
  if (context.slotMultipleInstance) {
    scopedAttrs.push(`${WEVU_SLOT_SCOPE_ATTR}="${renderMustache(WEVU_SLOT_SCOPE_KEY, context)}"`)
  }
  const scopedAttrString = scopedAttrs.length ? ` ${scopedAttrs.join(' ')}` : ''
  const scopedTag = `<${genericKey}${scopedAttrString} />`

  return `${slotTag}${scopedTag}`
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
