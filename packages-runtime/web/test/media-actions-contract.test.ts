import { WEAPP_VITE_WEB_OPEN_VIDEO_EDITOR_KEY } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetWebRuntimeHost, setWebRuntimeHost } from '../src/runtime/host'
import {
  normalizePreviewMediaSources,
  openTargetInNewWindow,
  readOpenVideoEditorPreset,
  triggerDownload,
} from '../src/runtime/polyfill/mediaActions'

describe('media action host contract', () => {
  afterEach(() => {
    resetWebRuntimeHost()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(globalThis, WEAPP_VITE_WEB_OPEN_VIDEO_EDITOR_KEY)
  })

  it('ignores popup errors while preserving open parameters', () => {
    const open = vi.fn(() => {
      throw new Error('popup blocked')
    })
    setWebRuntimeHost({ open })

    expect(() => openTargetInNewWindow('https://example.com')).not.toThrow()
    expect(open).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
  })

  it('normalizes preview media records and invalid source shapes', () => {
    expect(normalizePreviewMediaSources(null)).toEqual([])
    expect(normalizePreviewMediaSources([
      null,
      'invalid',
      {},
      { url: '   ' },
      { poster: 1, type: 'video', url: ' video.mp4 ' },
      { poster: 'cover.png', type: 'unknown', url: 'image.png' },
    ])).toEqual([
      { poster: '', type: 'video', url: 'video.mp4' },
      { poster: 'cover.png', type: 'image', url: 'image.png' },
    ])
  })

  it('reads function, string, and source-map video editor presets', () => {
    Object.assign(globalThis, {
      [WEAPP_VITE_WEB_OPEN_VIDEO_EDITOR_KEY]: vi.fn(() => ' edited.mp4 '),
    })
    expect(readOpenVideoEditorPreset('source.mp4')).toBe('edited.mp4')
    Object.assign(globalThis, {
      [WEAPP_VITE_WEB_OPEN_VIDEO_EDITOR_KEY]: vi.fn(() => null),
    })
    expect(readOpenVideoEditorPreset('source.mp4')).toBe('')

    Object.assign(globalThis, { [WEAPP_VITE_WEB_OPEN_VIDEO_EDITOR_KEY]: ' preset.mp4 ' })
    expect(readOpenVideoEditorPreset('source.mp4')).toBe('preset.mp4')
    Object.assign(globalThis, { [WEAPP_VITE_WEB_OPEN_VIDEO_EDITOR_KEY]: '   ' })
    expect(readOpenVideoEditorPreset('source.mp4')).toBe('')

    Object.assign(globalThis, {
      [WEAPP_VITE_WEB_OPEN_VIDEO_EDITOR_KEY]: { 'source.mp4': ' mapped.mp4 ' },
    })
    expect(readOpenVideoEditorPreset('source.mp4')).toBe('mapped.mp4')
    Object.assign(globalThis, {
      [WEAPP_VITE_WEB_OPEN_VIDEO_EDITOR_KEY]: { 'source.mp4': 1 },
    })
    expect(readOpenVideoEditorPreset('source.mp4')).toBe('')
    Object.assign(globalThis, { [WEAPP_VITE_WEB_OPEN_VIDEO_EDITOR_KEY]: 1 })
    expect(readOpenVideoEditorPreset('source.mp4')).toBe('')
  })

  it('handles download capability, cleanup, and browser failures', () => {
    vi.stubGlobal('document', undefined)
    expect(triggerDownload('missing.png')).toBeUndefined()
    vi.stubGlobal('document', {})
    expect(triggerDownload('missing-body.png')).toBeUndefined()

    const removeChild = vi.fn()
    const click = vi.fn()
    const setAttribute = vi.fn()
    const link = {
      click,
      parentNode: { removeChild },
      setAttribute,
    }
    const append = vi.fn()
    vi.stubGlobal('document', {
      body: { append },
      createElement: vi.fn(() => link),
    })
    triggerDownload('photo.png', 'download.png')
    expect(setAttribute).toHaveBeenCalledWith('href', 'photo.png')
    expect(setAttribute).toHaveBeenCalledWith('download', 'download.png')
    expect(append).toHaveBeenCalledWith(link)
    expect(click).toHaveBeenCalledTimes(1)
    expect(removeChild).toHaveBeenCalledWith(link)

    vi.stubGlobal('document', {
      body: { append: vi.fn() },
      createElement: vi.fn(() => ({ parentNode: null, setAttribute: vi.fn() })),
    })
    expect(() => triggerDownload('no-click.png')).not.toThrow()

    vi.stubGlobal('document', {
      body: {},
      createElement: vi.fn(() => {
        throw new Error('creation blocked')
      }),
    })
    expect(() => triggerDownload('blocked.png')).not.toThrow()
  })
})
