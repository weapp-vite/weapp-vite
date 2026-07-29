import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  normalizeFilePath,
  readFileSyncInternal,
  resolveOpenDocumentUrl,
  resolveSaveFilePath,
  resolveUploadFileBlob,
  resolveUploadFileName,
  saveMemoryFile,
  WEB_USER_DATA_PATH,
  writeFileSyncInternal,
} from '../src/runtime/polyfill/files'
import { openDocumentBridge } from '../src/runtime/polyfill/mediaApi/file'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('web memory file contracts', () => {
  it('normalizes paths and stores cloned text, buffers and views', () => {
    expect(normalizeFilePath(undefined)).toBe('')
    expect(normalizeFilePath('  /file.txt  ')).toBe('/file.txt')
    expect(() => writeFileSyncInternal(' ', 'invalid')).toThrow('invalid filePath')
    expect(() => readFileSyncInternal(' ')).toThrow('invalid filePath')
    expect(() => readFileSyncInternal('/missing')).toThrow('no such file')

    writeFileSyncInternal('/text', 'ready')
    expect(readFileSyncInternal('/text')).toBe('ready')
    expect(readFileSyncInternal('/text', 1 as unknown as string)).toBe('ready')

    const bytes = new Uint8Array([65, 66, 67])
    writeFileSyncInternal('/buffer', bytes.buffer)
    bytes[0] = 90
    expect([...new Uint8Array(readFileSyncInternal('/buffer') as ArrayBuffer)]).toEqual([65, 66, 67])

    const backing = new Uint8Array([0, 68, 69, 0])
    writeFileSyncInternal('/view', new Uint8Array(backing.buffer, 1, 2))
    backing[1] = 90
    expect([...new Uint8Array(readFileSyncInternal('/view') as ArrayBuffer)]).toEqual([68, 69])
    expect(readFileSyncInternal('/view', ' UTF-8 ')).toBe('DE')
    expect(readFileSyncInternal('/view', 'invalid-encoding')).toBe('DE')

    vi.stubGlobal('TextDecoder', undefined)
    expect(readFileSyncInternal('/view', 'utf-8')).toBe('DE')
  })

  it('resolves upload names and blobs from memory, remote and fallback inputs', async () => {
    expect(resolveUploadFileName('/path/report.txt?download=1#hash')).toBe('report.txt')
    expect(resolveUploadFileName('/')).toBe('file')

    writeFileSyncInternal('/upload-text', 'text payload')
    await expect(resolveUploadFileBlob('/upload-text', undefined)).resolves.toMatchObject({ type: 'text/plain;charset=utf-8' })
    writeFileSyncInternal('/upload-bytes', new Uint8Array([1, 2]))
    expect(await (await resolveUploadFileBlob('/upload-bytes', undefined)).arrayBuffer()).toEqual(new Uint8Array([1, 2]).buffer)

    const remoteBlob = new Blob(['remote'], { type: 'text/plain' })
    const runtimeFetch = vi.fn(async () => ({ blob: async () => remoteBlob })) as unknown as typeof fetch
    await expect(resolveUploadFileBlob('https://example.test/file', runtimeFetch)).resolves.toBe(remoteBlob)
    expect(runtimeFetch).toHaveBeenCalledWith('https://example.test/file', { method: 'GET' })

    const failedFetch = vi.fn(async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    expect(await (await resolveUploadFileBlob('blob:missing', failedFetch)).text()).toBe('blob:missing')
    expect(await (await resolveUploadFileBlob('data:text/plain,ready', undefined)).text()).toBe('data:text/plain,ready')
    expect(await (await resolveUploadFileBlob('/plain/path', runtimeFetch)).text()).toBe('/plain/path')
  })

  it('copies saved files and resolves default or explicit destinations', () => {
    expect(resolveSaveFilePath('/tmp/report.txt?x=1')).toBe(`${WEB_USER_DATA_PATH}/report.txt`)
    expect(resolveSaveFilePath('/tmp/report.txt', '  /custom/report.txt ')).toBe('/custom/report.txt')
    expect(resolveSaveFilePath('/tmp/report.txt', 1 as unknown as string)).toBe(`${WEB_USER_DATA_PATH}/report.txt`)

    writeFileSyncInternal('/source-text', 'source')
    saveMemoryFile('/source-text', '/saved-text')
    writeFileSyncInternal('/source-text', 'changed')
    expect(readFileSyncInternal('/saved-text')).toBe('source')

    const bytes = new Uint8Array([3, 4])
    writeFileSyncInternal('/source-binary', bytes)
    saveMemoryFile('/source-binary', '/saved-binary')
    bytes[0] = 9
    expect([...new Uint8Array(readFileSyncInternal('/saved-binary') as ArrayBuffer)]).toEqual([3, 4])

    saveMemoryFile('/external/path', '/saved-fallback')
    expect(readFileSyncInternal('/saved-fallback')).toBe('/external/path')
  })

  it('opens memory, absolute and relative file locations across host capabilities', () => {
    const OriginalURL = globalThis.URL
    const OriginalBlob = globalThis.Blob
    const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.type || 'binary'}`)
    vi.stubGlobal('URL', { createObjectURL })

    writeFileSyncInternal('/open-text', 'hello world')
    expect(resolveOpenDocumentUrl('/open-text')).toBe('blob:text/plain;charset=utf-8')
    writeFileSyncInternal('/open-binary', new Uint8Array([1]))
    expect(resolveOpenDocumentUrl('/open-binary')).toBe('blob:binary')

    vi.stubGlobal('Blob', undefined)
    expect(resolveOpenDocumentUrl('/open-text')).toBe('data:text/plain;charset=utf-8,hello%20world')
    expect(resolveOpenDocumentUrl('/open-binary')).toBe('')

    expect(resolveOpenDocumentUrl('https://example.test/file.pdf')).toBe('https://example.test/file.pdf')
    expect(resolveOpenDocumentUrl('data:text/plain,ready')).toBe('data:text/plain,ready')

    vi.stubGlobal('Blob', OriginalBlob)
    vi.stubGlobal('URL', OriginalURL)
    vi.stubGlobal('location', { href: 'https://example.test/base/' })
    expect(resolveOpenDocumentUrl('relative.pdf')).toBe('https://example.test/base/relative.pdf')

    class ThrowingURL {
      constructor() {
        throw new Error('invalid URL')
      }
    }
    vi.stubGlobal('URL', ThrowingURL)
    expect(resolveOpenDocumentUrl('raw-path')).toBe('raw-path')
    vi.stubGlobal('location', undefined)
    expect(resolveOpenDocumentUrl('without-location')).toBe('without-location')
  })

  it('rejects opening binary memory files without Blob support', async () => {
    writeFileSyncInternal('/binary-document', new Uint8Array([1, 2, 3]))
    vi.stubGlobal('Blob', undefined)
    await expect(openDocumentBridge({ filePath: '/binary-document' })).rejects.toMatchObject({
      errMsg: 'openDocument:fail document url is unavailable',
    })
  })
})
