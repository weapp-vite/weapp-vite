import type { SFCStyleBlock } from 'vue/compiler-sfc'

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

  return { filename, index }
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

  // IMPORTANT: `lang.*` must be at the end so Vite's CSS_LANGS_RE can match it.
  query += `&lang.${lang}`
  return `${filename}?${query}`
}
