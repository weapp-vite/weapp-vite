import type { HandleWxmlOptions } from '../types'
import type { scanWxml } from './scan'
import { defu } from '@weapp-core/shared'
import MagicString from 'magic-string'
import { changeFileExtension } from '../utils/file'
import {
  normalizeImportSjsAttributes,
  resolveScriptModuleTagName,
  shouldNormalizeScriptModuleAttributes,
} from '../utils/wxmlScriptModule'
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
const IDENTIFIER_CHAR_RE = /[\w$]/

function escapeRegExp(source: string) {
  return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isInsideMustache(code: string, start: number, end: number) {
  const open = code.lastIndexOf('{{', start)
  if (open < 0) {
    return false
  }

  const close = code.indexOf('}}', open + 2)
  return close >= end
}

function getMustacheOuterQuote(code: string, start: number) {
  const open = code.lastIndexOf('{{', start)
  if (open <= 0) {
    return null
  }

  for (let index = open - 1; index >= 0; index--) {
    const char = code[index]
    if (char === '"' || char === '\'') {
      return char
    }
    if (char === '<' || char === '>' || char === '\n' || char === '\r') {
      break
    }
  }

  return null
}

function toQuotedLiteral(value: string, quote: '\'' | '"') {
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed !== 'string') {
      return value
    }

    const escaped = parsed
      .replace(/\\/g, '\\\\')
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')

    return quote === '\''
      ? `'${escaped.replace(/'/g, '\\\'')}'`
      : `"${escaped.replace(/"/g, '\\"')}"`
  }
  catch {
    return value
  }
}

function replaceDefineImportMetaEnv(code: string, defineImportMetaEnv?: Record<string, any>) {
  if (!defineImportMetaEnv || Object.keys(defineImportMetaEnv).length === 0) {
    return code
  }

  const entries = Object.entries(defineImportMetaEnv)
    .sort(([leftKey], [rightKey]) => rightKey.length - leftKey.length)
  const replacementRanges: Array<{ start: number, end: number, value: string }> = []

  for (const [key, value] of entries) {
    if (!key.startsWith('import.meta')) {
      continue
    }
    const pattern = new RegExp(escapeRegExp(key), 'g')
    for (const match of code.matchAll(pattern)) {
      const start = match.index ?? -1
      if (start < 0) {
        continue
      }
      const end = start + key.length
      const previous = start > 0 ? code[start - 1] : ''
      const next = end < code.length ? code[end] : ''
      if ((previous && IDENTIFIER_CHAR_RE.test(previous)) || (next && IDENTIFIER_CHAR_RE.test(next))) {
        continue
      }
      if (replacementRanges.some(range => !(end <= range.start || start >= range.end))) {
        continue
      }
      replacementRanges.push({
        start,
        end,
        value: isInsideMustache(code, start, end)
          ? toQuotedLiteral(String(value), getMustacheOuterQuote(code, start) === '\'' ? '"' : '\'')
          : String(value),
      })
    }
  }

  if (replacementRanges.length === 0) {
    return code
  }

  const ms = new MagicString(code)
  for (const range of replacementRanges.sort((left, right) => left.start - right.start)) {
    ms.update(range.start, range.end, range.value)
  }
  return ms.toString()
}

function createCacheKey(options: Required<HandleWxmlOptions>) {
  const extension = options.scriptModuleExtension ?? ''
  const tag = options.scriptModuleTag ?? ''
  const templateExt = options.templateExtension ?? ''
  const defineKeys = options.defineImportMetaEnv
    ? Object.keys(options.defineImportMetaEnv).sort().map(key => `${key}:${String(options.defineImportMetaEnv?.[key])}`).join(',')
    : ''
  return `${options.removeComment ? 1 : 0}|${options.transformEvent ? 1 : 0}|${extension}|${tag}|${templateExt}|${defineKeys}`
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
    defineImportMetaEnv: undefined,
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
    directiveTokens = [],
    tagNameTokens = [],
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
    directiveTokens?: typeof data.directiveTokens
    tagNameTokens?: typeof data.tagNameTokens
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
  const resolvedScriptTag = resolveScriptModuleTagName({
    scriptModuleExtension: normalizedScriptExtension,
    scriptModuleTag: opts.scriptModuleTag,
  })
  const shouldNormalizeImports = wxsImportNormalizeTokens.length > 0
  const shouldNormalizeTemplateImports = templateImportNormalizeTokens.length > 0 && normalizedTemplateExtension
  const shouldRemoveLang = removeWxsLangAttrTokens.length > 0
  const shouldTransformInlineWxs = inlineWxsTokens.length > 0
  const shouldTransformEvents = opts.transformEvent && eventTokens.length > 0
  const shouldTransformDirectives = directiveTokens.length > 0
  const shouldTransformTagNames = tagNameTokens.length > 0
  const shouldTransformScriptModuleTags = resolvedScriptTag !== 'wxs' && scriptModuleTagTokens.length > 0
  const shouldRemoveConditionals = removalRanges.length > 0
  const shouldRemoveComments = opts.removeComment && commentTokens.length > 0
  const shouldReplaceDefineImportMetaEnv = !!opts.defineImportMetaEnv && Object.keys(opts.defineImportMetaEnv).length > 0

  if (!shouldNormalizeImports && !shouldNormalizeTemplateImports && !shouldRemoveLang && !shouldTransformInlineWxs && !shouldTransformEvents && !shouldTransformDirectives && !shouldTransformTagNames && !shouldTransformScriptModuleTags && !shouldRemoveConditionals && !shouldRemoveComments && !shouldReplaceDefineImportMetaEnv) {
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

  if (shouldTransformDirectives) {
    for (const { end, start, value } of directiveTokens) {
      ms.update(start, end, value)
    }
  }

  if (shouldTransformTagNames) {
    for (const { end, start, value } of tagNameTokens) {
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

  const finalCode = shouldNormalizeScriptModuleAttributes(resolvedScriptTag)
    ? normalizeImportSjsAttributes(ms.toString())
    : ms.toString()
  const codeWithDefine = replaceDefineImportMetaEnv(finalCode, opts.defineImportMetaEnv)

  return setCachedResult(data, cacheKey, {
    code: codeWithDefine,
    components,
    deps,
  })
}
