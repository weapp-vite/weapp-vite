import type { ClassStyleBinding } from '../compiler/template/types'
import * as t from '@weapp-vite/ast/babelTypes'
import { generate, traverse } from '../../../utils/babel'
import { buildComputedFunctionBody, createStaticObjectKey } from './classStyleComputedBuilders'

export interface ClassStyleHelperIds {
  normalizeClass: t.Identifier
  normalizeStyle: t.Identifier
  unref?: t.Identifier
}

export interface ClassStyleHelperNames {
  normalizeClassName: string
  normalizeStyleName: string
  unrefName?: string
}

function createMemberAccess(target: t.Expression, prop: string): t.Expression {
  if (t.isValidIdentifier(prop)) {
    return t.memberExpression(target, t.identifier(prop))
  }
  return t.memberExpression(target, t.stringLiteral(prop), true)
}

function applyPropsAliasesToExpression(expression: t.Expression, propsAliases: Record<string, string> | undefined) {
  if (!propsAliases || !Object.keys(propsAliases).length) {
    return expression
  }
  const ast = t.file(t.program([t.expressionStatement(expression)]))
  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const propName = propsAliases[path.node.name]
      if (!propName || path.scope.hasBinding(path.node.name)) {
        return
      }
      const replacement = createMemberAccess(t.identifier('props'), propName)
      const parent = path.parentPath
      if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
        parent.node.shorthand = false
        parent.node.value = replacement
        return
      }
      path.replaceWith(replacement)
    },
  })
  const statement = ast.program.body[0]
  return t.isExpressionStatement(statement) ? statement.expression : expression
}

export function buildClassStyleComputedEntries(
  bindings: ClassStyleBinding[],
  helpers: ClassStyleHelperIds,
  propsAliases?: Record<string, string>,
) {
  const entries: t.ObjectProperty[] = []
  for (const binding of bindings) {
    const key = createStaticObjectKey(binding.name)
    const body = buildComputedFunctionBody({
      ...binding,
      expAst: binding.expAst
        ? applyPropsAliasesToExpression(t.cloneNode(binding.expAst, true), propsAliases)
        : binding.expAst,
    }, helpers)
    const fn = t.functionExpression(null, [], body)
    entries.push(t.objectProperty(key, fn))
  }
  return entries
}

export function buildClassStyleComputedObject(
  bindings: ClassStyleBinding[],
  helpers: ClassStyleHelperIds,
): t.ObjectExpression | null {
  if (!bindings.length) {
    return null
  }
  const entries = buildClassStyleComputedEntries(bindings, helpers)
  if (!entries.length) {
    return null
  }
  return t.objectExpression(entries)
}

export function buildClassStyleComputedCode(
  bindings: ClassStyleBinding[],
  helpers: ClassStyleHelperNames,
): string | null {
  if (!bindings.length) {
    return null
  }
  const obj = buildClassStyleComputedObject(bindings, {
    normalizeClass: t.identifier(helpers.normalizeClassName),
    normalizeStyle: t.identifier(helpers.normalizeStyleName),
    unref: t.identifier(helpers.unrefName ?? 'unref'),
  })
  if (!obj) {
    return null
  }
  const { code } = generate(obj, { compact: true })
  return code
}
