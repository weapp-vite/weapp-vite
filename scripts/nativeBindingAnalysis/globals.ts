import { INLINE_GLOBALS } from '../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/expression/inlineShared'
import { parseBabelExpressionFile } from '../../packages-runtime/wevu-compiler/src/plugins/vue/compiler/template/expression/parse'
import { traverse } from '../../packages-runtime/wevu-compiler/src/utils/babel'

/** 从现有编译器读取全局标识符语义，避免 Rust 维护第二套名称清单。 */
export function collectIgnoredGlobals() {
  const ignored = new Set([...INLINE_GLOBALS, ...Object.getOwnPropertyNames(Object.prototype)])
  const parsed = parseBabelExpressionFile('value')!
  traverse(parsed.ast, {
    Program(path) {
      const scopeType = path.scope.constructor as unknown as { globals: string[], contextVariables: string[] }
      for (const name of [...scopeType.globals, ...scopeType.contextVariables]) {
        ignored.add(name)
      }
    },
  })
  return [...ignored].sort()
}
