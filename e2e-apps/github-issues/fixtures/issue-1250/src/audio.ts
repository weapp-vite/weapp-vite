/** 生成无外部网络依赖的单声道 PCM WAV，交由真实浏览器媒体管线播放。 */
function createWaveUrl(seconds: number) {
  const sampleRate = 8000
  const samples = Math.round(sampleRate * seconds)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  const text = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index))
    }
  }
  text(0, 'RIFF')
  view.setUint32(4, buffer.byteLength - 8, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples * 2, true)
  return `data:audio/wav;base64,${wx.arrayBufferToBase64(buffer)}`
}

/** 业务只调用 wx 音频 API，输出真实媒体事件与读取状态供浏览器验收。 */
export function createAudioProbe(publish: (snapshot: string) => void) {
  let audio: ReturnType<typeof wx.createInnerAudioContext> | undefined
  const trace = { events: [] as string[], errors: [] as Array<{ errCode: number, errMsg: string }>, destroyed: false }
  const snapshot = () => publish(JSON.stringify({
    ...trace,
    currentTime: audio?.currentTime ?? 0,
    duration: audio?.duration ?? 0,
    buffered: audio?.buffered ?? 0,
    paused: audio?.paused ?? true,
    srcEmpty: !audio?.src,
  }))
  const notifications = ['Canplay', 'Play', 'Pause', 'Stop', 'Ended', 'TimeUpdate', 'Waiting', 'Seeking', 'Seeked'] as const
  return {
    start(seconds = 6, invalid = false) {
      audio?.destroy()
      trace.events = []
      trace.errors = []
      trace.destroyed = false
      audio = wx.createInnerAudioContext()
      for (const name of notifications) {
        audio[`on${name}`](() => {
          trace.events.push(name)
          snapshot()
        })
      }
      audio.onError((error) => {
        trace.errors.push(error)
        snapshot()
      })
      audio.src = invalid ? 'data:audio/wav;base64,AA==' : createWaveUrl(seconds)
      audio.volume = 0
      audio.loop = seconds > 1
      audio.startTime = invalid ? 0 : 0.1
      audio.play()
      snapshot()
    },
    pause() {
      audio?.pause()
      snapshot()
    },
    resume() {
      audio?.play()
      snapshot()
    },
    seek() {
      audio?.seek(2)
      snapshot()
    },
    stop() {
      audio?.stop()
      snapshot()
    },
    unsubscribe() {
      for (const name of notifications) {
        audio?.[`off${name}`]()
      }
      audio?.offError()
      snapshot()
    },
    destroy() {
      audio?.destroy()
      trace.destroyed = true
      snapshot()
    },
  }
}
