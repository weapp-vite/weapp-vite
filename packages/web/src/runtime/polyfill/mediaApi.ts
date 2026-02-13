import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  normalizeChooseFileExtensions,
  normalizeChooseMessageFile,
  normalizeChooseMessageFileCount,
  normalizeChooseMessageFileType,
  pickChooseFileFiles,
  pickChooseMessageFiles,
} from './filePicker'
import {
  normalizeFilePath,
  resolveOpenDocumentUrl,
  resolveSaveFilePath,
  saveMemoryFile,
} from './files'
import {
  normalizePreviewMediaSources,
  openTargetInNewWindow,
  readOpenVideoEditorPreset,
  triggerDownload,
} from './mediaActions'
import {
  inferImageTypeFromPath,
  inferVideoTypeFromPath,
  normalizeVideoInfoNumber,
  readImageInfoFromSource,
  readPresetCompressVideo,
  readPresetVideoInfo,
  readVideoInfoFromSource,
} from './mediaInfo'
import {
  normalizeChooseImageCount,
  normalizeChooseImageFile,
  normalizeChooseMediaCount,
  normalizeChooseMediaFile,
  normalizeChooseMediaTypes,
  pickChooseImageFiles,
  pickChooseMediaFiles,
} from './mediaPicker'
import {
  compressImageByCanvas,
  normalizeChooseVideoFile,
  normalizeCompressImageQuality,
  pickChooseVideoFile,
} from './mediaProcess'

export function getImageInfoBridge(options?: any) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'getImageInfo:fail invalid src')
    return Promise.reject(failure)
  }
  return readImageInfoFromSource(src)
    .then(({ width, height }) => callWxAsyncSuccess(options, {
      errMsg: 'getImageInfo:ok',
      width,
      height,
      path: src,
      type: inferImageTypeFromPath(src),
      orientation: 'up',
    }))
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      const failure = callWxAsyncFailure(options, `getImageInfo:fail ${message}`)
      return Promise.reject(failure)
    })
}

export function getVideoInfoBridge(options?: any) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'getVideoInfo:fail invalid src')
    return Promise.reject(failure)
  }
  const preset = readPresetVideoInfo(src)
  const resolveResult = async () => {
    if (preset) {
      return preset
    }
    return readVideoInfoFromSource(src)
  }
  return resolveResult()
    .then((result) => {
      const duration = normalizeVideoInfoNumber(result.duration)
      const width = normalizeVideoInfoNumber(result.width)
      const height = normalizeVideoInfoNumber(result.height)
      const bitrate = normalizeVideoInfoNumber(result.bitrate)
      const fps = normalizeVideoInfoNumber(result.fps)
      return callWxAsyncSuccess(options, {
        errMsg: 'getVideoInfo:ok',
        orientation: 'up',
        type: inferVideoTypeFromPath(src),
        duration,
        size: normalizeVideoInfoNumber(result.size),
        width,
        height,
        bitrate,
        fps,
      })
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      const failure = callWxAsyncFailure(options, `getVideoInfo:fail ${message}`)
      return Promise.reject(failure)
    })
}

export async function chooseImageBridge(options?: any) {
  const count = normalizeChooseImageCount(options?.count)
  try {
    const files = await pickChooseImageFiles(count)
    const tempFiles = files.map(file => normalizeChooseImageFile(file))
    const tempFilePaths = tempFiles.map(item => item.path)
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseImage:ok',
      tempFilePaths,
      tempFiles,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseImage:fail ${message}`)
    return Promise.reject(failure)
  }
}

export async function chooseMediaBridge(options?: any) {
  const count = normalizeChooseMediaCount(options?.count)
  const types = normalizeChooseMediaTypes(options?.mediaType)
  try {
    const files = await pickChooseMediaFiles(count, types)
    const tempFiles = files.map(file => normalizeChooseMediaFile(file))
    const defaultType = types.has('video') && !types.has('image') ? 'video' : 'image'
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseMedia:ok',
      type: tempFiles[0]?.fileType ?? defaultType,
      tempFiles,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseMedia:fail ${message}`)
    return Promise.reject(failure)
  }
}

export async function compressImageBridge(options?: any) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'compressImage:fail invalid src')
    return Promise.reject(failure)
  }
  const quality = normalizeCompressImageQuality(options?.quality)
  try {
    const tempFilePath = await compressImageByCanvas(src, quality)
    return callWxAsyncSuccess(options, {
      errMsg: 'compressImage:ok',
      tempFilePath,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `compressImage:fail ${message}`)
    return Promise.reject(failure)
  }
}

export function compressVideoBridge(options?: any) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callWxAsyncFailure(options, 'compressVideo:fail invalid src')
    return Promise.reject(failure)
  }
  const preset = readPresetCompressVideo(src)
  const result = preset ?? {
    tempFilePath: src,
    size: 0,
    duration: 0,
    width: 0,
    height: 0,
    bitrate: 0,
    fps: 0,
  }
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'compressVideo:ok',
    ...result,
  }))
}

export async function chooseVideoBridge(options?: any) {
  try {
    const file = await pickChooseVideoFile()
    if (!file) {
      throw new TypeError('no file selected')
    }
    const normalized = normalizeChooseVideoFile(file)
    if (!normalized) {
      throw new TypeError('selected file is not a video')
    }
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseVideo:ok',
      ...normalized,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseVideo:fail ${message}`)
    return Promise.reject(failure)
  }
}

export async function chooseMessageFileBridge(options?: any) {
  const count = normalizeChooseMessageFileCount(options?.count)
  const type = normalizeChooseMessageFileType(options?.type)
  try {
    const files = await pickChooseMessageFiles(count, type)
    const tempFiles = files.map(file => normalizeChooseMessageFile(file))
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseMessageFile:ok',
      tempFiles,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseMessageFile:fail ${message}`)
    return Promise.reject(failure)
  }
}

export async function chooseFileBridge(options?: any) {
  const count = normalizeChooseMessageFileCount(options?.count)
  const type = normalizeChooseMessageFileType(options?.type)
  const extensions = normalizeChooseFileExtensions(options?.extension)
  try {
    const files = await pickChooseFileFiles(count, type, extensions)
    const tempFiles = files.map(file => normalizeChooseMessageFile(file))
    return callWxAsyncSuccess(options, {
      errMsg: 'chooseFile:ok',
      tempFiles,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `chooseFile:fail ${message}`)
    return Promise.reject(failure)
  }
}

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
