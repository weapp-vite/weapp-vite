import type { HandleWxmlOptions } from '../types'
import type { scanWxml } from './scan'
import { defu } from '@weapp-core/shared'
import MagicString from 'magic-string'
import { changeFileExtension } from '../utils/file'
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
  const extension = options.scriptModuleExtension ?? ''
  const tag = options.scriptModuleTag ?? ''
  const templateExt = options.templateExtension ?? ''
  return `${options.removeComment ? 1 : 0}|${options.transformEvent ? 1 : 0}|${extension}|${tag}|${templateExt}`
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

function getCachedInlineWxsTransform(code: string, extension: string) {
  const key = `${extension}::${code}`
  const cached = inlineWxsTransformCache.get(key)
  if (cached) {
    inlineWxsTransformCache.delete(key)
    inlineWxsTransformCache.set(key, cached)
    return cached
  }

  const transformed = transformWxsCode(code, { extension })
  inlineWxsTransformCache.set(key, transformed)
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
    scriptModuleExtension: undefined,
    scriptModuleTag: undefined,
    templateExtension: undefined,
  })
  const cacheKey = createCacheKey(opts)
  const cached = getCachedResult(data, cacheKey)
  if (cached) {
    return cached
  }
  const {
    code,
    removalRanges = [],
    commentTokens = [],
    eventTokens = [],
    inlineWxsTokens = [],
    removeWxsLangAttrTokens = [],
    scriptModuleTagTokens = [],
    wxsImportNormalizeTokens = [],
    templateImportNormalizeTokens = [],
    components,
    deps,
  } = data as typeof data & {
    removalRanges?: typeof data.removalRanges
    commentTokens?: typeof data.commentTokens
    eventTokens?: typeof data.eventTokens
    inlineWxsTokens?: typeof data.inlineWxsTokens
    removeWxsLangAttrTokens?: typeof data.removeWxsLangAttrTokens
    scriptModuleTagTokens?: typeof data.scriptModuleTagTokens
    wxsImportNormalizeTokens?: typeof data.wxsImportNormalizeTokens
    templateImportNormalizeTokens?: typeof data.templateImportNormalizeTokens
  }
  const normalizedScriptExtension = opts.scriptModuleExtension?.startsWith('.')
    ? opts.scriptModuleExtension.slice(1)
    : opts.scriptModuleExtension
  const normalizedTemplateExtension = opts.templateExtension?.startsWith('.')
    ? opts.templateExtension.slice(1)
    : opts.templateExtension
  const resolvedScriptTag = opts.scriptModuleTag
    ?? (normalizedScriptExtension === 'sjs' ? 'sjs' : 'wxs')
  const shouldNormalizeImports = wxsImportNormalizeTokens.length > 0
  const shouldNormalizeTemplateImports = templateImportNormalizeTokens.length > 0 && normalizedTemplateExtension
  const shouldRemoveLang = removeWxsLangAttrTokens.length > 0
  const shouldTransformInlineWxs = inlineWxsTokens.length > 0
  const shouldTransformEvents = opts.transformEvent && eventTokens.length > 0
  const shouldTransformScriptModuleTags = resolvedScriptTag !== 'wxs' && scriptModuleTagTokens.length > 0
  const shouldRemoveConditionals = removalRanges.length > 0
  const shouldRemoveComments = opts.removeComment && commentTokens.length > 0

  if (!shouldNormalizeImports && !shouldNormalizeTemplateImports && !shouldRemoveLang && !shouldTransformInlineWxs && !shouldTransformEvents && !shouldTransformScriptModuleTags && !shouldRemoveConditionals && !shouldRemoveComments) {
    return setCachedResult(data, cacheKey, {
      code,
      components,
      deps,
    })
  }

  const ms = new MagicString(code)

  if (shouldNormalizeImports) {
    for (const { start, end, value } of wxsImportNormalizeTokens) {
      ms.update(start, end, normalizeWxsFilename(value, normalizedScriptExtension ?? 'wxs'))
    }
  }

  if (shouldNormalizeTemplateImports) {
    for (const { start, end, value } of templateImportNormalizeTokens) {
      let nextValue = changeFileExtension(value, normalizedTemplateExtension!)
      if (value.startsWith('./') && !nextValue.startsWith('./') && !nextValue.startsWith('../') && !nextValue.startsWith('/')) {
        nextValue = `./${nextValue}`
      }
      ms.update(start, end, nextValue)
    }
  }

  if (shouldRemoveLang) {
    for (const { start, end } of removeWxsLangAttrTokens) {
      ms.update(start, end, '')
    }
  }

  if (shouldTransformInlineWxs) {
    for (const { end, start, value } of inlineWxsTokens) {
      const { result } = getCachedInlineWxsTransform(value, normalizedScriptExtension ?? 'wxs')
      if (result?.code) {
        ms.update(start, end, `\n${result.code}`)
      }
    }
  }

  if (shouldTransformScriptModuleTags) {
    const visited = new Set<string>()
    for (const { start, end } of scriptModuleTagTokens) {
      const key = `${start}:${end}`
      if (visited.has(key)) {
        continue
      }
      visited.add(key)
      ms.update(start, end, resolvedScriptTag)
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
