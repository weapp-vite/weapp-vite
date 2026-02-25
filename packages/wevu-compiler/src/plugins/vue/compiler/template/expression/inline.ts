import type {
  InlineExpressionAsset,
  InlineExpressionIndexBindingAsset,
  InlineExpressionScopeResolverAsset,
  TransformContext,
} from '../types'
import * as t from '@babel/types'
import { traverse } from '../../../../../utils/babel'
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
  '__weapp_vite',
  '__wevuUnref',
  'globalThis',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'wx',
  'Page',
  'App',
  'Component',
  'requirePlugin',
  'getApp',
  'getCurrentPages',
  'WechatMiniprogram',
  'ctx',
  'scope',
])

const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
const SIMPLE_PATH_RE = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i

function createMemberAccess(target: string, prop: string) {
  if (IDENTIFIER_RE.test(prop)) {
    return t.memberExpression(t.identifier(target), t.identifier(prop))
  }
  return t.memberExpression(t.identifier(target), t.stringLiteral(prop), true)
}

function resolveSlotPropBinding(slotProps: Record<string, string>, name: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(slotProps, name)) {
    return null
  }
  const prop = slotProps[name]
  if (!prop) {
    return '__wvSlotPropsData'
  }
  return generateExpression(createMemberAccess('__wvSlotPropsData', prop) as any)
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
        path.replaceWith(createMemberAccess('scope', name))
        return
      }
      if (INLINE_GLOBALS.has(name)) {
        return
      }
      path.replaceWith(createMemberAccess('ctx', name))
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
    id: `__wv_inline_${context.inlineExpressionSeed++}`,
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
