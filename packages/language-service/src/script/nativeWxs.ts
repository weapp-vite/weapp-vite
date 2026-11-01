import type * as t from '@weapp-vite/ast/babelTypes'

const MODERN_NODE_NAMES = new Map<string, string>([
  ['ArrowFunctionExpression', '箭头函数'],
  ['ClassDeclaration', 'class'],
  ['ClassExpression', 'class'],
  ['TemplateLiteral', '模板字面量'],
  ['ObjectPattern', '对象解构'],
  ['ArrayPattern', '数组解构'],
  ['RestElement', '剩余参数或属性'],
  ['SpreadElement', '展开语法'],
  ['OptionalMemberExpression', '可选链'],
  ['OptionalCallExpression', '可选调用'],
  ['AwaitExpression', 'await'],
  ['YieldExpression', 'yield'],
  ['ForOfStatement', 'for...of'],
  ['BigIntLiteral', 'BigInt 字面量'],
  ['ImportExpression', '动态 import'],
  ['MetaProperty', '元属性'],
])

/** 原生 WXS 的公开语法参考采用 var 与 ES5 表达式；现代源码交给独立构建入口。 */
export function nativeWxsSyntaxIssue(node: t.Node): string | undefined {
  const named = MODERN_NODE_NAMES.get(node.type)
  if (named) {
    return named
  }
  if (node.type === 'VariableDeclaration' && node.kind !== 'var') {
    return node.kind
  }
  if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && (node.async || node.generator)) {
    return node.async ? 'async 函数' : 'generator 函数'
  }
  if (node.type === 'ObjectMethod' && (node.computed || node.kind === 'method')) {
    return node.computed ? '计算属性' : '对象方法简写'
  }
  if (node.type === 'ObjectProperty' && (node.computed || node.shorthand)) {
    return node.computed ? '计算属性' : '对象属性简写'
  }
  if (node.type === 'LogicalExpression' && node.operator === '??') {
    return '空值合并'
  }
  if (node.type === 'AssignmentExpression' && ['&&=', '||=', '??='].includes(node.operator)) {
    return '逻辑赋值'
  }
  if (node.type === 'BinaryExpression' && node.operator === '**') {
    return '幂运算符'
  }
  if (node.type === 'NumericLiteral' && /^0[ob]|_/i.test(String(node.extra?.raw ?? ''))) {
    return '现代数字字面量'
  }
  return undefined
}
