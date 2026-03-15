import type { AstEngineName, AstParserLike } from './types'
import { babelAstEngine } from './engines/babel'
import { oxcAstEngine } from './engines/oxc'

/**
 * 统一解析 JS-like 源码，供 analysis 型 operation 复用。
 */
export function parseJsLikeWithEngine(
  code: string,
  options?: {
    engine?: AstEngineName
    filename?: string
    parserLike?: AstParserLike
  },
) {
  const engine = options?.engine ?? 'babel'

  if (engine === 'oxc') {
    if (typeof options?.parserLike?.parse === 'function') {
      return options.parserLike.parse(code)
    }
    return oxcAstEngine.parseJsLike(code, options?.filename)
  }

  return babelAstEngine.parseJsLike(code)
}
