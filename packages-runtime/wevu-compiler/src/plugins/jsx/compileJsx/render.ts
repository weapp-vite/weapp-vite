/* eslint-disable ts/no-use-before-define -- JSX 渲染器存在递归与互相调用的编译 helper，按阅读顺序组织更稳定。 */
import type {
  Expression,
  JSXElement,
  JSXExpressionContainer,
  JSXFragment,
  JSXSpreadChild,
  JSXText,
} from '@weapp-vite/ast/babelTypes'
import type { JsxCompileContext, JsxDynamicIslandReason } from './types'
import {
  WEVU_JSX_ISLAND_DATA_KEY,
  WEVU_JSX_ISLAND_HANDLER,
  WEVU_JSX_ISLAND_TEMPLATE_NAME,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { isBuiltinComponent } from '../../../auto-import-components/builtin'
import { traverse } from '../../../utils/babel'
import { hyphenate } from '../../../utils/text'
import {
  escapeText,
  normalizeInterpolationExpression,
  normalizeJsxText,
  popScope,
  pushScope,
  renderMustache,
  toJsxTagName,
  unwrapTsExpression,
} from './ast'
import { compileJsxAttributes, extractJsxKeyExpression, isStaticClassStyleExpression, readJsxAttributeExpression } from './attributes'
import { recordJsxBinding } from './bindingManifest'

type JSXChild = JSXText | JSXExpressionContainer | JSXSpreadChild | JSXElement | JSXFragment
const DYNAMIC_ISLAND_TEMPLATE_DEPTH = 8

function resolveDynamicIslandTemplateName(depth: number) {
  return depth === 0
    ? WEVU_JSX_ISLAND_TEMPLATE_NAME
    : `${WEVU_JSX_ISLAND_TEMPLATE_NAME}_${depth}`
}

function compileListExpression(exp: Expression) {
  return normalizeInterpolationExpression(exp)
}

function registerDynamicIsland(exp: Expression, context: JsxCompileContext, reason: JsxDynamicIslandReason) {
  if (context.dynamicIslandMode === 'static') {
    context.warnings.push(`[JSX 编译] static 模式不允许 dynamic island（${reason}）。`)
    return ''
  }
  const id = `i${context.dynamicIslandSeed ?? 0}`
  context.dynamicIslandSeed = (context.dynamicIslandSeed ?? 0) + 1
  context.bindingManifest.features.jsxIslands = true
  recordJsxBinding(context, exp, 'text', WEVU_JSX_ISLAND_DATA_KEY)
  const expression = normalizeInterpolationExpression(exp)
  const captures = new Set<string>()
  const file = t.file(t.program([t.expressionStatement(t.cloneNode(exp, true))]))
  traverse(file, {
    ReferencedIdentifier(path) {
      if (path.scope.hasBinding(path.node.name)) {
        return
      }
      if (context.importedBindings?.has(path.node.name)) {
        return
      }
      captures.add(path.node.name)
    },
    ThisExpression() {
      captures.add('this')
    },
  })
  context.dynamicIslands?.push({
    id,
    expression,
    reason,
    captures: [...captures],
  })
  return `<template is="${WEVU_JSX_ISLAND_TEMPLATE_NAME}" data-wv-jsx-island="${id}" data="{{node:${WEVU_JSX_ISLAND_DATA_KEY}.${id},islandId:'${id}'}}" />`
}

export function renderDynamicIslandSupportTemplate(context: JsxCompileContext) {
  const { directives } = context.platform
  const bindTap = context.platform.eventBindingAttr('bind:tap')
  const bindInput = context.platform.eventBindingAttr('bind:input')
  const bindChange = context.platform.eventBindingAttr('bind:change')
  const attrs = `id="{{node.props.id}}" class="{{node.props.class}}" style="{{node.props.style}}" hidden="{{node.props.hidden}}"`
  const tapAttrs = `${attrs} data-wv-jsx-handler="{{node.events.tap}}" ${bindTap}="${WEVU_JSX_ISLAND_HANDLER}"`
  return Array.from({ length: DYNAMIC_ISLAND_TEMPLATE_DEPTH }, (_, depth) => {
    const templateName = resolveDynamicIslandTemplateName(depth)
    const childTemplateName = resolveDynamicIslandTemplateName(depth + 1)
    const childTemplate = depth + 1 < DYNAMIC_ISLAND_TEMPLATE_DEPTH
      ? `<block ${directives.forAttr}="{{node.children}}" ${directives.forItemAttr}="child" ${directives.keyAttr}="index"><template is="${childTemplateName}" data="{{node:child,islandId:islandId}}" /></block>`
      : ''
    return `<template name="${templateName}">`
      + `<block ${directives.ifAttr}="{{node.kind=='text'}}">{{node.text}}</block>`
      + `<block ${directives.elifAttr}="{{node.kind=='fragment'}}">${childTemplate}</block>`
      + `<view ${directives.elifAttr}="{{node.tag=='view'}}" ${tapAttrs}>${childTemplate}</view>`
      + `<text ${directives.elifAttr}="{{node.tag=='text'}}" ${tapAttrs}>${childTemplate}</text>`
      + `<button ${directives.elifAttr}="{{node.tag=='button'}}" ${tapAttrs}>${childTemplate}</button>`
      + `<input ${directives.elifAttr}="{{node.tag=='input'}}" ${attrs} value="{{node.props.value}}" data-wv-jsx-handler="{{node.events.input||node.events.change}}" ${bindInput}="${WEVU_JSX_ISLAND_HANDLER}" ${bindChange}="${WEVU_JSX_ISLAND_HANDLER}" />`
      + `<image ${directives.elifAttr}="{{node.tag=='image'}}" ${tapAttrs} src="{{node.props.src}}" />`
      + `<block ${directives.elseAttr}>${childTemplate}</block>`
      + `</template>`
  }).join('')
}

function resolveImportedExpression(node: Expression, context: JsxCompileContext) {
  if (!context.filename || !context.moduleResolver) {
    return undefined
  }
  let localName: string | undefined
  let importedName: string | undefined
  if (t.isIdentifier(node)) {
    localName = node.name
  }
  else if (
    t.isMemberExpression(node)
    && !node.computed
    && t.isIdentifier(node.object)
    && t.isIdentifier(node.property)
  ) {
    localName = node.object.name
    importedName = node.property.name
  }
  if (!localName) {
    return undefined
  }
  const binding = context.importedBindings?.get(localName)
  if (!binding) {
    return undefined
  }
  if (binding.importedName !== '*' && importedName) {
    return undefined
  }
  const resolvedName = importedName ?? binding.importedName
  const key = `${context.filename}:${localName}:${resolvedName}`
  if (context.resolvingExports?.has(key)) {
    context.warnings.push(`[JSX 编译] 跨文件 JSX 导出循环引用：${localName}`)
    return undefined
  }
  context.resolvingExports?.add(key)
  try {
    return context.moduleResolver.resolveImport(context.filename, binding.source, resolvedName)
  }
  finally {
    context.resolvingExports?.delete(key)
  }
}

function compileImportedExpression(node: Expression, context: JsxCompileContext): string | null {
  const resolved = resolveImportedExpression(node, context)
  if (!resolved || resolved.params.length > 0) {
    const importedLocal = t.isIdentifier(node)
      ? node.name
      : t.isMemberExpression(node) && t.isIdentifier(node.object)
        ? node.object.name
        : ''
    if (context.importedBindings?.has(importedLocal)) {
      context.warnings.push(`[JSX 编译] 无法静态展开跨文件 JSX 导出，已生成 dynamic island：${importedLocal || 'unknown'}`)
      return registerDynamicIsland(node, context, 'unsupported-import')
    }
    return null
  }
  return compileRenderableExpression(resolved.expression, context)
}

function compileImportedFactoryCall(node: t.CallExpression, context: JsxCompileContext): string | null {
  if (!t.isIdentifier(node.callee) || !context.filename || !context.moduleResolver) {
    return null
  }
  const binding = context.importedBindings?.get(node.callee.name)
  if (!binding) {
    return null
  }
  const resolved = context.moduleResolver.resolveImport(context.filename, binding.source, binding.importedName)
  if (!resolved || resolved.params.length === 0) {
    context.warnings.push(`[JSX 编译] 无法静态展开 JSX 工厂 ${node.callee.name}，已生成 dynamic island。`)
    return registerDynamicIsland(node, context, 'unsupported-call')
  }
  const replacements = new Map<string, Expression>()
  resolved.params.forEach((param, index) => {
    const argument = node.arguments[index]
    if (argument && t.isExpression(argument)) {
      replacements.set(param, argument)
    }
  })
  if (replacements.size !== resolved.params.length) {
    context.warnings.push(`[JSX 编译] JSX 工厂 ${node.callee.name} 调用参数不足，已保留运行时表达式。`)
    return null
  }
  const expression = t.cloneNode(resolved.expression, true)
  const file = t.file(t.program([t.expressionStatement(expression)]))
  traverse(file, {
    ReferencedIdentifier(path) {
      const replacement = replacements.get(path.node.name)
      if (replacement) {
        path.replaceWith(t.cloneNode(replacement, true))
      }
    },
  })
  const output = file.program.body[0]
  if (!t.isExpressionStatement(output)) {
    return null
  }
  let expanded = output.expression as Expression
  if (t.isCallExpression(expanded) && expanded.arguments.length === 0) {
    const callee = expanded.callee
    if (t.isArrowFunctionExpression(callee) || t.isFunctionExpression(callee)) {
      const body = callee.body
      let capturesThis = false
      if (t.isExpression(body)) {
        const file = t.file(t.program([t.expressionStatement(body)]))
        traverse(file, {
          ThisExpression() {
            capturesThis = true
          },
        })
        if (!capturesThis) {
          expanded = body
        }
      }
    }
  }
  return compileRenderableExpression(expanded, context)
}

function compileMapExpression(exp: t.CallExpression, context: JsxCompileContext): string | null {
  const callee = exp.callee
  if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property, { name: 'map' })) {
    return null
  }

  const callback = exp.arguments[0]
  if (!callback || !(t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback))) {
    context.warnings.push('仅支持 map(fn) 形式的列表渲染。')
    return null
  }

  recordJsxBinding(context, callee.object as Expression, 'for')
  const listExp = compileListExpression(callee.object as Expression)
  const renderTemplateMustache = (expression: string) => renderMustache(expression, context)
  const itemParam = callback.params[0]
  const indexParam = callback.params[1]
  const item = t.isIdentifier(itemParam) ? itemParam.name : 'item'
  const index = t.isIdentifier(indexParam) ? indexParam.name : undefined

  const addedScope = [item, index].filter((name): name is string => !!name)
  pushScope(context, addedScope)

  let bodyExp: Expression | null = null
  if (t.isBlockStatement(callback.body)) {
    for (const statement of callback.body.body) {
      if (t.isReturnStatement(statement) && statement.argument) {
        bodyExp = unwrapTsExpression(statement.argument as Expression)
        break
      }
    }
  }
  else {
    bodyExp = unwrapTsExpression(callback.body as Expression)
  }

  const body = bodyExp ? compileRenderableExpression(bodyExp, context) : ''
  popScope(context, addedScope.length)

  if (!body) {
    return ''
  }

  let keyValue = context.platform.keyThisValue
  if (bodyExp && t.isJSXElement(bodyExp)) {
    const extracted = extractJsxKeyExpression(bodyExp)
    if (extracted) {
      keyValue = extracted
    }
    else if (index) {
      keyValue = index
    }
  }
  else if (index) {
    keyValue = index
  }

  const attrs = [
    ...context.platform.forAttrs(listExp, renderTemplateMustache, item, index),
    context.platform.keyAttr(keyValue),
  ]

  return `<block ${attrs.join(' ')}>${body}</block>`
}

function compileConditionalExpression(exp: t.ConditionalExpression, context: JsxCompileContext): string {
  const renderTemplateMustache = (expression: string) => renderMustache(expression, context)
  recordJsxBinding(context, exp.test, 'if')
  const test = normalizeInterpolationExpression(exp.test)
  const consequent = compileRenderableExpression(exp.consequent, context)
  const alternate = compileRenderableExpression(exp.alternate, context)

  if (!alternate) {
    return context.platform.wrapIf(test, consequent, renderTemplateMustache)
  }

  return `${context.platform.wrapIf(test, consequent, renderTemplateMustache)}${context.platform.wrapElse(alternate)}`
}

function compileLogicalExpression(exp: t.LogicalExpression, context: JsxCompileContext): string {
  const renderTemplateMustache = (expression: string) => renderMustache(expression, context)
  recordJsxBinding(context, exp.left, 'if')
  if (exp.operator === '&&') {
    const test = normalizeInterpolationExpression(exp.left)
    const content = compileRenderableExpression(exp.right, context)
    return context.platform.wrapIf(test, content, renderTemplateMustache)
  }
  if (exp.operator === '||') {
    const negated = t.unaryExpression('!', t.parenthesizedExpression(t.cloneNode(exp.left, true)))
    const test = normalizeInterpolationExpression(negated)
    const content = compileRenderableExpression(exp.right, context)
    return context.platform.wrapIf(test, content, renderTemplateMustache)
  }
  return renderMustache(normalizeInterpolationExpression(exp), context)
}

export function compileRenderableExpression(exp: Expression, context: JsxCompileContext): string {
  const node = unwrapTsExpression(exp)
  if (t.isJSXElement(node)) {
    return compileJsxElement(node, context)
  }
  if (t.isJSXFragment(node)) {
    return compileJsxFragment(node, context)
  }
  if (t.isConditionalExpression(node)) {
    return compileConditionalExpression(node, context)
  }
  if (t.isLogicalExpression(node)) {
    return compileLogicalExpression(node, context)
  }
  if (t.isCallExpression(node)) {
    const importedFactory = compileImportedFactoryCall(node, context)
    if (importedFactory != null) {
      return importedFactory
    }
    const mapped = compileMapExpression(node, context)
    if (mapped != null) {
      return mapped
    }
    context.warnings.push('无法证明 JSX 子节点函数调用返回静态文本，已生成 dynamic island。')
    return registerDynamicIsland(node, context, 'unsupported-call')
  }
  if (t.isArrayExpression(node)) {
    return node.elements
      .map((element) => {
        if (!element || !t.isExpression(element)) {
          return ''
        }
        return compileRenderableExpression(element, context)
      })
      .join('')
  }
  if (t.isIdentifier(node) || t.isMemberExpression(node)) {
    const imported = compileImportedExpression(node, context)
    if (imported != null) {
      return imported
    }
  }
  if (t.isNullLiteral(node) || t.isBooleanLiteral(node)) {
    return ''
  }

  recordJsxBinding(context, node, 'text')
  return renderMustache(normalizeInterpolationExpression(node), context)
}

function compileExpressionContainer(node: JSXExpressionContainer, context: JsxCompileContext): string {
  const exp = node.expression
  if (t.isJSXEmptyExpression(exp)) {
    return ''
  }
  return compileRenderableExpression(exp as Expression, context)
}

function compileJsxChildren(children: JSXChild[], context: JsxCompileContext): string {
  const parts: string[] = []
  for (const child of children) {
    if (t.isJSXText(child)) {
      const normalized = normalizeJsxText(child.value)
      if (!normalized.trim()) {
        continue
      }
      parts.push(escapeText(normalized))
      continue
    }
    if (t.isJSXExpressionContainer(child)) {
      const chunk = compileExpressionContainer(child, context)
      if (chunk) {
        parts.push(chunk)
      }
      continue
    }
    if (t.isJSXElement(child)) {
      parts.push(compileJsxElement(child, context))
      continue
    }
    if (t.isJSXFragment(child)) {
      parts.push(compileJsxFragment(child, context))
      continue
    }
    if (t.isJSXSpreadChild(child)) {
      parts.push(registerDynamicIsland(child.expression as Expression, context, 'spread-child'))
      context.warnings.push('JSX spread child 无法映射为静态 WXML，已生成 dynamic island。')
    }
  }
  return parts.join('')
}

function compileJsxFragment(node: JSXFragment, context: JsxCompileContext): string {
  return compileJsxChildren(node.children, context)
}

function compileJsxElement(node: JSXElement, context: JsxCompileContext): string {
  if (t.isJSXMemberExpression(node.openingElement.name)) {
    context.warnings.push('JSX 成员标签（如 <Foo.Bar />）无法映射为小程序 WXML 组件标签，已生成 dynamic island。')
    return registerDynamicIsland(node as unknown as Expression, context, 'dynamic-component')
  }
  const dynamicSpread = node.openingElement.attributes.find((attr) => {
    if (!t.isJSXSpreadAttribute(attr)) {
      return false
    }
    const argument = unwrapTsExpression(attr.argument as Expression)
    return !t.isObjectExpression(argument) || argument.properties.some(property => (
      !t.isObjectProperty(property)
      || property.computed
      || (!t.isIdentifier(property.key) && !t.isStringLiteral(property.key))
      || !t.isExpression(property.value)
    ))
  })
  if (dynamicSpread && t.isJSXSpreadAttribute(dynamicSpread)) {
    context.warnings.push('动态 JSX spread attributes 无法映射为静态 WXML，已生成 dynamic island。')
    return registerDynamicIsland(node as unknown as Expression, context, 'dynamic-spread')
  }
  const rawTag = toJsxTagName(node.openingElement.name, context)
  if (rawTag === 'component') {
    context.warnings.push('JSX 动态 component 无法映射为静态 WXML，已生成 dynamic island。')
    return registerDynamicIsland(node as unknown as Expression, context, 'dynamic-component')
  }
  if (rawTag === 'Teleport') {
    context.warnings.push('小程序不支持 JSX <Teleport>，已生成 dynamic island。')
    return registerDynamicIsland(node as unknown as Expression, context, 'dynamic-component')
  }
  if (rawTag === 'Transition') {
    context.warnings.push('JSX <Transition> 需要 Web 动画运行时，当前仅渲染子节点。')
    return compileJsxChildren(node.children, context)
  }
  if (rawTag === 'KeepAlive') {
    context.warnings.push('JSX <KeepAlive> 需要运行时缓存管理，当前仅保留标记并渲染子节点。')
    return `<block data-keep-alive="true">${compileJsxChildren(node.children, context)}</block>`
  }
  const isComponent = !isBuiltinComponent(rawTag)
  const tag = isComponent ? hyphenate(rawTag) : rawTag
  const hasRuntimeSlots = node.children.some((child) => {
    if (!t.isJSXExpressionContainer(child) || t.isJSXEmptyExpression(child.expression)) {
      return false
    }
    const expression = unwrapTsExpression(child.expression as Expression)
    return t.isObjectExpression(expression) || t.isFunctionExpression(expression) || t.isArrowFunctionExpression(expression)
  })
  if (hasRuntimeSlots) {
    context.warnings.push('JSX slot 函数或对象 slots 无法映射为静态 WXML，已生成 dynamic island。')
    return registerDynamicIsland(node as unknown as Expression, context, 'closure')
  }
  const hasDynamicClassStyle = node.openingElement.attributes.some((attribute) => {
    if (!t.isJSXAttribute(attribute) || !t.isJSXIdentifier(attribute.name)) {
      return false
    }
    if (attribute.name.name !== 'class' && attribute.name.name !== 'className' && attribute.name.name !== 'style') {
      return false
    }
    const expression = readJsxAttributeExpression(attribute.value)
    return !!expression
      && (t.isArrayExpression(expression) || t.isObjectExpression(expression))
      && !isStaticClassStyleExpression(expression)
  })
  if (hasDynamicClassStyle) {
    context.warnings.push('动态 JSX class/style 数组或对象需要运行时合并，已生成 dynamic island。')
    return registerDynamicIsland(node as unknown as Expression, context, 'closure')
  }
  const directives = new Map<string, Expression>()
  for (const attribute of node.openingElement.attributes) {
    if (!t.isJSXAttribute(attribute)) {
      continue
    }
    const name = t.isJSXIdentifier(attribute.name)
      ? attribute.name.name
      : t.isJSXNamespacedName(attribute.name)
        ? attribute.name.namespace.name
        : undefined
    if (!name?.startsWith('v-')) {
      continue
    }
    const expression = readJsxAttributeExpression(attribute.value)
    if (expression) {
      directives.set(name, expression)
    }
  }
  if (directives.has('v-for') || directives.has('v-slots') || directives.has('v-model') || directives.has('v-models')) {
    const directive = ['v-for', 'v-slots', 'v-model', 'v-models'].find(name => directives.has(name))!
    if (directive === 'v-model' || directive === 'v-models') {
      context.bindingManifest.features.model = true
    }
    context.warnings.push(`JSX ${directive} 无法直接映射当前静态 WXML，已生成 dynamic island。`)
    return registerDynamicIsland(node as unknown as Expression, context, 'closure')
  }
  const attrs = compileJsxAttributes(node.openingElement.attributes, context, { isComponent })
  const showExpression = directives.get('v-show')
  if (showExpression) {
    recordJsxBinding(context, showExpression, 'style')
    attrs.push(`hidden="${renderMustache(`!(${normalizeInterpolationExpression(showExpression)})`, context)}"`)
  }
  const attrsSegment = attrs.length ? ` ${attrs.join(' ')}` : ''
  const textExpression = directives.get('v-text')
  if (textExpression) {
    recordJsxBinding(context, textExpression, 'text')
  }
  const content = textExpression
    ? renderMustache(normalizeInterpolationExpression(textExpression), context)
    : compileJsxChildren(node.children, context)
  const element = node.openingElement.selfClosing && !textExpression
    ? `<${tag}${attrsSegment} />`
    : `<${tag}${attrsSegment}>${content}</${tag}>`
  const ifExpression = directives.get('v-if')
  if (ifExpression) {
    recordJsxBinding(context, ifExpression, 'if')
    return context.platform.wrapIf(
      normalizeInterpolationExpression(ifExpression),
      element,
      expression => renderMustache(expression, context),
    )
  }
  return element
}
