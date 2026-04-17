import type { AstParserLike } from '../../../../ast'
import { rewriteMiniProgramPlatformApiAccess } from '../platformApiRewrite'

export function replacePlatformApiAccess(
  code: string,
  globalName: string,
  options?: {
    engine?: 'babel' | 'oxc'
    parserLike?: AstParserLike
  },
) {
  return rewriteMiniProgramPlatformApiAccess(code, globalName, options)
}
