import type { AstParserLike } from '../../../ast'
import { WEAPP_VITE_INJECTED_API_IDENTIFIER } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { platformApiIdentifiers } from '../../../ast'
import { parseJsLike, traverse } from '../../../utils/babel'
import { createWeapiAccessExpression } from '../../../utils/weapi'

export function createMiniProgramPlatformApiRewrite(
  code: string,
  globalName: string,
  _options?: {
    engine?: 'babel' | 'oxc'
    parserLike?: AstParserLike
  },
) {
  const injectedApiIdentifier = WEAPP_VITE_INJECTED_API_IDENTIFIER

  try {
    const ast = parseJsLike(code)
    const magicString = new MagicString(code)
    let mutated = false

    const rewritePath = (path: any) => {
      const object = path.node?.object
      if (!object || object.type !== 'Identifier') {
        return
      }
      const identifierName = object.name
      if (!platformApiIdentifiers.has(identifierName)) {
        return
      }
      if (path.scope?.hasBinding?.(identifierName)) {
        return
      }
      if (
        typeof object.start !== 'number'
        || typeof object.end !== 'number'
        || object.start < 0
        || object.end < object.start
      ) {
        return
      }
      magicString.update(object.start, object.end, injectedApiIdentifier)
      mutated = true
    }

    traverse(ast as any, {
      MemberExpression: rewritePath,
      OptionalMemberExpression: rewritePath,
    })

    if (mutated) {
      const aliasCode = `var ${injectedApiIdentifier} = ${createWeapiAccessExpression(globalName)};`
      magicString.prepend(`${aliasCode}\n`)
      return magicString
    }
  }
  catch {
  }
}

export function rewriteMiniProgramPlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    engine?: 'babel' | 'oxc'
    parserLike?: AstParserLike
  },
) {
  return createMiniProgramPlatformApiRewrite(code, globalName, options)?.toString() ?? code
}
