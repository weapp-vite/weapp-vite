import type { AttributeNode, DirectiveNode, ElementNode, SourceLocation } from '@vue/compiler-core'
import type { WevuRuntimeCapabilityName } from '../../../../../runtimeCapabilities'
import type {
  ResolvedSlotFallbackWrapper,
  ScopedSlotComponentAsset,
  SlotFallbackWrapperMatcher,
  SlotFallbackWrapperResolveContext,
  TransformContext,
  TransformNode,
} from '../types'
import { NodeTypes } from '@vue/compiler-core'
import {
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ID_ATTR,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_PROPS_ATTR,
  WEVU_SLOT_SCOPE_ATTR,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { createWevuRuntimeCapabilityMetadata } from '../../../../../runtimeCapabilities'

import { renderClassAttribute, renderStyleAttribute, transformAttribute } from '../attributes'
import { createBindingManifest, recordBindingExpression } from '../bindingManifest'
import { buildClassStyleWxsTag } from '../classStyleRuntime'
import { warn } from '../diagnostics'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { renderMustache } from '../mustache'
import { buildScopedSlotComponentScript } from '../scopedSlotScript'
import {
  collectScopePropMapping,
  getBindDirectiveExpression,
  hashString,
  isScopedSlotsDisabled,
  isStructuralDirective,
  withSlotProps,
} from './helpers'
import { collectSlotBindingExpression, parseSlotPropsExpression } from './slotProps'

export type SlotNameInfo = { type: 'default' } | { type: 'static', value: string } | { type: 'dynamic', exp: string, loc: SourceLocation }

export interface ScopedSlotDeclaration {
  name: SlotNameInfo
  props: Record<string, string>
  children: any[]
  implicitDefault?: boolean
  conditionKind?: 'if' | 'else-if' | 'else'
  condition?: string
  wrapper?: SlotFallbackWrapperResolveContext['local']
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
    recordBindingExpression(context, {
      kind: attrName === 'slot' ? 'component-prop' : 'attribute',
      expression: info.exp,
      sourceLocation: info.loc,
    })
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
  return { type: 'dynamic', exp: slotDirective.arg.content, loc: slotDirective.loc }
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
          return { type: 'dynamic', exp: raw, loc: prop.loc }
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
  warn(context, '动态插槽名通过表达式哈希匹配，请确保提供方与使用方的表达式一致。', info.loc)
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
    conditionKind?: 'if' | 'else-if' | 'else'
    condition?: string
    wrapper?: SlotFallbackWrapperResolveContext['local']
    location?: SourceLocation
  },
): ScopedSlotDeclaration {
  const props = propsExp ? parseSlotPropsExpression(propsExp, context, options?.location) : {}
  return {
    name,
    props,
    children,
    implicitDefault: options?.implicitDefault,
    conditionKind: options?.conditionKind,
    condition: options?.condition,
    wrapper: options?.wrapper,
  }
}

export function createScopedSlotComponent(
  context: TransformContext,
  slotKey: string,
  props: Record<string, string>,
  children: any[],
  transformNode: TransformNode,
  options?: {
    hostComponentName?: string
  },
): { componentName: string, slotKey: string } {
  const ownerHash = hashString(context.filename)
  const index = context.scopedSlotComponents.length
  const id = `${slotKey}-${index}`
  const componentName = `scoped-slot-${ownerHash}-${slotKey}-${index}`
  const bindingManifest = createBindingManifest(context.bindingManifest.sourceFile)
  bindingManifest.features.scopedSlots = true
  const asset: ScopedSlotComponentAsset = {
    id,
    componentName,
    hostComponentName: options?.hostComponentName,
    slotKey,
    template: '',
    script: '',
    bindingManifest,
  }
  context.scopedSlotComponents.push(asset)
  if (!context.bindingManifest.features.scopedSlots) {
    context.bindingManifest.features.scopedSlots = true
    context.bindingManifest.bindings.push({
      id: `b${context.bindingManifest.bindings.length}`,
      kind: 'component-prop',
      outputPath: WEVU_SLOT_OWNER_ID_KEY,
      sourceRoots: [WEVU_SLOT_OWNER_ID_KEY],
      sourcePaths: [WEVU_SLOT_OWNER_ID_KEY],
      dependencies: [{
        root: WEVU_SLOT_OWNER_ID_KEY,
        path: WEVU_SLOT_OWNER_ID_KEY,
        updateMode: 'exact-path',
      }],
      scopes: [{ kind: 'root', depth: 0 }],
      updateMode: 'exact-path',
    })
  }
  const scopedContext: TransformContext = {
    ...context,
    bindingManifest,
    scopedSlotComponents: context.scopedSlotComponents,
    componentGenerics: {},
    miniProgramComponentTags: context.miniProgramComponentTags,
    scopeStack: [],
    slotPropStack: [],
    rewriteScopedSlot: true,
    hasSlotOutlet: false,
    classStyleBindings: [],
    classStyleWxs: false,
    forStack: [],
    forIndexSeed: 0,
    inlineExpressions: [],
    inlineExpressionSeed: 0,
    templateRefs: [],
    templateRefIndexSeed: 0,
    layoutHosts: [],
    layoutHostIndexSeed: 0,
    functionPropPaths: new Set(),
    functionPropNames: context.functionPropNames,
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
  asset.template = template
  asset.componentGenerics = Object.keys(scopedContext.componentGenerics).length ? scopedContext.componentGenerics : undefined
  asset.classStyleWxs = scopedContext.classStyleWxs || undefined
  asset.inlineExpressions = scopedContext.inlineExpressions.length ? scopedContext.inlineExpressions : undefined
  asset.templateRefs = scopedContext.templateRefs.length ? scopedContext.templateRefs : undefined
  asset.layoutHosts = scopedContext.layoutHosts.length ? scopedContext.layoutHosts : undefined
  const requiredCapabilities: WevuRuntimeCapabilityName[] = ['scopedSlots']
  if (bindingManifest.features.templateRefs) {
    requiredCapabilities.push('templateRefs')
  }
  if (bindingManifest.features.inlineEvents) {
    requiredCapabilities.push('inlineEvents')
  }
  if (bindingManifest.features.layout) {
    requiredCapabilities.push('layout')
  }
  const runtimeCapabilities = createWevuRuntimeCapabilityMetadata(requiredCapabilities)
  asset.runtimeCapabilities = runtimeCapabilities
  asset.script = buildScopedSlotComponentScript({
    classStyleBindings: scopedContext.classStyleBindings,
    inlineExpressions: scopedContext.inlineExpressions,
    layoutHosts: scopedContext.layoutHosts,
    templateRefs: scopedContext.templateRefs,
    bindingManifest,
    runtimeBindingManifest: scopedContext.runtimeBindingManifest,
    runtimeCapabilities,
  })
  return { componentName, slotKey }
}

function injectAttributesIntoOpeningTag(source: string, attrs: string[]): string | null {
  if (!attrs.length) {
    return source
  }
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

  return `${source.slice(0, tagNameEnd)} ${attrs.join(' ')}${source.slice(tagNameEnd)}`
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

function injectSlotAttributeIntoElementNode(
  child: any,
  slotAttr: string,
  extraAttrs: string[],
  transformNode: TransformNode,
  context: TransformContext,
): string | null {
  if (child.type !== NodeTypes.ELEMENT || child.tag === 'template') {
    return null
  }
  const sourceNode = child as ElementNode
  const slotAttribute = createSlotAttributeNode(sourceNode, slotAttr)
  if (!slotAttribute) {
    return null
  }
  const projectedNode: ElementNode = {
    ...sourceNode,
    props: [slotAttribute, ...sourceNode.props],
  }
  const transformed = transformNode(projectedNode, context)
  return injectAttributesIntoOpeningTag(transformed, extraAttrs)
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

function canInjectSlotAttributeIntoFallbackChild(child: any): boolean {
  if (child.type !== NodeTypes.ELEMENT) {
    return true
  }
  return (child as ElementNode).tag !== 'slot'
}

function matchesSlotFallbackWrapperMatcher(matcher: SlotFallbackWrapperMatcher | undefined, value: string | undefined): boolean {
  if (!matcher) {
    return true
  }
  if (!value) {
    return false
  }
  if (Array.isArray(matcher)) {
    return matcher.some(item => matchesSlotFallbackWrapperMatcher(item, value))
  }
  return typeof matcher === 'string'
    ? matcher === value
    : matcher.test(value)
}

function normalizeSlotFallbackWrapperTag(tag: string | undefined) {
  return tag?.trim() || 'view'
}

function mergeSlotFallbackWrapperAttrs(
  base: Record<string, string> | undefined,
  override: Record<string, string> | undefined,
) {
  if (!base) {
    return override
  }
  if (!override) {
    return base
  }
  return {
    ...base,
    ...override,
  }
}

function resolveSlotFallbackWrapper(
  context: TransformContext,
  info: SlotFallbackWrapperResolveContext,
): ResolvedSlotFallbackWrapper {
  const resolved: ResolvedSlotFallbackWrapper = {
    tag: normalizeSlotFallbackWrapperTag(context.slotFallbackWrapper.tag),
    attrs: context.slotFallbackWrapper.attrs,
    singleRootNoWrapper: context.slotFallbackWrapper.singleRootNoWrapper ?? context.slotSingleRootNoWrapper,
  }

  for (const rule of context.slotFallbackWrapper.rules) {
    if (
      matchesSlotFallbackWrapperMatcher(rule.component, info.component)
      && matchesSlotFallbackWrapperMatcher(rule.componentName, info.componentName)
      && matchesSlotFallbackWrapperMatcher(rule.slot, info.slot)
    ) {
      if (rule.tag) {
        resolved.tag = normalizeSlotFallbackWrapperTag(rule.tag)
      }
      if (rule.attrs) {
        resolved.attrs = mergeSlotFallbackWrapperAttrs(resolved.attrs, rule.attrs)
      }
      if (rule.singleRootNoWrapper !== undefined) {
        resolved.singleRootNoWrapper = rule.singleRootNoWrapper
      }
    }
  }

  if (info.local?.tag) {
    resolved.tag = normalizeSlotFallbackWrapperTag(info.local.tag)
  }
  if (info.local?.staticClass !== undefined) {
    resolved.staticClass = info.local.staticClass
  }
  if (info.local?.dynamicClassExp !== undefined) {
    resolved.dynamicClassExp = info.local.dynamicClassExp
  }
  if (info.local?.staticStyle !== undefined) {
    resolved.staticStyle = info.local.staticStyle
  }
  if (info.local?.dynamicStyleExp !== undefined) {
    resolved.dynamicStyleExp = info.local.dynamicStyleExp
  }
  if (info.local?.singleRootNoWrapper !== undefined) {
    resolved.singleRootNoWrapper = info.local.singleRootNoWrapper
  }

  return resolved
}

function createStaticAttributeNode(name: string, value: string): AttributeNode {
  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    nameLoc: undefined as any,
    value: {
      type: NodeTypes.TEXT,
      content: value,
      loc: undefined as any,
    },
    loc: undefined as any,
  }
}

function renderSlotFallbackWrapperAttrs(wrapper: ResolvedSlotFallbackWrapper, context: TransformContext): string[] {
  const attrs: string[] = []
  for (const [name, value] of Object.entries(wrapper.attrs ?? {})) {
    if (name === 'class' && (wrapper.staticClass !== undefined || wrapper.dynamicClassExp !== undefined)) {
      continue
    }
    if (name === 'style' && (wrapper.staticStyle !== undefined || wrapper.dynamicStyleExp !== undefined)) {
      continue
    }
    const attr = transformAttribute(createStaticAttributeNode(name, value), context)
    if (attr) {
      attrs.push(attr)
    }
  }
  const classBindingCount = context.classStyleBindings.length
  const classAttr = renderClassAttribute(wrapper.staticClass, wrapper.dynamicClassExp, context)
  if (wrapper.dynamicClassExp) {
    const binding = context.classStyleBindings
      .slice(classBindingCount)
      .find(item => item.type === 'class')
    recordBindingExpression(context, {
      kind: 'class',
      expression: wrapper.dynamicClassExp,
      outputPath: binding?.name,
    })
  }
  if (classAttr) {
    attrs.push(classAttr)
  }
  const styleBindingCount = context.classStyleBindings.length
  const styleAttr = renderStyleAttribute(wrapper.staticStyle, wrapper.dynamicStyleExp, undefined, context)
  if (wrapper.dynamicStyleExp) {
    const binding = context.classStyleBindings
      .slice(styleBindingCount)
      .find(item => item.type === 'style')
    recordBindingExpression(context, {
      kind: 'style',
      expression: wrapper.dynamicStyleExp,
      outputPath: binding?.name,
    })
  }
  if (styleAttr) {
    attrs.push(styleAttr)
  }
  return attrs
}

function renderPlainSlotOutlet(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const slotNameInfo = resolveSlotNameFromSlotElement(node)
  const hasScopeBindings = node.props.some((prop) => {
    if (prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind') {
      return prop.arg?.type !== NodeTypes.SIMPLE_EXPRESSION || prop.arg.content !== 'name'
    }
    return false
  })
  if (hasScopeBindings) {
    warn(context, '已禁用作用域插槽参数，插槽绑定将被忽略。', node.loc)
  }

  const fallbackContent = node.children
    .map(child => transformNode(child, context))
    .join('')

  const slotAttrs: string[] = []
  if (context.slottedScopeId) {
    slotAttrs.push(`${context.slottedScopeId}=""`)
  }
  const nameAttr = renderSlotNameAttribute(slotNameInfo, context, 'name')
  if (nameAttr) {
    slotAttrs.push(nameAttr)
  }
  const slotAttrString = slotAttrs.length ? ` ${slotAttrs.join(' ')}` : ''
  if (!hasScopeBindings && fallbackContent) {
    const slotPresentExp = createSlotPresenceExpression(slotNameInfo)
    if (slotPresentExp) {
      const slotTag = `<slot${slotAttrString} />`
      return `${context.platform.wrapIf(slotPresentExp, slotTag, exp => renderMustache(exp, context))}${context.platform.wrapElse(fallbackContent)}`
    }
  }
  return fallbackContent
    ? `<slot${slotAttrString}>${fallbackContent}</slot>`
    : `<slot${slotAttrString} />`
}

function transformFallbackChild(child: any, context: TransformContext, transformNode: TransformNode): string {
  if (child.type === NodeTypes.ELEMENT && (child as ElementNode).tag === 'slot') {
    return renderPlainSlotOutlet(child as ElementNode, context, transformNode)
  }
  return transformNode(child, context)
}

export function renderSlotFallback(
  decl: ScopedSlotDeclaration,
  context: TransformContext,
  transformNode: TransformNode,
  options?: {
    component?: string
    componentName?: string
    wrapper?: SlotFallbackWrapperResolveContext['local']
  },
): string {
  const slotAttr = renderSlotNameAttribute(decl.name, context, 'slot')
  const wrapCondition = (content: string) => {
    if (decl.conditionKind === 'else') {
      return context.platform.wrapElse(content)
    }
    if (decl.conditionKind === 'else-if' && decl.condition) {
      return context.platform.wrapElseIf(decl.condition, content, exp => renderMustache(exp, context))
    }
    if (decl.conditionKind === 'if' && decl.condition) {
      return context.platform.wrapIf(decl.condition, content, exp => renderMustache(exp, context))
    }
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
  const staticSlotName = resolveSlotStaticName(decl.name)
  const wrapper = resolveSlotFallbackWrapper(context, {
    component: options?.component,
    componentName: options?.componentName,
    slot: staticSlotName,
    local: {
      ...options?.wrapper,
      ...decl.wrapper,
    },
  })
  const wrapperAttrs = renderSlotFallbackWrapperAttrs(wrapper, context)
  const wrapperAttrString = wrapperAttrs.length ? ` ${wrapperAttrs.join(' ')}` : ''

  if (!wrapper.singleRootNoWrapper) {
    const rawContent = decl.children
      .map(child => transformFallbackChild(child, context, transformNode))
      .join('')
    if (!rawContent) {
      return ''
    }
    return wrapCondition(`<${wrapper.tag} ${slotAttr}${wrapperAttrString}>${rawContent}</${wrapper.tag}>`)
  }

  if (renderableChildren.length === 1) {
    const child = renderableChildren[0]!
    let projected: string | null = null
    if (canInjectSlotAttributeIntoFallbackChild(child)) {
      projected = child.type === NodeTypes.ELEMENT && isStructuralDirective(child as ElementNode).type
        ? injectSlotAttributeIntoElementNode(child, slotAttr, wrapperAttrs, transformNode, context)
        : injectAttributesIntoOpeningTag(transformNode(child, context), [slotAttr, ...wrapperAttrs])
    }
    if (projected) {
      return wrapCondition(projected)
    }
  }

  const content = renderableChildren
    .map(child => transformFallbackChild(child, context, transformNode))
    .join('')

  // 真机 / DevTools 运行时里，多节点 fallback 通过 `<block slot="...">` 投影并不稳定，
  // 某些布局场景（尤其父级是 flex）会直接丢失整组内容，因此这里只对“单根节点”做无包裹下推；
  // 只要出现多节点，就退回真实 `<view>` 容器，优先保证投影可见性和兼容性。
  return wrapCondition(`<${wrapper.tag} ${slotAttr}${wrapperAttrString}>${content}</${wrapper.tag}>`)
}

function recordSlotPropBindings(node: ElementNode, context: TransformContext) {
  const hasForDirective = node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'for')
  for (const prop of node.props) {
    if (prop.type !== NodeTypes.DIRECTIVE || prop.name !== 'bind') {
      continue
    }
    if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION) {
      if (prop.arg.content === 'name' || (hasForDirective && prop.arg.content === 'key')) {
        continue
      }
      const expression = getBindDirectiveExpression(prop)
      if (expression) {
        recordBindingExpression(context, {
          kind: 'component-prop',
          expression,
          sourceLocation: prop.exp?.loc ?? prop.loc,
        })
      }
      continue
    }
    if (prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
      recordBindingExpression(context, {
        kind: 'component-prop',
        expression: prop.exp.content,
        sourceLocation: prop.exp.loc,
      })
    }
  }
}

export function transformSlotElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  context.hasSlotOutlet = true
  context.bindingManifest.features.scopedSlots = true
  if (isScopedSlotsDisabled(context)) {
    // eslint-disable-next-line ts/no-use-before-define
    return transformSlotElementPlain(node, context, transformNode)
  }
  const slotNameInfo = resolveSlotNameFromSlotElement(node)
  let slotPropsExp = collectSlotBindingExpression(node, context)
  recordSlotPropBindings(node, context)

  let fallbackContent = ''
  if (node.children.length > 0) {
    fallbackContent = node.children
      .map(child => transformNode(child, context))
      .join('')
  }

  const slotAttrs: string[] = []
  if (context.slottedScopeId) {
    slotAttrs.push(`${context.slottedScopeId}=""`)
  }
  const nameAttr = renderSlotNameAttribute(slotNameInfo, context, 'name')
  if (nameAttr) {
    slotAttrs.push(nameAttr)
  }

  const slotAttrString = slotAttrs.length ? ` ${slotAttrs.join(' ')}` : ''
  let slotTag = `<slot${slotAttrString} />`
  const slotPresentExp = fallbackContent ? createSlotPresenceExpression(slotNameInfo) : undefined

  if (fallbackContent) {
    if (!slotPropsExp && slotPresentExp) {
      slotTag = `${context.platform.wrapIf(slotPresentExp, slotTag, exp => renderMustache(exp, context))}${context.platform.wrapElse(fallbackContent)}`
    }
    else if (!slotPropsExp) {
      slotTag = `<slot${slotAttrString}>${fallbackContent}</slot>`
    }
  }

  if (
    !slotPropsExp
    && (
      context.scopedSlotsRequireProps
      || slotNameInfo.type !== 'default'
      || !context.isPage
    )
  ) {
    return slotTag
  }

  const hasScopeBindings = Boolean(slotPropsExp)
  const slotKey = resolveSlotKey(context, slotNameInfo)
  const genericKey = `scoped-slots-${slotKey}`
  context.componentGenerics[genericKey] = true

  slotPropsExp = slotPropsExp ?? '[]'
  const scopedAttrs = [
    `${context.platform.directives.ifAttr}="${renderMustache(WEVU_SLOT_OWNER_ID_PROP, context)}"`,
    `${WEVU_SLOT_OWNER_ID_ATTR}="${renderMustache(WEVU_SLOT_OWNER_ID_PROP, context)}"`,
    `${WEVU_SLOT_PROPS_ATTR}="${renderMustache(slotPropsExp, context)}"`,
  ]
  if (context.slottedScopeId) {
    scopedAttrs.push(`${context.slottedScopeId}=""`)
  }
  if (context.slotMultipleInstance) {
    scopedAttrs.push(`${WEVU_SLOT_SCOPE_ATTR}="${renderMustache(WEVU_SLOT_SCOPE_KEY, context)}"`)
  }
  const scopedAttrString = scopedAttrs.length ? ` ${scopedAttrs.join(' ')}` : ''
  const scopedTag = `<${genericKey}${scopedAttrString} />`
  // DevTools 会在 v-for 展开前注册原生 slot，多实例场景必须只保留 scoped generic。
  const nativeFallbackTag = context.forStack.length > 0
    ? ''
    : context.platform.wrapIf(
        `!${WEVU_SLOT_OWNER_ID_PROP}`,
        slotTag,
        exp => renderMustache(exp, context),
      )
  const projectedContent = hasScopeBindings
    ? `${scopedTag}${nativeFallbackTag}`
    : `${scopedTag}${context.platform.wrapElse(slotTag)}`

  if (fallbackContent && slotPresentExp) {
    return `${context.platform.wrapIf(slotPresentExp, projectedContent, exp => renderMustache(exp, context))}${context.platform.wrapElse(fallbackContent)}`
  }

  return projectedContent
}

export function transformSlotElementPlain(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  return renderPlainSlotOutlet(node, context, transformNode)
}
