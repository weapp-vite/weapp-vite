import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type {
  InlineExpressionAsset,
  InlineExpressionIndexBindingAsset,
  InlineExpressionScopeResolverAsset,
  TransformContext,
} from '../../types'
import type { InlineExpressionParameterIdentifiers } from '../inlineShared'
import { WEVU_SLOT_PROPS_DATA_KEY } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { createInlineExpressionId } from '../../../../../../inlineDataset'
import { traverse } from '../../../../../../utils/babel'
import { hasOwn } from '../../../../../../utils/object'
import { buildForItemResolverExpression } from '../forItemResolver'
import {
  createInlineExpressionParameterIdentifiers,
  createMemberAccess,
  INLINE_GLOBALS,
  isTemplateContextThis,
  replaceIdentifierWithExpression,
} from '../inlineShared'
import { generateExpression, parseBabelExpressionFile } from '../parse'
import { collectScopedSlotLocals, collectSlotPropMapping } from '../scopedSlot'
import { rewriteTopLevelRefLikeAccess } from './refAccess'

function resolveSlotPropBinding(slotProps: Record<string, string>, name: string): string | null {
  if (!hasOwn(slotProps, name)) {
    return null
  }
  const prop = slotProps[name]
  if (!prop) {
    return WEVU_SLOT_PROPS_DATA_KEY
  }
  return generateExpression(createMemberAccess(WEVU_SLOT_PROPS_DATA_KEY, prop) as any)
}

function rewriteExpressionAst(
  ast: t.File,
  locals: Set<string>,
  parameterIdentifiers: InlineExpressionParameterIdentifiers,
  options?: {
    markLocal?: (name: string) => void
  },
) {
  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (
        name === parameterIdentifiers.context.name
        || name === parameterIdentifiers.scope.name
        || name === parameterIdentifiers.event.name
      ) {
        return
      }
      if (path.scope.getBinding(name)) {
        return
      }
      if (name === '$event') {
        path.replaceWith(t.cloneNode(parameterIdentifiers.event))
        return
      }
      if (locals.has(name)) {
        options?.markLocal?.(name)
        replaceIdentifierWithExpression(
          path,
          createMemberAccess(parameterIdentifiers.scope.name, name) as t.Expression,
        )
        return
      }
      if (INLINE_GLOBALS.has(name)) {
        return
      }
      replaceIdentifierWithExpression(
        path,
        createMemberAccess(parameterIdentifiers.context.name, name) as t.Expression,
      )
    },
    ThisExpression(path) {
      if (isTemplateContextThis(path)) {
        path.replaceWith(t.cloneNode(parameterIdentifiers.context))
      }
    },
  })
}

function buildInlineIndexBindings(context: TransformContext): InlineExpressionIndexBindingAsset[] {
  if (!context.forStack.length) {
    return []
  }
  return context.forStack.map((forInfo, level) => ({
    key: `__wv_i${level}`,
    binding: forInfo.index?.trim() || 'index',
  }))
}

function buildScopeResolvers(
  usedLocals: string[],
  context: TransformContext,
  slotProps: Record<string, string>,
  indexBindings: InlineExpressionIndexBindingAsset[],
): InlineExpressionScopeResolverAsset[] {
  const resolvers: InlineExpressionScopeResolverAsset[] = []
  for (const key of usedLocals) {
    const expression = buildForItemResolverExpression(key, context, slotProps, indexBindings)
    if (!expression) {
      continue
    }
    resolvers.push({ key, expression })
  }
  return resolvers
}

function collectForAliasMapping(context: TransformContext): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const forInfo of context.forStack) {
    if (!forInfo.itemAliases) {
      continue
    }
    Object.assign(mapping, forInfo.itemAliases)
  }
  return mapping
}

export interface InlineExpressionBinding {
  id: string
  scopeBindings: string[]
  indexBindings: string[]
}

export function registerInlineExpression(exp: string, context: TransformContext): InlineExpressionBinding | null {
  const parsed = parseBabelExpressionFile(exp)
  if (!parsed) {
    return null
  }
  const { ast } = parsed
  const usedIdentifierNames = new Set<string>()
  let programScope: Scope | undefined
  traverse(ast, {
    Program(path) {
      programScope = path.scope
    },
    Identifier(path) {
      usedIdentifierNames.add(path.node.name)
    },
  })
  if (!programScope) {
    throw new Error('无法为内联表达式创建程序作用域。')
  }
  const parameterIdentifiers = createInlineExpressionParameterIdentifiers(
    programScope,
    usedIdentifierNames,
  )
  const locals = collectScopedSlotLocals(context)
  const slotProps = collectSlotPropMapping(context)
  for (const name of Object.keys(slotProps)) {
    locals.add(name)
  }

  const usedLocals: string[] = []
  const usedLocalSet = new Set<string>()

  const markLocal = (name: string) => {
    if (usedLocalSet.has(name)) {
      return
    }
    usedLocalSet.add(name)
    usedLocals.push(name)
  }

  rewriteExpressionAst(ast, locals, parameterIdentifiers, { markLocal })
  const createHelperIdentifier = (name: string) => {
    let identifier = programScope!.generateUidIdentifier(name)
    while (usedIdentifierNames.has(identifier.name)) {
      identifier = programScope!.generateUidIdentifier(name)
    }
    return identifier
  }
  const runtimeHelpers = rewriteTopLevelRefLikeAccess(ast, context, parameterIdentifiers, locals, createHelperIdentifier, markLocal)
  const forAliases = collectForAliasMapping(context)

  const updatedStmt = ast.program.body[0]
  const updatedExpressionNode = (updatedStmt && 'expression' in updatedStmt)
    ? (updatedStmt as any).expression as t.Expression
    : null
  const updatedExpression = updatedExpressionNode ? generateExpression(updatedExpressionNode) : exp

  const scopeBindings = usedLocals.map((name) => {
    const forAlias = forAliases[name]
    if (forAlias) {
      return forAlias
    }
    const slotBinding = resolveSlotPropBinding(slotProps, name)
    return slotBinding ?? name
  })
  const indexBindings = buildInlineIndexBindings(context)
  const scopeResolvers = buildScopeResolvers(usedLocals, context, slotProps, indexBindings)

  const asset: InlineExpressionAsset = {
    id: createInlineExpressionId(context.inlineExpressionSeed++),
    expression: updatedExpression,
    scopeKeys: usedLocals,
    parameterNames: {
      context: parameterIdentifiers.context.name,
      scope: parameterIdentifiers.scope.name,
      event: parameterIdentifiers.event.name,
    },
  }
  if (runtimeHelpers) {
    asset.runtimeHelpers = runtimeHelpers
  }
  if (scopeResolvers.length) {
    asset.indexBindings = indexBindings
    asset.scopeResolvers = scopeResolvers
  }

  context.inlineExpressions.push(asset)

  return {
    id: asset.id,
    scopeBindings,
    indexBindings: scopeResolvers.length ? indexBindings.map(binding => binding.binding) : [],
  }
}
