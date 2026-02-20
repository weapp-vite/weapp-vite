import type { TransformContext } from '../types'
import * as t from '@babel/types'
import { parseJsLike, traverse } from '../../../../../utils/babel'
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
  'wx',
  'getApp',
  'getCurrentPages',
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
  const thisAccess = createThisMemberAccess(name)
  const propsAccess = createMemberAccess(createThisMemberAccess('__wevuProps'), name)
  const propsObject = createThisMemberAccess('__wevuProps')
  const hasPropsObject = t.binaryExpression('!=', propsObject, t.nullLiteral())
  const hasDefinedPropsValue = t.binaryExpression('!==', propsAccess, t.identifier('undefined'))
  const hasPropsKey = createHasOwnPropertyCall(propsObject, name)
  const hasUsablePropsValue = t.logicalExpression(
    '&&',
    hasPropsObject,
    t.logicalExpression('||', hasDefinedPropsValue, hasPropsKey),
  )
  return t.conditionalExpression(
    hasUsablePropsValue,
    propsAccess,
    thisAccess,
  )
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
      if (locals.has(name)) {
        return
      }

      let replacement: t.Expression
      if (context.rewriteScopedSlot) {
        if (Object.prototype.hasOwnProperty.call(slotProps, name)) {
          const prop = slotProps[name]
          const base = createThisMemberAccess('__wvSlotPropsData')
          replacement = createUnrefCall(prop ? createMemberAccess(base, prop) : base)
        }
        else if (
          name === '__wvOwner'
          || name === '__wvSlotPropsData'
          || name === '__wvSlotProps'
          || name === '__wvSlotScope'
        ) {
          replacement = createUnrefCall(createThisMemberAccess(name))
        }
        else {
          const base = createThisMemberAccess('__wvOwner')
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
