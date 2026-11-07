// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInnerAudioContext } from '../src/runtime/polyfill/innerAudio'
import { createAudioEvents, readAudioError } from '../src/runtime/polyfill/innerAudio/events'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

let audio: HTMLAudioElement
const contexts: Array<ReturnType<typeof createInnerAudioContext>> = []

function createContext(options?: Parameters<typeof createInnerAudioContext>[0]) {
  const context = createInnerAudioContext(options)
  contexts.push(context)
  return context
}

function mediaState(values: Partial<Pick<HTMLAudioElement, 'readyState' | 'paused' | 'ended' | 'duration'>>) {
  for (const [name, value] of Object.entries(values)) {
    Object.defineProperty(audio, name, { configurable: true, value })
  }
}

beforeEach(() => {
  audio = document.createElement('audio')
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => tag === 'audio' ? audio : createElement(tag)) as typeof document.createElement)
  vi.spyOn(audio, 'load').mockImplementation(() => {})
  vi.spyOn(audio, 'play').mockResolvedValue(undefined)
  vi.spyOn(audio, 'pause').mockImplementation(() => mediaState({ paused: true }))
  mediaState({ readyState: 0, paused: true, ended: false })
  setRuntimeWarningOptions({ level: 'off' })
})

afterEach(() => {
  for (const context of contexts.splice(0)) {
    context.destroy()
  }
  setRuntimeWarningOptions()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('inner audio host and lifecycle boundaries', () => {
  it('retries a seek rejected before metadata and preserves its explicit position on repeated metadata', () => {
    const context = createContext({ useWebAudioImplement: true })
    let position = 0
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      get: () => position,
      set: (value: number) => {
        if (audio.readyState === 0) {
          throw new DOMException('metadata unavailable', 'InvalidStateError')
        }
        position = value
      },
    })
    context.startTime = 3
    context.seek(8)
    expect(context.currentTime).toBe(0)
    mediaState({ readyState: 1 })
    audio.dispatchEvent(new Event('loadedmetadata'))
    expect(context.currentTime).toBe(8)
    audio.dispatchEvent(new Event('loadedmetadata'))
    expect(context.currentTime).toBe(8)
    context.seek(Number.NaN)
    expect(context.currentTime).toBe(8)
  })

  it('reports synchronous playback failures once per generation and ignores an obsolete rejected attempt', async () => {
    const context = createContext()
    const error = vi.fn()
    context.onError(error)
    vi.mocked(audio.play).mockImplementationOnce(() => {
      // eslint-disable-next-line no-throw-literal -- 模拟宿主抛出非 Error 值，验证原始失败内容仍被正确映射。
      throw 'play failed'
    })
    context.play()
    audio.dispatchEvent(new Event('error'))
    expect(error).toHaveBeenCalledExactlyOnceWith({ errCode: -1, errMsg: 'InnerAudioContext:fail play failed' })
    let reject!: (reason: unknown) => void
    vi.mocked(audio.play).mockReturnValueOnce(new Promise<void>((_resolve, fail) => {
      reject = fail
    }))
    context.play()
    context.src = '/fresh.wav'
    reject(new Error('obsolete source'))
    await Promise.resolve()
    expect(error).toHaveBeenCalledOnce()
    context.play()
    Object.defineProperty(audio, 'error', { configurable: true, value: { code: 3, message: 'decode failed' } })
    audio.dispatchEvent(new Event('error'))
    expect(error).toHaveBeenLastCalledWith({ errCode: 10003, errMsg: 'InnerAudioContext:fail decode failed' })
  })

  it('filters stale native playback events and repeated stop calls according to observable media state', () => {
    const context = createContext()
    const trace: string[] = []
    context.onPlay(() => trace.push('play'))
    context.onPause(() => trace.push('pause'))
    context.onStop(() => trace.push('stop'))
    audio.dispatchEvent(new Event('pause'))
    context.play()
    audio.dispatchEvent(new Event('play'))
    expect(trace).toEqual([])
    mediaState({ paused: false })
    audio.dispatchEvent(new Event('play'))
    audio.dispatchEvent(new Event('play'))
    audio.dispatchEvent(new Event('pause'))
    context.pause()
    audio.dispatchEvent(new Event('play'))
    mediaState({ ended: true })
    audio.dispatchEvent(new Event('pause'))
    mediaState({ ended: false })
    audio.dispatchEvent(new Event('pause'))
    audio.dispatchEvent(new Event('pause'))
    context.stop()
    context.stop()
    audio.dispatchEvent(new Event('play'))
    audio.dispatchEvent(new Event('pause'))
    expect(trace).toEqual(['play', 'pause', 'stop'])
    context.destroy()
    context.pause()
    context.stop()
    context.seek(4)
    expect(trace).toEqual(['play', 'pause', 'stop'])
  })

  it('clamps numeric properties, normalizes non-finite media readings and freezes configuration on destroy', () => {
    const context = createContext()
    context.volume = -1
    context.playbackRate = 9
    context.startTime = -1
    expect([context.volume, context.playbackRate, context.startTime]).toEqual([0, 2, 0])
    context.volume = Number.NaN
    context.playbackRate = Number.POSITIVE_INFINITY
    context.startTime = Number.NaN
    expect([context.volume, context.playbackRate, context.startTime]).toEqual([0, 2, 0])
    context.obeyMuteSwitch = false
    context.referrerPolicy = 'origin'
    expect([context.obeyMuteSwitch, context.referrerPolicy]).toEqual([false, 'origin'])
    mediaState({ duration: Number.POSITIVE_INFINITY })
    Object.defineProperty(audio, 'currentTime', { configurable: true, value: Number.NaN, writable: true })
    Object.defineProperty(audio, 'buffered', { configurable: true, value: { length: 1, end: () => Number.NaN } })
    expect([context.currentTime, context.duration, context.buffered]).toEqual([0, 0, 0])
    context.destroy()
    context.volume = 1
    context.startTime = 9
    context.obeyMuteSwitch = true
    context.referrerPolicy = 'no-referrer'
    expect([context.volume, context.startTime, context.obeyMuteSwitch, context.referrerPolicy]).toEqual([0, 0, false, 'origin'])
  })

  it('retains fallback properties and empty buffered state when no DOM media host exists', () => {
    vi.stubGlobal('document', undefined)
    const context = createContext()
    context.autoplay = true
    context.loop = true
    context.volume = 3
    context.playbackRate = 0
    context.startTime = 5
    context.obeyMuteSwitch = false
    context.referrerPolicy = 'origin'
    expect([context.autoplay, context.loop, context.volume, context.playbackRate]).toEqual([true, true, 1, 0.5])
    expect([context.currentTime, context.buffered, context.startTime]).toEqual([0, 0, 5])
    expect([context.obeyMuteSwitch, context.referrerPolicy]).toEqual([false, 'origin'])
    context.destroy()
    context.src = '/ignored.wav'
    expect(context.src).toBe('')
  })
})

describe('audio subscriptions and error normalization', () => {
  it('continues after a failed callback and ignores emissions after destroy', () => {
    const events = createAudioEvents()
    const healthy = vi.fn()
    events.methods.offCanplay(healthy)
    const subscribe = events.methods.onCanplay as (callback: unknown) => void
    subscribe(null)
    events.methods.onCanplay(() => {
      throw new Error('listener failed')
    })
    events.methods.onCanplay(healthy)
    expect(() => events.emit('Canplay')).not.toThrow()
    expect(healthy).toHaveBeenCalledExactlyOnceWith()
    events.destroy()
    events.emit('Canplay')
    expect(healthy).toHaveBeenCalledOnce()
  })

  it.each([
    [undefined, undefined, -1, 'audio unavailable'],
    ['plain error', undefined, -1, 'plain error'],
    [{ name: 'NotSupportedError', message: 'format' }, undefined, 10004, 'format'],
    [{ message: 'host code' }, 99, -1, 'host code'],
    [{ message: 'aborted' }, 1, 10001, 'aborted'],
  ])('maps a media failure without assuming an Error instance: %j', (reason, code, errCode, message) => {
    expect(readAudioError(reason, code as number | undefined)).toEqual({ errCode, errMsg: `InnerAudioContext:fail ${message}` })
  })
})
