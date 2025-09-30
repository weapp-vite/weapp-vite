import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { FileCache } from './file'

describe('FileCache', () => {
  it('invalidates cache when file disappears', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-file-cache-'))
    const target = path.join(tmpDir, 'cache.json')

    await fs.outputJSON(target, { foo: 'bar' })

    const cache = new FileCache<Record<string, unknown>>()

    expect(await cache.isInvalidate(target)).toBe(true)
    // consecutive checks use cached mtime
    expect(await cache.isInvalidate(target)).toBe(false)

    await fs.remove(target)

    // missing file should be treated as invalid and not throw
    await expect(cache.isInvalidate(target)).resolves.toBe(true)

    await fs.remove(tmpDir)
  })
})
