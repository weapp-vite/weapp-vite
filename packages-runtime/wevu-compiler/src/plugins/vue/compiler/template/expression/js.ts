import type { TransformContext } from '../types'
import {
  WEVU_PROPS_KEY,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_OWNER_PROXY_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseJsLike, traverse } from '../../../../../utils/babel'
import { hasOwn } from '../../../../../utils/object'
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
  '__wevuResolvePropValue',
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

function createResolvePropValueCall(name: string, fallback: t.Expression, preferProps = false): t.Expression {
  const args: t.Expression[] = [
    t.thisExpression(),
    t.stringLiteral(name),
    fallback,
  ]
  if (preferProps) {
    args.push(t.booleanLiteral(true))
  }
  return t.callExpression(t.identifier('__wevuResolvePropValue'), args)
}

function createPropsKeyAccessFallback(name: string, fallback: t.Expression): t.Expression {
  const propsObject = createThisMemberAccess(WEVU_PROPS_KEY)
  const propsAccess = createMemberAccess(propsObject, name)
  const hasPropsObject = t.binaryExpression('!=', propsObject, t.nullLiteral())
  const hasPropsValue = t.logicalExpression(
    '&&',
    hasPropsObject,
    t.logicalExpression(
      '||',
      t.binaryExpression('!==', propsAccess, t.identifier('undefined')),
      createHasOwnPropertyCall(propsObject, name),
    ),
  )
  return t.conditionalExpression(
    hasPropsValue,
    propsAccess,
    fallback,
  )
}

function createIdentifierAccessWithPropsFallback(
  name: string,
  context: TransformContext,
  useRuntimePropHelper = false,
): t.Expression {
  if (useRuntimePropHelper) {
    if (name === 'props') {
      const propsObject = createThisMemberAccess(WEVU_PROPS_KEY)
      return t.conditionalExpression(
        t.binaryExpression('!=', propsObject, t.nullLiteral()),
        propsObject,
        createThisMemberAccess('props'),
      )
    }
    return createResolvePropValueCall(name, createThisMemberAccess(name))
  }
  if (name === 'props') {
    const propsObject = createThisMemberAccess(WEVU_PROPS_KEY)
    return t.conditionalExpression(
      t.binaryExpression('!=', propsObject, t.nullLiteral()),
      propsObject,
      createThisMemberAccess('props'),
    )
  }
  if (name === 'data') {
    return createPropsKeyAccessFallback(name, createThisMemberAccess(name))
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
  const isPropsDerivedKey = Boolean(context.propsDerivedKeys?.includes(name))
  const shouldUseStateAccess = isPropsDerivedKey
    ? t.booleanLiteral(false)
    : t.logicalExpression('&&', hasStateObject, hasStateKey)
  const shouldUsePropsAccess = t.logicalExpression(
    '&&',
    hasUsablePropsValue,
    isPropsDerivedKey ? t.booleanLiteral(true) : t.unaryExpression('!', hasThisMember),
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

function createAliasedPropsAccess(name: string, propName: string): t.Expression {
  return createResolvePropValueCall(propName, createThisMemberAccess(name), true)
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
  options?: { hint?: string, runtimePropAccess?: 'default' | 'helper' },
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
      if (hasOwn(forAliases, name)) {
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
        if (hasOwn(slotProps, name)) {
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
          const base = createThisMemberAccess(WEVU_SLOT_OWNER_PROXY_KEY)
          replacement = createUnrefCall(createMemberAccess(base, name))
        }
      }
      else {
        const propsAlias = context.propsAliases?.[name]
        replacement = createUnrefCall(
          propsAlias
            ? createAliasedPropsAccess(name, propsAlias)
            : createIdentifierAccessWithPropsFallback(name, context, options?.runtimePropAccess === 'helper'),
        )
      }

      const parent = path.parentPath
      if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
        parent.node.shorthand = false
        parent.node.value = replacement
        path.skip()
        return
      }
      path.replaceWith(replacement)
      path.skip()
    },
  })

  const stmt = ast.program.body[0]
  const updated = (stmt && 'expression' in stmt) ? (stmt as any).expression as t.Expression : null
  return updated || null
}
