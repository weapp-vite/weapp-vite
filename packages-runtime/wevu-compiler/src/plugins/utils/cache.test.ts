import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from '../../utils/fs'
import {
  clearFileCaches,
  invalidateFileCache,
  isInvalidate,
  mtimeCache,
  pathExists,
  readFile,
} from './cache'

describe('file cache readFile line endings', () => {
  let tempDir = ''

  beforeEach(async () => {
    clearFileCaches()
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wevu-compiler-cache-'))
  })

  afterEach(async () => {
    clearFileCaches()
    if (tempDir) {
      await fs.remove(tempDir)
    }
  })

  it('normalizes CRLF to LF', async () => {
    const filePath = path.join(tempDir, 'sample-crlf.vue')
    await fs.writeFile(filePath, '<template>\r\n  <view />\r\n</template>\r\n', 'utf8')

    const content = await readFile(filePath, { checkMtime: false })
    expect(content).toBe('<template>\n  <view />\n</template>\n')
  })

  it('normalizes legacy CR to LF', async () => {
    const filePath = path.join(tempDir, 'sample-cr.vue')
    await fs.writeFile(filePath, '<template>\r  <view />\r</template>\r', 'utf8')

    const content = await readFile(filePath, { checkMtime: true })
    expect(content).toBe('<template>\n  <view />\n</template>\n')
  })

  it('reuses load cache when checkMtime is false', async () => {
    const filePath = path.join(tempDir, 'sample-cache.vue')
    await fs.writeFile(filePath, 'line-1\r\n', 'utf8')

    const first = await readFile(filePath, { checkMtime: false })
    await fs.writeFile(filePath, 'line-2\r\n', 'utf8')
    const second = await readFile(filePath, { checkMtime: false })

    expect(first).toBe('line-1\n')
    expect(second).toBe('line-1\n')

    clearFileCaches()
    const refreshed = await readFile(filePath, { checkMtime: false })
    expect(refreshed).toBe('line-2\n')
  })

  it('tracks file signature in mtime cache and invalidates on changes', async () => {
    const filePath = path.join(tempDir, 'sample-mtime.vue')
    await fs.writeFile(filePath, 'a', 'utf8')

    expect(await isInvalidate(filePath)).toBe(true)
    expect(await isInvalidate(filePath)).toBe(false)

    await fs.writeFile(filePath, 'ab', 'utf8')
    expect(await isInvalidate(filePath)).toBe(true)
    expect(await isInvalidate(filePath)).toBe(false)
  })

  it('returns true when fs.stat contains invalid mtime/size', async () => {
    const filePath = path.join(tempDir, 'sample-invalid-stat.vue')
    await fs.writeFile(filePath, 'x', 'utf8')
    const statSpy = vi.spyOn(fs, 'stat').mockResolvedValue({
      mtimeMs: Number.NaN,
      size: Number.NaN,
    } as any)

    await expect(isInvalidate(filePath)).resolves.toBe(true)
    statSpy.mockRestore()
  })

  it('caches pathExists results and supports invalidateFileCache', async () => {
    const filePath = path.join(tempDir, 'sample-path-exists.vue')
    await fs.writeFile(filePath, '<view />', 'utf8')
    const pathExistsSpy = vi.spyOn(fs, 'pathExists')

    expect(await pathExists(filePath, { ttlMs: 10_000 })).toBe(true)
    expect(await pathExists(filePath, { ttlMs: 10_000 })).toBe(true)
    expect(pathExistsSpy).toHaveBeenCalledTimes(1)

    invalidateFileCache(filePath)
    expect(await pathExists(filePath, { ttlMs: 10_000 })).toBe(true)
    expect(pathExistsSpy).toHaveBeenCalledTimes(2)
    pathExistsSpy.mockRestore()
  })

  it('clears mtime and path caches globally', async () => {
    const filePath = path.join(tempDir, 'sample-clear.vue')
    await fs.writeFile(filePath, 'x', 'utf8')
    await isInvalidate(filePath)
    expect(mtimeCache.has(filePath)).toBe(true)

    clearFileCaches()
    expect(mtimeCache.has(filePath)).toBe(false)
  })
})
