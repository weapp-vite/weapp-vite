import * as t from '@babel/types'

function isDefineComponentCall(node: t.CallExpression, aliases: Set<string>) {
  return t.isIdentifier(node.callee) && aliases.has(node.callee.name)
}

function isObjectAssignCall(node: t.CallExpression) {
  const callee = node.callee
  return t.isMemberExpression(callee)
    && t.isIdentifier(callee.object, { name: 'Object' })
    && t.isIdentifier(callee.property, { name: 'assign' })
}

function unwrapTypeLikeExpression(node: t.Expression): t.Expression {
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node) || t.isTypeCastExpression(node)) {
    return unwrapTypeLikeExpression(node.expression as t.Expression)
  }
  if (t.isParenthesizedExpression(node)) {
    return unwrapTypeLikeExpression(node.expression)
  }
  return node
}

function resolveObjectExpressionFromAssignCall(node: t.CallExpression): t.ObjectExpression | null {
  if (!isObjectAssignCall(node)) {
    return null
  }

  for (let index = node.arguments.length - 1; index >= 0; index -= 1) {
    const arg = node.arguments[index]
    if (t.isSpreadElement(arg) || !t.isExpression(arg)) {
      continue
    }
    const normalized = unwrapTypeLikeExpression(arg)
    if (t.isObjectExpression(normalized)) {
      return normalized
    }
  }

  return null
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
    if (t.isExpression(arg)) {
      return arg
    }
    return null
  }
  if (t.isCallExpression(declaration) && isObjectAssignCall(declaration)) {
    return declaration
  }
  if (t.isIdentifier(declaration)) {
    const matched = defineComponentDecls.get(declaration.name)
    return matched ? t.cloneNode(matched, true) : null
  }
  return null
}

export function resolveComponentOptionsObject(componentExpr: t.Expression | null): t.ObjectExpression | null {
  if (!componentExpr) {
    return null
  }

  const normalized = unwrapTypeLikeExpression(componentExpr)

  if (t.isObjectExpression(normalized)) {
    return normalized
  }

  if (t.isCallExpression(normalized)) {
    return resolveObjectExpressionFromAssignCall(normalized)
  }

  return null
}
