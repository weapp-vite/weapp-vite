import type { NodePath } from '@babel/traverse'
import type { WevuPageFeatureFlag } from './types'
import * as t from '@babel/types'

export function isStaticObjectKeyMatch(key: t.Expression | t.PrivateName, expected: string) {
  if (t.isIdentifier(key)) {
    return key.name === expected
  }
  if (t.isStringLiteral(key)) {
    return key.value === expected
  }
  return false
}

export function getObjectPropertyByKey(node: t.ObjectExpression, key: string): t.ObjectProperty | null {
  for (const prop of node.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue
    }
    if (isStaticObjectKeyMatch(prop.key, key)) {
      return prop
    }
  }
  return null
}

export function buildInjectedFeaturesObject(
  enabled: Set<WevuPageFeatureFlag>,
): t.ObjectExpression {
  return t.objectExpression(
    Array.from(enabled).map((key) => {
      return t.objectProperty(t.identifier(key), t.booleanLiteral(true))
    }),
  )
}

export function getObjectMemberIndexByKey(node: t.ObjectExpression, key: string): number {
  return node.properties.findIndex((prop) => {
    if (t.isObjectProperty(prop) && !prop.computed) {
      return isStaticObjectKeyMatch(prop.key, key)
    }
    if (t.isObjectMethod(prop) && !prop.computed) {
      return isStaticObjectKeyMatch(prop.key, key)
    }
    return false
  })
}

export function isTopLevel(path: NodePath<t.Node>) {
  return path.getFunctionParent() == null
}
