import { emitRuntimeWarning } from '../../warning'

function finite(value: number) {
  return Number.isFinite(value) ? value : 0
}

/** 浏览器可用的媒体属性直接代理，其余平台属性只保留实例内配置。 */
export function createAudioProperties(
  audio: HTMLAudioElement | undefined,
  seek: (position: number) => void,
  sourceChanged: () => void,
  isDestroyed: () => boolean,
) {
  const fallback = { src: '', autoplay: false, loop: false, volume: 1, playbackRate: 1 }
  let startTime = 0
  let obeyMuteSwitch = true
  let referrerPolicy = ''
  const properties: Record<string, PropertyDescriptor> = {}
  for (const name of ['src', 'autoplay', 'loop', 'volume', 'playbackRate'] as const) {
    properties[name] = {
      enumerable: true,
      get: () => audio?.[name] ?? fallback[name],
      set(value: string | boolean | number) {
        if (isDestroyed()) {
          return
        }
        if (name === 'src') {
          fallback.src = String(value)
          sourceChanged()
          if (audio) {
            audio.src = fallback.src
          }
        }
        else if (name === 'autoplay' || name === 'loop') {
          fallback[name] = Boolean(value)
          if (audio) {
            audio[name] = fallback[name]
          }
        }
        else if (typeof value === 'number' && Number.isFinite(value)) {
          fallback[name] = name === 'volume' ? Math.min(1, Math.max(0, value)) : Math.min(2, Math.max(0.5, value))
          if (audio) {
            audio[name] = fallback[name]
          }
        }
      },
    }
  }
  Object.assign(properties, {
    currentTime: { enumerable: true, get: () => finite(audio?.currentTime ?? 0), set: seek },
    duration: { enumerable: true, get: () => finite(audio?.duration ?? 0) },
    paused: { enumerable: true, get: () => audio?.paused ?? true },
    buffered: {
      enumerable: true,
      get() {
        const ranges = audio?.buffered
        return ranges?.length ? finite(ranges.end(ranges.length - 1)) : 0
      },
    },
    startTime: {
      enumerable: true,
      get: () => startTime,
      set(value: number) {
        if (!isDestroyed() && Number.isFinite(value)) {
          startTime = Math.max(0, value)
        }
      },
    },
    obeyMuteSwitch: {
      enumerable: true,
      get: () => obeyMuteSwitch,
      set(value: boolean) {
        if (!isDestroyed()) {
          obeyMuteSwitch = Boolean(value)
          emitRuntimeWarning('[@weapp-vite/web] InnerAudioContext.obeyMuteSwitch 在 Web 端不能控制系统静音开关。', { key: 'inner-audio:obeyMuteSwitch' })
        }
      },
    },
    referrerPolicy: {
      enumerable: true,
      get: () => referrerPolicy,
      set(value: string) {
        if (!isDestroyed()) {
          referrerPolicy = String(value)
          emitRuntimeWarning('[@weapp-vite/web] InnerAudioContext.referrerPolicy 在 Web 端不能设置微信来源地址，请使用浏览器的资源访问策略。', { key: 'inner-audio:referrerPolicy' })
        }
      },
    },
  })
  return {
    properties,
    getStartTime: () => startTime,
    clear: () => { fallback.src = '' },
  }
}
