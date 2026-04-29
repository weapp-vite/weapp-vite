import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext, TransformNode } from '../types'
import type { ScopedSlotDeclaration } from './tag-slot'
import { NodeTypes } from '@vue/compiler-core'
import {
  WEVU_SLOT_NAMES_ATTR,
  WEVU_SLOT_OWNER_ID_ATTR,
  WEVU_SLOT_OWNER_ID_KEY,
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

function resolveTemplateSlotCondition(node: ElementNode, context: TransformContext) {
  const ifDirective = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE
      && prop.name === 'if'
      && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION,
  )
  const rawExp = ifDirective?.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? ifDirective.exp.content : ''
  return rawExp ? normalizeWxmlExpressionWithContext(rawExp, context) : undefined
}

function pushSlotNamesAttr(
  attrs: string[],
  slotNames: Array<{ name: string, condition?: string }>,
  context: TransformContext,
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
  for (const [name, entry] of entries) {
    const value = entry.conditions.length
      ? entry.conditions.map(condition => `(${condition})`).join('||')
      : 'true'
    properties.push(`[${name}]:${value}`)
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

function isWevuComponentTag(node: ElementNode, context: TransformContext) {
  return context.wevuComponentTags ? context.wevuComponentTags.has(node.tag) : /^[A-Z]/.test(node.tag)
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

  const nonTemplateChildren: any[] = []
  for (const child of node.children) {
    if (child.type === NodeTypes.ELEMENT && child.tag === 'template') {
      const templateSlot = findSlotDirective(child as ElementNode)
      if (templateSlot) {
        const slotName = resolveSlotNameFromDirective(templateSlot)
        slotDeclarations.push(
          buildSlotDeclaration(
            slotName,
            templateSlot.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? templateSlot.exp.content : undefined,
            (child as ElementNode).children,
            context,
            { condition: resolveTemplateSlotCondition(child as ElementNode, context) },
          ),
        )
        continue
      }
    }
    nonTemplateChildren.push(child)
  }

  const defaultSlotChildren = nonTemplateChildren.filter(isRenderableSlotChild)

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
      ),
    )
  }
  else if (slotDeclarations.length && defaultSlotChildren.length) {
    const hasDefault = slotDeclarations.some(decl => decl.name.type === 'default' || (decl.name.type === 'static' && decl.name.value === 'default'))
    if (hasDefault) {
      context.warnings.push('存在显式的 v-slot:default，默认插槽内容将被忽略。')
    }
    else {
      slotDeclarations.push(buildSlotDeclaration({ type: 'default' }, undefined, defaultSlotChildren, context, { implicitDefault: true }))
    }
  }
  else if (!slotDeclarations.length && defaultSlotChildren.length && !context.scopedSlotsRequireProps && !hasLegacySlotAttribute(defaultSlotChildren)) {
    slotDeclarations.push(buildSlotDeclaration({ type: 'default' }, undefined, defaultSlotChildren, context, { implicitDefault: true }))
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
      pushSlotNamesAttr(attrs, [{ name: '\'default\'' }], context)
    }
    const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''
    const { tag } = node
    return children
      ? `<${tag}${attrString}>${children}</${tag}>`
      : `<${tag}${attrString} />`
  }

  const scopedSlotDeclarations: ScopedSlotDeclaration[] = []
  const plainSlotDeclarations: ScopedSlotDeclaration[] = []
  for (const decl of slotDeclarations) {
    const hasSlotProps = Object.keys(decl.props).length > 0
    if (hasSlotProps || (!context.scopedSlotsRequireProps && decl.implicitDefault && hasDirectComponentSlotChild(decl.children, context))) {
      scopedSlotDeclarations.push(decl)
    }
    else {
      plainSlotDeclarations.push(decl)
    }
  }

  const slotNames: Array<{ name: string, condition?: string }> = []
  const slotGenericAttrs: string[] = []
  for (const decl of scopedSlotDeclarations) {
    const slotKey = resolveSlotKey(context, decl.name)
    const { componentName } = createScopedSlotComponent(context, slotKey, decl.props, decl.children, transformNode)
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
  pushSlotNamesAttr(mergedAttrs, slotNames, context)
  if (scopedSlotDeclarations.length) {
    const scopePropsExp = buildScopePropsExpression(context)
    if (scopePropsExp) {
      mergedAttrs.push(`${WEVU_SLOT_SCOPE_ATTR}="${renderMustache(scopePropsExp, context)}"`)
    }
    mergedAttrs.push(`${WEVU_SLOT_OWNER_ID_ATTR}="${renderMustache(`${WEVU_SLOT_OWNER_ID_KEY} || ''`, context)}"`)
  }

  const attrString = mergedAttrs.length ? ` ${mergedAttrs.join(' ')}` : ''
  const { tag } = node
  const plainSlotContent = plainSlotDeclarations
    .map(decl => renderSlotFallback(decl, context, transformNode))
    .join('')
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
  const nonTemplateChildren: any[] = []

  for (const child of node.children) {
    if (child.type === NodeTypes.ELEMENT && child.tag === 'template') {
      const templateSlot = findSlotDirective(child as ElementNode)
      if (templateSlot) {
        const slotName = resolveSlotNameFromDirective(templateSlot)
        slotDeclarations.push(
          buildSlotDeclaration(
            slotName,
            templateSlot.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? templateSlot.exp.content : undefined,
            (child as ElementNode).children,
            context,
            { condition: resolveTemplateSlotCondition(child as ElementNode, context) },
          ),
        )
        continue
      }
    }
    nonTemplateChildren.push(child)
  }

  const defaultSlotChildren = nonTemplateChildren.filter(isRenderableSlotChild)

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
      ),
    )
  }
  else if (slotDeclarations.length && defaultSlotChildren.length) {
    const hasDefault = slotDeclarations.some(decl => decl.name.type === 'default' || (decl.name.type === 'static' && decl.name.value === 'default'))
    if (hasDefault) {
      context.warnings.push('存在显式的 v-slot:default，默认插槽内容将被忽略。')
    }
    else {
      slotDeclarations.push(buildSlotDeclaration({ type: 'default' }, undefined, defaultSlotChildren, context))
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
      pushSlotNamesAttr(attrs, [{ name: '\'default\'' }], context)
    }
    const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''
    const { tag } = node
    return children
      ? `<${tag}${attrString}>${children}</${tag}>`
      : `<${tag}${attrString} />`
  }

  if (slotDeclarations.some(decl => Object.keys(decl.props).length)) {
    context.warnings.push('已禁用作用域插槽参数，插槽绑定将被忽略。')
  }

  const renderedSlots = slotDeclarations
    .map(decl => renderSlotFallback(decl, context, transformNode))
    .join('')

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
