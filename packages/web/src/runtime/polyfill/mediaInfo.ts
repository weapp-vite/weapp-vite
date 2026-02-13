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
