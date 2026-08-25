import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import {
  WEVU_CLASS_STYLE_RUNTIME_MODULE,
} from '@weapp-core/constants'
import { getMiniProgramRuntimeGlobalKeys } from '@weapp-core/shared'
import * as t from '@weapp-vite/ast/babelTypes'

const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i

export const INLINE_GLOBALS = new Set([
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

export function createMemberAccess(target: string, prop: string) {
  if (IDENTIFIER_RE.test(prop)) {
    return t.memberExpression(t.identifier(target), t.identifier(prop))
  }
  return t.memberExpression(t.identifier(target), t.stringLiteral(prop), true)
}

export function replaceIdentifierWithExpression(path: NodePath<t.Identifier>, replacement: t.Expression) {
  const parent = path.parentPath
  if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
    parent.node.shorthand = false
    parent.node.value = replacement
    return
  }
  path.replaceWith(replacement)
}
