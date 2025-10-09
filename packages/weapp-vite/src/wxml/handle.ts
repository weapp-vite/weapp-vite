import type { HandleWxmlOptions } from '../types'
import type { scanWxml } from './scan'
import { defu } from '@weapp-core/shared'
import MagicString from 'magic-string'
import { normalizeWxsFilename, transformWxsCode } from '../wxs'

type ScanResult = ReturnType<typeof scanWxml>
interface HandleWxmlReturn {
  code: string
  components: ScanResult['components']
  deps: ScanResult['deps']
}

const handleCache = new WeakMap<ScanResult, Map<string, HandleWxmlReturn>>()
const inlineWxsTransformCache = new Map<string, ReturnType<typeof transformWxsCode>>()
const INLINE_WXS_CACHE_LIMIT = 256

function createCacheKey(options: Required<HandleWxmlOptions>) {
  return `${options.removeComment ? 1 : 0}|${options.transformEvent ? 1 : 0}`
}

function getCachedResult(data: ScanResult, cacheKey: string) {
  return handleCache.get(data)?.get(cacheKey)
}

function setCachedResult(data: ScanResult, cacheKey: string, result: HandleWxmlReturn) {
  let cacheForToken = handleCache.get(data)
  if (!cacheForToken) {
    cacheForToken = new Map()
    handleCache.set(data, cacheForToken)
  }
  cacheForToken.set(cacheKey, result)
  return result
}

function getCachedInlineWxsTransform(code: string) {
  const cached = inlineWxsTransformCache.get(code)
  if (cached) {
    inlineWxsTransformCache.delete(code)
    inlineWxsTransformCache.set(code, cached)
    return cached
  }

  const transformed = transformWxsCode(code)
  inlineWxsTransformCache.set(code, transformed)
  if (inlineWxsTransformCache.size > INLINE_WXS_CACHE_LIMIT) {
    const firstKey = inlineWxsTransformCache.keys().next().value
    if (firstKey) {
      inlineWxsTransformCache.delete(firstKey)
    }
  }
  return transformed
}

export function handleWxml(data: ReturnType<typeof scanWxml>, options?: HandleWxmlOptions) {
  const opts = defu<Required<HandleWxmlOptions>, HandleWxmlOptions[]>(options, {
    removeComment: true,
    transformEvent: true,
  })
  const cacheKey = createCacheKey(opts)
  const cached = getCachedResult(data, cacheKey)
  if (cached) {
    return cached
  }
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
    return setCachedResult(data, cacheKey, {
      code,
      components,
      deps,
    })
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
      const { result } = getCachedInlineWxsTransform(value)
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
    for (const { start, end } of removalRanges) {
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

  return setCachedResult(data, cacheKey, {
    code: ms.toString(),
    components,
    deps,
  })
}
