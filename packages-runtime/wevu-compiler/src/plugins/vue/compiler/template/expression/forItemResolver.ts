import type {
  InlineExpressionIndexBindingAsset,
  TransformContext,
} from '../types'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../../../utils/babel'
import { hasOwn } from '../../../../../utils/object'
import {
  createMemberAccess,
  INLINE_GLOBALS,
  replaceIdentifierWithExpression,
} from './inlineShared'
import { generateExpression, parseBabelExpressionFile } from './parse'

const SIMPLE_PATH_RE = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i

function rewriteForItemResolverExpression(
  rawExp: string,
  resolvedLocals: ReadonlyMap<string, t.Expression>,
  resolvedIndexes: ReadonlyMap<string, t.Expression>,
): t.Expression | null {
  const parsed = parseBabelExpressionFile(rawExp)
  if (!parsed) {
    return null
  }
  traverse(parsed.ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier() || path.scope.hasBinding(path.node.name)) {
        return
      }
      const name = path.node.name
      const localExpression = resolvedLocals.get(name) ?? resolvedIndexes.get(name)
      if (localExpression) {
        replaceIdentifierWithExpression(path, t.cloneNode(localExpression, true))
        path.skip()
        return
      }
      if (INLINE_GLOBALS.has(name)) {
        return
      }
      replaceIdentifierWithExpression(path, createMemberAccess('ctx', name) as t.Expression)
      path.skip()
    },
    ThisExpression(path) {
      path.replaceWith(t.identifier('ctx'))
    },
  })
  const statement = parsed.ast.program.body[0]
  return statement && t.isExpressionStatement(statement) ? statement.expression : null
}

function buildNestedForItemResolverExpression(
  targetKey: string,
  targetLevel: number,
  context: TransformContext,
  slotProps: Record<string, string>,
  indexBindings: InlineExpressionIndexBindingAsset[],
): string | null {
  const resolvedLocals = new Map<string, t.Expression>()
  const resolvedIndexes = new Map<string, t.Expression>()

  for (let level = 0; level <= targetLevel; level += 1) {
    const forInfo = context.forStack[level]
    const listExp = forInfo?.listExp?.trim() ?? ''
    const indexBinding = indexBindings[level]
    if (!forInfo || !listExp || !indexBinding) {
      return null
    }
    const root = SIMPLE_PATH_RE.test(listExp) ? listExp.split('.')[0] : ''
    if (root && hasOwn(slotProps, root) && !resolvedLocals.has(root)) {
      return null
    }

    const listExpression = rewriteForItemResolverExpression(listExp, resolvedLocals, resolvedIndexes)
    if (!listExpression) {
      return null
    }
    const indexExpression = createMemberAccess('scope', indexBinding.key) as t.Expression
    const itemExpression = t.memberExpression(listExpression, t.cloneNode(indexExpression), true)
    if (forInfo.item) {
      resolvedLocals.set(forInfo.item, itemExpression)
    }
    for (const [alias, aliasExp] of Object.entries(forInfo.itemAliases ?? {})) {
      const resolvedAlias = rewriteForItemResolverExpression(aliasExp, resolvedLocals, resolvedIndexes)
      if (resolvedAlias) {
        resolvedLocals.set(alias, resolvedAlias)
      }
    }

    const targetExpression = resolvedLocals.get(targetKey)
    if (level === targetLevel && targetExpression) {
      return generateExpression(
        t.arrowFunctionExpression(
          [t.identifier('ctx'), t.identifier('scope')],
          t.cloneNode(targetExpression, true),
        ),
      )
    }

    resolvedIndexes.set(forInfo.index?.trim() || 'index', indexExpression)
    if (forInfo.key) {
      resolvedIndexes.set(forInfo.key, indexExpression)
    }
  }
  return null
}

export function buildForItemResolverExpression(
  targetKey: string,
  context: TransformContext,
  slotProps: Record<string, string>,
  indexBindings: InlineExpressionIndexBindingAsset[],
): string | null {
  let targetLevel = -1
  for (let level = context.forStack.length - 1; level >= 0; level -= 1) {
    const forInfo = context.forStack[level]
    if (forInfo?.item === targetKey || hasOwn(forInfo?.itemAliases ?? {}, targetKey)) {
      targetLevel = level
      break
    }
  }
  if (targetLevel < 0) {
    return null
  }

  const forInfo = context.forStack[targetLevel]
  const listExp = forInfo?.listExp?.trim() ?? ''
  const indexBinding = indexBindings[targetLevel]
  if (!listExp || !indexBinding) {
    return null
  }

  if (forInfo?.item === targetKey && SIMPLE_PATH_RE.test(listExp)) {
    const root = listExp.split('.')[0]
    const localRoots = new Set<string>(Object.keys(slotProps))
    for (let level = 0; level <= targetLevel; level += 1) {
      const item = context.forStack[level]?.item?.trim()
      const index = context.forStack[level]?.index?.trim()
      if (item) {
        localRoots.add(item)
      }
      if (index) {
        localRoots.add(index)
      }
      localRoots.add('index')
    }
    if (!localRoots.has(root)) {
      return `({type:'for-item',path:${JSON.stringify(listExp)},indexKey:${JSON.stringify(indexBinding.key)}})`
    }
  }

  return buildNestedForItemResolverExpression(targetKey, targetLevel, context, slotProps, indexBindings)
}
