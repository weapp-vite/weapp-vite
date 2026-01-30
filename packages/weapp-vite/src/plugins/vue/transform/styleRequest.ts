import type { SFCStyleBlock } from 'vue/compiler-sfc'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'

export interface WeappVueStyleRequest {
  filename: string
  index: number
}

export function parseWeappVueStyleRequest(id: string): WeappVueStyleRequest | undefined {
  const [filename, rawQuery] = id.split('?', 2)
  if (!rawQuery) {
    return
  }

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

  const normalizedFilename = normalizeFsResolvedId(filename)
  if (!normalizedFilename) {
    return
  }

  return { filename: normalizedFilename, index }
}

export function buildWeappVueStyleRequest(filename: string, styleBlock: SFCStyleBlock, index: number): string {
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

  // 重要：`lang.*` 必须放在末尾，确保 Vite 的 CSS_LANGS_RE 能命中。
  query += `&lang.${lang}`
  return `${filename}?${query}`
}
