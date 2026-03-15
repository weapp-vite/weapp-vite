import { parseJsLike } from '../babel'

/**
 * Babel AST 引擎。
 */
export const babelAstEngine = {
  name: 'babel' as const,
  parseJsLike(code: string) {
    return parseJsLike(code)
  },
}
