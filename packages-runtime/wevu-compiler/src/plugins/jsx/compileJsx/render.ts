/* eslint-disable ts/no-use-before-define -- JSX 渲染器存在递归与互相调用的编译 helper，按阅读顺序组织更稳定。 */
import type {
  Expression,
  JSXElement,
  JSXExpressionContainer,
  JSXFragment,
  JSXSpreadChild,
  JSXText,
} from '@weapp-vite/ast/babelTypes'
import type { JsxCompileContext } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../utils/babel'
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
import { compileJsxAttributes, extractJsxKeyExpression } from './attributes'

type JSXChild = JSXText | JSXExpressionContainer | JSXSpreadChild | JSXElement | JSXFragment

function compileListExpression(exp: Expression) {
  return normalizeInterpolationExpression(exp)
}

function resolveImportedExpression(node: Expression, context: JsxCompileContext) {
  if (!t.isIdentifier(node) || !context.filename || !context.moduleResolver) {
    return undefined
  }
  const binding = context.importedBindings?.get(node.name)
  if (!binding) {
    return undefined
  }
  const key = `${context.filename}:${node.name}`
  if (context.resolvingExports?.has(key)) {
    context.warnings.push(`[JSX 编译] 跨文件 JSX 导出循环引用：${node.name}`)
    return undefined
  }
  context.resolvingExports?.add(key)
  try {
    return context.moduleResolver.resolveImport(context.filename, binding.source, binding.importedName)
  }
  finally {
    context.resolvingExports?.delete(key)
  }
}

function compileImportedExpression(node: Expression, context: JsxCompileContext): string | null {
  const resolved = resolveImportedExpression(node, context)
  if (!resolved || resolved.params.length > 0) {
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
    return null
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
  return compileRenderableExpression(output.expression as Expression, context)
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
  if (t.isIdentifier(node)) {
    const imported = compileImportedExpression(node, context)
    if (imported != null) {
      return imported
    }
  }
  if (t.isNullLiteral(node) || t.isBooleanLiteral(node)) {
    return ''
  }

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
      context.warnings.push('暂不支持 JSX spread child，已忽略。')
    }
  }
  return parts.join('')
}

function compileJsxFragment(node: JSXFragment, context: JsxCompileContext): string {
  return compileJsxChildren(node.children, context)
}

function compileJsxElement(node: JSXElement, context: JsxCompileContext): string {
  const tag = toJsxTagName(node.openingElement.name, context)
  const attrs = compileJsxAttributes(node.openingElement.attributes, context)
  const attrsSegment = attrs.length ? ` ${attrs.join(' ')}` : ''
  if (node.openingElement.selfClosing) {
    return `<${tag}${attrsSegment} />`
  }
  const children = compileJsxChildren(node.children, context)
  return `<${tag}${attrsSegment}>${children}</${tag}>`
}
