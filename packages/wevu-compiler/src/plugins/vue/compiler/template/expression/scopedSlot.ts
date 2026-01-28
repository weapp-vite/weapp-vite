import type { TransformContext } from '../types'
import * as t from '@babel/types'
import { traverse } from '../../../../../utils/babel'
import { generateExpression, parseBabelExpressionFile } from './parse'
import { normalizeWxmlExpression } from './wxml'

const SCOPED_SLOT_GLOBALS = new Set([
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
  '__wvOwner',
  '__wvSlotProps',
  '__wvSlotPropsData',
  '__weapp_vite',
])

export function collectScopedSlotLocals(context: TransformContext): Set<string> {
  const locals = new Set<string>()
  for (const scope of context.scopeStack) {
    for (const name of scope) {
      locals.add(name)
    }
  }
  return locals
}

export function collectSlotPropMapping(context: TransformContext): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const entry of context.slotPropStack) {
    Object.assign(mapping, entry)
  }
  return mapping
}

function rewriteScopedSlotExpression(exp: string, context: TransformContext): string {
  const normalized = normalizeWxmlExpression(exp)
  const parsed = parseBabelExpressionFile(normalized)
  if (!parsed) {
    return normalized
  }
  const { ast } = parsed
  const locals = collectScopedSlotLocals(context)
  const slotProps = collectSlotPropMapping(context)
  const createMemberAccess = (target: string, prop: string) => {
    if (!prop) {
      return t.identifier(target)
    }
    if (/^[A-Z_$][\w$]*$/i.test(prop)) {
      return t.memberExpression(t.identifier(target), t.identifier(prop))
    }
    return t.memberExpression(t.identifier(target), t.stringLiteral(prop), true)
  }

  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (SCOPED_SLOT_GLOBALS.has(name)) {
        return
      }
      if (locals.has(name)) {
        return
      }
      if (Object.prototype.hasOwnProperty.call(slotProps, name)) {
        const member = createMemberAccess('__wvSlotPropsData', slotProps[name])
        const parent = path.parentPath
        if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
          parent.node.shorthand = false
          parent.node.value = member
          return
        }
        path.replaceWith(member)
        return
      }
      const member = createMemberAccess('__wvOwner', name)
      const parent = path.parentPath
      if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
        parent.node.shorthand = false
        parent.node.value = member
        return
      }
      path.replaceWith(member)
    },
  })

  const stmt = ast.program.body[0]
  const updatedExpression = (stmt && 'expression' in stmt) ? (stmt as any).expression as t.Expression : null
  return updatedExpression ? generateExpression(updatedExpression) : normalized
}

export function normalizeWxmlExpressionWithContext(exp: string, context?: TransformContext): string {
  if (!context?.rewriteScopedSlot) {
    return normalizeWxmlExpression(exp)
  }
  return rewriteScopedSlotExpression(exp, context)
}
