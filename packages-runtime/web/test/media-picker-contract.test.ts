import { afterEach, describe, expect, it, vi } from 'vitest'
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

interface InputOptions {
  files?: unknown[] | null
  parent?: boolean
  withClick?: boolean
}

function createInput(options: InputOptions = {}) {
  let change: (() => void) | undefined
  const removeChild = vi.fn()
  const attributes = new Map<string, string>()
  const input = {
    files: options.files,
    parentNode: options.parent ? { removeChild } : null,
    addEventListener: vi.fn((_name: string, listener: () => void) => {
      change = listener
    }),
    setAttribute: vi.fn((name: string, value: string) => {
      attributes.set(name, value)
    }),
  } as Record<string, unknown>
  if (options.withClick !== false) {
    input.click = vi.fn(() => change?.())
  }
  return { attributes, input, removeChild }
}

function installInput(input: unknown, withBody = true) {
  const append = vi.fn()
  vi.stubGlobal('document', {
    body: withBody ? { append } : undefined,
    createElement: vi.fn(() => input),
  })
  return append
}

describe('media picker boundary contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('normalizes counts, files, paths, media types, and extension fallbacks', () => {
    expect(normalizeChooseImageCount(undefined)).toBe(9)
    expect(normalizeChooseImageCount(Number.NaN)).toBe(9)
    expect(normalizeChooseImageCount(-2)).toBe(1)
    expect(normalizeChooseImageCount(2.9)).toBe(2)
    expect(normalizeChooseMediaCount(undefined)).toBe(1)
    expect(normalizeChooseMediaCount(Number.NaN)).toBe(1)
    expect(normalizeChooseMediaCount(0)).toBe(1)
    expect(normalizeChooseMediaCount(3.8)).toBe(3)

    vi.stubGlobal('URL', undefined)
    expect(createTempFilePath({ name: 'fallback.png' })).toBe('fallback.png')
    expect(createTempFilePath({})).toBe('')
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => '') })
    expect(createTempFilePath({ name: 'empty-url.png' })).toBe('empty-url.png')
    expect(normalizeChooseImageFile({})).toEqual({ path: '', size: 0, type: '', name: '' })
    expect(normalizeChooseMediaFile({})).toMatchObject({ size: 0, fileType: 'image' })

    expect([...normalizeChooseMediaTypes(undefined)]).toEqual(['image', 'video'])
    expect([...normalizeChooseMediaTypes(['image'])]).toEqual(['image'])
    expect([...normalizeChooseMediaTypes(['video'])]).toEqual(['video'])
    expect([...normalizeChooseMediaTypes(['mix'])]).toEqual(['image', 'video'])
    expect([...normalizeChooseMediaTypes(['invalid' as any])]).toEqual(['image', 'video'])
    expect(inferChooseMediaFileType({ type: 'VIDEO/MP4' })).toBe('video')
    expect(inferChooseMediaFileType({ type: 'IMAGE/PNG' })).toBe('image')
    expect(inferChooseMediaFileType({ name: 'clip.MOV' })).toBe('video')
    expect(inferChooseMediaFileType({})).toBe('image')
  })

  it('handles empty and partial native image picker handles', async () => {
    const getFile = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ name: 'picked.png' })
    const picker = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([null, {}, { getFile }, { getFile }])
    vi.stubGlobal('showOpenFilePicker', picker)

    await expect(pickChooseImageFiles(1)).resolves.toEqual([])
    await expect(pickChooseImageFiles(1)).resolves.toEqual([{ name: 'picked.png' }])
    expect(picker).toHaveBeenNthCalledWith(1, expect.objectContaining({ multiple: false }))
  })

  it('uses the image input fallback and cleans up a parented input', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined)
    const first = { name: 'first.png' }
    const second = { name: 'second.png' }
    const { attributes, input, removeChild } = createInput({
      files: [first, second],
      parent: true,
    })
    const append = installInput(input)

    await expect(pickChooseImageFiles(2)).resolves.toEqual([first, second])
    expect(attributes.get('accept')).toBe('image/*')
    expect(attributes.get('multiple')).toBe('true')
    expect(append).toHaveBeenCalledWith(input)
    expect(removeChild).toHaveBeenCalledWith(input)
  })

  it('reports image input cancellation and missing click support', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined)
    const cancelled = createInput({ files: null })
    installInput(cancelled.input, false)
    await expect(pickChooseImageFiles(1)).rejects.toThrow('no file selected')
    expect(cancelled.removeChild).not.toHaveBeenCalled()

    const unclickable = createInput({ files: [], withClick: false })
    installInput(unclickable.input)
    await expect(pickChooseImageFiles(1)).rejects.toThrow('file input click is unavailable')
  })

  it('rejects image fallback when document or input creation is unavailable', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined)
    vi.stubGlobal('document', undefined)
    await expect(pickChooseImageFiles(1)).rejects.toThrow('Image picker is unavailable')

    vi.stubGlobal('document', {})
    await expect(pickChooseImageFiles(1)).rejects.toThrow('Image picker is unavailable')

    installInput(null)
    await expect(pickChooseImageFiles(1)).rejects.toThrow('Image picker is unavailable')

    installInput(1)
    await expect(pickChooseImageFiles(1)).rejects.toThrow('Image picker is unavailable')
  })

  it('builds native media picker accept maps for image and video modes', async () => {
    const picker = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue([])
    vi.stubGlobal('showOpenFilePicker', picker)

    await expect(pickChooseMediaFiles(1, new Set(['image']))).resolves.toEqual([])
    await expect(pickChooseMediaFiles(1, new Set(['video']))).resolves.toEqual([])
    await expect(pickChooseMediaFiles(2, new Set(['image', 'video']))).resolves.toEqual([])
    expect(picker).toHaveBeenNthCalledWith(1, expect.objectContaining({
      multiple: false,
      types: [expect.objectContaining({ accept: { 'image/*': expect.any(Array) } })],
    }))
    expect(picker).toHaveBeenNthCalledWith(2, expect.objectContaining({
      types: [expect.objectContaining({ accept: { 'video/*': expect.any(Array) } })],
    }))
    expect(picker).toHaveBeenNthCalledWith(3, expect.objectContaining({ multiple: true }))
  })

  it.each([
    [new Set(['image'] as const), 'image/*'],
    [new Set(['video'] as const), 'video/*'],
    [new Set(['image', 'video'] as const), 'image/*,video/*'],
  ])('uses media input accept %s', async (types, expectedAccept) => {
    vi.stubGlobal('showOpenFilePicker', undefined)
    const file = { name: 'selected' }
    const { attributes, input } = createInput({ files: [file] })
    installInput(input, false)

    await expect(pickChooseMediaFiles(1, types)).resolves.toEqual([file])
    expect(attributes.get('accept')).toBe(expectedAccept)
  })

  it('handles partial media handles, cancellation, cleanup, and missing capabilities', async () => {
    const file = { name: 'clip.mp4' }
    vi.stubGlobal('showOpenFilePicker', vi.fn().mockResolvedValue([null, {}, {
      getFile: vi.fn().mockResolvedValue(null),
    }, {
      getFile: vi.fn().mockResolvedValue(file),
    }]))
    await expect(pickChooseMediaFiles(1, new Set(['video']))).resolves.toEqual([file])

    vi.stubGlobal('showOpenFilePicker', undefined)
    const cancelled = createInput({ files: null, parent: true })
    installInput(cancelled.input)
    await expect(pickChooseMediaFiles(1, new Set(['video']))).rejects.toThrow('no file selected')
    expect(cancelled.removeChild).toHaveBeenCalledWith(cancelled.input)

    installInput(null)
    await expect(pickChooseMediaFiles(1, new Set(['video']))).rejects.toThrow('Media picker is unavailable')
    installInput(1)
    await expect(pickChooseMediaFiles(1, new Set(['video']))).rejects.toThrow('Media picker is unavailable')
  })
})
