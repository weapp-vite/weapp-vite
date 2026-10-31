import type { InnerAudioContext, InnerAudioError } from '../types/audio'
import { emitRuntimeWarning } from '../../warning'

export const AUDIO_EVENT_NAMES = ['Canplay', 'Play', 'Pause', 'Stop', 'Ended', 'TimeUpdate', 'Error', 'Waiting', 'Seeking', 'Seeked'] as const
export type AudioEventName = typeof AUDIO_EVENT_NAMES[number]
type AudioListener = (...args: any[]) => void
type AudioEventMethods = Pick<InnerAudioContext, `on${AudioEventName}` | `off${AudioEventName}`>

/** 每个音频实例独立管理订阅；销毁后不再持有回调。 */
export function createAudioEvents() {
  const listeners = new Map<AudioEventName, Set<AudioListener>>()
  let destroyed = false
  const methods = Object.fromEntries(AUDIO_EVENT_NAMES.flatMap(name => [
    [`on${name}`, (callback: AudioListener) => {
      if (destroyed || typeof callback !== 'function') {
        return
      }
      let entries = listeners.get(name)
      if (!entries) {
        entries = new Set()
        listeners.set(name, entries)
      }
      entries.add(callback)
    }],
    [`off${name}`, (callback?: AudioListener) => {
      if (callback === undefined) {
        listeners.delete(name)
      }
      else {
        listeners.get(name)?.delete(callback)
      }
    }],
  ])) as AudioEventMethods
  return {
    methods,
    emit(name: AudioEventName, error?: InnerAudioError) {
      if (destroyed) {
        return
      }
      for (const callback of [...(listeners.get(name) ?? [])]) {
        if (destroyed) {
          break
        }
        try {
          if (error) {
            callback(error)
          }
          else {
            callback()
          }
        }
        catch (reason) {
          emitRuntimeWarning(`[@weapp-vite/web] InnerAudioContext.on${name} 监听器执行失败：${String(reason)}`, {
            key: `inner-audio-listener:${name}:${String(reason)}`,
          })
        }
      }
    },
    destroy() {
      destroyed = true
      listeners.clear()
    },
  }
}

/** 将浏览器媒体错误映射到小程序音频错误，不将播放拒绝泄漏为全局未处理异常。 */
export function readAudioError(error: unknown, code?: number): InnerAudioError {
  const mediaCodes: Record<number, InnerAudioError['errCode']> = { 1: 10001, 2: 10002, 3: 10003, 4: 10004 }
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error ?? 'audio unavailable')
  const unsupported = error && typeof error === 'object' && 'name' in error && error.name === 'NotSupportedError'
  return {
    errCode: code !== undefined ? (mediaCodes[code] ?? -1) : unsupported ? 10004 : -1,
    errMsg: `InnerAudioContext:fail ${message}`,
  }
}
