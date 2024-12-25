import type { scanWxml } from './scan'
import MagicString from 'magic-string'
import { normalizeWxsFilename, transformWxsCode } from '../wxs'

export function handleWxml(data: ReturnType<typeof scanWxml>) {
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
    const res = transformWxsCode(value)
    if (res?.code) {
      ms.update(start, end, `\n${res.code}`)
    }
  }
  for (const { end, start, value } of eventTokens) {
    ms.update(start, end, value)
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

  for (const { end, start } of commentTokens) {
    ms.remove(start, end)
  }

  return {
    code: ms.toString(),
    components,
    deps,
  }
}
