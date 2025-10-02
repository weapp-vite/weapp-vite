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
    removalRanges,
    commentTokens,
    eventTokens,
    inlineWxsTokens,
    removeWxsLangAttrTokens,
    wxsImportNormalizeTokens,
    components,
    deps,
  } = data
  const shouldNormalizeImports = wxsImportNormalizeTokens.length > 0
  const shouldRemoveLang = removeWxsLangAttrTokens.length > 0
  const shouldTransformInlineWxs = inlineWxsTokens.length > 0
  const shouldTransformEvents = opts.transformEvent && eventTokens.length > 0
  const shouldRemoveConditionals = removalRanges.length > 0
  const shouldRemoveComments = opts.removeComment && commentTokens.length > 0

  if (!shouldNormalizeImports && !shouldRemoveLang && !shouldTransformInlineWxs && !shouldTransformEvents && !shouldRemoveConditionals && !shouldRemoveComments) {
    return {
      code,
      components,
      deps,
    }
  }

  const ms = new MagicString(code)

  if (shouldNormalizeImports) {
    for (const { start, end, value } of wxsImportNormalizeTokens) {
      ms.update(start, end, normalizeWxsFilename(value))
    }
  }

  if (shouldRemoveLang) {
    for (const { start, end } of removeWxsLangAttrTokens) {
      ms.update(start, end, '')
    }
  }

  if (shouldTransformInlineWxs) {
    for (const { end, start, value } of inlineWxsTokens) {
      const { result } = transformWxsCode(value)
      if (result?.code) {
        ms.update(start, end, `\n${result.code}`)
      }
    }
  }

  if (shouldTransformEvents) {
    for (const { end, start, value } of eventTokens) {
      ms.update(start, end, value)
    }
  }

  if (shouldRemoveConditionals) {
    for (const { start, end } of [...removalRanges].sort((a, b) => b.start - a.start)) {
      if (end > start) {
        ms.remove(start, end)
      }
    }
  }

  if (shouldRemoveComments) {
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
