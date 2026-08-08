import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
  normalizeDuration,
  scheduleMicrotask,
} from '../src/runtime/polyfill/async'
import { createFileSystemManagerBridge } from '../src/runtime/polyfill/fileSystemManager'
import { loadFontFace } from '../src/runtime/polyfill/font'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('file system manager bridge contracts', () => {
  it('routes async writes and reads through success and validation failures', () => {
    const success = vi.fn()
    const failure = vi.fn()
    const manager = createFileSystemManagerBridge(success, failure)

    manager.writeFile()
    manager.readFile({ filePath: ' ' })
    expect(failure).toHaveBeenCalledWith(undefined, 'writeFile:fail invalid filePath')
    expect(failure).toHaveBeenCalledWith({ filePath: ' ' }, 'readFile:fail invalid filePath')

    const emptyWrite = { filePath: '/bridge-empty' }
    manager.writeFile(emptyWrite)
    expect(success).toHaveBeenCalledWith(emptyWrite, { errMsg: 'writeFile:ok' })

    const read = { filePath: '/bridge-empty', encoding: 'utf8' }
    manager.readFile(read)
    expect(success).toHaveBeenCalledWith(read, { errMsg: 'readFile:ok', data: '' })

    const missing = { filePath: '/bridge-missing' }
    manager.readFile(missing)
    expect(failure).toHaveBeenCalledWith(missing, expect.stringContaining('readFile:fail'))
  })

  it('supports sync operations and reports host-thrown write failures', () => {
    const success = vi.fn()
    const failure = vi.fn()
    const manager = createFileSystemManagerBridge(success, failure)
    manager.writeFileSync('/bridge-sync', new Uint8Array([65, 66]))
    expect([...new Uint8Array(manager.readFileSync('/bridge-sync') as ArrayBuffer)]).toEqual([65, 66])
    expect(manager.readFileSync('/bridge-sync', 'utf8')).toBe('AB')

    const throwingData = new Proxy({}, {
      get() {
        // eslint-disable-next-line no-throw-literal -- 覆盖宿主抛出非 Error 值的兼容路径
        throw 'host write failure'
      },
    }) as ArrayBufferView
    const options = { filePath: '/bridge-error', data: throwingData }
    manager.writeFile(options)
    expect(failure.mock.lastCall?.[0]).toBe(options)
    expect(failure.mock.lastCall?.[1]).toBe('writeFile:fail host write failure')
  })
})

describe('async callback and scheduling contracts', () => {
  it('forwards success, failure and completion callbacks', () => {
    const success = vi.fn()
    const fail = vi.fn()
    const complete = vi.fn()
    const successResult = { errMsg: 'demo:ok', value: 1 }
    expect(callMiniProgramAsyncSuccess({ success, complete }, successResult)).toBe(successResult)
    expect(success).toHaveBeenCalledWith(successResult)
    expect(complete).toHaveBeenCalledWith(successResult)

    expect(callMiniProgramAsyncFailure({ fail, complete }, 'demo:fail')).toEqual({ errMsg: 'demo:fail' })
    expect(fail).toHaveBeenCalledWith({ errMsg: 'demo:fail' })
    expect(complete).toHaveBeenCalledWith({ errMsg: 'demo:fail' })
    expect(callMiniProgramAsyncSuccess(undefined, successResult)).toBe(successResult)
    expect(callMiniProgramAsyncFailure(undefined, 'demo:fail')).toEqual({ errMsg: 'demo:fail' })
  })

  it('normalizes durations and schedules through native and Promise microtasks', async () => {
    expect(normalizeDuration(undefined, 10)).toBe(10)
    expect(normalizeDuration(Number.NaN, 10)).toBe(10)
    expect(normalizeDuration(-1, 10)).toBe(0)
    expect(normalizeDuration(5, 10)).toBe(5)

    const nativeTask = vi.fn()
    const queueMicrotask = vi.fn((task: () => void) => task())
    vi.stubGlobal('queueMicrotask', queueMicrotask)
    scheduleMicrotask(nativeTask)
    expect(queueMicrotask).toHaveBeenCalledWith(nativeTask)
    expect(nativeTask).toHaveBeenCalledOnce()

    vi.stubGlobal('queueMicrotask', undefined)
    const fallbackTask = vi.fn()
    scheduleMicrotask(fallbackTask)
    await Promise.resolve()
    expect(fallbackTask).toHaveBeenCalledOnce()

    let deferredThrow: (() => void) | undefined
    vi.stubGlobal('setTimeout', vi.fn((task: () => void) => {
      deferredThrow = task
      return 1
    }))
    scheduleMicrotask(() => {
      throw new Error('microtask failure')
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(deferredThrow).toBeTypeOf('function')
    expect(() => deferredThrow?.()).toThrow('microtask failure')
  })
})

describe('loadFontFace host capability contracts', () => {
  it('rejects invalid options before touching browser capabilities', async () => {
    const fail = vi.fn()
    const complete = vi.fn()
    await expect(loadFontFace({ family: ' ', source: 'url(font.woff2)', fail, complete }))
      .resolves
      .toEqual({ errMsg: 'loadFontFace:fail invalid options' })
    await expect(loadFontFace({ family: 'demo', source: ' ' })).resolves.toEqual({ errMsg: 'loadFontFace:fail invalid options' })
    expect(fail).toHaveBeenCalledWith({ errMsg: 'loadFontFace:fail invalid options' })
    expect(complete).toHaveBeenCalledWith({ errMsg: 'loadFontFace:fail invalid options' })
  })

  it('loads native FontFace instances and forwards descriptors and callbacks', async () => {
    const loadedFace = { family: 'demo' }
    const load = vi.fn(async () => loadedFace)
    const constructor = vi.fn()
    class FontFaceMock {
      load = load

      constructor(family: string, source: string, descriptors?: FontFaceDescriptors) {
        constructor(family, source, descriptors)
      }
    }
    const add = vi.fn()
    vi.stubGlobal('FontFace', FontFaceMock)
    vi.stubGlobal('document', { fonts: { add } })
    const success = vi.fn()
    const complete = vi.fn()
    const descriptors = { style: 'italic' as const }

    await expect(loadFontFace({
      family: ' demo ',
      source: ' url(font.woff2) ',
      descriptors,
      success,
      complete,
    })).resolves.toEqual({ errMsg: 'loadFontFace:ok' })
    expect(constructor).toHaveBeenCalledWith('demo', 'url(font.woff2)', descriptors)
    expect(add).toHaveBeenCalledWith(loadedFace)
    expect(success).toHaveBeenCalledWith({ errMsg: 'loadFontFace:ok' })
    expect(complete).toHaveBeenCalledWith({ errMsg: 'loadFontFace:ok' })
  })

  it('installs style fallbacks when native font loading is unavailable', async () => {
    const style = { dataset: {} as Record<string, string>, textContent: '' }
    const append = vi.fn()
    const createElement = vi.fn(() => style)
    vi.stubGlobal('FontFace', undefined)
    vi.stubGlobal('document', { createElement, head: { append } })

    await expect(loadFontFace({ family: 'fallback', source: 'url(fallback.woff2)' }))
      .resolves
      .toEqual({ errMsg: 'loadFontFace:ok' })
    expect(createElement).toHaveBeenCalledWith('style')
    expect(style.dataset.weappFontFamily).toBe('fallback')
    expect(style.textContent).toContain('font-family:"fallback"')
    expect(append).toHaveBeenCalledWith(style)

    vi.stubGlobal('FontFace', class {})
    vi.stubGlobal('document', { createElement, fonts: {}, head: { append } })
    await expect(loadFontFace({ family: 'missing-add', source: 'url(missing.woff2)' }))
      .resolves
      .toEqual({ errMsg: 'loadFontFace:ok' })
  })

  it('reports unavailable documents and native host failures', async () => {
    vi.stubGlobal('FontFace', undefined)
    vi.stubGlobal('document', undefined)
    await expect(loadFontFace({ family: 'missing-doc', source: 'url(font.woff2)' }))
      .resolves
      .toEqual({ errMsg: 'loadFontFace:fail document is unavailable' })

    class ThrowingFontFace {
      constructor() {
        // eslint-disable-next-line no-throw-literal -- 覆盖宿主抛出非 Error 值的兼容路径
        throw 'font host failure'
      }
    }
    vi.stubGlobal('FontFace', ThrowingFontFace)
    vi.stubGlobal('document', { fonts: { add: vi.fn() } })
    const fail = vi.fn()
    await expect(loadFontFace({ family: 'broken', source: 'url(font.woff2)', fail }))
      .resolves
      .toEqual({ errMsg: 'loadFontFace:fail font host failure' })
    expect(fail).toHaveBeenCalledWith({ errMsg: 'loadFontFace:fail font host failure' })
  })
})
