import type { AstParserLike, NativeNpmPlatformApiFact } from '../../../ast'
import { WEAPP_VITE_INJECTED_API_IDENTIFIER } from '@weapp-core/constants'
import MagicString from 'magic-string'
import { isPlatformApiIdentifier, platformApiIdentifiers } from '../../../ast'
import { parseJsLike, traverse } from '../../../utils/babel'
import { createWeapiAccessExpression } from '../../../utils/weapi'

function getPlatformApiRewriteTarget(path: any) {
  const object = path.node?.object
  if (
    object?.type !== 'Identifier'
    || !platformApiIdentifiers.has(object.name)
    || path.scope?.hasBinding?.(object.name)
    || typeof object.start !== 'number'
    || typeof object.end !== 'number'
    || object.start < 0
    || object.end < object.start
  ) {
    return
  }
  return object as { start: number, end: number }
}

/**
 * 在已有遍历中收集平台 API 改写事实，与实际改写共用作用域和节点判定。
 */
export function createPlatformApiAccessCollector() {
  let hasPlatformApiAccess = false
  const collect = (path: any) => {
    hasPlatformApiAccess ||= Boolean(getPlatformApiRewriteTarget(path))
  }
  return {
    hasPlatformApiAccess: () => hasPlatformApiAccess,
    visitor: {
      MemberExpression: collect,
      OptionalMemberExpression: collect,
    },
  }
}

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
      const object = getPlatformApiRewriteTarget(path)
      if (!object) {
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

/**
 * 使用 native 已校验的对象范围完成平台 API 改写；不重新解析最终 chunk。
 */
export function createMiniProgramPlatformApiRewriteFromRanges(
  code: string,
  globalName: string,
  ranges: NativeNpmPlatformApiFact[],
) {
  if (ranges.length === 0) {
    return
  }
  let previousEnd = -1
  for (const range of ranges) {
    if (
      !Number.isSafeInteger(range.start)
      || !Number.isSafeInteger(range.end)
      || range.start < 0
      || range.end <= range.start
      || range.end > code.length
      || range.start < previousEnd
      || !isPlatformApiIdentifier(code.slice(range.start, range.end))
    ) {
      throw new RangeError('Invalid native platform API object range')
    }
    previousEnd = range.end
  }
  const magicString = new MagicString(code)
  for (const range of ranges) {
    magicString.update(range.start, range.end, WEAPP_VITE_INJECTED_API_IDENTIFIER)
  }
  const aliasCode = `var ${WEAPP_VITE_INJECTED_API_IDENTIFIER} = ${createWeapiAccessExpression(globalName)};`
  magicString.prepend(`${aliasCode}\n`)
  return magicString
}
