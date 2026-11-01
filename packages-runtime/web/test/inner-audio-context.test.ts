// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as polyfill from '../src/runtime/polyfill'
import { setRuntimeWarningOptions } from '../src/runtime/warning'

const runtime = { ...polyfill, setRuntimeWarningOptions }

let audio: HTMLAudioElement

beforeEach(() => {
  audio = document.createElement('audio')
  const createElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => tag === 'audio' ? audio : createElement(tag)) as typeof document.createElement)
  vi.spyOn(audio, 'load').mockImplementation(() => {})
  vi.spyOn(audio, 'play').mockImplementation(() => {
    Object.defineProperty(audio, 'paused', { configurable: true, value: false })
    queueMicrotask(() => audio.dispatchEvent(new Event('play')))
    return Promise.resolve()
  })
  vi.spyOn(audio, 'pause').mockImplementation(() => {
    const paused = audio.paused
    Object.defineProperty(audio, 'paused', { configurable: true, value: true })
    if (!paused) {
      queueMicrotask(() => audio.dispatchEvent(new Event('pause')))
    }
  })
  runtime.setRuntimeWarningOptions({ level: 'off' })
})

afterEach(() => {
  runtime.setRuntimeWarningOptions()
  vi.restoreAllMocks()
})

describe('issue #1250 InnerAudioContext media lifecycle', () => {
  it('maps playback state and properties to its audio element', async () => {
    const context = runtime.createInnerAudioContext()
    context.src = '/audio/notification.wav'
    context.autoplay = true
    context.loop = true
    context.volume = 0.4
    context.playbackRate = 1.5
    context.startTime = 2
    expect(audio.src).toContain('/audio/notification.wav')
    expect(audio.autoplay).toBe(true)
    expect(audio.loop).toBe(true)
    expect(audio.volume).toBe(0.4)
    expect(audio.playbackRate).toBe(1.5)
    Object.defineProperty(audio, 'duration', { configurable: true, value: 8 })
    Object.defineProperty(audio, 'readyState', { configurable: true, value: 1 })
    Object.defineProperty(audio, 'buffered', { configurable: true, value: { length: 1, end: () => 5 } })
    audio.dispatchEvent(new Event('loadedmetadata'))
    expect(context.currentTime).toBe(2)
    expect(context.duration).toBe(8)
    expect(context.buffered).toBe(5)
    context.play()
    await Promise.resolve()
    expect(context.paused).toBe(false)
    context.seek(4)
    expect(audio.currentTime).toBe(4)
    context.currentTime = 3
    expect(audio.currentTime).toBe(3)
    context.destroy()
  })

  it('delivers each subscription once and separates stop from asynchronous native pause', async () => {
    const context = runtime.createInnerAudioContext()
    const events: string[] = []
    const onPlay = () => events.push('play')
    context.onPlay(onPlay)
    context.onPlay(onPlay)
    context.onPause(() => events.push('pause'))
    context.onStop(() => events.push('stop'))
    context.play()
    await Promise.resolve()
    context.pause()
    context.pause()
    await Promise.resolve()
    context.play()
    await Promise.resolve()
    context.stop()
    await Promise.resolve()
    expect(events).toEqual(['play', 'pause', 'play', 'stop'])
    expect(context.currentTime).toBe(0)
    context.offPlay(onPlay)
    context.play()
    await Promise.resolve()
    expect(events).toEqual(['play', 'pause', 'play', 'stop'])
    context.destroy()
  })

  it('catches playback rejection as an audio error and stops notifying after off or destroy', async () => {
    const rejected = new DOMException('User activation required', 'NotAllowedError')
    vi.mocked(audio.play).mockRejectedValue(rejected)
    const context = runtime.createInnerAudioContext()
    const onError = vi.fn()
    const unhandled = vi.fn()
    window.addEventListener('unhandledrejection', unhandled)
    try {
      context.onError(onError)
      context.play()
      await Promise.resolve()
      await Promise.resolve()
      expect(onError).toHaveBeenCalledOnce()
      expect(onError.mock.calls[0]?.[0]).toMatchObject({ errCode: -1, errMsg: expect.stringContaining('User activation required') })
      context.offError(onError)
      context.play()
      await Promise.resolve()
      await Promise.resolve()
      expect(onError).toHaveBeenCalledOnce()
      context.onError(onError)
      context.play()
      context.destroy()
      context.destroy()
      await Promise.resolve()
      await Promise.resolve()
      expect(onError).toHaveBeenCalledOnce()
      expect(unhandled).not.toHaveBeenCalled()
      expect(audio.getAttribute('src')).toBeNull()
    }
    finally {
      window.removeEventListener('unhandledrejection', unhandled)
      context.destroy()
    }
  })

  it('exposes all native notifications and removes specific or all callbacks', () => {
    const context = runtime.createInnerAudioContext()
    const cases = [
      ['Canplay', 'canplay'],
      ['Ended', 'ended'],
      ['TimeUpdate', 'timeupdate'],
      ['Waiting', 'waiting'],
      ['Seeking', 'seeking'],
      ['Seeked', 'seeked'],
    ] as const
    for (const [suffix, event] of cases) {
      const listener = vi.fn()
      const other = vi.fn()
      context[`on${suffix}`](listener)
      context[`on${suffix}`](other)
      audio.dispatchEvent(new Event(event))
      expect(listener).toHaveBeenCalledOnce()
      context[`off${suffix}`](listener)
      audio.dispatchEvent(new Event(event))
      expect(listener).toHaveBeenCalledOnce()
      expect(other).toHaveBeenCalledTimes(2)
      context[`off${suffix}`]()
      audio.dispatchEvent(new Event(event))
      expect(other).toHaveBeenCalledTimes(2)
    }
    const onError = vi.fn()
    context.onError(onError)
    Object.defineProperty(audio, 'error', { configurable: true, value: { code: 4, message: 'unsupported source' } })
    audio.dispatchEvent(new Event('error'))
    expect(onError.mock.calls[0]?.[0]).toMatchObject({ errCode: 10004 })
    context.destroy()
    audio.dispatchEvent(new Event('error'))
    expect(onError).toHaveBeenCalledOnce()
  })

  it('ignores a stopped playback pause event after an onStop callback starts fresh playback', async () => {
    const context = runtime.createInnerAudioContext()
    const events: string[] = []
    context.onPlay(() => events.push('play'))
    context.onPause(() => events.push('pause'))
    context.onStop(() => {
      events.push('stop')
      context.play()
    })
    context.play()
    await Promise.resolve()
    context.stop()
    await Promise.resolve()
    expect(events).toEqual(['play', 'stop', 'play'])
    expect(context.paused).toBe(false)
    context.destroy()
  })

  it('ends notification delivery immediately when a listener destroys its context', () => {
    const context = runtime.createInnerAudioContext()
    const late = vi.fn()
    context.onCanplay(() => context.destroy())
    context.onCanplay(late)
    audio.dispatchEvent(new Event('canplay'))
    context.onCanplay(late)
    audio.dispatchEvent(new Event('canplay'))
    expect(late).not.toHaveBeenCalled()
  })

  it('allows a fresh play notification after a previous playback failed', async () => {
    const context = runtime.createInnerAudioContext()
    const play = vi.fn()
    context.onPlay(play)
    context.play()
    await Promise.resolve()
    Object.defineProperty(audio, 'paused', { configurable: true, value: true })
    Object.defineProperty(audio, 'error', { configurable: true, value: { code: 2, message: 'network interrupted' } })
    audio.dispatchEvent(new Event('error'))
    context.play()
    await Promise.resolve()
    expect(play).toHaveBeenCalledTimes(2)
    context.destroy()
  })

  it('provides a complete inert context without DOM and reports unavailable playback through onError', () => {
    vi.stubGlobal('document', undefined)
    try {
      const context = runtime.createInnerAudioContext()
      const error = vi.fn()
      context.src = '/sample.wav'
      context.onError(error)
      expect(context.src).toBe('/sample.wav')
      expect(context.paused).toBe(true)
      expect(context.duration).toBe(0)
      expect(context.buffered).toBe(0)
      expect(context.play()).toBeUndefined()
      expect(error.mock.calls[0]?.[0]).toMatchObject({ errCode: -1 })
      context.pause()
      context.stop()
      context.seek(2)
      context.destroy()
      context.onError(error)
      context.play()
      expect(error).toHaveBeenCalledOnce()
      expect(context.src).toBe('')
    }
    finally {
      vi.unstubAllGlobals()
    }
  })
})
