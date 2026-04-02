import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext, TransformNode } from '../types'
import type { ScopedSlotDeclaration } from './tag-slot'
import { NodeTypes } from '@vue/compiler-core'
import { transformAttribute } from '../attributes'
import { transformDirective } from '../directives'
import { renderMustache } from '../mustache'
import { collectElementAttributes } from './attrs'
import { buildScopePropsExpression, findSlotDirective, isScopedSlotsDisabled } from './helpers'
import { transformNormalElement } from './tag-normal'
import {
  buildSlotDeclaration,
  createScopedSlotComponent,
  renderSlotFallback,
  resolveSlotKey,
  resolveSlotNameFromDirective,

  stringifySlotName,
} from './tag-slot'

export function transformComponentWithSlots(
  node: ElementNode,
  context: TransformContext,
  transformNode: TransformNode,
  options?: { extraAttrs?: string[], forInfo?: ForParseResult },
): string {
  if (isScopedSlotsDisabled(context)) {
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
          ),
        )
        continue
      }
    }
    nonTemplateChildren.push(child)
  }

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
  else if (slotDeclarations.length && nonTemplateChildren.length) {
    const hasDefault = slotDeclarations.some(decl => decl.name.type === 'default' || (decl.name.type === 'static' && decl.name.value === 'default'))
    if (hasDefault) {
      context.warnings.push('存在显式的 v-slot:default，默认插槽内容将被忽略。')
    }
    else {
      slotDeclarations.push(buildSlotDeclaration({ type: 'default' }, undefined, nonTemplateChildren, context))
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
    if (!context.scopedSlotsRequireProps || hasSlotProps) {
      scopedSlotDeclarations.push(decl)
    }
    else {
      plainSlotDeclarations.push(decl)
    }
  }

  const slotNames: string[] = []
  const slotGenericAttrs: string[] = []
  for (const decl of scopedSlotDeclarations) {
    const slotKey = resolveSlotKey(context, decl.name)
    const { componentName } = createScopedSlotComponent(context, slotKey, decl.props, decl.children, transformNode)
    slotNames.push(stringifySlotName(decl.name, context))
    slotGenericAttrs.push(`generic:scoped-slots-${slotKey}="${componentName}"`)
  }

  const { attrs } = collectElementAttributes(node, context, {
    skipSlotDirective: true,
    forInfo: options?.forInfo,
    isComponent: true,
  })
  const mergedAttrs = [...extraAttrs, ...attrs, ...slotGenericAttrs]
  if (slotNames.length) {
    mergedAttrs.push(`vue-slots="${renderMustache(`[${slotNames.join(',')}]`, context)}"`)
  }
  if (scopedSlotDeclarations.length) {
    const scopePropsExp = buildScopePropsExpression(context)
    if (scopePropsExp) {
      mergedAttrs.push(`__wv-slot-scope="${renderMustache(scopePropsExp, context)}"`)
    }
    mergedAttrs.push(`__wv-slot-owner-id="${renderMustache(`__wvOwnerId || ''`, context)}"`)
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
          ),
        )
        continue
      }
    }
    nonTemplateChildren.push(child)
  }

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
  else if (slotDeclarations.length && nonTemplateChildren.length) {
    const hasDefault = slotDeclarations.some(decl => decl.name.type === 'default' || (decl.name.type === 'static' && decl.name.value === 'default'))
    if (hasDefault) {
      context.warnings.push('存在显式的 v-slot:default，默认插槽内容将被忽略。')
    }
    else {
      slotDeclarations.push(buildSlotDeclaration({ type: 'default' }, undefined, nonTemplateChildren, context))
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

  if (!isDirective || !isDirective.exp) {
    context.warnings.push('<component> 未提供 :is 绑定，将按普通元素处理。')
    return transformNormalElement(node, context, transformNode)
  }

  const componentVar = isDirective.exp.type === NodeTypes.SIMPLE_EXPRESSION ? isDirective.exp.content : ''

  const otherProps = node.props.filter(prop => prop !== isDirective)
  const attrs: string[] = []

  const slotDirective = findSlotDirective(node)
  const templateSlotChildren = node.children.filter(
    child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
  )
  if (slotDirective || templateSlotChildren.length > 0) {
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
