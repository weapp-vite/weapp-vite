import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from '../async'
import { readPresetCompressVideo } from '../mediaInfo'
import {
  compressImageByCanvas,
  normalizeCompressImageQuality,
} from '../mediaProcess'

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
