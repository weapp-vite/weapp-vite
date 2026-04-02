interface PreviewMediaSourceRecord {
  url: string
  type: 'image' | 'video'
  poster: string
}

export function openTargetInNewWindow(target: string) {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return
  }
  try {
    window.open(target, '_blank', 'noopener,noreferrer')
  }
  catch {
    // ignore browser popup restrictions and keep API-level success semantics
  }
}

export function normalizePreviewMediaSources(sources: unknown): PreviewMediaSourceRecord[] {
  if (!Array.isArray(sources)) {
    return []
  }
  return sources
    .map((source) => {
      if (!source || typeof source !== 'object') {
        return null
      }
      const sourceRecord = source as Record<string, unknown>
      const url = typeof sourceRecord.url === 'string' ? sourceRecord.url.trim() : ''
      if (!url) {
        return null
      }
      return {
        url,
        type: sourceRecord.type === 'video' ? 'video' : 'image',
        poster: typeof sourceRecord.poster === 'string' ? sourceRecord.poster : '',
      }
    })
    .filter((item): item is PreviewMediaSourceRecord => Boolean(item))
}

export function readOpenVideoEditorPreset(src: string) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebOpenVideoEditor
  if (typeof preset === 'function') {
    const value = (preset as (value: string) => unknown)(src)
    return typeof value === 'string' && value.trim() ? value.trim() : ''
  }
  if (typeof preset === 'string' && preset.trim()) {
    return preset.trim()
  }
  if (preset && typeof preset === 'object') {
    const value = (preset as Record<string, unknown>)[src]
    return typeof value === 'string' && value.trim() ? value.trim() : ''
  }
  return ''
}

export function triggerDownload(filePath: string, fileName = '') {
  if (typeof document === 'undefined' || !document.body) {
    return
  }
  try {
    const link = document.createElement('a')
    link.setAttribute('href', filePath)
    link.setAttribute('download', fileName)
    link.setAttribute('style', 'display:none')
    document.body.append(link)
    link.click?.()
    if (link.parentNode) {
      link.parentNode.removeChild(link)
    }
  }
  catch {
    // keep API-level success semantics for browser restrictions
  }
}
