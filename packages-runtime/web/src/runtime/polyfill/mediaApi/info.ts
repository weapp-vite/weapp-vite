import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
} from '../async'
import {
  inferImageTypeFromPath,
  inferVideoTypeFromPath,
  normalizeVideoInfoNumber,
  readImageInfoFromSource,
  readPresetVideoInfo,
  readVideoInfoFromSource,
} from '../mediaInfo'

export function getImageInfoBridge(options?: any) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callMiniProgramAsyncFailure(options, 'getImageInfo:fail invalid src')
    return Promise.reject(failure)
  }
  return readImageInfoFromSource(src)
    .then(({ width, height }) => callMiniProgramAsyncSuccess(options, {
      errMsg: 'getImageInfo:ok',
      width,
      height,
      path: src,
      type: inferImageTypeFromPath(src),
      orientation: 'up',
    }))
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      const failure = callMiniProgramAsyncFailure(options, `getImageInfo:fail ${message}`)
      return Promise.reject(failure)
    })
}

export function getVideoInfoBridge(options?: any) {
  const src = typeof options?.src === 'string' ? options.src.trim() : ''
  if (!src) {
    const failure = callMiniProgramAsyncFailure(options, 'getVideoInfo:fail invalid src')
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
      const bitrate = normalizeVideoInfoNumber((result as Record<string, unknown>).bitrate)
      const fps = normalizeVideoInfoNumber((result as Record<string, unknown>).fps)
      return callMiniProgramAsyncSuccess(options, {
        errMsg: 'getVideoInfo:ok',
        orientation: 'up',
        type: inferVideoTypeFromPath(src),
        duration,
        size: normalizeVideoInfoNumber((result as Record<string, unknown>).size),
        width,
        height,
        bitrate,
        fps,
      })
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      const failure = callMiniProgramAsyncFailure(options, `getVideoInfo:fail ${message}`)
      return Promise.reject(failure)
    })
}
