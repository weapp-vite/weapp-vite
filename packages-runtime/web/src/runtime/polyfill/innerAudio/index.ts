import type { CreateInnerAudioContextOptions, InnerAudioContext } from '../types/audio'
import type { AudioEventName } from './events'
import { emitRuntimeWarning } from '../../warning'
import { createAudioEvents, readAudioError } from './events'
import { createAudioProperties } from './properties'

export type { CreateInnerAudioContextOptions, InnerAudioContext, InnerAudioError } from '../types/audio'

/** 以独立的 HTMLAudioElement 承载音频；不暴露或依赖浏览器专属的 Promise 返回。 */
export function createInnerAudioContext(options?: CreateInnerAudioContextOptions): InnerAudioContext {
  const audio = typeof document === 'undefined' ? undefined : document.createElement('audio')
  const events = createAudioEvents()
  const disposers: Array<() => void> = []
  let destroyed = false
  let generation = 0
  let failedGeneration = -1
  let desired: 'idle' | 'playing' | 'paused' | 'stopped' = 'idle'
  let lastPlaybackEvent: 'Play' | 'Pause' | 'Stop' | undefined
  let pendingPosition: number | undefined
  let startApplied = false

  if (options?.useWebAudioImplement) {
    emitRuntimeWarning('[@weapp-vite/web] wx.createInnerAudioContext 在 Web 端使用 HTMLAudioElement，忽略 useWebAudioImplement。', { key: 'inner-audio:useWebAudioImplement' })
  }

  function seek(position: number) {
    if (destroyed || !Number.isFinite(position)) {
      return
    }
    pendingPosition = Math.max(0, position)
    if (audio) {
      try {
        audio.currentTime = pendingPosition
        if (audio.readyState > 0) {
          pendingPosition = undefined
        }
      }
      catch {
        // 元数据尚未就绪时保留目标，在 loadedmetadata 中重试。
      }
    }
  }

  const properties = createAudioProperties(audio, seek, () => {
    generation += 1
    desired = 'idle'
    lastPlaybackEvent = undefined
    startApplied = false
    pendingPosition = undefined
  }, () => destroyed)

  function applyInitialPosition() {
    const position = pendingPosition ?? (startApplied ? undefined : properties.getStartTime())
    if (position !== undefined) {
      seek(position)
    }
    if (audio && audio.readyState > 0) {
      startApplied = true
    }
  }

  function fail(error: unknown, code?: number) {
    if (!destroyed && failedGeneration !== generation) {
      failedGeneration = generation
      desired = 'idle'
      lastPlaybackEvent = undefined
      events.emit('Error', readAudioError(error, code))
    }
  }

  function listen(name: string, listener: () => void) {
    audio?.addEventListener(name, listener)
    disposers.push(() => audio?.removeEventListener(name, listener))
  }

  listen('loadedmetadata', applyInitialPosition)
  listen('play', () => {
    if (desired === 'paused' || desired === 'stopped' || audio?.paused || lastPlaybackEvent === 'Play') {
      return
    }
    desired = 'playing'
    lastPlaybackEvent = 'Play'
    events.emit('Play')
  })
  listen('pause', () => {
    if (desired === 'idle' || desired === 'stopped' || (audio && !audio.paused) || audio?.ended || lastPlaybackEvent === 'Pause') {
      return
    }
    desired = 'paused'
    lastPlaybackEvent = 'Pause'
    events.emit('Pause')
  })
  listen('ended', () => {
    desired = 'idle'
    lastPlaybackEvent = undefined
    events.emit('Ended')
  })
  listen('error', () => fail(audio?.error, audio?.error?.code))
  for (const [name, event] of Object.entries({ canplay: 'Canplay', timeupdate: 'TimeUpdate', waiting: 'Waiting', seeking: 'Seeking', seeked: 'Seeked' })) {
    listen(name, () => events.emit(event as AudioEventName))
  }

  return Object.defineProperties({
    ...events.methods,
    play() {
      if (destroyed) {
        return
      }
      desired = 'playing'
      const attempt = ++generation
      applyInitialPosition()
      if (!audio) {
        fail('HTMLAudioElement is unavailable')
        return
      }
      try {
        Promise.resolve(audio.play()).catch((error: unknown) => {
          if (attempt === generation) {
            fail(error)
          }
        })
      }
      catch (error) {
        fail(error)
      }
    },
    pause() {
      if (!destroyed) {
        desired = 'paused'
        generation += 1
        audio?.pause()
      }
    },
    stop() {
      if (destroyed || desired === 'stopped') {
        return
      }
      desired = 'stopped'
      generation += 1
      audio?.pause()
      seek(0)
      startApplied = true
      lastPlaybackEvent = 'Stop'
      events.emit('Stop')
    },
    seek,
    destroy() {
      if (destroyed) {
        return
      }
      destroyed = true
      generation += 1
      for (const dispose of disposers) {
        dispose()
      }
      disposers.length = 0
      events.destroy()
      properties.clear()
      audio?.pause()
      audio?.removeAttribute('src')
      audio?.load()
    },
  }, properties.properties) as InnerAudioContext
}
