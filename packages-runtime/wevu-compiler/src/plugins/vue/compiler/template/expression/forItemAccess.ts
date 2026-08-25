import type { TransformContext } from '../types'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../../../utils/babel'
import { replaceIdentifierWithExpression } from './inlineShared'

export function getForItemAccess(context: TransformContext, name: string) {
  for (let index = context.forStack.length - 1; index >= 0; index -= 1) {
    const forInfo = context.forStack[index]
    if (forInfo?.item === name && forInfo.itemAccess) {
      return forInfo.itemAccess
    }
  }
  return name
}

export function rewriteForItemAccess(ast: t.File, context: TransformContext) {
  const itemAccesses = new Map<string, string>()
  for (const forInfo of context.forStack) {
    if (forInfo.item && forInfo.itemAccess) {
      itemAccesses.set(forInfo.item, forInfo.itemAccess)
    }
  }
  if (!itemAccesses.size) {
    return
  }
  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier() || path.scope.hasBinding(path.node.name)) {
        return
      }
      const replacement = itemAccesses.get(path.node.name)
      if (!replacement) {
        return
      }
      const parsed = replacement.split('.').slice(1).reduce<t.Expression>(
        (target, property) => t.memberExpression(target, t.identifier(property)),
        t.identifier(path.node.name),
      )
      replaceIdentifierWithExpression(path, parsed)
      path.skip()
    },
  })
}
