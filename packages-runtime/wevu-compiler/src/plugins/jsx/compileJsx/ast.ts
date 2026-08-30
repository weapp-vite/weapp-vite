import type {
  Expression,
  JSXIdentifier,
  JSXNamespacedName,
} from '@weapp-vite/ast/babelTypes'
import type { JsxCompileContext } from './types'
import { escapeWxmlAttribute, escapeWxmlText } from '@weapp-core/shared'
import {
  getObjectPropertyByKey,
  resolveRenderableExpression,
  toStaticObjectKey,
  unwrapTypeScriptExpression,
} from '@weapp-vite/ast'
import * as t from '@weapp-vite/ast/babelTypes'
import { createInlineExpressionId } from '../../../inlineDataset'
import { generate, traverse } from '../../../utils/babel'
import { normalizeWxmlExpression } from '../../vue/compiler/template/expression/wxml'

const WXML_EXPRESSION_GENERATE_OPTIONS = {
  compact: true,
  jsescOption: { quotes: 'single' as const, minimal: true },
}

export const escapeText = escapeWxmlText
export const escapeAttr = escapeWxmlAttribute

const WHITESPACE_RE = /\s+/g

export function normalizeJsxText(value: string) {
  return value.replace(WHITESPACE_RE, ' ')
}

export function printExpression(exp: Expression) {
  const normalized = t.cloneNode(exp, true) as Expression
  t.traverseFast(normalized, (node) => {
    if (t.isStringLiteral(node)) {
      node.extra = undefined
    }
  })
  return generate(normalized, WXML_EXPRESSION_GENERATE_OPTIONS).code
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
  const id = createInlineExpressionId(context.inlineExpressionSeed++)
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

  context.warnings.push('JSX 成员标签（如 <Foo.Bar />）无法映射为小程序 WXML 组件标签，已生成 dynamic island。')
  return 'block'
}
