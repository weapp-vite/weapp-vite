import type { Program } from '@oxc-project/types'
import type { AstEngineName, AstParserLike } from '../types'
import { walk } from 'oxc-walker'
import { parseJsLikeWithEngine } from '../engine'

export const platformApiIdentifiers = new Set(['wx', 'my', 'tt', 'swan', 'jd', 'xhs'])

/**
 * 使用统一 AST 入口做平台 API 访问预判。
 */
export function mayContainPlatformApiAccess(
  code: string,
  options?: {
    engine?: AstEngineName
    parserLike?: AstParserLike
  },
): boolean {
  const engine = options?.engine ?? 'babel'

  if (engine !== 'oxc') {
    return true
  }

  try {
    const ast = parseJsLikeWithEngine(code, {
      engine,
      filename: 'inline.ts',
      parserLike: options?.parserLike,
    }) as Program
    let found = false

    walk(ast, {
      enter(node) {
        if (found) {
          return
        }

        if (
          node.type === 'MemberExpression'
          && node.object.type === 'Identifier'
          && platformApiIdentifiers.has(node.object.name)
        ) {
          found = true
        }
      },
    })

    return found
  }
  catch {
    return true
  }
}
