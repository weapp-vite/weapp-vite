import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from '../async'
import {
  normalizeFilePath,
  resolveOpenDocumentUrl,
  resolveSaveFilePath,
  saveMemoryFile,
} from '../files'
import {
  openTargetInNewWindow,
  triggerDownload,
} from '../mediaActions'

export function saveImageToPhotosAlbumBridge(options?: any) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'saveImageToPhotosAlbum:fail invalid filePath')
    return Promise.reject(failure)
  }
  triggerDownload(filePath)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'saveImageToPhotosAlbum:ok' }))
}

export function saveVideoToPhotosAlbumBridge(options?: any) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'saveVideoToPhotosAlbum:fail invalid filePath')
    return Promise.reject(failure)
  }
  triggerDownload(filePath)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'saveVideoToPhotosAlbum:ok' }))
}

export function saveFileBridge(options?: any) {
  const tempFilePath = typeof options?.tempFilePath === 'string' ? options.tempFilePath.trim() : ''
  if (!tempFilePath) {
    const failure = callWxAsyncFailure(options, 'saveFile:fail invalid tempFilePath')
    return Promise.reject(failure)
  }
  const savedFilePath = resolveSaveFilePath(tempFilePath, options?.filePath)
  saveMemoryFile(tempFilePath, savedFilePath)
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'saveFile:ok',
    savedFilePath,
  }))
}

export function saveFileToDiskBridge(options?: any) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'saveFileToDisk:fail invalid filePath')
    return Promise.reject(failure)
  }
  const fileName = typeof options?.fileName === 'string' ? options.fileName.trim() : ''
  triggerDownload(filePath, fileName)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'saveFileToDisk:ok' }))
}

export function openDocumentBridge(options?: any) {
  const filePath = normalizeFilePath(options?.filePath)
  if (!filePath) {
    const failure = callWxAsyncFailure(options, 'openDocument:fail invalid filePath')
    return Promise.reject(failure)
  }
  const target = resolveOpenDocumentUrl(filePath)
  if (!target) {
    const failure = callWxAsyncFailure(options, 'openDocument:fail document url is unavailable')
    return Promise.reject(failure)
  }
  openTargetInNewWindow(target)
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'openDocument:ok' }))
}
