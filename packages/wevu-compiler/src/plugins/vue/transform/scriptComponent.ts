import * as t from '@babel/types'

function isDefineComponentCall(node: t.CallExpression, aliases: Set<string>) {
  return t.isIdentifier(node.callee) && aliases.has(node.callee.name)
}

export function unwrapDefineComponent(node: t.Expression, aliases: Set<string>): t.ObjectExpression | null {
  if (t.isCallExpression(node) && isDefineComponentCall(node, aliases)) {
    const arg = node.arguments[0]
    if (t.isObjectExpression(arg)) {
      return arg
    }
  }
  return null
}

export function resolveComponentExpression(
  declaration: t.Declaration | t.Expression | null,
  defineComponentDecls: Map<string, t.ObjectExpression>,
  aliases: Set<string>,
): t.Expression | null {
  if (!declaration) {
    return null
  }
  if (t.isObjectExpression(declaration)) {
    return declaration
  }
  if (t.isCallExpression(declaration) && isDefineComponentCall(declaration, aliases)) {
    const arg = declaration.arguments[0]
    if (t.isObjectExpression(arg)) {
      return arg
    }
    if (t.isIdentifier(arg)) {
      const matched = defineComponentDecls.get(arg.name)
      return matched ? t.cloneNode(matched, true) : null
    }
    return null
  }
  if (t.isIdentifier(declaration)) {
    const matched = defineComponentDecls.get(declaration.name)
    return matched ? t.cloneNode(matched, true) : null
  }
  return null
}
