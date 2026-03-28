import type { Program } from '@oxc-project/types'
import type { AstEngineName, AstParserLike } from '../types'
import { walk } from 'oxc-walker'
import { parseJsLikeWithEngine } from '../engine'

export const platformApiIdentifierList = ['wx', 'my', 'tt', 'swan', 'jd', 'xhs'] as const
export const platformApiIdentifiers = new Set(platformApiIdentifierList)

export function isPlatformApiIdentifier(name: string) {
  return platformApiIdentifiers.has(name)
}

export function mayContainPlatformApiIdentifierByText(code: string) {
  for (const identifier of platformApiIdentifiers) {
    if (code.includes(`${identifier}.`)) {
      return true
    }
  }
  return false
}

export function isPlatformApiMemberExpression(node: any) {
  return node?.type === 'MemberExpression'
    && node.object?.type === 'Identifier'
    && isPlatformApiIdentifier(node.object.name)
}

export function hasPlatformApiMemberExpression(ast: Program) {
  let found = false

  walk(ast, {
    enter(node) {
      if (found) {
        return
      }

      if (isPlatformApiMemberExpression(node)) {
        found = true
      }
    },
  })

  return found
}

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

  if (!mayContainPlatformApiIdentifierByText(code)) {
    return false
  }

  try {
    const ast = parseJsLikeWithEngine(code, {
      engine,
      filename: 'inline.ts',
      parserLike: options?.parserLike,
    }) as Program
    return hasPlatformApiMemberExpression(ast)
  }
  catch {
    return true
  }
}
