import type { TransformContext } from '../types'
import {
  WEVU_PROPS_KEY,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseJsLike, traverse } from '../../../../../utils/babel'
import { parseBabelExpression } from './parse'
import { collectScopedSlotLocals, collectSlotPropMapping } from './scopedSlot'
import { normalizeWxmlExpression } from './wxml'

const JS_RUNTIME_GLOBALS = new Set([
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
  'WeakMap',
  'WeakSet',
  'Promise',
  'Symbol',
  'BigInt',
  'JSON',
  'Intl',
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
  'globalThis',
  '__wevuUnref',
  'getApp',
  'getCurrentPages',
  ...getMiniProgramRuntimeGlobalKeys(),
])

function parseJsExpressionFile(exp: string): { ast: t.File, expression: t.Expression } | null {
  try {
    const ast = parseJsLike(`(${exp})`)
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return null
    }
    const expression = (stmt as any).expression as t.Expression
    return { ast, expression }
  }
  catch {
    return null
  }
}

function createMemberAccess(target: t.Expression, prop: string): t.Expression {
  if (!prop) {
    return target
  }
  if (t.isValidIdentifier(prop)) {
    return t.memberExpression(target, t.identifier(prop))
  }
  return t.memberExpression(target, t.stringLiteral(prop), true)
}

function createThisMemberAccess(prop: string): t.Expression {
  return createMemberAccess(t.thisExpression(), prop)
}

function createUnrefCall(exp: t.Expression): t.Expression {
  return t.callExpression(t.identifier('__wevuUnref'), [exp])
}

function createHasOwnPropertyCall(target: t.Expression, key: string): t.Expression {
  return t.callExpression(
    t.memberExpression(
      t.memberExpression(
        t.memberExpression(t.identifier('Object'), t.identifier('prototype')),
        t.identifier('hasOwnProperty'),
      ),
      t.identifier('call'),
    ),
    [target, t.stringLiteral(key)],
  )
}

function createIdentifierAccessWithPropsFallback(name: string): t.Expression {
  if (name === 'props') {
    const propsObject = createThisMemberAccess(WEVU_PROPS_KEY)
    return t.conditionalExpression(
      t.binaryExpression('!=', propsObject, t.nullLiteral()),
      propsObject,
      createThisMemberAccess('props'),
    )
  }
  const thisAccess = createThisMemberAccess(name)
  const propsAccess = createMemberAccess(createThisMemberAccess(WEVU_PROPS_KEY), name)
  const propsObject = createThisMemberAccess(WEVU_PROPS_KEY)
  const stateObject = createThisMemberAccess('$state')
  const hasPropsObject = t.binaryExpression('!=', propsObject, t.nullLiteral())
  const hasDefinedPropsValue = t.binaryExpression('!==', propsAccess, t.identifier('undefined'))
  const hasPropsKey = createHasOwnPropertyCall(propsObject, name)
  const hasUsablePropsValue = t.logicalExpression(
    '&&',
    hasPropsObject,
    t.logicalExpression('||', hasDefinedPropsValue, hasPropsKey),
  )
  const hasStateObject = t.binaryExpression('!=', stateObject, t.nullLiteral())
  const hasStateKey = createHasOwnPropertyCall(stateObject, name)
  const hasThisMember = t.binaryExpression('in', t.stringLiteral(name), t.thisExpression())
  const shouldUseStateAccess = t.logicalExpression('&&', hasStateObject, hasStateKey)
  const shouldUsePropsAccess = t.logicalExpression(
    '&&',
    hasUsablePropsValue,
    t.unaryExpression('!', hasThisMember),
  )
  return t.conditionalExpression(
    shouldUseStateAccess,
    thisAccess,
    t.conditionalExpression(
      shouldUsePropsAccess,
      propsAccess,
      thisAccess,
    ),
  )
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

export function normalizeJsExpressionWithContext(
  exp: string,
  context: TransformContext,
  options?: { hint?: string },
): t.Expression | null {
  const trimmed = exp.trim()
  if (!trimmed) {
    return null
  }
  const normalized = normalizeWxmlExpression(trimmed)
  const parsed = parseJsExpressionFile(normalized)
  if (!parsed) {
    const hint = options?.hint ? `${options.hint} ` : ''
    context.warnings.push(`${hint}模板表达式解析失败，已忽略：${exp}`)
    return null
  }

  const { ast } = parsed
  const locals = collectScopedSlotLocals(context)
  const slotProps = context.rewriteScopedSlot ? collectSlotPropMapping(context) : {}
  const forAliases = collectForAliasMapping(context)

  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (JS_RUNTIME_GLOBALS.has(name)) {
        return
      }
      if (path.scope.hasBinding(name)) {
        return
      }
      if (Object.hasOwn(forAliases, name)) {
        const aliasExp = parseBabelExpression(forAliases[name])
        if (aliasExp) {
          const replacement = t.cloneNode(aliasExp, true)
          const parent = path.parentPath
          if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
            parent.node.shorthand = false
            parent.node.value = replacement
            return
          }
          path.replaceWith(replacement)
          return
        }
      }
      if (locals.has(name)) {
        return
      }

      let replacement: t.Expression
      if (context.rewriteScopedSlot) {
        if (Object.hasOwn(slotProps, name)) {
          const prop = slotProps[name]
          const base = createThisMemberAccess(WEVU_SLOT_PROPS_DATA_KEY)
          replacement = createUnrefCall(prop ? createMemberAccess(base, prop) : base)
        }
        else if (
          name === WEVU_SLOT_OWNER_KEY
          || name === WEVU_SLOT_PROPS_DATA_KEY
          || name === WEVU_SLOT_PROPS_KEY
          || name === WEVU_SLOT_SCOPE_KEY
        ) {
          replacement = createUnrefCall(createThisMemberAccess(name))
        }
        else {
          const base = createThisMemberAccess(WEVU_SLOT_OWNER_KEY)
          replacement = createUnrefCall(createMemberAccess(base, name))
        }
      }
      else {
        replacement = createUnrefCall(createIdentifierAccessWithPropsFallback(name))
      }

      const parent = path.parentPath
      if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
        parent.node.shorthand = false
        parent.node.value = replacement
        return
      }
      path.replaceWith(replacement)
    },
  })

  const stmt = ast.program.body[0]
  const updated = (stmt && 'expression' in stmt) ? (stmt as any).expression as t.Expression : null
  return updated || null
}
