import * as t from '@weapp-vite/ast/babelTypes'
import { resolveStaticObjectProperty } from '../componentStyleOptions'

function resolveDefaultsTarget(node: t.Expression): t.ObjectExpression | undefined {
  if (t.isObjectExpression(node)) {
    return node
  }
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node)
    || t.isTypeCastExpression(node) || t.isParenthesizedExpression(node)) {
    return resolveDefaultsTarget(node.expression)
  }
  if (t.isCallExpression(node) && t.isMemberExpression(node.callee) && !node.callee.computed
    && t.isIdentifier(node.callee.object, { name: 'Object' })
    && t.isIdentifier(node.callee.property, { name: 'assign' })) {
    const first = node.arguments[0]
    return first && t.isExpression(first) ? resolveDefaultsTarget(first) : undefined
  }
}

/** 按最终属性所有权补默认值，避免 Object.assign 后序对象覆盖 defineOptions。 */
export function applyDefaultsToExpression(
  expression: t.Expression,
  defaults: Record<string, any>,
  merge: (object: t.ObjectExpression, defaults: Record<string, any>) => boolean,
): boolean {
  let changed = false
  const fallback = resolveDefaultsTarget(expression)
  for (const [key, value] of Object.entries(defaults)) {
    // 不解析引用对象，避免为一个组件补默认值时修改其他组件共享的源对象。
    const effective = resolveStaticObjectProperty(expression, key, undefined)
    if (effective.kind === 'expression' && effective.property) {
      // 旧合并器按非 computed 键查找；用规范键处理值，再写回原属性以保留源码键语义。
      const normalized = t.objectProperty(t.stringLiteral(key), effective.property.value)
      changed = merge(t.objectExpression([normalized]), { [key]: value }) || changed
      effective.property.value = normalized.value
    }
    else if (effective.kind === 'absent' && fallback) {
      changed = merge(fallback, { [key]: value }) || changed
    }
    else if (effective.kind === 'unknown' && fallback) {
      // 动态 spread/assign 只能覆盖前置默认值，不能被后置静态默认值反向覆盖。
      changed = merge(fallback, { [key]: value }) || changed
    }
  }
  return changed
}
