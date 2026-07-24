import type { ObjectExpression } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'

const UNITLESS_STYLE_PROPERTIES = new Set([
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'lineHeight',
  'opacity',
  'order',
  'zIndex',
])

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)
}

function readPropertyName(node: t.ObjectProperty['key']) {
  if (t.isIdentifier(node)) {
    return node.name
  }
  if (t.isStringLiteral(node)) {
    return node.value
  }
  return undefined
}

function readPropertyValue(node: t.ObjectProperty['value']) {
  if (t.isStringLiteral(node) || t.isNumericLiteral(node)) {
    return node.value
  }
  return undefined
}

export function compileStaticStyle(expression: ObjectExpression) {
  const declarations: string[] = []
  for (const property of expression.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      return undefined
    }
    const name = readPropertyName(property.key)
    const value = readPropertyValue(property.value)
    if (!name || value === undefined) {
      return undefined
    }
    const normalized = typeof value === 'number' && !UNITLESS_STYLE_PROPERTIES.has(name)
      ? `${value}px`
      : String(value)
    declarations.push(`${toKebabCase(name)}:${normalized}`)
  }
  return declarations.join(';')
}
