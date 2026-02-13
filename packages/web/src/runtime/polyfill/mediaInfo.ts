export function inferImageTypeFromPath(path: string) {
  const lower = path.toLowerCase()
  if (lower.includes('.png')) {
    return 'png'
  }
  if (lower.includes('.jpg') || lower.includes('.jpeg')) {
    return 'jpg'
  }
  if (lower.includes('.gif')) {
    return 'gif'
  }
  if (lower.includes('.webp')) {
    return 'webp'
  }
  if (lower.includes('.bmp')) {
    return 'bmp'
  }
  if (lower.includes('.svg')) {
    return 'svg'
  }
  if (lower.includes('.avif')) {
    return 'avif'
  }
  return 'unknown'
}

export function inferVideoTypeFromPath(path: string) {
  const lower = path.toLowerCase()
  if (lower.includes('.mp4')) {
    return 'mp4'
  }
  if (lower.includes('.mov')) {
    return 'mov'
  }
  if (lower.includes('.m4v')) {
    return 'm4v'
  }
  if (lower.includes('.webm')) {
    return 'webm'
  }
  if (lower.includes('.avi')) {
    return 'avi'
  }
  if (lower.includes('.mkv')) {
    return 'mkv'
  }
  return 'unknown'
}

export function normalizeVideoInfoNumber(value: unknown) {
  if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
    return 0
  }
  return value
}

function normalizeVideoInfoPreset(value: unknown, src: string) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const info = value as Record<string, unknown>
  return {
    size: normalizeVideoInfoNumber(info.size),
    duration: normalizeVideoInfoNumber(info.duration),
    width: normalizeVideoInfoNumber(info.width),
    height: normalizeVideoInfoNumber(info.height),
    fps: normalizeVideoInfoNumber(info.fps),
    bitrate: normalizeVideoInfoNumber(info.bitrate),
    type: typeof info.type === 'string' ? info.type : inferVideoTypeFromPath(src),
    orientation: 'up' as const,
  }
}

export function readPresetVideoInfo(src: string) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebVideoInfo
  if (typeof preset === 'function') {
    return normalizeVideoInfoPreset((preset as (value: string) => unknown)(src), src)
  }
  if (preset && typeof preset === 'object') {
    const sourcePreset = (preset as Record<string, unknown>)[src]
    if (sourcePreset && typeof sourcePreset === 'object') {
      return normalizeVideoInfoPreset(sourcePreset, src)
    }
    return normalizeVideoInfoPreset(preset, src)
  }
  return null
}

function normalizeCompressVideoResult(value: unknown, src: string) {
  if (!value || typeof value !== 'object') {
    return null
  }
  const info = value as Record<string, unknown>
  const tempFilePath = typeof info.tempFilePath === 'string' && info.tempFilePath.trim()
    ? info.tempFilePath.trim()
    : src
  return {
    tempFilePath,
    size: normalizeVideoInfoNumber(info.size),
    duration: normalizeVideoInfoNumber(info.duration),
    width: normalizeVideoInfoNumber(info.width),
    height: normalizeVideoInfoNumber(info.height),
    bitrate: normalizeVideoInfoNumber(info.bitrate),
    fps: normalizeVideoInfoNumber(info.fps),
  }
}

export function readPresetCompressVideo(src: string) {
  const runtimeGlobal = globalThis as Record<string, unknown>
  const preset = runtimeGlobal.__weappViteWebCompressVideo
  if (typeof preset === 'function') {
    return normalizeCompressVideoResult((preset as (value: string) => unknown)(src), src)
  }
  if (preset && typeof preset === 'object') {
    const sourcePreset = (preset as Record<string, unknown>)[src]
    if (sourcePreset && typeof sourcePreset === 'object') {
      return normalizeCompressVideoResult(sourcePreset, src)
    }
    return normalizeCompressVideoResult(preset, src)
  }
  if (typeof preset === 'string' && preset.trim()) {
    return {
      tempFilePath: preset.trim(),
      size: 0,
      duration: 0,
      width: 0,
      height: 0,
      bitrate: 0,
      fps: 0,
    }
  }
  return null
}

export async function readImageInfoFromSource(src: string) {
  const ImageCtor = (globalThis as { Image?: typeof Image }).Image
  if (typeof ImageCtor !== 'function') {
    throw new TypeError('Image is unavailable')
  }
  return new Promise<{ width: number, height: number }>((resolve, reject) => {
    const image = new ImageCtor()
    image.onload = () => {
      const width = Number((image as { naturalWidth?: number }).naturalWidth ?? image.width ?? 0)
      const height = Number((image as { naturalHeight?: number }).naturalHeight ?? image.height ?? 0)
      resolve({
        width: Number.isFinite(width) ? width : 0,
        height: Number.isFinite(height) ? height : 0,
      })
    }
    image.onerror = () => {
      reject(new Error('image load error'))
    }
    image.src = src
  })
}

export async function readVideoInfoFromSource(src: string) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    throw new TypeError('video element is unavailable')
  }
  const video = document.createElement('video') as HTMLVideoElement
  if (!video || typeof video.addEventListener !== 'function') {
    throw new Error('video element is unavailable')
  }
  return new Promise<{ duration: number, width: number, height: number }>((resolve, reject) => {
    const cleanup = () => {
      if (typeof video.removeEventListener === 'function') {
        video.removeEventListener('loadedmetadata', onLoadedMetadata)
        video.removeEventListener('error', onError)
      }
    }
    const onLoadedMetadata = () => {
      cleanup()
      resolve({
        duration: normalizeVideoInfoNumber(video.duration),
        width: normalizeVideoInfoNumber((video as { videoWidth?: number }).videoWidth),
        height: normalizeVideoInfoNumber((video as { videoHeight?: number }).videoHeight),
      })
    }
    const onError = () => {
      cleanup()
      reject(new Error('video load error'))
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.src = src
    video.load?.()
  })
}
