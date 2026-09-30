import type { Rule } from 'eslint'

type BuiltinReceiver = 'Array' | 'String'

/** 只在接收者有静态证据时选择实例规则；同名业务方法和未知值不归因于内建 API。 */
export function resolveBuiltinReceiver(
  context: Rule.RuleContext,
  node: any,
  seen = new Set<any>(),
): BuiltinReceiver | undefined {
  if (!node || seen.has(node)) {
    return
  }
  seen.add(node)
  if (node.type === 'ArrayExpression') {
    return 'Array'
  }
  if ((node.type === 'Literal' && typeof node.value === 'string') || node.type === 'TemplateLiteral') {
    return 'String'
  }
  if (['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ChainExpression'].includes(node.type)) {
    return resolveBuiltinReceiver(context, node.expression, seen)
  }
  if (node.type !== 'Identifier') {
    return
  }
  let scope: any = context.sourceCode.getScope(node)
  while (scope) {
    const variable = scope.set?.get(node.name)
    if (variable?.defs?.length) {
      if (variable.defs.length !== 1 || variable.references.some((ref: any) => ref.isWrite() && !ref.init)) {
        return
      }
      const definition = variable.defs[0]
      if (definition.type === 'Variable' && definition.parent?.kind === 'const') {
        return resolveBuiltinReceiver(context, definition.node.init, seen)
      }
      if (definition.type === 'Parameter') {
        const annotation = definition.name.typeAnnotation?.typeAnnotation
        if (annotation?.type === 'TSStringKeyword') {
          return 'String'
        }
        if (annotation?.type === 'TSArrayType' || annotation?.type === 'TSTupleType') {
          return 'Array'
        }
      }
      return
    }
    scope = scope.upper
  }
}
