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

/**
 * 判断 `this` 是否继承自模板表达式上下文。
 *
 * 普通函数与方法拥有动态 `this`；箭头函数继续向外查找。类字段初始化器与
 * 静态块也拥有类实例或类本身的 `this`，而计算属性名仍在外层上下文求值。
 */
export function isTemplateContextThis(path: NodePath<t.ThisExpression>) {
  let childPath: NodePath<t.Node> = path
  let parentPath: NodePath<t.Node> | null = path.parentPath
  while (parentPath) {
    if (
      (parentPath.isObjectMethod() || parentPath.isClassMethod())
      && (childPath.key === 'key' || childPath.listKey === 'decorators')
    ) {
      childPath = parentPath
      parentPath = parentPath.parentPath
      continue
    }
    if (parentPath.isFunction() && !parentPath.isArrowFunctionExpression()) {
      return false
    }
    if (
      (
        parentPath.isClassProperty()
        || parentPath.isClassPrivateProperty()
        || parentPath.isClassAccessorProperty()
      )
      && childPath.key === 'value'
    ) {
      return false
    }
    if (parentPath.isStaticBlock()) {
      return false
    }
    childPath = parentPath
    parentPath = parentPath.parentPath
  }
  return true
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
