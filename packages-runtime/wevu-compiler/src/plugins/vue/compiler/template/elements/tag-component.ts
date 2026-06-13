import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, LocalSlotFallbackWrapperConfig, TransformContext, TransformNode } from '../types'
import type { ScopedSlotDeclaration } from './tag-slot'
import { NodeTypes } from '@vue/compiler-core'
import {
  WEVU_SLOT_NAMES_ATTR,
  WEVU_SLOT_OWNER_ID_ATTR,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_SCOPE_ATTR,
} from '@weapp-core/constants'
import { transformAttribute } from '../attributes'
import { transformDirective } from '../directives'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { registerRuntimeBindingExpression } from '../expression/runtimeBinding'
import { resolveTemplateTagName } from '../htmlTagMapping'
import { renderMustache } from '../mustache'
import { collectElementAttributes, isBuiltinTag } from './attrs'
import { buildScopePropsExpression, findSlotDirective, getBindDirectiveExpression, isScopedSlotsDisabled } from './helpers'
import { transformNormalElement } from './tag-normal'
import {
  buildSlotDeclaration,
  createScopedSlotComponent,
  renderSlotFallback,
  resolveSlotKey,
  resolveSlotNameFromDirective,
  stringifySlotName,
} from './tag-slot'

type SlotContentRenderItem
  = | { type: 'declaration', declaration: ScopedSlotDeclaration }
    | { type: 'default-child', child: any }

function hasLegacySlotAttribute(children: any[]): boolean {
  return children.some((child) => {
    if (child.type !== NodeTypes.ELEMENT) {
      return false
    }
    return (child as ElementNode).props.some(prop => prop.type === NodeTypes.ATTRIBUTE && prop.name === 'slot')
  })
}

function isRenderableSlotChild(child: any): boolean {
  if (child.type === NodeTypes.COMMENT) {
    return false
  }
  if (child.type === NodeTypes.TEXT) {
    return child.content.trim().length > 0
  }
  return true
}

function hasDirectComponentSlotChild(children: any[], context: TransformContext): boolean {
  return children.some((child) => {
    if (child.type !== NodeTypes.ELEMENT) {
      return false
    }
    if (child.tag === 'component') {
      return true
    }
    if (child.tag === 'template') {
      return false
    }
    if (isBuiltinTag(resolveTemplateTagName(child.tag, context))) {
      return false
    }
    return /^[A-Z]/.test(child.tag)
  })
}

function isWevuComponentTag(node: ElementNode, context: TransformContext) {
  return context.wevuComponentTags ? context.wevuComponentTags.has(node.tag) : /^[A-Z]/.test(node.tag)
}

function hasDirectWevuComponentSlotChild(children: any[], context: TransformContext): boolean {
  return children.some((child) => {
    if (child.type !== NodeTypes.ELEMENT) {
      return false
    }
    const element = child as ElementNode
    if (element.tag === 'template' || isBuiltinTag(resolveTemplateTagName(element.tag, context))) {
      return false
    }
    return isWevuComponentTag(element, context)
  })
}

function hasMiniProgramComponentSlotDescendant(children: any[], context: TransformContext): boolean {
  const componentTags = context.miniProgramComponentTags
  if (!componentTags?.size) {
    return false
  }
  return children.some((child) => {
    if (child.type !== NodeTypes.ELEMENT) {
      return false
    }
    const element = child as ElementNode
    if (componentTags.has(element.tag)) {
      return true
    }
    return hasMiniProgramComponentSlotDescendant(element.children, context)
  })
}

function hasNativeComponentSlotDescendant(children: any[], context: TransformContext): boolean {
  return children.some((child) => {
    if (child.type !== NodeTypes.ELEMENT) {
      return false
    }
    const element = child as ElementNode
    const resolvedTag = resolveTemplateTagName(element.tag, context)
    if (!isBuiltinTag(resolvedTag) && element.tag.includes('-') && !isWevuComponentTag(element, context)) {
      return true
    }
    return hasNativeComponentSlotDescendant(element.children, context)
  })
}

function shouldAugmentPlainSlot(
  decl: ScopedSlotDeclaration,
  context: TransformContext,
  ownerNode: ElementNode,
  hasScopedSlotPropsSibling: boolean,
) {
  if (context.scopedSlotsRequireProps) {
    return false
  }
  if (context.rewriteScopedSlot && !isWevuComponentTag(ownerNode, context)) {
    return false
  }
  if (context.rewriteScopedSlot) {
    if (context.scopedSlotsCompiler === 'augmented' && !decl.implicitDefault) {
      return true
    }
    return context.scopedSlotsCompiler === 'augmented'
      ? hasMiniProgramComponentSlotDescendant(decl.children, context)
      : hasScopedSlotPropsSibling && hasDirectComponentSlotChild(decl.children, context)
  }
  if (context.scopedSlotsCompiler === 'augmented') {
    if (!decl.implicitDefault) {
      return true
    }
    return hasMiniProgramComponentSlotDescendant(decl.children, context)
      || (!isWevuComponentTag(ownerNode, context) && hasNativeComponentSlotDescendant(decl.children, context))
  }
  if (!isWevuComponentTag(ownerNode, context)) {
    return false
  }
  return hasScopedSlotPropsSibling || hasDirectWevuComponentSlotChild(decl.children, context)
}

function resolveTemplateSlotCondition(node: ElementNode, context: TransformContext): {
  conditionKind?: 'if' | 'else-if' | 'else'
  condition?: string
} {
  const directive = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE
      && (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else')
      && (prop.name === 'else' || prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION),
  )
  if (!directive) {
    return {}
  }
  if (directive.name === 'else') {
    return { conditionKind: 'else' }
  }
  const rawExp = directive.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? directive.exp.content : ''
  const conditionKind = directive.name === 'else-if' ? 'else-if' : 'if'
  return {
    conditionKind,
    condition: rawExp ? normalizeWxmlExpressionWithContext(rawExp, context) : undefined,
  }
}

function resolveInlineStaticSlotName(name: string): string | null {
  if (!name.startsWith('\'') || !name.endsWith('\'')) {
    return null
  }
  const normalizedName = name.slice(1, -1)
  return /^[A-Z_$][\w$]*$/i.test(normalizedName) ? normalizedName : null
}

function pushSlotNamesAttr(
  attrs: string[],
  slotNames: Array<{ name: string, condition?: string }>,
  context: TransformContext,
  options?: { forInfo?: ForParseResult },
) {
  if (!slotNames.length) {
    return
  }
  const seen = new Set<string>()
  const entries = new Map<string, { conditions: string[], unconditional: boolean }>()
  for (const item of slotNames) {
    const dedupeKey = `${item.name}:${item.condition ?? ''}`
    if (seen.has(dedupeKey)) {
      continue
    }
    seen.add(dedupeKey)
    const entry = entries.get(item.name) ?? { conditions: [], unconditional: false }
    if (item.condition) {
      if (!entry.unconditional) {
        entry.conditions.push(item.condition)
      }
    }
    else {
      entry.conditions.length = 0
      entry.unconditional = true
    }
    entries.set(item.name, entry)
  }
  const properties: string[] = []
  const inlineProperties: string[] = []
  let canInlineStatic = !options?.forInfo
  for (const [name, entry] of entries) {
    const value = entry.conditions.length
      ? entry.conditions.map(condition => `(${condition})`).join('||')
      : 'true'
    const inlineName = resolveInlineStaticSlotName(name)
    if (value !== 'true' || !inlineName) {
      canInlineStatic = false
    }
    properties.push(`[${name}]:${value}`)
    inlineProperties.push(`${inlineName}:${value}`)
  }
  if (canInlineStatic) {
    const inlineSlots = `{${inlineProperties.join(',')}}`
    const mustache = context.mustacheInterpolation === 'spaced'
      ? renderMustache(inlineSlots, context)
      : `{{ ${inlineSlots} }}`
    attrs.push(`${WEVU_SLOT_NAMES_ATTR}="${mustache}"`)
    return
  }
  const slotNamesRef = registerRuntimeBindingExpression(`{${properties.join(',')}}`, context, {
    hint: 'vue-slots 元数据',
  })
  if (slotNamesRef) {
    attrs.push(`${WEVU_SLOT_NAMES_ATTR}="${renderMustache(slotNamesRef, context)}"`)
  }
}

function shouldExposePlainSlotPresence(node: ElementNode) {
  return node.tag === 'component'
}

function normalizeBooleanAttributeValue(value: string | undefined) {
  if (value === undefined || value === '') {
    return true
  }
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return undefined
}

function isSlotFallbackWrapperName(name: string, baseName: string, slotName: string | undefined) {
  return name === baseName || (
    slotName !== undefined
    && (name === `${baseName}-${slotName}` || name === `${baseName}:${slotName}`)
  )
}

function isSlotFallbackWrapperAttr(name: string, baseName: string, slotName: string | undefined, attrName?: string) {
  if (!attrName) {
    return isSlotFallbackWrapperName(name, baseName, slotName)
  }
  return name === `${baseName}-${attrName}` || (
    slotName !== undefined
    && (name === `${baseName}-${slotName}-${attrName}` || name === `${baseName}:${slotName}:${attrName}`)
  )
}

function resolveLocalSlotFallbackWrapperConfig(node: ElementNode, context: TransformContext, slotName?: string) {
  const wrapper: LocalSlotFallbackWrapperConfig = {}
  let hasConfig = false

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      if (isSlotFallbackWrapperAttr(prop.name, 'slot-wrapper', slotName)) {
        const tag = prop.value?.type === NodeTypes.TEXT ? prop.value.content.trim() : ''
        if (tag) {
          wrapper.tag = tag
          hasConfig = true
        }
        else {
          context.warnings.push('slot-wrapper 需要提供非空标签名，已忽略该配置。')
        }
      }
      else if (isSlotFallbackWrapperAttr(prop.name, 'slot-single-root-no-wrapper', slotName)) {
        const value = normalizeBooleanAttributeValue(prop.value?.type === NodeTypes.TEXT ? prop.value.content.trim() : undefined)
        if (value === undefined) {
          context.warnings.push('slot-single-root-no-wrapper 仅支持 true / false 静态值，已忽略该配置。')
        }
        else {
          wrapper.singleRootNoWrapper = value
          hasConfig = true
        }
      }
      else if (isSlotFallbackWrapperAttr(prop.name, 'slot-wrapper', slotName, 'class')) {
        const value = prop.value?.type === NodeTypes.TEXT ? prop.value.content.trim() : ''
        if (value) {
          wrapper.staticClass = value
          hasConfig = true
        }
      }
      else if (isSlotFallbackWrapperAttr(prop.name, 'slot-wrapper', slotName, 'style')) {
        const value = prop.value?.type === NodeTypes.TEXT ? prop.value.content.trim() : ''
        if (value) {
          wrapper.staticStyle = value
          hasConfig = true
        }
      }
    }
    else if (prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION) {
      if (isSlotFallbackWrapperAttr(prop.arg.content, 'slot-wrapper', slotName, 'class')) {
        const exp = getBindDirectiveExpression(prop)
        if (exp) {
          wrapper.dynamicClassExp = exp
          hasConfig = true
        }
      }
      else if (isSlotFallbackWrapperAttr(prop.arg.content, 'slot-wrapper', slotName, 'style')) {
        const exp = getBindDirectiveExpression(prop)
        if (exp) {
          wrapper.dynamicStyleExp = exp
          hasConfig = true
        }
      }
    }
  }

  return hasConfig ? wrapper : undefined
}

function mergeLocalSlotFallbackWrapperConfig(
  base: LocalSlotFallbackWrapperConfig | undefined,
  override: LocalSlotFallbackWrapperConfig | undefined,
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

function renderPlainSlotContentInSourceOrder(
  renderItems: SlotContentRenderItem[],
  plainSlotDeclarations: ScopedSlotDeclaration[],
  implicitDefaultDeclaration: ScopedSlotDeclaration | undefined,
  ownerComponent: string | undefined,
  ownerComponentName: string | undefined,
  ownerWrapper: LocalSlotFallbackWrapperConfig | undefined,
  context: TransformContext,
  transformNode: TransformNode,
) {
  const plainSlots = new Set(plainSlotDeclarations)
  const shouldRenderImplicitDefault = implicitDefaultDeclaration
    ? plainSlots.has(implicitDefaultDeclaration)
    : false

  return renderItems
    .map((item) => {
      if (item.type === 'declaration') {
        return plainSlots.has(item.declaration)
          ? renderSlotFallback(item.declaration, context, transformNode, {
              component: ownerComponent,
              componentName: ownerComponentName,
              wrapper: ownerWrapper,
            })
          : ''
      }
      return shouldRenderImplicitDefault
        ? transformNode(item.child, context)
        : ''
    })
    .join('')
}

export function shouldTransformAsComponentWithSlots(
  node: ElementNode,
  context: TransformContext,
  resolvedTag = resolveTemplateTagName(node.tag, context),
) {
  const slotDirective = findSlotDirective(node)
  const templateSlotChildren = node.children.filter(
    child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
  )
  const shouldUseAugmentedDefaultSlot = node.children.length > 0 && !context.scopedSlotsRequireProps && !isBuiltinTag(resolvedTag)
  const shouldUseSlotPresenceMetadata = node.children.length > 0 && isWevuComponentTag(node, context)
  return slotDirective || templateSlotChildren.length > 0 || shouldUseAugmentedDefaultSlot || shouldUseSlotPresenceMetadata
}

export function transformComponentWithSlots(
  node: ElementNode,
  context: TransformContext,
  transformNode: TransformNode,
  options?: { extraAttrs?: string[], forInfo?: ForParseResult },
): string {
  if (isScopedSlotsDisabled(context)) {
    // eslint-disable-next-line ts/no-use-before-define
    return transformComponentWithSlotsFallback(node, context, transformNode, options)
  }
  const extraAttrs = options?.extraAttrs ?? []
  const slotDeclarations: ScopedSlotDeclaration[] = []
  const slotDirective = findSlotDirective(node)
  const ownerWrapper = resolveLocalSlotFallbackWrapperConfig(node, context)

  const nonTemplateChildren: any[] = []
  const renderItems: SlotContentRenderItem[] = []
  for (const child of node.children) {
    if (child.type === NodeTypes.ELEMENT && child.tag === 'template') {
      const templateSlot = findSlotDirective(child as ElementNode)
      if (templateSlot) {
        const slotName = resolveSlotNameFromDirective(templateSlot)
        const templateSlotCondition = resolveTemplateSlotCondition(child as ElementNode, context)
        const declaration = buildSlotDeclaration(
          slotName,
          templateSlot.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? templateSlot.exp.content : undefined,
          (child as ElementNode).children,
          context,
          {
            ...templateSlotCondition,
            wrapper: mergeLocalSlotFallbackWrapperConfig(
              resolveLocalSlotFallbackWrapperConfig(node, context, slotName.type === 'static' ? slotName.value : undefined),
              resolveLocalSlotFallbackWrapperConfig(child as ElementNode, context),
            ),
          },
        )
        slotDeclarations.push(declaration)
        renderItems.push({ type: 'declaration', declaration })
        continue
      }
    }
    nonTemplateChildren.push(child)
    if (isRenderableSlotChild(child)) {
      renderItems.push({ type: 'default-child', child })
    }
  }

  const defaultSlotChildren = nonTemplateChildren.filter(isRenderableSlotChild)
  let implicitDefaultDeclaration: ScopedSlotDeclaration | undefined

  if (slotDirective) {
    if (slotDeclarations.length) {
      context.warnings.push('组件上的 v-slot 与 <template v-slot> 不能同时使用；仅使用组件上的 v-slot。')
    }
    slotDeclarations.length = 0
    slotDeclarations.push(
      buildSlotDeclaration(
        resolveSlotNameFromDirective(slotDirective),
        slotDirective.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? slotDirective.exp.content : undefined,
        node.children,
        context,
        { wrapper: ownerWrapper },
      ),
    )
  }
  else if (slotDeclarations.length && defaultSlotChildren.length) {
    const hasDefault = slotDeclarations.some(decl => decl.name.type === 'default' || (decl.name.type === 'static' && decl.name.value === 'default'))
    if (hasDefault) {
      context.warnings.push('存在显式的 v-slot:default，默认插槽内容将被忽略。')
    }
    else {
      implicitDefaultDeclaration = buildSlotDeclaration({ type: 'default' }, undefined, defaultSlotChildren, context, { implicitDefault: true })
      slotDeclarations.push(implicitDefaultDeclaration)
    }
  }
  else if (!slotDeclarations.length && defaultSlotChildren.length && !context.scopedSlotsRequireProps && !hasLegacySlotAttribute(defaultSlotChildren)) {
    implicitDefaultDeclaration = buildSlotDeclaration({ type: 'default' }, undefined, defaultSlotChildren, context, { implicitDefault: true })
    slotDeclarations.push(implicitDefaultDeclaration)
  }

  if (!slotDeclarations.length) {
    const { attrs, vTextExp } = collectElementAttributes(node, context, {
      skipSlotDirective: true,
      forInfo: options?.forInfo,
      isComponent: true,
    })
    let children = node.children
      .map(child => transformNode(child, context))
      .join('')
    if (vTextExp !== undefined) {
      children = renderMustache(vTextExp, context)
    }
    if (children && defaultSlotChildren.length && !hasLegacySlotAttribute(defaultSlotChildren) && isWevuComponentTag(node, context)) {
      pushSlotNamesAttr(attrs, [{ name: '\'default\'' }], context, { forInfo: options?.forInfo })
    }
    const mergedAttrs = [...extraAttrs, ...attrs]
    const attrString = mergedAttrs.length ? ` ${mergedAttrs.join(' ')}` : ''
    const { tag } = node
    return children
      ? `<${tag}${attrString}>${children}</${tag}>`
      : `<${tag}${attrString} />`
  }

  const scopedSlotDeclarations: ScopedSlotDeclaration[] = []
  const plainSlotDeclarations: ScopedSlotDeclaration[] = []
  const hasScopedSlotProps = slotDeclarations.some(decl => Object.keys(decl.props).length > 0)
  for (const decl of slotDeclarations) {
    const hasSlotProps = Object.keys(decl.props).length > 0
    if (hasSlotProps || shouldAugmentPlainSlot(decl, context, node, hasScopedSlotProps)) {
      scopedSlotDeclarations.push(decl)
    }
    else {
      plainSlotDeclarations.push(decl)
    }
  }

  const slotNames: Array<{ name: string, condition?: string }> = []
  const slotGenericAttrs: string[] = []
  const ownerComponentName = context.componentNameMap?.[node.tag]
  for (const decl of scopedSlotDeclarations) {
    const slotKey = resolveSlotKey(context, decl.name)
    const { componentName } = createScopedSlotComponent(context, slotKey, decl.props, decl.children, transformNode, {
      hostComponentName: node.tag,
    })
    slotNames.push({ name: stringifySlotName(decl.name, context), condition: decl.condition })
    slotGenericAttrs.push(`generic:scoped-slots-${slotKey}="${componentName}"`)
  }
  if (shouldExposePlainSlotPresence(node) || isWevuComponentTag(node, context)) {
    for (const decl of plainSlotDeclarations) {
      slotNames.push({ name: stringifySlotName(decl.name, context), condition: decl.condition })
    }
  }

  const { attrs } = collectElementAttributes(node, context, {
    skipSlotDirective: true,
    forInfo: options?.forInfo,
    isComponent: true,
  })
  const mergedAttrs = [...extraAttrs, ...attrs, ...slotGenericAttrs]
  pushSlotNamesAttr(mergedAttrs, slotNames, context, { forInfo: options?.forInfo })
  if (scopedSlotDeclarations.length) {
    const scopePropsExp = buildScopePropsExpression(context)
    if (scopePropsExp) {
      mergedAttrs.push(`${WEVU_SLOT_SCOPE_ATTR}="${renderMustache(scopePropsExp, context)}"`)
    }
    const ownerIdExp = context.rewriteScopedSlot
      ? `${WEVU_SLOT_OWNER_ID_PROP} || ${WEVU_SLOT_OWNER_ID_KEY} || ''`
      : `${WEVU_SLOT_OWNER_ID_PROP} || ${WEVU_SLOT_OWNER_ID_KEY} || ''`
    mergedAttrs.push(`${WEVU_SLOT_OWNER_ID_ATTR}="${renderMustache(ownerIdExp, context)}"`)
  }

  const attrString = mergedAttrs.length ? ` ${mergedAttrs.join(' ')}` : ''
  const { tag } = node
  const plainSlotContent = slotDirective
    ? plainSlotDeclarations
        .map(decl => renderSlotFallback(decl, context, transformNode, {
          component: node.tag,
          componentName: ownerComponentName,
          wrapper: ownerWrapper,
        }))
        .join('')
    : renderPlainSlotContentInSourceOrder(
        renderItems,
        plainSlotDeclarations,
        implicitDefaultDeclaration,
        node.tag,
        ownerComponentName,
        ownerWrapper,
        context,
        transformNode,
      )
  return plainSlotContent
    ? `<${tag}${attrString}>${plainSlotContent}</${tag}>`
    : `<${tag}${attrString} />`
}

export function transformComponentWithSlotsFallback(
  node: ElementNode,
  context: TransformContext,
  transformNode: TransformNode,
  options?: { extraAttrs?: string[], forInfo?: ForParseResult },
): string {
  const extraAttrs = options?.extraAttrs ?? []
  const slotDeclarations: ScopedSlotDeclaration[] = []
  const slotDirective = findSlotDirective(node)
  const ownerWrapper = resolveLocalSlotFallbackWrapperConfig(node, context)
  const nonTemplateChildren: any[] = []
  const renderItems: SlotContentRenderItem[] = []

  for (const child of node.children) {
    if (child.type === NodeTypes.ELEMENT && child.tag === 'template') {
      const templateSlot = findSlotDirective(child as ElementNode)
      if (templateSlot) {
        const slotName = resolveSlotNameFromDirective(templateSlot)
        const templateSlotCondition = resolveTemplateSlotCondition(child as ElementNode, context)
        const declaration = buildSlotDeclaration(
          slotName,
          templateSlot.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? templateSlot.exp.content : undefined,
          (child as ElementNode).children,
          context,
          {
            ...templateSlotCondition,
            wrapper: mergeLocalSlotFallbackWrapperConfig(
              resolveLocalSlotFallbackWrapperConfig(node, context, slotName.type === 'static' ? slotName.value : undefined),
              resolveLocalSlotFallbackWrapperConfig(child as ElementNode, context),
            ),
          },
        )
        slotDeclarations.push(declaration)
        renderItems.push({ type: 'declaration', declaration })
        continue
      }
    }
    nonTemplateChildren.push(child)
    if (isRenderableSlotChild(child)) {
      renderItems.push({ type: 'default-child', child })
    }
  }

  const defaultSlotChildren = nonTemplateChildren.filter(isRenderableSlotChild)
  let implicitDefaultDeclaration: ScopedSlotDeclaration | undefined

  if (slotDirective) {
    if (slotDeclarations.length) {
      context.warnings.push('组件上的 v-slot 与 <template v-slot> 不能同时使用；仅使用组件上的 v-slot。')
    }
    slotDeclarations.length = 0
    slotDeclarations.push(
      buildSlotDeclaration(
        resolveSlotNameFromDirective(slotDirective),
        slotDirective.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? slotDirective.exp.content : undefined,
        node.children,
        context,
        { wrapper: ownerWrapper },
      ),
    )
  }
  else if (slotDeclarations.length && defaultSlotChildren.length) {
    const hasDefault = slotDeclarations.some(decl => decl.name.type === 'default' || (decl.name.type === 'static' && decl.name.value === 'default'))
    if (hasDefault) {
      context.warnings.push('存在显式的 v-slot:default，默认插槽内容将被忽略。')
    }
    else {
      implicitDefaultDeclaration = buildSlotDeclaration({ type: 'default' }, undefined, defaultSlotChildren, context)
      slotDeclarations.push(implicitDefaultDeclaration)
    }
  }

  if (!slotDeclarations.length) {
    const { attrs, vTextExp } = collectElementAttributes(node, context, {
      skipSlotDirective: true,
      forInfo: options?.forInfo,
      isComponent: true,
    })
    let children = node.children
      .map(child => transformNode(child, context))
      .join('')
    if (vTextExp !== undefined) {
      children = renderMustache(vTextExp, context)
    }
    if (children && defaultSlotChildren.length && !hasLegacySlotAttribute(defaultSlotChildren) && isWevuComponentTag(node, context)) {
      pushSlotNamesAttr(attrs, [{ name: '\'default\'' }], context, { forInfo: options?.forInfo })
    }
    const mergedAttrs = [...extraAttrs, ...attrs]
    const attrString = mergedAttrs.length ? ` ${mergedAttrs.join(' ')}` : ''
    const { tag } = node
    return children
      ? `<${tag}${attrString}>${children}</${tag}>`
      : `<${tag}${attrString} />`
  }

  if (slotDeclarations.some(decl => Object.keys(decl.props).length)) {
    context.warnings.push('已禁用作用域插槽参数，插槽绑定将被忽略。')
  }

  const renderedSlots = slotDirective
    ? slotDeclarations
        .map(decl => renderSlotFallback(decl, context, transformNode, {
          component: node.tag,
          componentName: context.componentNameMap?.[node.tag],
          wrapper: ownerWrapper,
        }))
        .join('')
    : renderPlainSlotContentInSourceOrder(
        renderItems,
        slotDeclarations,
        implicitDefaultDeclaration,
        node.tag,
        context.componentNameMap?.[node.tag],
        ownerWrapper,
        context,
        transformNode,
      )

  const { attrs } = collectElementAttributes(node, context, {
    skipSlotDirective: true,
    forInfo: options?.forInfo,
    isComponent: true,
  })
  const mergedAttrs = [...extraAttrs, ...attrs]
  if (shouldExposePlainSlotPresence(node) || isWevuComponentTag(node, context)) {
    pushSlotNamesAttr(
      mergedAttrs,
      slotDeclarations.map(decl => ({ name: stringifySlotName(decl.name, context), condition: decl.condition })),
      context,
      { forInfo: options?.forInfo },
    )
  }
  const attrString = mergedAttrs.length ? ` ${mergedAttrs.join(' ')}` : ''
  const { tag } = node
  return renderedSlots
    ? `<${tag}${attrString}>${renderedSlots}</${tag}>`
    : `<${tag}${attrString} />`
}

export function transformComponentElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  // :is 或 v-bind:is
  let isDirective: DirectiveNode | undefined
  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      if ((prop.name === 'bind' && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === 'is')) {
        isDirective = prop
        break
      }
    }
  }

  if (!isDirective) {
    context.warnings.push('<component> 未提供 :is 绑定，将按普通元素处理。')
    return transformNormalElement(node, context, transformNode)
  }

  const componentVar = getBindDirectiveExpression(isDirective)
  if (!componentVar) {
    context.warnings.push('<component> 未提供 :is 绑定，将按普通元素处理。')
    return transformNormalElement(node, context, transformNode)
  }

  const otherProps = node.props.filter(prop => prop !== isDirective)
  const attrs: string[] = []

  const slotDirective = findSlotDirective(node)
  const templateSlotChildren = node.children.filter(
    child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
  )
  const shouldUseAugmentedDefaultSlot = node.children.length > 0 && !context.scopedSlotsRequireProps
  if (slotDirective || templateSlotChildren.length > 0 || shouldUseAugmentedDefaultSlot) {
    const slotNode = { ...node, props: otherProps } as ElementNode
    return transformComponentWithSlots(slotNode, context, transformNode, { extraAttrs: [`data-is="${renderMustache(componentVar, context)}"`] })
  }

  for (const prop of otherProps) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
    }
    else if (prop.type === NodeTypes.DIRECTIVE) {
      const dir = transformDirective(prop, context, node, undefined, { isComponent: true })
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  context.warnings.push(
    '动态组件使用 data-is 属性，可能需要小程序运行时支持。',
  )

  return `<component data-is="${renderMustache(componentVar, context)}"${attrString}>${children}</component>`
}
