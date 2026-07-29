import {
  WEAPP_VITE_WEB_COMPRESS_VIDEO_KEY,
  WEAPP_VITE_WEB_VIDEO_INFO_KEY,
} from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createInterstitialAdImpl,
  createRewardedVideoAdImpl,
} from '../src/runtime/polyfill/ad'
import {
  normalizeChooseFileExtensions,
  normalizeChooseMessageFile,
  normalizeChooseMessageFileCount,
  normalizeChooseMessageFileType,
  pickChooseFileFiles,
  pickChooseMessageFiles,
} from '../src/runtime/polyfill/filePicker'
import {
  inferImageTypeFromPath,
  inferVideoTypeFromPath,
  normalizeVideoInfoNumber,
  readImageInfoFromSource,
  readPresetCompressVideo,
  readPresetVideoInfo,
  readVideoInfoFromSource,
} from '../src/runtime/polyfill/mediaInfo'
import {
  createTempFilePath,
  inferChooseMediaFileType,
  normalizeChooseImageCount,
  normalizeChooseImageFile,
  normalizeChooseMediaCount,
  normalizeChooseMediaFile,
  normalizeChooseMediaTypes,
  pickChooseImageFiles,
  pickChooseMediaFiles,
} from '../src/runtime/polyfill/mediaPicker'

interface FakeInputOptions {
  files?: unknown[]
  hasClick?: boolean
}

function installInputDocument(options: FakeInputOptions) {
  const attributes: Record<string, string> = {}
  let change: (() => void) | undefined
  const parent = { removeChild: vi.fn() }
  const input: Record<string, any> = {
    files: options.files,
    parentNode: parent,
    setAttribute(name: string, value: string) {
      attributes[name] = value
    },
    addEventListener(name: string, callback: () => void) {
      if (name === 'change') {
        change = callback
      }
    },
  }
  if (options.hasClick !== false) {
    input.click = () => change?.()
  }
  const body = { append: vi.fn() }
  vi.stubGlobal('document', {
    body,
    createElement: vi.fn(() => input),
  })
  return { attributes, body, input, parent }
}

function createOpenPickerFiles(files: unknown[]) {
  const showOpenFilePicker = vi.fn(async () => [
    { getFile: async () => files[0] },
    {},
    { getFile: async () => undefined },
    ...files.slice(1).map(file => ({ getFile: async () => file })),
  ])
  vi.stubGlobal('showOpenFilePicker', showOpenFilePicker)
  return showOpenFilePicker
}

describe('web polyfill host capability matrix', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    delete (globalThis as Record<string, unknown>)[WEAPP_VITE_WEB_VIDEO_INFO_KEY]
    delete (globalThis as Record<string, unknown>)[WEAPP_VITE_WEB_COMPRESS_VIDEO_KEY]
  })

  it('normalizes image and media picker arguments and files', () => {
    expect(normalizeChooseImageCount(undefined)).toBe(9)
    expect(normalizeChooseImageCount(Number.NaN)).toBe(9)
    expect(normalizeChooseImageCount(0)).toBe(1)
    expect(normalizeChooseImageCount(2.9)).toBe(2)
    expect(normalizeChooseMediaCount(undefined)).toBe(1)
    expect(normalizeChooseMediaCount(Number.NaN)).toBe(1)
    expect(normalizeChooseMediaCount(3.8)).toBe(3)

    expect([...normalizeChooseMediaTypes(undefined)]).toEqual(['image', 'video'])
    expect([...normalizeChooseMediaTypes(['image', 'image'])]).toEqual(['image'])
    expect([...normalizeChooseMediaTypes(['video'])]).toEqual(['video'])
    expect([...normalizeChooseMediaTypes(['mix'])]).toEqual(['image', 'video'])
    expect(inferChooseMediaFileType({ type: 'VIDEO/MP4' })).toBe('video')
    expect(inferChooseMediaFileType({ type: 'image/png' })).toBe('image')
    expect(inferChooseMediaFileType({ name: 'clip.MOV' })).toBe('video')
    expect(inferChooseMediaFileType({ name: 'unknown.bin' })).toBe('image')

    const createObjectURL = vi.fn(() => 'blob:file')
    vi.stubGlobal('URL', { createObjectURL })
    expect(createTempFilePath({ name: 'photo.png' })).toBe('blob:file')
    expect(normalizeChooseImageFile({ name: 'photo.png', size: 12, type: 'image/png' })).toEqual({
      path: 'blob:file',
      size: 12,
      type: 'image/png',
      name: 'photo.png',
    })
    expect(normalizeChooseMediaFile({ name: 'clip.mp4' })).toEqual({
      tempFilePath: 'blob:file',
      size: 0,
      fileType: 'video',
      width: 0,
      height: 0,
      duration: 0,
    })
    vi.stubGlobal('URL', { createObjectURL: () => '' })
    expect(createTempFilePath({ name: 'fallback.png' })).toBe('fallback.png')
    vi.stubGlobal('URL', undefined)
    expect(createTempFilePath({})).toBe('')
  })

  it('picks image and media files through the open picker', async () => {
    const image = { name: 'one.png' }
    const video = { name: 'two.mp4' }
    let picker = createOpenPickerFiles([image, video])
    await expect(pickChooseImageFiles(1)).resolves.toEqual([image])
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ multiple: false }))

    picker = createOpenPickerFiles([image, video])
    await expect(pickChooseMediaFiles(2, normalizeChooseMediaTypes(['mix']))).resolves.toEqual([image, video])
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({
      multiple: true,
      types: [expect.objectContaining({ accept: expect.objectContaining({ 'image/*': expect.any(Array), 'video/*': expect.any(Array) }) })],
    }))

    picker = createOpenPickerFiles([])
    await expect(pickChooseMediaFiles(1, normalizeChooseMediaTypes(['video']))).resolves.toEqual([])
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({
      types: [expect.objectContaining({ accept: { 'video/*': expect.any(Array) } })],
    }))
  })

  it('falls back to file inputs for image and media selection', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined)
    const first = installInputDocument({ files: [{ name: 'a.png' }, { name: 'b.png' }] })
    await expect(pickChooseImageFiles(1)).resolves.toEqual([{ name: 'a.png' }])
    expect(first.attributes).toMatchObject({ accept: 'image/*', type: 'file' })
    expect(first.attributes.multiple).toBeUndefined()
    expect(first.body.append).toHaveBeenCalledWith(first.input)
    expect(first.parent.removeChild).toHaveBeenCalledWith(first.input)

    const second = installInputDocument({ files: [{ name: 'a.mp4' }] })
    await expect(pickChooseMediaFiles(2, normalizeChooseMediaTypes(['video']))).resolves.toEqual([{ name: 'a.mp4' }])
    expect(second.attributes).toMatchObject({ accept: 'video/*', multiple: 'true' })

    const mixed = installInputDocument({ files: [{ name: 'a.png' }] })
    await expect(pickChooseMediaFiles(1, normalizeChooseMediaTypes(['mix']))).resolves.toHaveLength(1)
    expect(mixed.attributes.accept).toBe('image/*,video/*')
  })

  it('reports unavailable and cancelled image and media input paths', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined)
    vi.stubGlobal('document', undefined)
    await expect(pickChooseImageFiles(1)).rejects.toThrow('Image picker is unavailable')
    await expect(pickChooseMediaFiles(1, normalizeChooseMediaTypes(undefined))).rejects.toThrow('Media picker is unavailable')

    installInputDocument({ files: [] })
    await expect(pickChooseImageFiles(1)).rejects.toThrow('no file selected')
    installInputDocument({ files: [], hasClick: false })
    await expect(pickChooseMediaFiles(1, normalizeChooseMediaTypes(['image']))).rejects.toThrow('file input click is unavailable')
  })

  it('normalizes and picks message and extension-filtered files', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1234)
    expect(normalizeChooseMessageFileCount(undefined)).toBe(1)
    expect(normalizeChooseMessageFileCount(Number.NaN)).toBe(1)
    expect(normalizeChooseMessageFileCount(0)).toBe(1)
    expect(normalizeChooseMessageFileCount(2.5)).toBe(2)
    for (const type of ['video', 'image', 'file', 'all'] as const) {
      expect(normalizeChooseMessageFileType(type)).toBe(type)
    }
    expect(normalizeChooseMessageFileType('other')).toBe('all')
    expect(normalizeChooseFileExtensions([' JPG ', '.png', '', '.PNG', 1 as any])).toEqual(['.jpg', '.png'])

    vi.stubGlobal('URL', undefined)
    expect(normalizeChooseMessageFile({ name: 'doc.txt' })).toEqual({
      path: 'doc.txt',
      size: 0,
      type: '',
      name: 'doc.txt',
      time: 1234,
    })
    expect(normalizeChooseMessageFile({ name: 'doc.txt', size: 4, type: 'text/plain', lastModified: 5 }).time).toBe(5)

    const file = { name: 'doc.txt' }
    let picker = createOpenPickerFiles([file])
    await expect(pickChooseMessageFiles(2, 'image')).resolves.toEqual([file])
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({
      multiple: true,
      types: [expect.objectContaining({ accept: { 'image/*': [] } })],
    }))
    picker = createOpenPickerFiles([file])
    await expect(pickChooseFileFiles(1, 'file', ['.txt'])).resolves.toEqual([file])
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({
      types: [expect.objectContaining({ accept: { '*/*': ['.txt'] } })],
    }))
  })

  it('uses message and generic file input fallbacks and failure paths', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined)
    let input = installInputDocument({ files: [{ name: 'clip.mp4' }] })
    await expect(pickChooseMessageFiles(1, 'video')).resolves.toHaveLength(1)
    expect(input.attributes.accept).toBe('video/*')

    input = installInputDocument({ files: [{ name: 'image.png' }] })
    await expect(pickChooseFileFiles(2, 'image', ['.png', '.jpg'])).resolves.toHaveLength(1)
    expect(input.attributes).toMatchObject({ accept: '.png,.jpg', multiple: 'true' })

    input = installInputDocument({ files: [{ name: 'other.bin' }] })
    await expect(pickChooseFileFiles(1, 'all', [])).resolves.toHaveLength(1)
    expect(input.attributes.accept).toBe('*/*')

    vi.stubGlobal('document', undefined)
    await expect(pickChooseMessageFiles(1, 'all')).rejects.toThrow('Message file picker is unavailable')
    await expect(pickChooseFileFiles(1, 'all', [])).rejects.toThrow('File picker is unavailable')

    installInputDocument({ files: [] })
    await expect(pickChooseMessageFiles(1, 'all')).rejects.toThrow('no file selected')
    installInputDocument({ files: [], hasClick: false })
    await expect(pickChooseFileFiles(1, 'all', [])).rejects.toThrow('file input click is unavailable')
  })

  it('infers image and video metadata and reads presets', () => {
    for (const [path, type] of [
      ['a.png', 'png'],
      ['a.jpg', 'jpg'],
      ['a.jpeg', 'jpg'],
      ['a.gif', 'gif'],
      ['a.webp', 'webp'],
      ['a.bmp', 'bmp'],
      ['a.svg', 'svg'],
      ['a.avif', 'avif'],
      ['a.bin', 'unknown'],
    ]) {
      expect(inferImageTypeFromPath(path)).toBe(type)
    }
    for (const [path, type] of [
      ['a.mp4', 'mp4'],
      ['a.mov', 'mov'],
      ['a.m4v', 'm4v'],
      ['a.webm', 'webm'],
      ['a.avi', 'avi'],
      ['a.mkv', 'mkv'],
      ['a.bin', 'unknown'],
    ]) {
      expect(inferVideoTypeFromPath(path)).toBe(type)
    }
    expect(normalizeVideoInfoNumber(undefined)).toBe(0)
    expect(normalizeVideoInfoNumber(Number.NaN)).toBe(0)
    expect(normalizeVideoInfoNumber(-1)).toBe(0)
    expect(normalizeVideoInfoNumber(2)).toBe(2)

    const runtime = globalThis as Record<string, unknown>
    runtime[WEAPP_VITE_WEB_VIDEO_INFO_KEY] = (src: string) => ({ duration: 2, type: src.endsWith('.mp4') ? 'custom' : undefined })
    expect(readPresetVideoInfo('video.mp4')).toMatchObject({ duration: 2, type: 'custom', orientation: 'up' })
    runtime[WEAPP_VITE_WEB_VIDEO_INFO_KEY] = { 'video.mp4': { width: 320 }, 'type': 'fallback' }
    expect(readPresetVideoInfo('video.mp4')).toMatchObject({ width: 320, type: 'mp4' })
    expect(readPresetVideoInfo('other.mov')).toMatchObject({ type: 'fallback' })
    runtime[WEAPP_VITE_WEB_VIDEO_INFO_KEY] = () => null
    expect(readPresetVideoInfo('video.mp4')).toBeNull()

    runtime[WEAPP_VITE_WEB_COMPRESS_VIDEO_KEY] = (src: string) => ({ tempFilePath: `compressed:${src}`, size: 4 })
    expect(readPresetCompressVideo('video.mp4')).toMatchObject({ tempFilePath: 'compressed:video.mp4', size: 4 })
    runtime[WEAPP_VITE_WEB_COMPRESS_VIDEO_KEY] = { 'video.mp4': { duration: 3 }, 'tempFilePath': 'fallback.mp4' }
    expect(readPresetCompressVideo('video.mp4')).toMatchObject({ tempFilePath: 'video.mp4', duration: 3 })
    expect(readPresetCompressVideo('other.mp4')).toMatchObject({ tempFilePath: 'fallback.mp4' })
    runtime[WEAPP_VITE_WEB_COMPRESS_VIDEO_KEY] = ' compressed.mp4 '
    expect(readPresetCompressVideo('video.mp4')).toMatchObject({ tempFilePath: 'compressed.mp4', size: 0 })
    runtime[WEAPP_VITE_WEB_COMPRESS_VIDEO_KEY] = () => null
    expect(readPresetCompressVideo('video.mp4')).toBeNull()
  })

  it('reads image and video metadata through DOM host constructors', async () => {
    class SuccessfulImage {
      #src = ''
      width = 100
      height = 50
      naturalWidth = 320
      naturalHeight = 180
      onload?: () => void
      onerror?: () => void
      get src() {
        return this.#src
      }

      set src(_value: string) {
        this.#src = _value
        this.onload?.()
      }
    }
    vi.stubGlobal('Image', SuccessfulImage)
    await expect(readImageInfoFromSource('/image.png')).resolves.toEqual({ width: 320, height: 180 })
    class FailedImage extends SuccessfulImage {
      override get src() {
        return super.src
      }

      set src(_value: string) {
        this.onerror?.()
      }
    }
    vi.stubGlobal('Image', FailedImage)
    await expect(readImageInfoFromSource('/image.png')).rejects.toThrow('image load error')
    class MissingSizeImage {
      height = Number.NaN
      width = Number.NaN
      onload?: () => void
      get src() {
        return ''
      }

      set src(_value: string) {
        this.onload?.()
      }
    }
    vi.stubGlobal('Image', MissingSizeImage)
    await expect(readImageInfoFromSource('/missing-size.png')).resolves.toEqual({ width: 0, height: 0 })
    vi.stubGlobal('Image', undefined)
    await expect(readImageInfoFromSource('/image.png')).rejects.toThrow('Image is unavailable')

    const listeners = new Map<string, () => void>()
    const video = {
      duration: 5,
      videoWidth: 640,
      videoHeight: 360,
      addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
      removeEventListener: vi.fn(),
      load: () => listeners.get('loadedmetadata')?.(),
      src: '',
    }
    vi.stubGlobal('document', { createElement: () => video })
    await expect(readVideoInfoFromSource('/video.mp4')).resolves.toEqual({ duration: 5, width: 640, height: 360 })
    expect(video.removeEventListener).toHaveBeenCalledTimes(2)

    video.load = () => listeners.get('error')?.()
    await expect(readVideoInfoFromSource('/bad.mp4')).rejects.toThrow('video load error')
    const noCleanupVideo = {
      duration: 0,
      videoWidth: 0,
      videoHeight: 0,
      addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
      load: () => listeners.get('loadedmetadata')?.(),
      src: '',
    }
    vi.stubGlobal('document', { createElement: () => noCleanupVideo })
    await expect(readVideoInfoFromSource('/no-cleanup.mp4')).resolves.toEqual({ duration: 0, width: 0, height: 0 })
    vi.stubGlobal('document', undefined)
    await expect(readVideoInfoFromSource('/video.mp4')).rejects.toThrow('video element is unavailable')
  })

  it('implements rewarded and interstitial ad lifecycle contracts', async () => {
    for (const createAd of [createRewardedVideoAdImpl, createInterstitialAdImpl]) {
      const invalid = createAd()
      const invalidError = vi.fn()
      invalid.onLoad(null as any)
      invalid.onError(null as any)
      invalid.onClose(null as any)
      invalid.onError(invalidError)
      await expect(invalid.load()).rejects.toMatchObject({ errCode: -1 })
      expect(invalidError).toHaveBeenCalledTimes(1)
      invalid.offError(invalidError)
      invalid.offError()

      const ad = createAd({ adUnitId: ' ad-unit ' })
      const load = vi.fn()
      const close = vi.fn()
      const error = vi.fn()
      ad.onLoad(load)
      ad.onClose(close as any)
      ad.onError(error)
      await expect(ad.show()).resolves.toMatchObject({ errMsg: expect.stringContaining('show:ok') })
      expect(load).toHaveBeenCalledTimes(1)
      expect(close).toHaveBeenCalledTimes(1)
      expect(error).not.toHaveBeenCalled()
      ad.offLoad(load)
      ad.offClose(close as any)
      ad.offLoad()
      ad.offClose()
      ad.destroy()
      await expect(ad.show()).rejects.toMatchObject({ errMsg: expect.stringContaining('destroyed') })
      await expect(ad.load()).rejects.toMatchObject({ errMsg: expect.stringContaining('destroyed') })
    }
  })
})
