import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type {
  InlineExpressionAsset,
  InlineExpressionIndexBindingAsset,
  InlineExpressionScopeResolverAsset,
  TransformContext,
} from '../types'
import type { InlineExpressionParameterIdentifiers } from './inlineShared'
import { WEVU_SLOT_PROPS_DATA_KEY } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { createInlineExpressionId } from '../../../../../inlineDataset'
import { traverse } from '../../../../../utils/babel'
import { hasOwn } from '../../../../../utils/object'
import { buildForItemResolverExpression } from './forItemResolver'
import {
  createInlineExpressionParameterIdentifiers,
  createMemberAccess,
  INLINE_GLOBALS,
  replaceIdentifierWithExpression,
} from './inlineShared'
import { generateExpression, parseBabelExpressionFile } from './parse'
import { collectScopedSlotLocals, collectSlotPropMapping } from './scopedSlot'

const SCRIPT_SETUP_REF_BINDINGS = new Set([
  'setup-ref',
  'setup-maybe-ref',
])

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
      path.replaceWith(t.cloneNode(parameterIdentifiers.context))
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

function getScriptSetupBindingType(context: TransformContext, name: string): string | undefined {
  const binding = context.scriptSetupBindings?.[name]
  return typeof binding === 'string' ? binding : undefined
}

function isScriptSetupBinding(context: TransformContext, name: string) {
  return Boolean(getScriptSetupBindingType(context, name))
}

function isScriptSetupRefLikeBinding(context: TransformContext, name: string) {
  const bindingType = getScriptSetupBindingType(context, name)
  return bindingType ? SCRIPT_SETUP_REF_BINDINGS.has(bindingType) : false
}

function isRefLikeCtxMember(
  node: t.Node,
  context: TransformContext,
  contextIdentifierName: string,
): node is t.MemberExpression {
  return (
    t.isMemberExpression(node)
    && t.isIdentifier(node.object, { name: contextIdentifierName })
    && t.isIdentifier(node.property)
    && !node.computed
    && isScriptSetupRefLikeBinding(context, node.property.name)
  )
}

function buildCtxValueAccess(member: t.MemberExpression) {
  return t.memberExpression(t.cloneNode(member), t.identifier('value'))
}

function isValueMemberObject(node: t.MemberExpression, parent: t.Node | undefined) {
  return (
    t.isMemberExpression(parent)
    && parent.object === node
    && t.isIdentifier(parent.property, { name: 'value' })
    && !parent.computed
  )
}

function isCallTarget(node: t.MemberExpression, parent: t.Node | undefined) {
  return (
    (t.isCallExpression(parent) || t.isOptionalCallExpression(parent) || t.isNewExpression(parent))
    && parent.callee === node
  )
}

function rewriteTopLevelRefLikeAccess(
  ast: t.File,
  context: TransformContext,
  contextIdentifier: t.Identifier,
) {
  traverse(ast, {
    AssignmentExpression(path) {
      const left = path.node.left
      if (t.isIdentifier(left) && isScriptSetupRefLikeBinding(context, left.name)) {
        path.node.left = buildCtxValueAccess(
          t.memberExpression(t.cloneNode(contextIdentifier), t.identifier(left.name)),
        )
      }
      else if (t.isIdentifier(left) && isScriptSetupBinding(context, left.name)) {
        path.node.left = t.memberExpression(t.cloneNode(contextIdentifier), t.identifier(left.name))
      }
      else if (isRefLikeCtxMember(left, context, contextIdentifier.name)) {
        path.node.left = buildCtxValueAccess(left)
      }
    },
    UpdateExpression(path) {
      const arg = path.node.argument
      if (t.isIdentifier(arg) && isScriptSetupRefLikeBinding(context, arg.name)) {
        path.node.argument = buildCtxValueAccess(
          t.memberExpression(t.cloneNode(contextIdentifier), t.identifier(arg.name)),
        )
      }
      else if (t.isIdentifier(arg) && isScriptSetupBinding(context, arg.name)) {
        path.node.argument = t.memberExpression(t.cloneNode(contextIdentifier), t.identifier(arg.name))
      }
      else if (isRefLikeCtxMember(arg, context, contextIdentifier.name)) {
        path.node.argument = buildCtxValueAccess(arg)
      }
    },
  })

  traverse(ast, {
    MemberExpression(path) {
      if (!isRefLikeCtxMember(path.node, context, contextIdentifier.name)) {
        return
      }
      if (isValueMemberObject(path.node, path.parentPath?.node)) {
        return
      }
      if (isCallTarget(path.node, path.parentPath?.node)) {
        return
      }
      path.replaceWith(buildCtxValueAccess(path.node))
      path.skip()
    },
  })
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
  rewriteTopLevelRefLikeAccess(ast, context, parameterIdentifiers.context)
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
