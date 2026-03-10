import type {
  Expression,
  JSXIdentifier,
  JSXNamespacedName,
  ObjectExpression,
} from '@babel/types'
import type { JsxCompileContext } from './types'
import * as t from '@babel/types'
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
  let current: Expression = exp
  while (
    t.isTSAsExpression(current)
    || t.isTSTypeAssertion(current)
    || t.isTSNonNullExpression(current)
    || t.isParenthesizedExpression(current)
    || t.isTSInstantiationExpression(current)
  ) {
    if (t.isTSAsExpression(current) || t.isTSTypeAssertion(current) || t.isTSNonNullExpression(current)) {
      current = current.expression as Expression
      continue
    }
    if (t.isParenthesizedExpression(current)) {
      current = current.expression as Expression
      continue
    }
    if (t.isTSInstantiationExpression(current)) {
      current = current.expression as Expression
    }
  }
  return current
}

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

export function toStaticObjectKey(key: Expression | t.PrivateName | t.Identifier) {
  if (t.isIdentifier(key)) {
    return key.name
  }
  if (t.isStringLiteral(key)) {
    return key.value
  }
  return null
}

export function getObjectPropertyByKey(node: ObjectExpression, key: string) {
  for (const prop of node.properties) {
    if (t.isObjectMethod(prop)) {
      const name = toStaticObjectKey(prop.key)
      if (name === key) {
        return prop
      }
      continue
    }
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue
    }
    const name = toStaticObjectKey(prop.key)
    if (name === key) {
      return prop
    }
  }
  return null
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

export function resolveRenderableExpression(
  node: t.ObjectMethod | t.ObjectProperty,
) {
  if (t.isObjectMethod(node)) {
    for (const statement of node.body.body) {
      if (t.isReturnStatement(statement) && statement.argument) {
        return unwrapTsExpression(statement.argument as Expression)
      }
    }
    return null
  }

  if (!node.value) {
    return null
  }

  const value = node.value
  if (t.isArrowFunctionExpression(value)) {
    if (t.isBlockStatement(value.body)) {
      for (const statement of value.body.body) {
        if (t.isReturnStatement(statement) && statement.argument) {
          return unwrapTsExpression(statement.argument as Expression)
        }
      }
      return null
    }
    return unwrapTsExpression(value.body as Expression)
  }

  if (t.isFunctionExpression(value)) {
    for (const statement of value.body.body) {
      if (t.isReturnStatement(statement) && statement.argument) {
        return unwrapTsExpression(statement.argument as Expression)
      }
    }
  }

  return null
}
