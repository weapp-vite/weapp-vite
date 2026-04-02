import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from '../async'
import {
  normalizePreviewMediaSources,
  openTargetInNewWindow,
  readOpenVideoEditorPreset,
} from '../mediaActions'

export function previewImageBridge(options?: any) {
  const urls = Array.isArray(options?.urls)
    ? options.urls.map((url: unknown) => String(url).trim()).filter(Boolean)
    : []
  if (!urls.length) {
    const failure = callWxAsyncFailure(options, 'previewImage:fail invalid urls')
    return Promise.reject(failure)
  }
  const current = typeof options?.current === 'string' && options.current.trim()
    ? options.current.trim()
    : urls[0]
  const target = urls.includes(current) ? current : urls[0]
  openTargetInNewWindow(target)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'previewImage:ok' }))
}

export function previewMediaBridge(options?: any) {
  const sources = normalizePreviewMediaSources(options?.sources)
  if (!sources.length) {
    const failure = callWxAsyncFailure(options, 'previewMedia:fail invalid sources')
    return Promise.reject(failure)
  }
  const current = typeof options?.current === 'number' && Number.isFinite(options.current)
    ? Math.max(0, Math.floor(options.current))
    : 0
  const target = sources[current]?.url ?? sources[0].url
  openTargetInNewWindow(target)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'previewMedia:ok' }))
}

export function openVideoEditorBridge(options?: any) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'openVideoEditor:fail invalid src')
    return Promise.reject(failure)
  }
  const tempFilePath = readOpenVideoEditorPreset(src) || src
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'openVideoEditor:ok',
    tempFilePath,
  }))
}
