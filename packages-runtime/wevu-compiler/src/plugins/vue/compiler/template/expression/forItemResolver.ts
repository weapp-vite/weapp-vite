import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type {
  InlineExpressionIndexBindingAsset,
  TransformContext,
} from '../types'
import type { InlineExpressionParameterIdentifiers } from './inlineShared'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../../../utils/babel'
import { hasOwn } from '../../../../../utils/object'
import {
  createInlineExpressionParameterIdentifiers,
  createMemberAccess,
  INLINE_GLOBALS,
  replaceIdentifierWithExpression,
} from './inlineShared'
import { generateExpression, parseBabelExpressionFile } from './parse'

const SIMPLE_PATH_RE = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i

interface ParsedResolverExpression {
  ast: t.File
  expression: t.Expression
}

function rewriteForItemResolverExpression(
  expression: t.Expression,
  resolvedLocals: ReadonlyMap<string, t.Expression>,
  resolvedIndexes: ReadonlyMap<string, t.Expression>,
  parameterIdentifiers: InlineExpressionParameterIdentifiers,
): t.Expression | null {
  const ast = t.file(t.program([
    t.expressionStatement(t.cloneNode(expression, true)),
  ]))
  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier() || path.scope.hasBinding(path.node.name)) {
        return
      }
      const name = path.node.name
      if (
        name === parameterIdentifiers.context.name
        || name === parameterIdentifiers.scope.name
      ) {
        return
      }
      const localExpression = resolvedLocals.get(name) ?? resolvedIndexes.get(name)
      if (localExpression) {
        replaceIdentifierWithExpression(path, t.cloneNode(localExpression, true))
        path.skip()
        return
      }
      if (INLINE_GLOBALS.has(name)) {
        return
      }
      replaceIdentifierWithExpression(
        path,
        createMemberAccess(parameterIdentifiers.context.name, name) as t.Expression,
      )
      path.skip()
    },
    ThisExpression(path) {
      path.replaceWith(t.cloneNode(parameterIdentifiers.context))
    },
  })
  const statement = ast.program.body[0]
  return statement && t.isExpressionStatement(statement) ? statement.expression : null
}

function getParsedResolverExpression(
  source: string,
  cache: Map<string, ParsedResolverExpression | null>,
) {
  if (cache.has(source)) {
    return cache.get(source) ?? null
  }
  const expression = parseBabelExpressionFile(source)
  cache.set(source, expression)
  return expression
}

function buildNestedForItemResolverExpression(
  targetKey: string,
  targetLevel: number,
  context: TransformContext,
  slotProps: Record<string, string>,
  indexBindings: InlineExpressionIndexBindingAsset[],
): string | null {
  const expressionCache = new Map<string, ParsedResolverExpression | null>()
  for (let level = 0; level <= targetLevel; level += 1) {
    const forInfo = context.forStack[level]
    const listExp = forInfo?.listExp?.trim() ?? ''
    if (!listExp || !getParsedResolverExpression(listExp, expressionCache)) {
      return null
    }
    for (const aliasExp of Object.values(forInfo.itemAliases ?? {})) {
      getParsedResolverExpression(aliasExp, expressionCache)
    }
  }
  const usedIdentifierNames = new Set<string>()
  let programScope: Scope | undefined
  for (const parsed of expressionCache.values()) {
    if (!parsed) {
      continue
    }
    traverse(parsed.ast, {
      Program(path) {
        programScope ??= path.scope
      },
      Identifier(path) {
        usedIdentifierNames.add(path.node.name)
      },
    })
  }
  if (!programScope) {
    return null
  }
  const parameterIdentifiers = createInlineExpressionParameterIdentifiers(
    programScope,
    usedIdentifierNames,
  )
  const resolvedLocals = new Map<string, t.Expression>()
  const resolvedIndexes = new Map<string, t.Expression>()

  for (let level = 0; level <= targetLevel; level += 1) {
    const forInfo = context.forStack[level]
    const listExp = forInfo?.listExp?.trim() ?? ''
    const indexBinding = indexBindings[level]
    const parsedList = getParsedResolverExpression(listExp, expressionCache)
    if (!forInfo || !parsedList || !indexBinding) {
      return null
    }
    const root = SIMPLE_PATH_RE.test(listExp) ? listExp.split('.')[0] : ''
    if (root && hasOwn(slotProps, root) && !resolvedLocals.has(root)) {
      return null
    }

    const listExpression = rewriteForItemResolverExpression(
      parsedList.expression,
      resolvedLocals,
      resolvedIndexes,
      parameterIdentifiers,
    )
    if (!listExpression) {
      return null
    }
    const indexExpression = createMemberAccess(
      parameterIdentifiers.scope.name,
      indexBinding.key,
    ) as t.Expression
    const itemExpression = t.memberExpression(listExpression, t.cloneNode(indexExpression), true)
    if (forInfo.item) {
      resolvedLocals.set(forInfo.item, itemExpression)
    }
    for (const [alias, aliasExp] of Object.entries(forInfo.itemAliases ?? {})) {
      const parsedAlias = getParsedResolverExpression(aliasExp, expressionCache)
      if (!parsedAlias) {
        continue
      }
      const resolvedAlias = rewriteForItemResolverExpression(
        parsedAlias.expression,
        resolvedLocals,
        resolvedIndexes,
        parameterIdentifiers,
      )
      if (resolvedAlias) {
        resolvedLocals.set(alias, resolvedAlias)
      }
    }

    const targetExpression = resolvedLocals.get(targetKey)
    if (level === targetLevel && targetExpression) {
      return generateExpression(
        t.arrowFunctionExpression(
          [
            t.cloneNode(parameterIdentifiers.context),
            t.cloneNode(parameterIdentifiers.scope),
          ],
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
