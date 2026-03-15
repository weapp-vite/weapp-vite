import { parseSync } from 'oxc-parser'

/**
 * Oxc AST 引擎。
 */
export const oxcAstEngine = {
  name: 'oxc' as const,
  parseJsLike(code: string, filename = 'inline.ts') {
    return parseSync(filename, code).program
  },
}
