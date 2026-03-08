import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from '../async'
import {
  normalizeChooseFileExtensions,
  normalizeChooseMessageFile,
  normalizeChooseMessageFileCount,
  normalizeChooseMessageFileType,
  pickChooseFileFiles,
  pickChooseMessageFiles,
} from '../filePicker'
import {
  normalizeChooseImageCount,
  normalizeChooseImageFile,
  normalizeChooseMediaCount,
  normalizeChooseMediaFile,
  normalizeChooseMediaTypes,
  pickChooseImageFiles,
  pickChooseMediaFiles,
} from '../mediaPicker'
import {
  normalizeChooseVideoFile,
  pickChooseVideoFile,
} from '../mediaProcess'

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
