import type { ArrowFunctionExpression, Expression, FunctionExpression, ObjectExpression, ObjectMethod } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { createStaticObjectKey, getObjectPropertyByKey, isStaticObjectKeyMatch } from '../utils'

type SetupFunctionNode = ObjectMethod | FunctionExpression | ArrowFunctionExpression

function unwrapExpression(node: Expression): Expression {
  if (
    t.isTSAsExpression(node)
    || t.isTSSatisfiesExpression(node)
    || t.isTSNonNullExpression(node)
    || t.isTypeCastExpression(node)
    || t.isParenthesizedExpression(node)
  ) {
    return unwrapExpression(node.expression as Expression)
  }
  return node
}

function resolveSetupFunction(componentOptionsObject: ObjectExpression): SetupFunctionNode | null {
  for (const prop of componentOptionsObject.properties) {
    if (t.isObjectMethod(prop) && !prop.computed && isStaticObjectKeyMatch(prop.key, 'setup')) {
      return prop
    }
    if (!t.isObjectProperty(prop) || prop.computed || !isStaticObjectKeyMatch(prop.key, 'setup')) {
      continue
    }
    const value = unwrapExpression(prop.value as Expression)
    if (t.isFunctionExpression(value) || t.isArrowFunctionExpression(value)) {
      return value
    }
  }
  return null
}

function isComponentMetaObject(node: ObjectExpression) {
  return node.properties.some((prop) => {
    return t.isObjectProperty(prop)
      && !prop.computed
      && isStaticObjectKeyMatch(prop.key, '__weappViteUsingComponent')
      && t.isBooleanLiteral(prop.value, { value: true })
  })
}

function isSerializableSeed(node: Expression): boolean {
  const normalized = unwrapExpression(node)
  if (
    t.isStringLiteral(normalized)
    || t.isNumericLiteral(normalized)
    || t.isBooleanLiteral(normalized)
    || t.isNullLiteral(normalized)
  ) {
    return true
  }
  if (t.isTemplateLiteral(normalized)) {
    return normalized.expressions.length === 0
  }
  if (t.isArrayExpression(normalized)) {
    return normalized.elements.every(element => !!element && !t.isSpreadElement(element) && isSerializableSeed(element as Expression))
  }
  if (t.isObjectExpression(normalized)) {
    if (isComponentMetaObject(normalized)) {
      return false
    }
    return normalized.properties.every((prop) => {
      return t.isObjectProperty(prop)
        && !prop.computed
        && !t.isPatternLike(prop.value)
        && isSerializableSeed(prop.value as Expression)
    })
  }
  return false
}

function extractSeedExpression(node: Expression): Expression | null {
  const normalized = unwrapExpression(node)
  if (
    t.isCallExpression(normalized)
    && t.isIdentifier(normalized.callee)
    && ['ref', 'shallowRef', 'reactive'].includes(normalized.callee.name)
  ) {
    const firstArg = normalized.arguments[0]
    if (firstArg && !t.isSpreadElement(firstArg) && t.isExpression(firstArg) && isSerializableSeed(firstArg)) {
      return t.cloneNode(unwrapExpression(firstArg), true)
    }
    return null
  }
  if (!isSerializableSeed(normalized)) {
    return null
  }
  return t.cloneNode(normalized, true)
}

function collectSetupInitializers(setupBody: t.BlockStatement) {
  const initializers = new Map<string, Expression>()
  for (const statement of setupBody.body) {
    if (!t.isVariableDeclaration(statement)) {
      continue
    }
    for (const declarator of statement.declarations) {
      if (!t.isIdentifier(declarator.id) || !declarator.init || !t.isExpression(declarator.init)) {
        continue
      }
      initializers.set(declarator.id.name, declarator.init)
    }
  }
  return initializers
}

function resolveReturnedObjectExpression(setupBody: t.BlockStatement, initializers: Map<string, Expression>) {
  for (let index = setupBody.body.length - 1; index >= 0; index -= 1) {
    const statement = setupBody.body[index]
    if (!t.isReturnStatement(statement) || !statement.argument || !t.isExpression(statement.argument)) {
      continue
    }
    const returned = unwrapExpression(statement.argument)
    if (t.isObjectExpression(returned)) {
      return returned
    }
    if (t.isIdentifier(returned)) {
      const initializer = initializers.get(returned.name)
      if (initializer) {
        const normalized = unwrapExpression(initializer)
        if (t.isObjectExpression(normalized)) {
          return normalized
        }
      }
    }
  }
  return null
}

function resolvePropertyName(node: t.ObjectProperty) {
  if (t.isIdentifier(node.key) && !node.computed) {
    return node.key.name
  }
  if (t.isStringLiteral(node.key) && !node.computed) {
    return node.key.value
  }
  return null
}

export function injectSetupInitialData(componentOptionsObject: ObjectExpression) {
  if (getObjectPropertyByKey(componentOptionsObject, 'data')) {
    return false
  }

  const setupFn = resolveSetupFunction(componentOptionsObject)
  if (!setupFn || !t.isBlockStatement(setupFn.body)) {
    return false
  }

  const initializers = collectSetupInitializers(setupFn.body)
  const returnedObject = resolveReturnedObjectExpression(setupFn.body, initializers)
  if (!returnedObject) {
    return false
  }

  const seedProperties: t.ObjectProperty[] = []
  for (const prop of returnedObject.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue
    }
    const propertyName = resolvePropertyName(prop)
    if (!propertyName) {
      continue
    }

    let sourceExpression: Expression | null = null
    if (prop.shorthand && t.isIdentifier(prop.value)) {
      sourceExpression = initializers.get(prop.value.name) ?? null
    }
    else if (t.isIdentifier(prop.value)) {
      sourceExpression = initializers.get(prop.value.name) ?? prop.value
    }
    else if (t.isExpression(prop.value)) {
      sourceExpression = prop.value
    }

    if (!sourceExpression) {
      continue
    }

    const seedExpression = extractSeedExpression(sourceExpression)
    if (!seedExpression) {
      continue
    }

    seedProperties.push(
      t.objectProperty(
        createStaticObjectKey(propertyName),
        seedExpression,
      ),
    )
  }

  if (!seedProperties.length) {
    return false
  }

  componentOptionsObject.properties.unshift(
    t.objectMethod(
      'method',
      createStaticObjectKey('data'),
      [],
      t.blockStatement([
        t.returnStatement(t.objectExpression(seedProperties)),
      ]),
    ),
  )

  return true
}
