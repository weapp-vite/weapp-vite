import os from 'node:os'
import path from 'node:path'
import fs from 'fs-extra'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearFileCaches, invalidateFileCache, pathExists, readFile } from './cache'

describe('plugins/utils/cache', () => {
  // 使用随机目录避免在 workspace + pnpm store 的重复测试文件并行执行时相互干扰。
  const tmpDir = path.join(
    os.tmpdir(),
    'weapp-vite-cache-test',
    `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  )
  const fixturePath = path.join(tmpDir, 'fixture.txt')

  beforeEach(() => {
    clearFileCaches()
    vi.restoreAllMocks()
  })

  it('caches readFile when checkMtime is false', async () => {
    await fs.ensureDir(tmpDir)
    await fs.writeFile(fixturePath, 'v1', 'utf8')
    const readFileSpy = vi.spyOn(fs, 'readFile')

    expect(await readFile(fixturePath, { checkMtime: false })).toBe('v1')
    expect(await readFile(fixturePath, { checkMtime: false })).toBe('v1')

    expect(readFileSpy).toHaveBeenCalledTimes(1)
    expect(readFileSpy).toHaveBeenCalledWith(fixturePath, 'utf8')
  })

  it('uses mtime to skip reads when unchanged', async () => {
    await fs.ensureDir(tmpDir)
    await fs.writeFile(fixturePath, 'v1', 'utf8')
    const statSpy = vi.spyOn(fs, 'stat')
    const readFileSpy = vi.spyOn(fs, 'readFile')

    expect(await readFile(fixturePath)).toBe('v1')
    expect(await readFile(fixturePath)).toBe('v1')

    expect(statSpy).toHaveBeenCalledTimes(2)
    expect(readFileSpy).toHaveBeenCalledTimes(1)
  })

  it('invalidates when size changes even if mtime stays the same', async () => {
    await fs.ensureDir(tmpDir)
    await fs.writeFile(fixturePath, 'v1', 'utf8')

    const statSpy = vi.spyOn(fs, 'stat')
    const readFileSpy = vi.spyOn(fs, 'readFile')

    expect(await readFile(fixturePath)).toBe('v1')

    const firstStatCall = await statSpy.mock.results[0]?.value
    const mtimeMs = typeof (firstStatCall as any)?.mtimeMs === 'number'
      ? (firstStatCall as any).mtimeMs
      : undefined
    if (mtimeMs === undefined) {
      return
    }

    statSpy.mockResolvedValueOnce({ mtimeMs, size: 999 } as any)
    readFileSpy.mockResolvedValueOnce('v2' as any)

    expect(await readFile(fixturePath)).toBe('v2')
    expect(readFileSpy).toHaveBeenCalledTimes(2)
  })

  it('treats missing mtimeMs as invalid', async () => {
    await fs.ensureDir(tmpDir)
    await fs.writeFile(fixturePath, 'v1', 'utf8')
    vi.spyOn(fs, 'stat').mockResolvedValueOnce({} as any)
    const readFileSpy = vi.spyOn(fs, 'readFile')

    expect(await readFile(fixturePath)).toBe('v1')
    expect(readFileSpy).toHaveBeenCalledTimes(1)
  })

  it('passes encoding through to fs.readFile', async () => {
    await fs.ensureDir(tmpDir)
    await fs.writeFile(fixturePath, 'v1', 'utf8')
    const readFileSpy = vi.spyOn(fs, 'readFile')
    await readFile(fixturePath, { checkMtime: false, encoding: 'utf-8' })
    expect(readFileSpy).toHaveBeenCalledWith(fixturePath, 'utf-8')
  })

  it('memoizes pathExists calls', async () => {
    await fs.ensureDir(tmpDir)
    await fs.writeFile(fixturePath, 'v1', 'utf8')
    const pathExistsSpy = vi.spyOn(fs, 'pathExists')

    expect(await pathExists(fixturePath, { ttlMs: 60_000 })).toBe(true)
    expect(await pathExists(fixturePath, { ttlMs: 60_000 })).toBe(true)
    expect(pathExistsSpy).toHaveBeenCalledTimes(1)
  })

  it('can invalidate a single file cache entry', async () => {
    await fs.ensureDir(tmpDir)
    await fs.writeFile(fixturePath, 'v1', 'utf8')
    const readFileSpy = vi.spyOn(fs, 'readFile')

    expect(await readFile(fixturePath, { checkMtime: false })).toBe('v1')
    invalidateFileCache(fixturePath)
    await fs.writeFile(fixturePath, 'v2', 'utf8')
    expect(await readFile(fixturePath, { checkMtime: false })).toBe('v2')

    expect(readFileSpy).toHaveBeenCalledTimes(2)
  })
})
