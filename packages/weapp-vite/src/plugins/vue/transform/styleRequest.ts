import type { SFCStyleBlock } from 'vue/compiler-sfc'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'

export const WEAPP_VUE_STYLE_VIRTUAL_PREFIX = '\0weapp-vite:vue-style:'
const WEAPP_VUE_STYLE_VIRTUAL_PREFIX_PLAIN = 'weapp-vite:vue-style:'

export interface WeappVueStyleRequest {
  filename: string
  index: number
}

interface BuildWeappVueStyleRequestOptions {
  hmrToken?: number | string
}

function appendHmrToken(query: string, token: number | string | undefined) {
  if (typeof token === 'number') {
    return Number.isFinite(token) && token > 0
      ? `${query}&hmr=${token}`
      : query
  }
  if (typeof token === 'string' && token.trim()) {
    return `${query}&hmr=${encodeURIComponent(token)}`
  }
  return query
}

function resolveEncodedStyleRequestFilename(filename: string) {
  const normalizedFilename = normalizeFsResolvedId(filename)
  return {
    normalizedFilename,
    encodedFilename: encodeURIComponent(normalizedFilename),
  }
}

export function parseWeappVueStyleRequest(id: string): WeappVueStyleRequest | undefined {
  const queryIndex = id.indexOf('?')
  if (queryIndex === -1) {
    return
  }

  const rawQuery = id.slice(queryIndex + 1)
  const params = new URLSearchParams(rawQuery)
  if (!params.has('weapp-vite-vue')) {
    return
  }

  if (params.get('type') !== 'style') {
    return
  }

  const indexRaw = params.get('index')
  const index = indexRaw ? Number(indexRaw) : 0
  if (!Number.isFinite(index) || index < 0) {
    return
  }

  let filename = id.slice(0, queryIndex)
  if (filename.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX) || filename.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX_PLAIN)) {
    const prefix = filename.startsWith(WEAPP_VUE_STYLE_VIRTUAL_PREFIX)
      ? WEAPP_VUE_STYLE_VIRTUAL_PREFIX
      : WEAPP_VUE_STYLE_VIRTUAL_PREFIX_PLAIN
    const encoded = filename.slice(prefix.length)
    if (!encoded) {
      return
    }
    try {
      filename = decodeURIComponent(encoded)
    }
    catch {
      return
    }
  }

  const normalizedFilename = normalizeFsResolvedId(filename)
  if (!normalizedFilename) {
    return
  }

  return { filename: normalizedFilename, index }
}

export function buildWeappVueStyleRequest(filename: string, styleBlock: SFCStyleBlock, index: number, options: BuildWeappVueStyleRequestOptions = {}): string {
  const lang = styleBlock.lang || 'css'
  const { encodedFilename } = resolveEncodedStyleRequestFilename(filename)

  let query = `weapp-vite-vue&type=style&index=${index}`
  if (styleBlock.scoped) {
    query += '&scoped=true'
  }
  if (styleBlock.module) {
    query += typeof styleBlock.module === 'string'
      ? `&module=${encodeURIComponent(styleBlock.module)}`
      : '&module=true'
  }
  query = appendHmrToken(query, options.hmrToken)

  // 重要：`lang.*` 必须放在末尾，确保 Vite 的 CSS_LANGS_RE 能命中。
  query += `&lang.${lang}`
  return `${WEAPP_VUE_STYLE_VIRTUAL_PREFIX}${encodedFilename}?${query}`
}

export function buildWeappVueStyleRequests(filename: string, styleBlocks: SFCStyleBlock[], options: BuildWeappVueStyleRequestOptions = {}): string[] {
  const { encodedFilename } = resolveEncodedStyleRequestFilename(filename)
  return styleBlocks.map((styleBlock, index) => {
    const lang = styleBlock.lang || 'css'
    let query = `weapp-vite-vue&type=style&index=${index}`
    if (styleBlock.scoped) {
      query += '&scoped=true'
    }
    if (styleBlock.module) {
      query += typeof styleBlock.module === 'string'
        ? `&module=${encodeURIComponent(styleBlock.module)}`
        : '&module=true'
    }
    query = appendHmrToken(query, options.hmrToken)
    query += `&lang.${lang}`
    return `${WEAPP_VUE_STYLE_VIRTUAL_PREFIX}${encodedFilename}?${query}`
  })
}
