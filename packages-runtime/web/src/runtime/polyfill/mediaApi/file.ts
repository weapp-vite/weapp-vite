import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
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
    const failure = callMiniProgramAsyncFailure(options, 'saveImageToPhotosAlbum:fail invalid filePath')
    return Promise.reject(failure)
  }
  triggerDownload(filePath)
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'saveImageToPhotosAlbum:ok' }))
}

export function saveVideoToPhotosAlbumBridge(options?: any) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callMiniProgramAsyncFailure(options, 'saveVideoToPhotosAlbum:fail invalid filePath')
    return Promise.reject(failure)
  }
  triggerDownload(filePath)
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'saveVideoToPhotosAlbum:ok' }))
}

export function saveFileBridge(options?: any) {
  const tempFilePath = typeof options?.tempFilePath === 'string' ? options.tempFilePath.trim() : ''
  if (!tempFilePath) {
    const failure = callMiniProgramAsyncFailure(options, 'saveFile:fail invalid tempFilePath')
    return Promise.reject(failure)
  }
  const savedFilePath = resolveSaveFilePath(tempFilePath, options?.filePath)
  saveMemoryFile(tempFilePath, savedFilePath)
  return Promise.resolve(callMiniProgramAsyncSuccess(options, {
    errMsg: 'saveFile:ok',
    savedFilePath,
  }))
}

export function saveFileToDiskBridge(options?: any) {
  const filePath = typeof options?.filePath === 'string' ? options.filePath.trim() : ''
  if (!filePath) {
    const failure = callMiniProgramAsyncFailure(options, 'saveFileToDisk:fail invalid filePath')
    return Promise.reject(failure)
  }
  const fileName = typeof options?.fileName === 'string' ? options.fileName.trim() : ''
  triggerDownload(filePath, fileName)
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'saveFileToDisk:ok' }))
}

export function openDocumentBridge(options?: any) {
  const filePath = normalizeFilePath(options?.filePath)
  if (!filePath) {
    const failure = callMiniProgramAsyncFailure(options, 'openDocument:fail invalid filePath')
    return Promise.reject(failure)
  }
  const target = resolveOpenDocumentUrl(filePath)
  if (!target) {
    const failure = callMiniProgramAsyncFailure(options, 'openDocument:fail document url is unavailable')
    return Promise.reject(failure)
  }
  openTargetInNewWindow(target)
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'openDocument:ok' }))
}
