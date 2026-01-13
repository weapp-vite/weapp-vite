import type {
  DirectiveNode,
  ElementNode,
} from '@vue/compiler-core'
import type { ForParseResult, TransformContext, TransformNode } from './types'
import * as t from '@babel/types'
import { NodeTypes } from '@vue/compiler-core'
import { parse as babelParse } from '../../../../utils/babel'
import { renderClassAttribute, renderStyleAttribute, transformAttribute } from './attributes'
import { buildClassStyleWxsTag } from './classStyleRuntime'
import { transformDirective } from './directives'
import { normalizeJsExpressionWithContext, normalizeWxmlExpressionWithContext } from './expression'

function isStructuralDirective(node: ElementNode): {
  type: 'if' | 'for' | null
  directive: DirectiveNode | undefined
} {
  // 检查是否有 v-if, v-else-if, v-else, v-for 指令
  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else') {
        return { type: 'if', directive: prop }
      }
      if (prop.name === 'for') {
        return { type: 'for', directive: prop }
      }
    }
  }
  return { type: null, directive: undefined }
}

function pushScope(context: TransformContext, names: string[]) {
  if (!names.length) {
    return
  }
  context.scopeStack.push(new Set(names))
}

function popScope(context: TransformContext) {
  if (context.scopeStack.length) {
    context.scopeStack.pop()
  }
}

function pushForScope(context: TransformContext, info: ForParseResult) {
  if (!info.listExp) {
    return
  }
  context.forStack.push({ ...info })
}

function popForScope(context: TransformContext) {
  if (context.forStack.length) {
    context.forStack.pop()
  }
}

function withForScope<T>(context: TransformContext, info: ForParseResult, fn: () => T): T {
  pushForScope(context, info)
  try {
    return fn()
  }
  finally {
    popForScope(context)
  }
}

function pushSlotProps(context: TransformContext, mapping: Record<string, string>) {
  if (!Object.keys(mapping).length) {
    return
  }
  context.slotPropStack.push(mapping)
}

function popSlotProps(context: TransformContext) {
  if (context.slotPropStack.length) {
    context.slotPropStack.pop()
  }
}

function withScope<T>(context: TransformContext, names: string[], fn: () => T): T {
  pushScope(context, names)
  try {
    return fn()
  }
  finally {
    popScope(context)
  }
}

function withSlotProps<T>(context: TransformContext, mapping: Record<string, string>, fn: () => T): T {
  pushSlotProps(context, mapping)
  try {
    return fn()
  }
  finally {
    popSlotProps(context)
  }
}

function collectScopePropMapping(context: TransformContext): Record<string, string> {
  const mapping: Record<string, string> = {}
  if (!context.slotMultipleInstance) {
    return mapping
  }
  for (const scope of context.scopeStack) {
    for (const name of scope) {
      if (!/^[A-Z_$][\w$]*$/i.test(name)) {
        continue
      }
      if (!Object.prototype.hasOwnProperty.call(mapping, name)) {
        mapping[name] = name
      }
    }
  }
  return mapping
}

function buildScopePropsExpression(context: TransformContext): string | null {
  const mapping = collectScopePropMapping(context)
  const keys = Object.keys(mapping)
  if (!keys.length) {
    return null
  }
  return `[${keys.map(key => `${toWxmlStringLiteral(key)},${key}`).join(',')}]`
}

function toWxmlStringLiteral(value: string) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  return `'${escaped}'`
}

function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function isScopedSlotsDisabled(context: TransformContext) {
  return context.scopedSlotsCompiler === 'off'
}

function renderSlotNameAttribute(
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

type SlotNameInfo = { type: 'default' } | { type: 'static', value: string } | { type: 'dynamic', exp: string }

interface ScopedSlotDeclaration {
  name: SlotNameInfo
  props: Record<string, string>
  children: any[]
}

function resolveSlotNameFromDirective(slotDirective: DirectiveNode): SlotNameInfo {
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

function resolveSlotNameFromSlotElement(node: ElementNode): SlotNameInfo {
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

function resolveSlotKey(context: TransformContext, info: SlotNameInfo): string {
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

function stringifySlotName(info: SlotNameInfo, context: TransformContext): string {
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

function findSlotDirective(node: ElementNode): DirectiveNode | undefined {
  return node.props.find(
    prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'slot',
  ) as DirectiveNode | undefined
}

function buildSlotDeclaration(
  name: SlotNameInfo,
  propsExp: string | undefined,
  children: any[],
  context: TransformContext,
): ScopedSlotDeclaration {
  const props = propsExp ? parseSlotPropsExpression(propsExp, context) : {}
  return { name, props, children }
}

function createScopedSlotComponent(
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
    const helperTag = buildClassStyleWxsTag(ext)
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

export function transformElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const { tag } = node

  // 检查是否是 template 元素（用于 slot 内容）
  if (tag === 'template') {
    return transformTemplateElement(node, context, transformNode)
  }

  // 检查是否是 slot 元素
  if (tag === 'slot') {
    return transformSlotElement(node, context, transformNode)
  }

  // 检查是否是 component 元素（动态组件）
  if (tag === 'component') {
    return transformComponentElement(node, context, transformNode)
  }

  // 检查是否是 transition 元素
  if (tag === 'transition') {
    return transformTransitionElement(node, context, transformNode)
  }

  // 检查是否是 keep-alive 元素
  if (tag === 'keep-alive') {
    return transformKeepAliveElement(node, context, transformNode)
  }

  // 检查是否有结构指令
  const { type } = isStructuralDirective(node)

  if (type === 'if') {
    return transformIfElement(node, context, transformNode)
  }

  if (type === 'for') {
    return transformForElement(node, context, transformNode)
  }

  // 普通元素
  return transformNormalElement(node, context, transformNode)
}

function collectElementAttributes(
  node: ElementNode,
  context: TransformContext,
  options?: { forInfo?: ForParseResult, skipSlotDirective?: boolean, extraAttrs?: string[] },
) {
  const { props } = node
  const attrs: string[] = options?.extraAttrs ? [...options.extraAttrs] : []
  let staticClass: string | undefined
  let dynamicClassExp: string | undefined
  let staticStyle: string | undefined
  let dynamicStyleExp: string | undefined
  let vShowExp: string | undefined
  let vTextExp: string | undefined

  for (const prop of props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      if (prop.name === 'class' && prop.value?.type === NodeTypes.TEXT) {
        staticClass = prop.value.content
        continue
      }
      if (prop.name === 'style' && prop.value?.type === NodeTypes.TEXT) {
        staticStyle = prop.value.content
        continue
      }
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
      continue
    }
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (options?.skipSlotDirective && prop.name === 'slot') {
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'class'
        && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
      ) {
        dynamicClassExp = prop.exp.content
        continue
      }
      if (
        prop.name === 'bind'
        && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION
        && prop.arg.content === 'style'
        && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION
      ) {
        dynamicStyleExp = prop.exp.content
        continue
      }
      if (prop.name === 'show' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        vShowExp = prop.exp.content
        continue
      }
      if (prop.name === 'text' && prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        vTextExp = normalizeWxmlExpressionWithContext(prop.exp.content, context)
        continue
      }
      const dir = transformDirective(prop, context, node, options?.forInfo)
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  const classAttr = renderClassAttribute(staticClass, dynamicClassExp, context)
  if (classAttr) {
    attrs.unshift(classAttr)
  }
  const styleAttr = renderStyleAttribute(
    staticStyle,
    dynamicStyleExp,
    vShowExp,
    context,
  )
  if (styleAttr) {
    attrs.unshift(styleAttr)
  }

  return { attrs, vTextExp }
}

function transformNormalElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  const { tag } = node

  const slotDirective = findSlotDirective(node)
  const templateSlotChildren = node.children.filter(
    child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
  )
  if (slotDirective || templateSlotChildren.length > 0) {
    return transformComponentWithSlots(node, context, transformNode)
  }

  const { attrs, vTextExp } = collectElementAttributes(node, context)

  // 处理子元素
  let children = ''
  if (node.children.length > 0) {
    children = node.children
      .map(child => transformNode(child, context))
      .join('')
  }
  if (vTextExp !== undefined) {
    children = `{{${vTextExp}}}`
  }

  // 生成 WXML
  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  return children
    ? `<${tag}${attrString}>${children}</${tag}>`
    : `<${tag}${attrString} />`
}

function transformComponentWithSlots(
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
      context.warnings.push('v-slot on component and <template v-slot> cannot be used together; using component v-slot only.')
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
      context.warnings.push('Default slot content is ignored because an explicit v-slot:default is present.')
    }
    else {
      slotDeclarations.push(buildSlotDeclaration({ type: 'default' }, undefined, nonTemplateChildren, context))
    }
  }

  if (!slotDeclarations.length) {
    const { attrs, vTextExp } = collectElementAttributes(node, context, {
      skipSlotDirective: true,
      forInfo: options?.forInfo,
    })
    let children = node.children
      .map(child => transformNode(child, context))
      .join('')
    if (vTextExp !== undefined) {
      children = `{{${vTextExp}}}`
    }
    const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''
    const { tag } = node
    return children
      ? `<${tag}${attrString}>${children}</${tag}>`
      : `<${tag}${attrString} />`
  }

  const slotNames: string[] = []
  const slotGenericAttrs: string[] = []
  for (const decl of slotDeclarations) {
    const slotKey = resolveSlotKey(context, decl.name)
    const { componentName } = createScopedSlotComponent(context, slotKey, decl.props, decl.children, transformNode)
    slotNames.push(stringifySlotName(decl.name, context))
    slotGenericAttrs.push(`generic:scoped-slots-${slotKey}="${componentName}"`)
  }

  const { attrs } = collectElementAttributes(node, context, {
    skipSlotDirective: true,
    forInfo: options?.forInfo,
  })
  const mergedAttrs = [...extraAttrs, ...attrs, ...slotGenericAttrs]
  if (slotNames.length) {
    mergedAttrs.push(`vue-slots="{{[${slotNames.join(',')}]}}"`)
  }
  const scopePropsExp = buildScopePropsExpression(context)
  if (scopePropsExp) {
    mergedAttrs.push(`__wv-slot-scope="{{${scopePropsExp}}}"`)
  }
  mergedAttrs.push(`__wv-slot-owner-id="{{__wvOwnerId || ''}}"`)

  const attrString = mergedAttrs.length ? ` ${mergedAttrs.join(' ')}` : ''
  const { tag } = node
  return `<${tag}${attrString} />`
}

function renderSlotFallback(
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

function transformComponentWithSlotsFallback(
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
      context.warnings.push('v-slot on component and <template v-slot> cannot be used together; using component v-slot only.')
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
      context.warnings.push('Default slot content is ignored because an explicit v-slot:default is present.')
    }
    else {
      slotDeclarations.push(buildSlotDeclaration({ type: 'default' }, undefined, nonTemplateChildren, context))
    }
  }

  if (!slotDeclarations.length) {
    const { attrs, vTextExp } = collectElementAttributes(node, context, {
      skipSlotDirective: true,
      forInfo: options?.forInfo,
    })
    let children = node.children
      .map(child => transformNode(child, context))
      .join('')
    if (vTextExp !== undefined) {
      children = `{{${vTextExp}}}`
    }
    const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''
    const { tag } = node
    return children
      ? `<${tag}${attrString}>${children}</${tag}>`
      : `<${tag}${attrString} />`
  }

  if (slotDeclarations.some(decl => Object.keys(decl.props).length)) {
    context.warnings.push('Scoped slot props are disabled; slot bindings will be ignored.')
  }

  const renderedSlots = slotDeclarations
    .map(decl => renderSlotFallback(decl, context, transformNode))
    .join('')

  const { attrs } = collectElementAttributes(node, context, {
    skipSlotDirective: true,
    forInfo: options?.forInfo,
  })
  const mergedAttrs = [...extraAttrs, ...attrs]
  const attrString = mergedAttrs.length ? ` ${mergedAttrs.join(' ')}` : ''
  const { tag } = node
  return renderedSlots
    ? `<${tag}${attrString}>${renderedSlots}</${tag}>`
    : `<${tag}${attrString} />`
}

function transformSlotElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
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

function transformSlotElementPlain(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
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

function transformComponentElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  // 查找 :is 或 v-bind:is 指令
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
    // 没有 :is 绑定，当作普通元素处理
    context.warnings.push('<component> without :is binding, treating as regular element')
    return transformNormalElement(node, context, transformNode)
  }

  const componentVar = isDirective.exp.type === NodeTypes.SIMPLE_EXPRESSION ? isDirective.exp.content : ''

  // 微信小程序使用 data-is 属性来支持动态组件
  // 同时需要添加其他属性
  const otherProps = node.props.filter(prop => prop !== isDirective)
  const attrs: string[] = []

  const slotDirective = findSlotDirective(node)
  const templateSlotChildren = node.children.filter(
    child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
  )
  if (slotDirective || templateSlotChildren.length > 0) {
    const slotNode = { ...node, props: otherProps } as ElementNode
    return transformComponentWithSlots(slotNode, context, transformNode, { extraAttrs: [`data-is="{{${componentVar}}}"`] })
  }

  for (const prop of otherProps) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      const attr = transformAttribute(prop, context)
      if (attr) {
        attrs.push(attr)
      }
    }
    else if (prop.type === NodeTypes.DIRECTIVE) {
      const dir = transformDirective(prop, context, node)
      if (dir) {
        attrs.push(dir)
      }
    }
  }

  // 处理子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

  // 使用 data-is 属性
  context.warnings.push(
    'Dynamic components use data-is attribute which may require runtime support in mini-programs',
  )

  return `<component data-is="{{${componentVar}}}"${attrString}>${children}</component>`
}

function transformTransitionElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  // 组件：transition 主要用于包裹需要过渡的元素
  // 在小程序中，我们移除外层 <transition>，只渲染子元素
  // 但添加特殊的 class 或 data 属性供运行时处理过渡

  context.warnings.push(
    '<transition> component: transitions require animation library or runtime support. Rendering children only.',
  )

  // 处理子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  // 如果只有一个子元素，直接返回它
  if (node.children.length === 1) {
    return children
  }

  // 多个子元素用 block 包裹
  return children || ''
}

function transformKeepAliveElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  context.warnings.push(
    '<keep-alive> component: requires runtime state management. Rendering children with marker.',
  )

  // 处理子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  // 添加 keep-alive 标记，供运行时处理
  return `<block data-keep-alive="true">${children}</block>`
}

function transformTemplateElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  let nameAttr = ''
  let isAttr = ''
  let dataAttr = ''
  let hasOtherDirective = false
  let structuralDirective: DirectiveNode | undefined

  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (prop.name === 'slot') {
        context.warnings.push('<template v-slot> should be a child of a component element; it was ignored.')
        continue
      }
      hasOtherDirective = true
      if (!structuralDirective && (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else' || prop.name === 'for')) {
        structuralDirective = prop
      }
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name') {
      nameAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'is') {
      isAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'data') {
      dataAttr = prop.value && prop.value.type === NodeTypes.TEXT ? prop.value.content : ''
    }
  }

  // 转换 template 的子元素
  const children = node.children
    .map(child => transformNode(child, context))
    .join('')

  // 无 slot 且无语义属性时，根据是否包含指令决定如何降级
  if (!nameAttr && !isAttr && !dataAttr) {
    if (structuralDirective?.name === 'for') {
      // 结构指令 v-for：使用 block 承载平台 for 指令
      return transformForElement({ ...node, tag: 'block' } as ElementNode, context, transformNode)
    }
    if (structuralDirective && (structuralDirective.name === 'if' || structuralDirective.name === 'else-if' || structuralDirective.name === 'else')) {
      // 条件指令：使用 block 承载平台 if / elif / else
      const dir = structuralDirective
      const base = node.props.filter(prop => prop !== dir)
      const fakeNode: ElementNode = { ...node, tag: 'block', props: base }
      if (dir.name === 'if' && dir.exp) {
        const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
        const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
        return context.platform.wrapIf(expValue, children)
      }
      if (dir.name === 'else-if' && dir.exp) {
        const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
        const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
        return context.platform.wrapElseIf(expValue, children)
      }
      if (dir.name === 'else') {
        return context.platform.wrapElse(children)
      }
      // 回退：使用通用转换
      return transformIfElement(fakeNode, context, transformNode)
    }
    if (hasOtherDirective) {
      // 条件/循环等结构指令：用 block 保留语义
      return transformNormalElement(node, context, transformNode).replace(/<template/g, '<block').replace(/<\/template>/g, '</block>')
    }
    // 纯占位：直接展开子节点
    return children
  }

  // 构建属性
  const attrs: string[] = []
  if (nameAttr) {
    attrs.push(`name="${nameAttr}"`)
  }
  if (isAttr) {
    attrs.push(`is="${isAttr}"`)
  }
  if (dataAttr) {
    attrs.push(`data="${dataAttr}"`)
  }

  const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''
  return `<template${attrString}>${children}</template>`
}

function parseForExpression(exp: string): ForParseResult {
  // 解析 v-for 表达式
  // 支持: "item in list", "(item, index) in list", "(item, key, index) in list"

  // eslint-disable-next-line regexp/no-super-linear-backtracking -- 这里的正则来自模板转换逻辑，保持原样避免误伤
  const match = exp.match(/^\(([^,]+),\s*([^,]+),\s*([^)]+)\)\s+in\s+(.+)$/)
  if (match) {
    const [, item, _key, index, list] = match
    return {
      listExp: list,
      item,
      index,
      key: _key,
    }
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking -- 这里的正则来自模板转换逻辑，保持原样避免误伤
  const match2 = exp.match(/^\(([^,]+),\s*([^)]+)\)\s+in\s+(.+)$/)
  if (match2) {
    const [, item, index, list] = match2
    return {
      listExp: list,
      item,
      index,
    }
  }

  // eslint-disable-next-line regexp/no-super-linear-backtracking -- 这里的正则来自模板转换逻辑，保持原样避免误伤
  const match3 = exp.match(/^(\w+)\s+in\s+(.+)$/)
  if (match3) {
    const [, item, list] = match3
    return {
      listExp: list,
      item,
    }
  }

  // 如果无法解析，返回空
  return {}
}

function transformIfElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  // 查找所有兄弟元素中的 v-if/v-else-if/v-else 指令
  // 这里简化处理，只处理当前元素
  const ifDirective = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE
      && (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else'),
  )

  if (!ifDirective) {
    /* istanbul ignore next */
    return transformNormalElement(node, context, transformNode)
  }

  // 移除 v-if 指令后转换元素
  const otherProps = node.props.filter(prop => prop !== ifDirective)
  const elementWithoutIf = { ...node, props: otherProps }

  // 转换内容
  const content = transformNormalElement(elementWithoutIf as ElementNode, context, transformNode)

  // 生成 block 包裹
  const dir = ifDirective as DirectiveNode
  if (dir.name === 'if' && dir.exp) {
    const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
    const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
    return context.platform.wrapIf(expValue, content)
  }
  else if (dir.name === 'else-if' && dir.exp) {
    const rawExpValue = dir.exp.type === NodeTypes.SIMPLE_EXPRESSION ? dir.exp.content : ''
    const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
    return context.platform.wrapElseIf(expValue, content)
  }
  else if (dir.name === 'else') {
    return context.platform.wrapElse(content)
  }

  return content
}

function transformForElement(node: ElementNode, context: TransformContext, transformNode: TransformNode): string {
  // 查找 v-for 指令
  const forDirective = node.props.find(
    (prop): prop is DirectiveNode =>
      prop.type === NodeTypes.DIRECTIVE && prop.name === 'for',
  ) as DirectiveNode | undefined

  if (!forDirective || !forDirective.exp) {
    return transformNormalElement(node, context, transformNode)
  }

  const expValue = forDirective.exp.type === NodeTypes.SIMPLE_EXPRESSION ? forDirective.exp.content : ''
  const forInfo = parseForExpression(expValue)
  if (context.classStyleRuntime === 'js' && !forInfo.index) {
    forInfo.index = `__wv_index_${context.forIndexSeed++}`
  }
  const listExp = forInfo.listExp ? normalizeWxmlExpressionWithContext(forInfo.listExp, context) : undefined
  const listExpAst = context.classStyleRuntime === 'js' && forInfo.listExp
    ? normalizeJsExpressionWithContext(forInfo.listExp, context, { hint: 'v-for 列表' })
    : undefined
  const scopedForInfo: ForParseResult = listExp
    ? { ...forInfo, listExp, listExpAst: listExpAst ?? undefined }
    : { ...forInfo, listExpAst: listExpAst ?? undefined }
  const scopeNames = [forInfo.item, forInfo.index, forInfo.key].filter(Boolean) as string[]

  return withForScope(context, scopedForInfo, () => withScope(context, scopeNames, () => {
    const otherProps = node.props.filter(prop => prop !== forDirective)
    const elementWithoutFor: ElementNode = { ...node, props: otherProps }

    const extraAttrs: string[] = listExp
      ? context.platform.forAttrs(listExp, forInfo.item, forInfo.index)
      : []

    const slotDirective = findSlotDirective(elementWithoutFor)
    const templateSlotChildren = elementWithoutFor.children.filter(
      child => child.type === NodeTypes.ELEMENT && child.tag === 'template' && findSlotDirective(child as ElementNode),
    )
    if (slotDirective || templateSlotChildren.length > 0) {
      return transformComponentWithSlots(elementWithoutFor, context, transformNode, { extraAttrs, forInfo })
    }

    const { attrs, vTextExp } = collectElementAttributes(elementWithoutFor, context, {
      forInfo,
      extraAttrs,
    })

    let children = ''
    if (elementWithoutFor.children.length > 0) {
      children = elementWithoutFor.children
        .map(child => transformNode(child, context))
        .join('')
    }
    if (vTextExp !== undefined) {
      children = `{{${vTextExp}}}`
    }

    const { tag } = elementWithoutFor
    const attrString = attrs.length ? ` ${attrs.join(' ')}` : ''

    return children
      ? `<${tag}${attrString}>${children}</${tag}>`
      : `<${tag}${attrString} />`
  }))
}
