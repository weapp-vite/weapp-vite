import type { HandleWxmlOptions } from '../types'
import type { scanWxml } from './scan'
import { defu } from '@weapp-core/shared'
import MagicString from 'magic-string'
import { normalizeWxsFilename, transformWxsCode } from '../wxs'

export function handleWxml(data: ReturnType<typeof scanWxml>, options?: HandleWxmlOptions) {
  const opts = defu<Required<HandleWxmlOptions>, HandleWxmlOptions[]>(options, {
    removeComment: true,
    transformEvent: true,
  })
  const {
    code,
    removeStartStack,
    removeEndStack,
    commentTokens,
    eventTokens,
    inlineWxsTokens,
    removeWxsLangAttrTokens,
    wxsImportNormalizeTokens,
    components,
    deps,
  } = data
  const ms = new MagicString(code)

  for (const { start, end, value } of wxsImportNormalizeTokens) {
    ms.update(start, end, normalizeWxsFilename(value))
  }

  for (const { start, end } of removeWxsLangAttrTokens) {
    ms.update(start, end, '')
  }
  for (const { end, start, value } of inlineWxsTokens) {
    const { result } = transformWxsCode(value)
    if (result?.code) {
      ms.update(start, end, `\n${result.code}`)
    }
  }
  if (opts.transformEvent) {
    for (const { end, start, value } of eventTokens) {
      ms.update(start, end, value)
    }
  }

  for (let i = 0; i < removeStartStack.length; i++) {
    const startIndex = removeStartStack[i]
    for (let j = i; j < removeEndStack.length; j++) {
      const endIndex = removeEndStack[j]
      if (endIndex > startIndex) {
        ms.remove(startIndex, endIndex)
        break
      }
    }
  }
  // remove comments
  if (opts.removeComment) {
    for (const { end, start } of commentTokens) {
      ms.remove(start, end)
    }
  }

  return {
    code: ms.toString(),
    components,
    deps,
  }
}
