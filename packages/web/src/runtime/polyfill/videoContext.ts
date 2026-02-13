function resolveVideoElementById(videoId: string) {
  if (typeof document === 'undefined') {
    return undefined
  }
  const normalized = String(videoId ?? '').trim()
  if (!normalized) {
    return undefined
  }
  const fromId = document.getElementById(normalized)
  if (fromId && 'play' in fromId && 'pause' in fromId) {
    return fromId as unknown as HTMLVideoElement
  }
  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(normalized)
    : normalized.replace(/"/g, '\\"')
  const fromQuery = document.querySelector(`video#${escaped}`)
  if (fromQuery && 'play' in fromQuery && 'pause' in fromQuery) {
    return fromQuery as HTMLVideoElement
  }
  return undefined
}

export function createVideoContextBridge(videoId: string): VideoContext {
  const getVideo = () => resolveVideoElementById(videoId)
  return {
    play() {
      getVideo()?.play?.()
    },
    pause() {
      getVideo()?.pause?.()
    },
    stop() {
      const video = getVideo()
      if (!video) {
        return
      }
      video.pause?.()
      try {
        video.currentTime = 0
      }
      catch {
        // ignore browsers that block currentTime mutation
      }
    },
    seek(position: number) {
      if (!Number.isFinite(position)) {
        return
      }
      const video = getVideo()
      if (!video) {
        return
      }
      try {
        video.currentTime = Math.max(0, position)
      }
      catch {
        // ignore browsers that block currentTime mutation
      }
    },
    playbackRate(rate: number) {
      if (!Number.isFinite(rate) || rate <= 0) {
        return
      }
      const video = getVideo()
      if (!video) {
        return
      }
      try {
        video.playbackRate = rate
      }
      catch {
        // ignore unsupported playbackRate mutation
      }
    },
    requestFullScreen() {
      const video = getVideo() as (HTMLVideoElement & { requestFullscreen?: () => Promise<void> | void }) | undefined
      video?.requestFullscreen?.()
    },
    exitFullScreen() {
      const runtimeDocument = document as { exitFullscreen?: () => Promise<void> | void }
      runtimeDocument.exitFullscreen?.()
    },
  }
}
