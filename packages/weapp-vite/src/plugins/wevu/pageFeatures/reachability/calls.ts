import type { FunctionLike } from './moduleAnalysis'
import * as t from '@babel/types'

export type CallCalleeName
  = | { type: 'ident', name: string }
    | { type: 'member', object: string, property: string }

export function getCallCalleeName(callee: t.CallExpression['callee']): CallCalleeName | null {
  if (t.isV8IntrinsicIdentifier(callee)) {
    return null
  }
  if (t.isIdentifier(callee)) {
    return { type: 'ident', name: callee.name }
  }
  if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
    return { type: 'member', object: callee.object.name, property: callee.property.name }
  }
  return null
}

export function collectCalledBindingsFromFunctionBody(
  fn: FunctionLike,
): CallCalleeName[] {
  const called: CallCalleeName[] = []
  t.traverseFast(fn, (node) => {
    if (t.isCallExpression(node)) {
      const name = getCallCalleeName(node.callee)
      if (name) {
        called.push(name)
      }
    }
    else if (t.isOptionalCallExpression(node)) {
      const name = getCallCalleeName(node.callee)
      if (name) {
        called.push(name)
      }
    }
  })
  return called
}
