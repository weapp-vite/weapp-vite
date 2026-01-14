import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { TransformContext, TransformNode } from '../types'
import * as t from '@babel/types'
import { NodeTypes } from '@vue/compiler-core'
import { parse as babelParse } from '../../../../../utils/babel'
import { buildClassStyleWxsTag } from '../classStyleRuntime'
import { normalizeWxmlExpressionWithContext } from '../expression'
import {
  collectScopePropMapping,
  hashString,
  isScopedSlotsDisabled,
  toWxmlStringLiteral,
  withSlotProps,
} from './helpers'

export type SlotNameInfo = { type: 'default' } | { type: 'static', value: string } | { type: 'dynamic', exp: string }

export interface ScopedSlotDeclaration {
  name: SlotNameInfo
  props: Record<string, string>
  children: any[]
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
    return `${attrName}="{{${expValue}}}"`
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
        const raw = prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.exp.content : ''
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
  context.warnings.push('Dynamic slot names are matched by expression hash; ensure provider/consumer expressions align.')
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

function parseSlotPropsExpression(exp: string, context: TransformContext): Record<string, string> {
  const trimmed = exp.trim()
  if (!trimmed) {
    return {}
  }
  try {
    const ast = babelParse(`(${trimmed}) => {}`, { sourceType: 'module', plugins: ['typescript'] })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return {}
    }
    const expression = (stmt as any).expression as t.Expression
    if (!t.isArrowFunctionExpression(expression)) {
      return {}
    }
    const param = expression.params[0]
    if (!param) {
      return {}
    }
    if (t.isIdentifier(param)) {
      return { [param.name]: '' }
    }
    if (t.isObjectPattern(param)) {
      const mapping: Record<string, string> = {}
      for (const prop of param.properties) {
        if (t.isRestElement(prop)) {
          context.warnings.push('Scoped slot rest elements are not supported in mini-programs.')
          continue
        }
        if (!t.isObjectProperty(prop)) {
          continue
        }
        const key = prop.key
        const propName = t.isIdentifier(key)
          ? key.name
          : t.isStringLiteral(key)
            ? key.value
            : undefined
        if (!propName) {
          context.warnings.push('Scoped slot computed keys are not supported in mini-programs.')
          continue
        }
        const value = prop.value
        if (t.isIdentifier(value)) {
          mapping[value.name] = propName
          continue
        }
        if (t.isAssignmentPattern(value) && t.isIdentifier(value.left)) {
          mapping[value.left.name] = propName
          context.warnings.push('Scoped slot default values are not supported; default will be ignored.')
          continue
        }
        context.warnings.push('Scoped slot destructuring is limited to identifier bindings.')
      }
      return mapping
    }
  }
  catch {
    context.warnings.push('Failed to parse scoped slot props; falling back to empty props.')
  }
  return {}
}

export function buildSlotDeclaration(
  name: SlotNameInfo,
  propsExp: string | undefined,
  children: any[],
  context: TransformContext,
): ScopedSlotDeclaration {
  const props = propsExp ? parseSlotPropsExpression(propsExp, context) : {}
  return { name, props, children }
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
  })
  return { componentName, slotKey }
}

export function renderSlotFallback(
  decl: ScopedSlotDeclaration,
  context: TransformContext,
  transformNode: TransformNode,
): string {
  const content = decl.children.map(child => transformNode(child, context)).join('')
  if (!content) {
    return ''
  }
  const slotAttr = renderSlotNameAttribute(decl.name, context, 'slot')
  if (!slotAttr) {
    return content
  }
  return `<view ${slotAttr}>${content}</view>`
}

export function transformSlotElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  if (isScopedSlotsDisabled(context)) {
    return transformSlotElementPlain(node, context, transformNode)
  }
  const slotNameInfo = resolveSlotNameFromSlotElement(node)
  let bindObjectExp: string | null = null
  const namedBindings: Array<{ key: string, value: string }> = []

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name') {
      continue
    }
    if (prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind') {
      if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION) {
        const rawExpValue = prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.exp.content : ''
        if (prop.arg.content === 'name') {
          continue
        }
        if (rawExpValue) {
          namedBindings.push({ key: prop.arg.content, value: normalizeWxmlExpressionWithContext(rawExpValue, context) })
        }
        continue
      }
      if (prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        bindObjectExp = normalizeWxmlExpressionWithContext(prop.exp.content, context)
        continue
      }
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name !== 'name') {
      const literal = prop.value?.type === NodeTypes.TEXT ? prop.value.content : ''
      if (literal) {
        namedBindings.push({ key: prop.name, value: `'${literal.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'` })
      }
    }
  }

  if (bindObjectExp && namedBindings.length) {
    context.warnings.push('Scoped slot props using v-bind object will ignore additional named bindings.')
    namedBindings.length = 0
  }

  let slotPropsExp = bindObjectExp
  if (!slotPropsExp && namedBindings.length) {
    slotPropsExp = `[${namedBindings.map(entry => `${toWxmlStringLiteral(entry.key)},${entry.value}`).join(',')}]`
  }

  let fallbackContent = ''
  if (node.children.length > 0) {
    fallbackContent = node.children
      .map(child => transformNode(child, context))
      .join('')
  }

  if (slotPropsExp && fallbackContent) {
    context.warnings.push('Scoped slot fallback content is not supported and will be ignored.')
    fallbackContent = ''
  }
  const slotAttrs: string[] = []
  const nameAttr = renderSlotNameAttribute(slotNameInfo, context, 'name')
  if (nameAttr) {
    slotAttrs.push(nameAttr)
  }

  const slotAttrString = slotAttrs.length ? ` ${slotAttrs.join(' ')}` : ''
  const slotTag = fallbackContent
    ? `<slot${slotAttrString}>${fallbackContent}</slot>`
    : `<slot${slotAttrString} />`

  const slotKey = resolveSlotKey(context, slotNameInfo)
  const genericKey = `scoped-slots-${slotKey}`
  context.componentGenerics[genericKey] = true

  const resolvedSlotPropsExp = slotPropsExp ?? '[]'
  const scopedAttrs = [
    `__wv-owner-id="{{__wvSlotOwnerId}}"`,
    `__wv-slot-props="{{${resolvedSlotPropsExp}}}"`,
  ]
  if (context.slotMultipleInstance) {
    scopedAttrs.push(`__wv-slot-scope="{{__wvSlotScope}}"`)
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
    context.warnings.push('Scoped slot props are disabled; slot bindings will be ignored.')
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
