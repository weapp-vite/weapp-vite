import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearFileCaches, invalidateFileCache, pathExists, readFile } from './cache'

const {
  compilerClearFileCachesMock,
  compilerInvalidateFileCacheMock,
  compilerPathExistsMock,
  compilerReadFileMock,
} = vi.hoisted(() => {
  return {
    compilerClearFileCachesMock: vi.fn(),
    compilerInvalidateFileCacheMock: vi.fn(),
    compilerPathExistsMock: vi.fn(),
    compilerReadFileMock: vi.fn(),
  }
})

vi.mock('wevu/compiler', () => {
  return {
    __esModule: true,
    clearFileCaches: compilerClearFileCachesMock,
    invalidateFileCache: compilerInvalidateFileCacheMock,
    pathExists: compilerPathExistsMock,
    readFile: compilerReadFileMock,
  }
})

describe('plugins/utils/cache', () => {
  const fixturePath = '/project/src/fixture.txt'

  beforeEach(() => {
    vi.restoreAllMocks()
    compilerClearFileCachesMock.mockReset()
    compilerInvalidateFileCacheMock.mockReset()
    compilerPathExistsMock.mockReset()
    compilerReadFileMock.mockReset()
    ;(compilerReadFileMock as Mock).mockResolvedValue('v1')
    ;(compilerPathExistsMock as Mock).mockResolvedValue(true)
    clearFileCaches()
  })

  it('caches readFile when checkMtime is false', async () => {
    expect(await readFile(fixturePath, { checkMtime: false })).toBe('v1')
    expect(await readFile(fixturePath, { checkMtime: false })).toBe('v1')

    expect(compilerReadFileMock).toHaveBeenCalledTimes(2)
    expect(compilerReadFileMock).toHaveBeenCalledWith(fixturePath, { checkMtime: false })
  })

  it('uses mtime to skip reads when unchanged', async () => {
    expect(await readFile(fixturePath)).toBe('v1')
    expect(await readFile(fixturePath)).toBe('v1')

    expect(compilerReadFileMock).toHaveBeenCalledTimes(2)
    expect(compilerReadFileMock).toHaveBeenNthCalledWith(1, fixturePath)
  })

  it('invalidates when size changes even if mtime stays the same', async () => {
    ;(compilerReadFileMock as Mock)
      .mockResolvedValueOnce('v1')
      .mockResolvedValueOnce('v2')

    expect(await readFile(fixturePath)).toBe('v1')
    invalidateFileCache(fixturePath)
    expect(await readFile(fixturePath)).toBe('v2')
    expect(compilerReadFileMock).toHaveBeenCalledTimes(2)
  })

  it('treats missing mtimeMs as invalid', async () => {
    expect(await readFile(fixturePath)).toBe('v1')
    expect(compilerReadFileMock).toHaveBeenCalledTimes(1)
  })

  it('passes encoding through to fs.readFile', async () => {
    await readFile(fixturePath, { checkMtime: false, encoding: 'utf-8' })
    expect(compilerReadFileMock).toHaveBeenCalledWith(fixturePath, { checkMtime: false, encoding: 'utf-8' })
  })

  it('memoizes pathExists calls', async () => {
    expect(await pathExists(fixturePath, { ttlMs: 60_000 })).toBe(true)
    expect(await pathExists(fixturePath, { ttlMs: 60_000 })).toBe(true)
    expect(compilerPathExistsMock).toHaveBeenCalledTimes(2)
    expect(compilerPathExistsMock).toHaveBeenCalledWith(fixturePath, { ttlMs: 60_000 })
  })

  it('can invalidate a single file cache entry', async () => {
    ;(compilerReadFileMock as Mock)
      .mockResolvedValueOnce('v1')
      .mockResolvedValueOnce('v2')

    expect(await readFile(fixturePath, { checkMtime: false })).toBe('v1')
    invalidateFileCache(fixturePath)
    expect(await readFile(fixturePath, { checkMtime: false })).toBe('v2')

    expect(compilerInvalidateFileCacheMock).toHaveBeenCalledWith(fixturePath)
    expect(compilerReadFileMock).toHaveBeenCalledTimes(2)
  })
})
