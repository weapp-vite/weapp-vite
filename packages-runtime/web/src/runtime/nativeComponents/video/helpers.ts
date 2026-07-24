export function resolveVideoObjectFit(value: string | null) {
  return value === 'fill' || value === 'cover' || value === 'contain' ? value : 'contain'
}

export function createVideoTimeUpdateDetail(currentTime: number, duration: number) {
  return {
    currentTime: Number.isFinite(currentTime) ? currentTime : 0,
    duration: Number.isFinite(duration) ? duration : 0,
  }
}

export function createVideoProgressDetail(bufferedEnd: number, duration: number) {
  if (!Number.isFinite(bufferedEnd) || !Number.isFinite(duration) || duration <= 0) {
    return { buffered: 0 }
  }
  return {
    buffered: Math.min(100, Math.max(0, bufferedEnd / duration * 100)),
  }
}

export function resolveVideoDirection(videoWidth: number, videoHeight: number) {
  return videoWidth >= videoHeight ? 'horizontal' : 'vertical'
}
