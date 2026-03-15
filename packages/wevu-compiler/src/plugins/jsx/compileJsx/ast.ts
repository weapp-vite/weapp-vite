import type {
  Expression,
  JSXIdentifier,
  JSXNamespacedName,
} from '@babel/types'
import type { JsxCompileContext } from './types'
import * as t from '@babel/types'
import {
  getObjectPropertyByKey,
  resolveRenderableExpression,
  toStaticObjectKey,
  unwrapTypeScriptExpression,
} from '@weapp-vite/ast'
import { generate, traverse } from '../../../utils/babel'
import { normalizeWxmlExpression } from '../../vue/compiler/template/expression/wxml'

const ESCAPED_TEXT_RE = /[&<>]/g
const ESCAPED_ATTR_RE = /[&"<>]/g

const ESCAPED_TEXT_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}

const ESCAPED_ATTR_MAP: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
}

export function escapeText(value: string) {
  return value.replace(ESCAPED_TEXT_RE, ch => ESCAPED_TEXT_MAP[ch] || ch)
}

export function escapeAttr(value: string) {
  return value.replace(ESCAPED_ATTR_RE, ch => ESCAPED_ATTR_MAP[ch] || ch)
}

const WHITESPACE_RE = /\s+/g

export function normalizeJsxText(value: string) {
  return value.replace(WHITESPACE_RE, ' ')
}

export function printExpression(exp: Expression) {
  return generate(exp).code
}

export function unwrapTsExpression(exp: Expression): Expression {
  return unwrapTypeScriptExpression(exp)
}

export { getObjectPropertyByKey, resolveRenderableExpression, toStaticObjectKey }

export function normalizeInterpolationExpression(exp: Expression) {
  return normalizeWxmlExpression(printExpression(unwrapTsExpression(exp)))
}

export function renderMustache(expression: string, context: Pick<JsxCompileContext, 'mustacheInterpolation'>) {
  return context.mustacheInterpolation === 'spaced'
    ? `{{ ${expression} }}`
    : `{{${expression}}}`
}

export function pushScope(context: JsxCompileContext, names: string[]) {
  for (const name of names) {
    if (!name) {
      continue
    }
    context.scopeStack.push(name)
  }
}

export function popScope(context: JsxCompileContext, count: number) {
  for (let i = 0; i < count; i += 1) {
    context.scopeStack.pop()
  }
}

function collectExpressionScopeBindings(exp: Expression, context: JsxCompileContext): string[] {
  const localSet = new Set(context.scopeStack)
  if (!localSet.size) {
    return []
  }

  const used: string[] = []
  const usedSet = new Set<string>()
  const file = t.file(t.program([t.expressionStatement(t.cloneNode(exp, true))]))

  traverse(file, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (!localSet.has(name)) {
        return
      }
      if (path.scope.hasBinding(name)) {
        return
      }
      if (usedSet.has(name)) {
        return
      }
      usedSet.add(name)
      used.push(name)
    },
  })

  return used
}

export function registerInlineExpression(exp: Expression, context: JsxCompileContext) {
  const scopeKeys = collectExpressionScopeBindings(exp, context)
  const id = `__wv_inline_${context.inlineExpressionSeed++}`
  context.inlineExpressions.push({
    id,
    expression: printExpression(exp),
    scopeKeys,
  })
  return {
    id,
    scopeKeys,
  }
}

export function toJsxTagName(
  name: JSXIdentifier | JSXNamespacedName | t.JSXMemberExpression,
  context: JsxCompileContext,
): string {
  if (t.isJSXIdentifier(name)) {
    return name.name
  }
  if (t.isJSXNamespacedName(name)) {
    return `${name.namespace.name}:${name.name.name}`
  }

  context.warnings.push('暂不支持 JSX 成员标签（如 <Foo.Bar />），已回退为 <view />。')
  return 'view'
}
