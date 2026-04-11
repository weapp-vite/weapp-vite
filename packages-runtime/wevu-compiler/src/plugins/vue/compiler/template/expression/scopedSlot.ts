import type { TransformContext } from '../types'
import {
  WEVU_CLASS_STYLE_RUNTIME_MODULE,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_PROPS_KEY,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../../../utils/babel'
import { generateExpression, parseBabelExpression, parseBabelExpressionFile } from './parse'
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
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_PROPS_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_CLASS_STYLE_RUNTIME_MODULE,
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

function replaceIdentifierWithExpression(path: import('@weapp-vite/ast/babelTraverse').NodePath<t.Identifier>, replacement: t.Expression) {
  const parent = path.parentPath
  if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
    parent.node.shorthand = false
    parent.node.value = replacement
    return
  }
  path.replaceWith(replacement)
}

const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

function rewriteScopedSlotExpression(exp: string, context: TransformContext): string {
  const normalized = normalizeWxmlExpression(exp)
  const parsed = parseBabelExpressionFile(normalized)
  if (!parsed) {
    return normalized
  }
  const { ast } = parsed
  const locals = collectScopedSlotLocals(context)
  const slotProps = collectSlotPropMapping(context)
  const forAliases = collectForAliasMapping(context)
  const createMemberAccess = (target: string, prop: string) => {
    if (!prop) {
      return t.identifier(target)
    }
    if (IDENTIFIER_RE.test(prop)) {
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
      if (path.scope.hasBinding(name)) {
        return
      }
      if (Object.hasOwn(forAliases, name)) {
        const aliasExp = parseBabelExpression(forAliases[name])
        if (aliasExp) {
          replaceIdentifierWithExpression(path, t.cloneNode(aliasExp, true))
          return
        }
      }
      if (locals.has(name)) {
        return
      }
      if (Object.hasOwn(slotProps, name)) {
        const member = createMemberAccess(WEVU_SLOT_PROPS_DATA_KEY, slotProps[name])
        replaceIdentifierWithExpression(path, member)
        return
      }
      const member = createMemberAccess(WEVU_SLOT_OWNER_KEY, name)
      replaceIdentifierWithExpression(path, member)
    },
  })

  const stmt = ast.program.body[0]
  const updatedExpression = (stmt && 'expression' in stmt) ? (stmt as any).expression as t.Expression : null
  return updatedExpression ? generateExpression(updatedExpression) : normalized
}

function rewriteForAliasExpression(exp: string, context: TransformContext): string {
  const normalized = normalizeWxmlExpression(exp)
  const forAliases = collectForAliasMapping(context)
  if (!Object.keys(forAliases).length) {
    return normalized
  }
  const parsed = parseBabelExpressionFile(normalized)
  if (!parsed) {
    return normalized
  }
  const { ast } = parsed

  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (path.scope.hasBinding(name)) {
        return
      }
      if (!Object.hasOwn(forAliases, name)) {
        return
      }
      const aliasExp = parseBabelExpression(forAliases[name])
      if (!aliasExp) {
        return
      }
      replaceIdentifierWithExpression(path, t.cloneNode(aliasExp, true))
    },
  })

  const stmt = ast.program.body[0]
  const updatedExpression = (stmt && 'expression' in stmt) ? (stmt as any).expression as t.Expression : null
  return updatedExpression ? generateExpression(updatedExpression) : normalized
}

export function normalizeWxmlExpressionWithContext(exp: string, context?: TransformContext): string {
  if (!context) {
    return normalizeWxmlExpression(exp)
  }
  if (!context.rewriteScopedSlot) {
    return rewriteForAliasExpression(exp, context)
  }
  return rewriteScopedSlotExpression(exp, context)
}
