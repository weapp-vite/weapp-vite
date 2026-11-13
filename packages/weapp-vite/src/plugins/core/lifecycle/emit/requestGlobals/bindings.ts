import { parse, traverse } from '../../../../../utils/babel'

/** 收集模块顶层的直接调用及其结果绑定，不进入函数体。 */
export function createTopLevelCallCollector() {
  const calls: Array<{ name: string, start: number, end: number, binding?: string }> = []
  return {
    calls,
    visitor: {
      CallExpression(path: any) {
        const { node } = path
        if (node.callee?.type === 'Identifier' && !path.getFunctionParent() && typeof node.start === 'number' && typeof node.end === 'number') {
          const binding = path.scope.getBinding(node.callee.name)
          if (binding && !binding.scope.path.isProgram()) {
            return
          }
          const declaration = path.findParent((parent: any) => parent.isVariableDeclarator())
          calls.push(Object.freeze({ name: node.callee.name, start: node.start, end: node.end, binding: declaration?.node.id?.name }))
        }
      },
    },
  }
}

/** 保留产物模块自己的绑定，包括解构、导入和提升到模块作用域的 var。 */
export function collectTopLevelDeclaredIdentifiers(code: string) {
  const identifiers = new Set<string>()
  const ast = parse(code, { sourceType: 'unambiguous', allowReturnOutsideFunction: true })
  traverse(ast as any, {
    Program(program: any) {
      for (const name of Object.keys(program.scope.bindings)) {
        identifiers.add(name)
      }
      program.stop()
    },
  })
  return identifiers
}
