import { parse, traverse } from '../../../../../utils/babel'

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
