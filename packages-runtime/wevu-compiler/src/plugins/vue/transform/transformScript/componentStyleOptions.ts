import type { NodePath, Scope } from '@weapp-vite/ast/babelTraverse'
import type { ComponentStyleOptions, StaticComponentStyleOption } from '../../../../types/componentStyleOptions'
import * as t from '@weapp-vite/ast/babelTypes'

interface ExpressionState {
  kind: 'expression'
  node: t.Expression
  scope?: Scope
  property?: t.ObjectProperty
}
type PropertyState = { kind: 'absent' | 'unknown' } | ExpressionState
const absent = { kind: 'absent' } as const
const unknown = { kind: 'unknown' } as const

function unwrap(node: t.Expression): t.Expression {
  return t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node)
    || t.isTypeCastExpression(node) || t.isParenthesizedExpression(node)
    ? unwrap(node.expression as t.Expression)
    : node
}

function isFactoryCall(path: NodePath) {
  if (!path.isCallExpression() || !t.isIdentifier(path.node.callee)) {
    return false
  }
  const binding = path.scope.getBinding(path.node.callee.name)
  return binding?.path.isImportSpecifier()
    && t.isIdentifier(binding.path.node.imported, { name: 'defineComponent' })
    && binding.path.parentPath.isImportDeclaration()
    && ['vue', 'wevu', 'wevu/internal-runtime', 'virtual:weapp-vite/runtime'].includes(binding.path.parentPath.node.source.value)
}

function isSafeReference(reference: NodePath, visiting: Set<t.Node>): boolean {
  let current: NodePath = reference
  while (current.parentPath) {
    const parent = current.parentPath
    if (parent.isExportDefaultDeclaration()) {
      return true
    }
    if (parent.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
      // 对象引用与绑定递归检查逃逸，不能仅凭 const 推断静态值。
      // eslint-disable-next-line ts/no-use-before-define
      return isSafeBinding(parent.scope.getBinding(parent.node.id.name), visiting)
    }
    if (parent.isCallExpression() && isFactoryCall(parent)) {
      current = parent
      continue
    }
    if ((parent.isObjectProperty() && !parent.node.computed)
      || parent.isObjectExpression() || parent.isSpreadElement() || parent.isTSAsExpression()
      || parent.isTSSatisfiesExpression() || parent.isTSNonNullExpression() || parent.isParenthesizedExpression()) {
      current = parent
      continue
    }
    return false
  }
  return false
}

function isSafeBinding(binding: ReturnType<Scope['getBinding']>, visiting = new Set<t.Node>()): boolean {
  if (!binding?.constant || !binding.path.isVariableDeclarator() || !binding.path.parentPath.isVariableDeclaration()
    || binding.path.parentPath.node.kind !== 'const' || binding.path.parentPath.parentPath?.isExportNamedDeclaration()) {
    return false
  }
  if (visiting.has(binding.path.node)) {
    return false
  }
  const next = new Set(visiting).add(binding.path.node)
  return binding.referencePaths.every(reference => isSafeReference(reference, next))
}

function resolve(node: t.Expression, scope: Scope | undefined, visited: Set<t.Node>): ExpressionState | undefined {
  node = unwrap(node)
  if (!t.isIdentifier(node) || (node.name === 'undefined' && !scope?.getBinding('undefined'))) {
    return { kind: 'expression', node, scope }
  }
  const binding = scope?.getBinding(node.name)
  if (!isSafeBinding(binding) || !binding?.path.isVariableDeclarator() || visited.has(binding.path.node)
    || !binding.path.node.init || !t.isExpression(binding.path.node.init)) {
    return undefined
  }
  return resolve(binding.path.node.init, binding.path.scope, new Set(visited).add(binding.path.node))
}

function primitive(node: t.Expression, scope: Scope | undefined): StaticComponentStyleOption {
  const resolved = resolve(node, scope, new Set())
  if (!resolved) {
    return unknown
  }
  const value = resolved.node
  if (t.isStringLiteral(value) || t.isBooleanLiteral(value) || t.isNumericLiteral(value)) {
    return { kind: 'known', value: value.value }
  }
  if (t.isNullLiteral(value)) {
    return { kind: 'known', value: null }
  }
  if (t.isTemplateLiteral(value) && value.expressions.length === 0) {
    return { kind: 'known', value: value.quasis[0]?.value.cooked ?? value.quasis[0]?.value.raw ?? '' }
  }
  if (t.isIdentifier(value, { name: 'undefined' }) && !resolved.scope?.getBinding('undefined')) {
    return { kind: 'known', value: undefined }
  }
  if (t.isUnaryExpression(value) && t.isNumericLiteral(value.argument)) {
    if (value.operator === 'void') {
      return { kind: 'known', value: undefined }
    }
    if (value.operator === '-' || value.operator === '+') {
      return { kind: 'known', value: value.operator === '-' ? -value.argument.value : value.argument.value }
    }
  }
  return unknown
}

export function resolveStaticObjectProperty(node: t.Expression, key: string, scope: Scope | undefined, visited = new Set<t.Node>()): PropertyState {
  const resolved = resolve(node, scope, visited)
  if (!resolved || visited.has(resolved.node)) {
    return unknown
  }
  const current = resolved.node
  const next = new Set(visited).add(current)
  if (t.isCallExpression(current) && t.isMemberExpression(current.callee) && !current.callee.computed
    && t.isIdentifier(current.callee.object, { name: 'Object' }) && !resolved.scope?.getBinding('Object')
    && t.isIdentifier(current.callee.property, { name: 'assign' })) {
    let result: PropertyState = absent
    for (const argument of current.arguments) {
      const part = t.isExpression(argument) ? resolveStaticObjectProperty(argument, key, resolved.scope, next) : unknown
      if (part.kind !== 'absent') {
        result = part
      }
    }
    return result
  }
  if (!t.isObjectExpression(current)) {
    return t.isNullLiteral(current) || t.isStringLiteral(current) || t.isBooleanLiteral(current)
      || t.isNumericLiteral(current) || (t.isIdentifier(current, { name: 'undefined' }) && !resolved.scope?.getBinding('undefined'))
      ? absent
      : unknown
  }
  let result: PropertyState = absent
  for (const entry of current.properties) {
    if (t.isSpreadElement(entry)) {
      const part = resolveStaticObjectProperty(entry.argument, key, resolved.scope, next)
      if (part.kind !== 'absent') {
        result = part
      }
      continue
    }
    const name = !entry.computed && t.isIdentifier(entry.key)
      ? { kind: 'known', value: entry.key.name } as const
      : t.isExpression(entry.key) ? primitive(entry.key, resolved.scope) : unknown
    if (name.kind !== 'known') {
      result = unknown
    }
    else if (String(name.value) === key) {
      result = t.isObjectProperty(entry) && t.isExpression(entry.value)
        ? { kind: 'expression', node: entry.value, scope: resolved.scope, property: entry }
        : unknown
    }
  }
  return result
}

function isSafeAssignOperand(node: t.Expression, scope: Scope | undefined, visited: Set<t.Node>): boolean {
  const resolved = resolve(node, scope, visited)
  if (!resolved || visited.has(resolved.node) || !t.isObjectExpression(resolved.node)) {
    return false
  }
  const next = new Set(visited).add(resolved.node)
  return resolved.node.properties.every((entry) => {
    if (t.isSpreadElement(entry)) {
      return isSafeAssignOperand(entry.argument, resolved.scope, next)
    }
    if (t.isObjectMethod(entry) && entry.kind !== 'method') {
      return false
    }
    const name = !entry.computed && t.isIdentifier(entry.key)
      ? { kind: 'known', value: entry.key.name } as const
      : t.isExpression(entry.key) ? primitive(entry.key, resolved.scope) : unknown
    // 原型上的 setter 和计算键的求值副作用同样可能修改其他 options。
    return name.kind === 'known' && name.value !== '__proto__'
  })
}

function hasUnsafeObjectEvaluation(node: t.Expression, scope: Scope | undefined, visited = new Set<t.Node>()): boolean {
  const resolved = resolve(node, scope, visited)
  if (!resolved || visited.has(resolved.node)) {
    return false
  }
  const current = resolved.node
  const next = new Set(visited).add(current)
  if (t.isCallExpression(current) && t.isMemberExpression(current.callee) && !current.callee.computed
    && t.isIdentifier(current.callee.object, { name: 'Object' })
    && t.isIdentifier(current.callee.property, { name: 'assign' })) {
    // assign 会触发目标 setter 和来源 getter，不能用静态字段覆盖顺序代替实际执行。
    return Boolean(resolved.scope?.getBinding('Object')) || current.arguments.some(argument => !t.isExpression(argument)
      || !isSafeAssignOperand(argument, resolved.scope, new Set())
      || hasUnsafeObjectEvaluation(argument, resolved.scope, next))
  }
  if (t.isObjectExpression(current)) {
    return current.properties.some((entry) => {
      if (t.isSpreadElement(entry)) {
        const operand = resolve(entry.argument, resolved.scope, next)
        // 对象展开也会执行来源 getter，可能修改已复制的嵌套 options 引用。
        return Boolean(operand && t.isObjectExpression(operand.node)
          && !isSafeAssignOperand(entry.argument, resolved.scope, next))
        || hasUnsafeObjectEvaluation(entry.argument, resolved.scope, next)
      }
      return t.isObjectProperty(entry) && t.isExpression(entry.value)
        && hasUnsafeObjectEvaluation(entry.value, resolved.scope, next)
    })
  }
  return false
}

/** 基于默认值合并后的源码 AST 分析样式选项；动态值与逃逸对象不猜测。 */
export function analyzeComponentStyleOptions(node: t.Expression | null, scope?: Scope): ComponentStyleOptions | undefined {
  if (!node) {
    return { styleIsolation: unknown, addGlobalClass: unknown }
  }
  if (hasUnsafeObjectEvaluation(node, scope)) {
    return undefined
  }
  const options = resolveStaticObjectProperty(node, 'options', scope)
  if (['definitionFilter', 'behaviors', 'extends', 'mixins', '__proto__'].some(key => resolveStaticObjectProperty(node, key, scope).kind !== 'absent')) {
    // 定义过滤器可能在宿主合并 JSON 后修改样式选项，不能暴露可覆盖的静态元数据。
    return undefined
  }
  const read = (key: string): StaticComponentStyleOption => {
    const value = options.kind === 'expression' ? resolveStaticObjectProperty(options.node, key, options.scope) : options
    if (value.kind === 'absent') {
      return absent
    }
    return value.kind === 'expression' ? primitive(value.node, value.scope) : unknown
  }
  return { styleIsolation: read('styleIsolation'), addGlobalClass: read('addGlobalClass') }
}
