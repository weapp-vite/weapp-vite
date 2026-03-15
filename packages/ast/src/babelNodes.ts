import type { Expression, ObjectExpression, ObjectMethod, ObjectProperty, PrivateName } from '@babel/types'
import * as t from '@babel/types'

export function unwrapTypeScriptExpression(exp: Expression): Expression {
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

export function toStaticObjectKey(key: Expression | PrivateName | t.Identifier) {
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

export function resolveRenderableExpression(
  node: ObjectMethod | ObjectProperty,
) {
  if (t.isObjectMethod(node)) {
    for (const statement of node.body.body) {
      if (t.isReturnStatement(statement) && statement.argument) {
        return unwrapTypeScriptExpression(statement.argument as Expression)
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
          return unwrapTypeScriptExpression(statement.argument as Expression)
        }
      }
      return null
    }
    return unwrapTypeScriptExpression(value.body as Expression)
  }

  if (t.isFunctionExpression(value)) {
    for (const statement of value.body.body) {
      if (t.isReturnStatement(statement) && statement.argument) {
        return unwrapTypeScriptExpression(statement.argument as Expression)
      }
    }
  }

  return null
}
