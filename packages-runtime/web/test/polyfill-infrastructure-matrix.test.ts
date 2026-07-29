import { WEAPP_VITE_WEB_REQUEST_SUBSCRIBE_MESSAGE_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetWebRuntimeHost, setWebRuntimeHost } from '../src/runtime/host'
import {
  registerNativeMediaElement,
  unregisterNativeMediaElement,
} from '../src/runtime/nativeComponents/mediaRegistry'
import { $emit, $off, $on, $once } from '../src/runtime/polyfill/eventBus'
import { getLocale } from '../src/runtime/polyfill/locale'
import {
  clearStorageSyncInternal,
  getStorageInfoSyncInternal,
  getStorageSyncInternal,
  hasStorageKey,
  normalizeStorageKey,
  removeStorageSyncInternal,
  setStorageSyncInternal,
} from '../src/runtime/polyfill/storage'
import {
  clearStorageBridge,
  getStorageBridge,
  getStorageInfoBridge,
  removeStorageBridge,
  setStorageBridge,
} from '../src/runtime/polyfill/storageAsync'
import {
  normalizeSubscribeDecision,
  normalizeSubscribeTemplateIds,
  resolveSubscribeDecisionMap,
} from '../src/runtime/polyfill/subscribe'
import { createVideoContextBridge } from '../src/runtime/polyfill/videoContext'
import { createVkSessionBridge } from '../src/runtime/polyfill/vkSession'
import { createWorkerBridge } from '../src/runtime/polyfill/worker'

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    get length() {
      return values.size
    },
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => [...values.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    values,
  }
}

describe('web polyfill infrastructure matrix', () => {
  class HostFailure {
    toString() {
      return 'blocked'
    }
  }

  afterEach(() => {
    clearStorageSyncInternal()
    resetWebRuntimeHost()
    $off()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (globalThis as Record<string, unknown>)[WEAPP_VITE_WEB_REQUEST_SUBSCRIBE_MESSAGE_KEY]
  })

  it('stores undefined, JSON, malformed and memory-only values', () => {
    const storage = createStorage({
      'unrelated': 'keep',
      '__weapp_vite_web_storage__:legacy': '{"type":"json","value":2}',
      '__weapp_vite_web_storage__:undefined': '{"type":"undefined"}',
      '__weapp_vite_web_storage__:raw': '{bad',
      '__weapp_vite_web_storage__:object': '{"other":true}',
    })
    setWebRuntimeHost({ storage: storage as any })
    expect(normalizeStorageKey(1)).toBe('')
    expect(normalizeStorageKey(' key ')).toBe('key')
    expect(hasStorageKey('legacy')).toBe(true)
    expect(hasStorageKey('missing')).toBe(false)
    expect(getStorageSyncInternal('legacy')).toBe(2)
    expect(getStorageSyncInternal('undefined')).toBeUndefined()
    expect(getStorageSyncInternal('raw')).toBe('{bad')
    expect(getStorageSyncInternal('object')).toEqual({ other: true })

    setStorageSyncInternal('value', { ready: true })
    setStorageSyncInternal('void', undefined)
    expect(getStorageSyncInternal('value')).toEqual({ ready: true })
    expect(hasStorageKey('void')).toBe(true)
    removeStorageSyncInternal('value')
    expect(hasStorageKey('value')).toBe(false)
    const info = getStorageInfoSyncInternal()
    expect(info.keys).toEqual(expect.arrayContaining(['legacy', 'undefined', 'raw', 'object', 'void']))
    expect(info.currentSize).toBeGreaterThan(0)
    expect(info.limitSize).toBe(10240)

    clearStorageSyncInternal()
    expect(storage.values.has('unrelated')).toBe(true)
    expect([...storage.values.keys()].some(key => key.startsWith('__weapp_vite_web_storage__:'))).toBe(false)

    setWebRuntimeHost({ storage: {} as any })
    setStorageSyncInternal('memory', 1)
    expect(getStorageSyncInternal('memory')).toBe(1)
    expect(getStorageSyncInternal('missing')).toBe('')
    expect(hasStorageKey('missing')).toBe(false)
    clearStorageSyncInternal()
  })

  it('runs async storage callbacks and failures', async () => {
    const success = vi.fn()
    const fail = vi.fn()
    const complete = vi.fn()
    const storage = createStorage()
    setWebRuntimeHost({ storage: storage as any })
    await expect(setStorageBridge({ key: ' key ', data: 1, success, complete })).resolves.toEqual({ errMsg: 'setStorage:ok' })
    await expect(getStorageBridge({ key: 'key', success, complete })).resolves.toEqual({ errMsg: 'getStorage:ok', data: 1 })
    await expect(getStorageInfoBridge({ success, complete })).resolves.toMatchObject({ errMsg: 'getStorageInfo:ok', keys: ['key'] })
    await expect(removeStorageBridge({ key: 'key', success, complete })).resolves.toEqual({ errMsg: 'removeStorage:ok' })
    await expect(clearStorageBridge({ success, complete })).resolves.toEqual({ errMsg: 'clearStorage:ok' })
    expect(success).toHaveBeenCalledTimes(5)
    expect(complete).toHaveBeenCalledTimes(5)

    await expect(setStorageBridge({ key: '', fail, complete })).rejects.toMatchObject({ errMsg: 'setStorage:fail invalid key' })
    await expect(getStorageBridge({ key: 'missing', fail, complete })).rejects.toMatchObject({ errMsg: expect.stringContaining('data not found') })
    await expect(getStorageBridge({ key: '', fail, complete })).rejects.toMatchObject({ errMsg: 'getStorage:fail invalid key' })
    await expect(removeStorageBridge({ key: '', fail, complete })).rejects.toMatchObject({ errMsg: 'removeStorage:fail invalid key' })

    const throwing = createStorage()
    throwing.setItem.mockImplementation(() => {
      throw new Error('quota')
    })
    setWebRuntimeHost({ storage: throwing as any })
    await expect(setStorageBridge({ key: 'key', data: 1, fail })).rejects.toMatchObject({ errMsg: 'setStorage:fail quota' })
    throwing.removeItem.mockImplementation(() => {
      throw new HostFailure()
    })
    await expect(removeStorageBridge({ key: 'key', fail })).rejects.toMatchObject({ errMsg: 'removeStorage:fail blocked' })
    expect(fail).toHaveBeenCalledTimes(6)
  })

  it('supports event bus on, once, selective off and global off', () => {
    const regular = vi.fn()
    const once = vi.fn()
    $on('event', regular)
    $on(1 as any, regular)
    $on('event', undefined as any)
    $once('event', once)
    $once(1 as any, once)
    $once('event', undefined as any)
    $emit('missing')
    $emit('event', 1)
    $emit('event', 2)
    expect(regular).toHaveBeenCalledTimes(2)
    expect(once).toHaveBeenCalledTimes(1)
    $off('event', regular)
    $off('event', regular)
    $off(1 as any)
    $on('delete', regular)
    $off('delete')
    $on('clear', regular)
    $off()
    $emit('clear')
    expect(regular).toHaveBeenCalledTimes(2)
  })

  it('normalizes locale and subscription host decisions', () => {
    for (const [language, expected] of [
      ['zh_CN', 'zh-Hans'],
      ['zh-TW', 'zh-Hant'],
      ['zh-HK', 'zh-Hant'],
      ['zh-MO', 'zh-Hant'],
      ['zh-Hant-TW', 'zh-Hant'],
      ['en-US', 'en'],
      ['', 'en'],
    ]) {
      vi.stubGlobal('navigator', { language })
      expect(getLocale()).toBe(expected)
    }
    vi.stubGlobal('navigator', undefined)
    expect(getLocale()).toBe('en')

    for (const decision of ['accept', 'reject', 'ban', 'filter'] as const) {
      expect(normalizeSubscribeDecision(decision)).toBe(decision)
    }
    expect(normalizeSubscribeDecision('other')).toBe('accept')
    expect(normalizeSubscribeTemplateIds(undefined)).toEqual([])
    expect(normalizeSubscribeTemplateIds([' a ', '', 1, 'b'])).toEqual(['a', 'b'])
    const runtime = globalThis as Record<string, unknown>
    runtime[WEAPP_VITE_WEB_REQUEST_SUBSCRIBE_MESSAGE_KEY] = 'reject'
    expect(resolveSubscribeDecisionMap(['a', 'b'])).toEqual({ a: 'reject', b: 'reject' })
    runtime[WEAPP_VITE_WEB_REQUEST_SUBSCRIBE_MESSAGE_KEY] = { a: 'ban', b: 'invalid' }
    expect(resolveSubscribeDecisionMap(['a', 'b'])).toEqual({ a: 'ban', b: 'accept' })
    runtime[WEAPP_VITE_WEB_REQUEST_SUBSCRIBE_MESSAGE_KEY] = (ids: string[]) => ({ [ids[0]!]: 'filter' })
    expect(resolveSubscribeDecisionMap(['a'])).toEqual({ a: 'filter' })
  })

  it('bridges Worker event listeners and legacy callback properties', () => {
    const eventInstances: EventWorker[] = []
    class EventWorker {
      listeners = new Map<string, (event: any) => void>()
      postMessage = vi.fn()
      terminate = vi.fn()
      constructor(public path: string) {
        eventInstances.push(this)
      }

      addEventListener(name: string, listener: (event: any) => void) {
        this.listeners.set(name, listener)
      }
    }
    vi.stubGlobal('location', { href: 'https://example.com/app/' })
    vi.stubGlobal('Worker', EventWorker)
    const worker = createWorkerBridge('./worker.js')
    const native = worker as any
    const message = vi.fn()
    const error = vi.fn()
    worker.onMessage(message)
    worker.onMessage(undefined as any)
    worker.onError(error)
    worker.onError(undefined as any)
    const eventInstance = eventInstances[0]!
    eventInstance.listeners.get('message')?.({ data: 1 })
    eventInstance.listeners.get('error')?.({ message: 'failed' })
    expect(message).toHaveBeenCalledWith({ data: 1 })
    expect(error).toHaveBeenCalledWith({ message: 'failed', filename: undefined, lineno: undefined, colno: undefined })
    worker.postMessage({ ready: true })
    expect(eventInstance.postMessage).toHaveBeenCalledWith({ ready: true })
    worker.offMessage(message)
    worker.offMessage()
    worker.offError(error)
    worker.offError()
    worker.terminate()
    expect(eventInstance.terminate).toHaveBeenCalled()
    expect(native).toBeDefined()

    const legacyInstances: LegacyWorker[] = []
    class LegacyWorker {
      onmessage?: (event: any) => void
      onerror?: (event: any) => void
      postMessage = vi.fn()
      terminate = vi.fn()
      constructor(_path: string) {
        legacyInstances.push(this)
      }
    }
    vi.stubGlobal('Worker', LegacyWorker)
    const legacy = createWorkerBridge('/worker.js')
    const legacyMessage = vi.fn()
    const legacyError = vi.fn()
    const legacyInstance = legacyInstances[0]!
    legacy.onMessage(legacyMessage)
    legacy.onError(legacyError)
    legacyInstance.onmessage!({ data: 2 })
    legacyInstance.onerror!({ message: undefined, filename: 'worker.js', lineno: 1, colno: 2 })
    expect(legacyMessage).toHaveBeenCalledWith({ data: 2 })
    expect(legacyError).toHaveBeenCalledWith({ message: 'unknown error', filename: 'worker.js', lineno: 1, colno: 2 })
  })

  it('reports worker construction and path failures', () => {
    vi.stubGlobal('Worker', undefined)
    expect(() => createWorkerBridge('worker.js')).toThrow('Worker is unavailable')
    vi.stubGlobal('Worker', class {
      constructor() {
        throw new Error('blocked')
      }
    })
    expect(() => createWorkerBridge('worker.js')).toThrow('createWorker:fail blocked')
    expect(() => createWorkerBridge('')).toThrow('invalid scriptPath')
    vi.stubGlobal('location', {
      get href() {
        throw new Error('blocked')
      },
    })
    let path = ''
    vi.stubGlobal('Worker', class {
      constructor(value: string) {
        path = value
      }
    })
    createWorkerBridge('./raw.js')
    expect(path).toBe('./raw.js')
  })

  it('controls video elements and handles unsupported mutations', () => {
    const play = vi.fn()
    const pause = vi.fn()
    const requestFullscreen = vi.fn()
    const exitFullscreen = vi.fn()
    const video: any = { play, pause, requestFullscreen, currentTime: 3, playbackRate: 1 }
    vi.stubGlobal('document', {
      exitFullscreen,
      getElementById: (id: string) => id === 'video' ? video : null,
      querySelector: vi.fn(() => null),
    })
    const context = createVideoContextBridge('video')
    context.play()
    context.pause()
    context.stop()
    context.seek(-2)
    context.seek(Number.NaN)
    context.playbackRate(2)
    context.playbackRate(0)
    context.requestFullScreen()
    context.exitFullScreen()
    expect(play).toHaveBeenCalled()
    expect(pause).toHaveBeenCalledTimes(2)
    expect(video.currentTime).toBe(0)
    expect(video.playbackRate).toBe(2)
    expect(requestFullscreen).toHaveBeenCalled()
    expect(exitFullscreen).toHaveBeenCalled()

    vi.stubGlobal('document', undefined)
    const missing = createVideoContextBridge('')
    expect(() => missing.stop()).not.toThrow()
    expect(() => missing.seek(1)).not.toThrow()
    expect(() => missing.playbackRate(1)).not.toThrow()
  })

  it('resolves video contexts through normalized ids and selector fallbacks', () => {
    const queriedVideo = {
      pause: vi.fn(),
      play: vi.fn(),
    }
    const querySelector = vi.fn(() => queriedVideo)
    const escape = vi.fn(() => 'escaped-id')
    vi.stubGlobal('CSS', { escape })
    vi.stubGlobal('document', {
      exitFullscreen: undefined,
      getElementById: vi.fn(() => ({ nodeName: 'DIV' })),
      querySelector,
    })

    const queried = createVideoContextBridge('  video:id  ')
    queried.play()
    queried.pause()
    expect(escape).toHaveBeenCalledWith('video:id')
    expect(querySelector).toHaveBeenCalledWith('video#escaped-id')

    vi.stubGlobal('CSS', undefined)
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => null),
      querySelector: vi.fn(() => ({ nodeName: 'DIV' })),
    })
    const unresolved = createVideoContextBridge('video"id')
    unresolved.play()
    unresolved.pause()
    unresolved.requestFullScreen()
    unresolved.exitFullScreen()

    const blank = createVideoContextBridge('   ')
    blank.stop()
    createVideoContextBridge(null as any).pause()

    const registeredVideo = { pause: vi.fn(), play: vi.fn() } as unknown as HTMLVideoElement
    registerNativeMediaElement('video', ['registered'], registeredVideo)
    createVideoContextBridge('registered').play()
    expect(registeredVideo.play).toHaveBeenCalledOnce()
    unregisterNativeMediaElement(registeredVideo)
  })

  it('enforces VK session lifecycle and listener cleanup', async () => {
    const session = createVkSessionBridge()
    const callback = vi.fn()
    const retainedCallback = vi.fn()
    session.on('event', callback)
    session.on('event', retainedCallback)
    session.on('', callback)
    session.on(1 as any, callback)
    session.on('event', undefined as any)
    session.off('missing', callback)
    session.off('event', callback)
    session.off('event', retainedCallback)
    session.on('event', callback)
    session.off('event')
    session.on('event', callback)
    session.off()
    await expect(session.start()).resolves.toEqual({ errMsg: 'vkSession.start:ok' })
    await expect(session.stop()).resolves.toEqual({ errMsg: 'vkSession.stop:ok' })
    session.destroy()
    await expect(session.start()).rejects.toThrow('session is destroyed')
    await expect(session.stop()).rejects.toThrow('session is destroyed')
  })
})
