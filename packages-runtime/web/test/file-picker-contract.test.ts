import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeChooseFileExtensions,
  normalizeChooseMessageFile,
  pickChooseFileFiles,
  pickChooseMessageFiles,
} from '../src/runtime/polyfill/filePicker'

function createInput(options: {
  files?: unknown[] | null
  parent?: boolean
  withClick?: boolean
}) {
  let change: (() => void) | undefined
  const attributes = new Map<string, string>()
  const removeChild = vi.fn()
  const input = {
    files: options.files,
    parentNode: options.parent ? { removeChild } : null,
    addEventListener: vi.fn((_name: string, callback: () => void) => {
      change = callback
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

function installInput(input: unknown, body = false) {
  vi.stubGlobal('document', {
    body: body ? { append: vi.fn() } : undefined,
    createElement: vi.fn(() => input),
  })
}

describe('file picker defensive adapter contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('handles undefined and partial native picker results', async () => {
    const file = { name: 'file.txt' }
    const picker = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([null, {}, { getFile: vi.fn().mockResolvedValue(null) }, {
        getFile: vi.fn().mockResolvedValue(file),
      }])
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([null, {}, { getFile: vi.fn().mockResolvedValue(file) }])
    vi.stubGlobal('showOpenFilePicker', picker)

    await expect(pickChooseMessageFiles(1, 'all')).resolves.toEqual([])
    await expect(pickChooseMessageFiles(1, 'all')).resolves.toEqual([file])
    await expect(pickChooseFileFiles(1, 'all', [])).resolves.toEqual([])
    await expect(pickChooseFileFiles(1, 'all', [])).resolves.toEqual([file])
  })

  it('covers message input multiple, cancellation, cleanup, and missing click', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined)
    const cancelled = createInput({ files: null })
    installInput(cancelled.input)
    await expect(pickChooseMessageFiles(2, 'file')).rejects.toThrow('no file selected')
    expect(cancelled.attributes.get('multiple')).toBe('true')
    expect(cancelled.attributes.get('accept')).toBe('*/*')
    expect(cancelled.removeChild).not.toHaveBeenCalled()

    const unclickable = createInput({ files: [], parent: true, withClick: false })
    installInput(unclickable.input, true)
    await expect(pickChooseMessageFiles(1, 'all')).rejects.toThrow('file input click is unavailable')
    expect(unclickable.removeChild).toHaveBeenCalledWith(unclickable.input)
  })

  it('covers generic input validation, cancellation, and missing document creation', async () => {
    vi.stubGlobal('showOpenFilePicker', undefined)
    vi.stubGlobal('URL', undefined)
    expect(normalizeChooseFileExtensions(undefined)).toEqual([])
    expect(normalizeChooseMessageFile({}).time).toEqual(expect.any(Number))
    expect(normalizeChooseMessageFile({ lastModified: 12 }).time).toBe(12)

    installInput(null)
    await expect(pickChooseFileFiles(1, 'all', [])).rejects.toThrow('File picker is unavailable')
    installInput(1)
    await expect(pickChooseFileFiles(1, 'all', [])).rejects.toThrow('File picker is unavailable')

    const cancelled = createInput({ files: null })
    installInput(cancelled.input)
    await expect(pickChooseFileFiles(1, 'video', [])).rejects.toThrow('no file selected')
    expect(cancelled.attributes.get('accept')).toBe('video/*')

    vi.stubGlobal('document', {})
    await expect(pickChooseFileFiles(1, 'all', [])).rejects.toThrow('File picker is unavailable')
  })
})
