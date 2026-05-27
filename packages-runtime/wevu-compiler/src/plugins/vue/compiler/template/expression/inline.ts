import type {
  InlineExpressionAsset,
  InlineExpressionIndexBindingAsset,
  InlineExpressionScopeResolverAsset,
  TransformContext,
} from '../types'
import {
  WEVU_CLASS_STYLE_RUNTIME_MODULE,
  WEVU_SLOT_PROPS_DATA_KEY,
} from '@weapp-core/constants'
import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared'
import * as t from '@weapp-vite/ast/babelTypes'
import { createInlineExpressionId } from '../../../../../inlineDataset'
import { traverse } from '../../../../../utils/babel'
import { hasOwn } from '../../../../../utils/object'
import { generateExpression, parseBabelExpressionFile } from './parse'
import { collectScopedSlotLocals, collectSlotPropMapping } from './scopedSlot'

const INLINE_GLOBALS = new Set([
  'Math',
  'Number',
  'Date',
  'Array',
  'Object',
  'Boolean',
  'String',
  'RegExp',
  'Map',
  'Set',
  'JSON',
  'Intl',
  'Promise',
  'console',
  'Infinity',
  'undefined',
  'NaN',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'require',
  'arguments',
  WEVU_CLASS_STYLE_RUNTIME_MODULE,
  '__wevuUnref',
  'globalThis',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'Page',
  'App',
  'Component',
  'requirePlugin',
  'getApp',
  'getCurrentPages',
  'ctx',
  'scope',
  ...getMiniProgramRuntimeGlobalKeys(),
])

const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
const SIMPLE_PATH_RE = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i
const SCRIPT_SETUP_REF_BINDINGS = new Set([
  'setup-ref',
  'setup-maybe-ref',
])

function createMemberAccess(target: string, prop: string) {
  if (IDENTIFIER_RE.test(prop)) {
    return t.memberExpression(t.identifier(target), t.identifier(prop))
  }
  return t.memberExpression(t.identifier(target), t.stringLiteral(prop), true)
}

function replaceIdentifierWithExpression(path: import('@weapp-vite/ast/babelTraverse').NodePath<t.Identifier>, replacement: t.Expression) {
  const parent = path.parentPath
  if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
    parent.node.shorthand = false
    parent.node.value = replacement
    return
  }
  path.replaceWith(replacement)
}

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
      if (name === '$event') {
        return
      }
      if (name === 'ctx' || name === 'scope') {
        return
      }
      if (path.scope.getBinding(name)) {
        return
      }
      if (locals.has(name)) {
        options?.markLocal?.(name)
        replaceIdentifierWithExpression(path, createMemberAccess('scope', name) as t.Expression)
        return
      }
      if (INLINE_GLOBALS.has(name)) {
        return
      }
      replaceIdentifierWithExpression(path, createMemberAccess('ctx', name) as t.Expression)
    },
    ThisExpression(path) {
      path.replaceWith(t.identifier('ctx'))
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

function buildForItemResolverExpression(
  targetKey: string,
  context: TransformContext,
  slotProps: Record<string, string>,
  indexBindings: InlineExpressionIndexBindingAsset[],
): string | null {
  let targetLevel = -1
  for (let level = context.forStack.length - 1; level >= 0; level -= 1) {
    if (context.forStack[level]?.item === targetKey) {
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
  if (!listExp || !indexBinding || !SIMPLE_PATH_RE.test(listExp)) {
    return null
  }

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
  if (localRoots.has(root)) {
    return null
  }

  return `({type:'for-item',path:${JSON.stringify(listExp)},indexKey:${JSON.stringify(indexBinding.key)}})`
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

function isRefLikeCtxMember(node: t.Node, context: TransformContext): node is t.MemberExpression {
  return (
    t.isMemberExpression(node)
    && t.isIdentifier(node.object, { name: 'ctx' })
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

function rewriteTopLevelRefLikeAccess(ast: t.File, context: TransformContext) {
  traverse(ast, {
    AssignmentExpression(path) {
      const left = path.node.left
      if (t.isIdentifier(left) && isScriptSetupRefLikeBinding(context, left.name)) {
        path.node.left = buildCtxValueAccess(
          t.memberExpression(t.identifier('ctx'), t.identifier(left.name)),
        ) as any
      }
      else if (t.isIdentifier(left) && isScriptSetupBinding(context, left.name)) {
        path.node.left = t.memberExpression(t.identifier('ctx'), t.identifier(left.name))
      }
      else if (isRefLikeCtxMember(left, context)) {
        path.node.left = buildCtxValueAccess(left)
      }
    },
    UpdateExpression(path) {
      const arg = path.node.argument
      if (t.isIdentifier(arg) && isScriptSetupRefLikeBinding(context, arg.name)) {
        path.node.argument = buildCtxValueAccess(
          t.memberExpression(t.identifier('ctx'), t.identifier(arg.name)),
        )
      }
      else if (t.isIdentifier(arg) && isScriptSetupBinding(context, arg.name)) {
        path.node.argument = t.memberExpression(t.identifier('ctx'), t.identifier(arg.name))
      }
      else if (isRefLikeCtxMember(arg, context)) {
        path.node.argument = buildCtxValueAccess(arg)
      }
    },
  })

  traverse(ast, {
    MemberExpression(path) {
      if (!isRefLikeCtxMember(path.node, context)) {
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

  rewriteExpressionAst(ast, locals, { markLocal })
  rewriteTopLevelRefLikeAccess(ast, context)
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
