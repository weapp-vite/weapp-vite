import { afterEach, describe, expect, it, vi } from 'vitest'
import { chooseVideoBridge } from '../src/runtime/polyfill/mediaApi/picker'
import { compressImageBridge } from '../src/runtime/polyfill/mediaApi/process'
import {
  compressImageByCanvas,
  normalizeChooseVideoFile,
  normalizeCompressImageQuality,
  pickChooseVideoFile,
} from '../src/runtime/polyfill/mediaProcess'

interface ImageShape {
  height?: number
  naturalHeight?: number
  naturalWidth?: number
  width?: number
}

function installImage(shape: ImageShape, fail = false) {
  class ImageMock {
    onerror?: () => void
    onload?: () => void
    #src = ''

    constructor() {
      Object.assign(this, shape)
    }

    get src() {
      return this.#src
    }

    set src(value: string) {
      this.#src = value
      if (fail) {
        this.onerror?.()
      }
      else {
        this.onload?.()
      }
    }
  }
  vi.stubGlobal('Image', ImageMock)
}

function installCanvas(canvas: Partial<HTMLCanvasElement> | null) {
  vi.stubGlobal('document', {
    createElement: vi.fn(() => canvas),
  })
}

describe('media process capability contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes image quality and video metadata boundaries', () => {
    expect(normalizeCompressImageQuality(undefined)).toBe(80)
    expect(normalizeCompressImageQuality(Number.NaN)).toBe(80)
    expect(normalizeCompressImageQuality(-1)).toBe(0)
    expect(normalizeCompressImageQuality(101)).toBe(100)
    expect(normalizeCompressImageQuality(62.6)).toBe(63)

    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:video') })
    expect(normalizeChooseVideoFile({ name: 'photo.jpg', size: 12, type: 'image/jpeg' })).toBeNull()
    expect(normalizeChooseVideoFile({ name: 'clip.mp4', size: 12, type: 'video/mp4' })).toMatchObject({
      size: 12,
      tempFilePath: expect.any(String),
    })
    expect(normalizeChooseVideoFile({ name: 'clip.webm', type: 'video/webm' })).toMatchObject({ size: 0 })
  })

  it('returns the source when required browser capabilities are absent', async () => {
    vi.stubGlobal('document', undefined)
    await expect(compressImageByCanvas('a.png', 80)).resolves.toBe('a.png')

    vi.stubGlobal('document', {})
    await expect(compressImageByCanvas('b.png', 80)).resolves.toBe('b.png')

    installCanvas({ getContext: vi.fn() })
    vi.stubGlobal('Image', undefined)
    await expect(compressImageByCanvas('c.png', 80)).resolves.toBe('c.png')

    installCanvas(null)
    installImage({ height: 1, width: 1 })
    await expect(compressImageByCanvas('d.png', 80)).resolves.toBe('d.png')

    installCanvas({} as HTMLCanvasElement)
    await expect(compressImageByCanvas('e.png', 80)).resolves.toBe('e.png')
  })

  it.each([
    ['missing context', null, { naturalHeight: 10, naturalWidth: 10 }],
    ['missing drawImage', {}, { naturalHeight: 10, naturalWidth: 10 }],
    ['zero width', { drawImage: vi.fn() }, { height: 10, width: 0 }],
    ['zero height', { drawImage: vi.fn() }, { height: 0, width: 10 }],
    ['missing dimensions', { drawImage: vi.fn() }, {}],
  ])('returns the source for %s', async (_name, context, image) => {
    installCanvas({ getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement)
    installImage(image)

    await expect(compressImageByCanvas('fallback.png', 80)).resolves.toBe('fallback.png')
  })

  it('uses image dimensions, mime types, and empty data-url fallback', async () => {
    const drawImage = vi.fn()
    const toDataURL = vi.fn()
      .mockReturnValueOnce('data:image/jpeg;base64,jpg')
      .mockReturnValueOnce('data:image/webp;base64,webp')
      .mockReturnValueOnce('')
    const canvas = {
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL,
    } as unknown as HTMLCanvasElement
    installCanvas(canvas)
    installImage({ height: 24, width: 32 })

    await expect(compressImageByCanvas('photo.jpeg', 75)).resolves.toContain('image/jpeg')
    await expect(compressImageByCanvas('photo.webp', 50)).resolves.toContain('image/webp')
    await expect(compressImageByCanvas('photo.unknown', 25)).resolves.toBe('photo.unknown')
    expect(toDataURL).toHaveBeenNthCalledWith(1, 'image/jpeg', 0.75)
    expect(toDataURL).toHaveBeenNthCalledWith(2, 'image/webp', 0.5)
    expect(toDataURL).toHaveBeenNthCalledWith(3, 'image/png', 0.25)
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 32, 24)
  })

  it('falls back without toDataURL and rejects load or canvas errors', async () => {
    const context = { drawImage: vi.fn() }
    installCanvas({ getContext: vi.fn(() => context) } as unknown as HTMLCanvasElement)
    installImage({ naturalHeight: 10, naturalWidth: 10 })
    await expect(compressImageByCanvas('no-encoder.png', 80)).resolves.toBe('no-encoder.png')

    installCanvas({
      getContext: vi.fn(() => context),
      toDataURL: vi.fn(() => {
        throw new Error('encode failed')
      }),
    } as unknown as HTMLCanvasElement)
    await expect(compressImageByCanvas('broken.png', 80)).rejects.toThrow('encode failed')

    installCanvas({
      getContext: vi.fn(() => context),
      toDataURL: vi.fn(() => {
        // eslint-disable-next-line no-throw-literal -- 模拟浏览器宿主以非 Error 值拒绝。
        throw 'encode denied'
      }),
    } as unknown as HTMLCanvasElement)
    await expect(compressImageBridge({ src: 'string-error.png' })).rejects.toMatchObject({
      errMsg: 'compressImage:fail encode denied',
    })

    installImage({ naturalHeight: 10, naturalWidth: 10 }, true)
    await expect(compressImageByCanvas('load-error.png', 80)).rejects.toThrow('image load error')
  })

  it('returns null when the video picker has no selection', async () => {
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([]))

    await expect(pickChooseVideoFile()).resolves.toBeNull()
    await expect(chooseVideoBridge()).rejects.toMatchObject({ errMsg: 'chooseVideo:fail no file selected' })
  })
})
