import type { AstParserLike } from '../../../../ast'
import { mayContainPlatformApiAccess, platformApiIdentifiers } from '../../../../ast'
import { generate, parseJsLike, traverse } from '../../../../utils/babel'
import { createWeapiAccessExpression } from '../../../../utils/weapi'

const injectedApiIdentifier = '__weappViteInjectedApi__'

export function replacePlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    engine?: 'babel' | 'oxc'
    parserLike?: AstParserLike
  },
) {
  if (!mayContainPlatformApiAccess(code, options)) {
    return code
  }

  try {
    const ast = parseJsLike(code)
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
      path.node.object = {
        type: 'Identifier',
        name: injectedApiIdentifier,
      }
      mutated = true
    }

    traverse(ast as any, {
      MemberExpression: rewritePath,
      OptionalMemberExpression: rewritePath,
    })

    if (!mutated) {
      return code
    }

    const transformedCode = generate(ast as any).code
    const aliasCode = `var ${injectedApiIdentifier} = ${createWeapiAccessExpression(globalName)};`
    return `${aliasCode}\n${transformedCode}`
  }
  catch {
    return code
  }
}
