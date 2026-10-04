import type { NodePath } from '@babel/traverse'
import type * as t from '@babel/types'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'

const traverse = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

export function ensureAnchor(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Inline origin instrumentation anchor changed: ${message}`)
  }
}

export function member(node: t.Node, names: readonly string[]): boolean {
  return names.length === 1
    ? node.type === 'Identifier' && node.name === names[0]
    : node.type === 'MemberExpression' && !node.computed
      && node.property.type === 'Identifier' && node.property.name === names.at(-1)
      && member(node.object, names.slice(0, -1))
}

/** 只解析真实加载文本来定位节点；不重打印模块，也不依赖 strip/tsx 的空白格式。 */
export function calls(source: string, globalKey: string) {
  ensureAnchor(!source.includes(globalKey), 'already instrumented')
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['typescript'] })
  }
  catch {
    throw new Error('Inline origin instrumentation anchor changed: module no longer parses')
  }
  const result: NodePath<t.CallExpression>[] = []
  traverse(ast, {
    CallExpression(path) {
      result.push(path)
    },
  })
  return result
}

/** 同名调用必须唯一且位于原顶层函数；参数不能由内层函数或同名局部变量冒充。 */
export function ownedCall(all: NodePath<t.CallExpression>[], callee: readonly string[], args: readonly (readonly string[])[], functionName: string, params: readonly string[]) {
  const matching = all.filter(path => member(path.node.callee, callee))
  ensureAnchor(matching.length === 1, `expected one ${callee.join('.')} call`)
  const call = matching[0]!
  ensureAnchor(call.node.arguments.length === args.length
    && call.node.arguments.every((argument, index) => member(argument, args[index]!)), `unexpected ${callee.join('.')} arguments`)
  const owner = call.getFunctionParent()
  ensureAnchor(owner?.isFunctionDeclaration() && owner.node.id?.name === functionName
    && (owner.parentPath.isProgram() || (owner.parentPath.isExportNamedDeclaration() && owner.parentPath.parentPath.isProgram()))
    && owner.node.params.length === params.length
    && owner.node.params.every((param, index) => param.type === 'Identifier' && param.name === params[index]), `unexpected ${functionName} scope`)
  ensureAnchor(!call.scope.getBinding('globalThis'), 'globalThis is shadowed')
  for (const name of params) {
    const binding = call.scope.getBinding(name)
    ensureAnchor(binding?.kind === 'param' && binding.scope === owner.scope, `unexpected ${name} parameter owner`)
  }
  return { call, owner }
}

export function importedCall(call: NodePath<t.CallExpression>, name: string) {
  const binding = call.scope.getBinding(name)
  ensureAnchor(binding?.constant && binding.scope.path.isProgram()
    && (binding.path.isImportSpecifier() || binding.path.isFunctionDeclaration()), `unexpected ${name} binding`)
}

export function ownedVariable(call: NodePath<t.CallExpression>, owner: NodePath<t.FunctionDeclaration>, name: string) {
  const binding = call.scope.getBinding(name)
  ensureAnchor(binding?.scope === owner.scope && binding.constant && binding.path.isVariableDeclarator()
    && binding.path.node.id.type === 'Identifier' && binding.path.node.id.name === name, `unexpected ${name} variable owner`)
}

export function span(node: t.Node): { start: number, end: number } {
  ensureAnchor(typeof node.start === 'number' && typeof node.end === 'number' && node.end > node.start, 'missing source span')
  return { start: node.start, end: node.end }
}

/** 仅应用不重叠的源文本补丁；其余字节，包括注释、source map 和 tsx helper，保持原样。 */
export function patch(source: string, edits: { start: number, end: number, text: string }[]) {
  let boundary = source.length
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    ensureAnchor(edit.start >= 0 && edit.end >= edit.start && edit.end <= boundary, 'overlapping source edits')
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end)
    boundary = edit.start
  }
  return source
}
