import type { Expression, JSXElement } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { readJsxAttributeExpression } from './attributes'

export function collectJsxDirectives(node: JSXElement): Map<string, Expression> {
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
  return directives
}
