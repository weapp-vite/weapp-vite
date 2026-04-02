import type { AstEngineName } from '../../../../ast/types'
import type { FunctionLike } from '../moduleAnalysis'
import * as t from '@weapp-vite/ast/babelTypes'

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
  engine: AstEngineName = 'babel',
): CallCalleeName[] {
  const called: CallCalleeName[] = []

  if (engine === 'oxc') {
    const visit = (node: any) => {
      if (!node) {
        return
      }
      if (node.type === 'CallExpression') {
        const callee = node.callee
        if (callee?.type === 'Identifier') {
          called.push({ type: 'ident', name: callee.name })
        }
        else if (
          callee?.type === 'MemberExpression'
          && !callee.computed
          && callee.object?.type === 'Identifier'
          && callee.property?.type === 'Identifier'
        ) {
          called.push({ type: 'member', object: callee.object.name, property: callee.property.name })
        }
      }
      else if (node.type === 'ChainExpression') {
        visit(node.expression)
        return
      }

      for (const value of Object.values(node)) {
        if (!value) {
          continue
        }
        if (Array.isArray(value)) {
          for (const child of value) {
            if (child && typeof child === 'object' && typeof child.type === 'string') {
              visit(child)
            }
          }
        }
        else if (typeof value === 'object' && typeof (value as any).type === 'string') {
          visit(value)
        }
      }
    }

    visit(fn)
    return called
  }

  t.traverseFast(fn as t.Node, (node) => {
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
