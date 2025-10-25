import os from 'node:os'
import fs from 'fs-extra'
import path from 'pathe'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { _collectAutoRouteCandidates } from '../autoRoutesPlugin'

describe('collectCandidates', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-auto-routes-'))
    await fs.ensureDir(path.join(tempDir, 'pages/index'))
    await fs.ensureFile(path.join(tempDir, 'pages/index/index.ts'))
    await fs.ensureDir(path.join(tempDir, 'sub/pages/foo'))
    await fs.ensureFile(path.join(tempDir, 'sub/pages/foo/index.ts'))
  })

  afterAll(async () => {
    await fs.remove(tempDir)
  })

  it('limits crawling to specified roots when provided', async () => {
    const allCandidates = await _collectAutoRouteCandidates(tempDir)
    const allKeys = Array.from(allCandidates.keys()).map(key => path.relative(tempDir, key))
    expect(allKeys).toContain('pages/index/index')
    expect(allKeys).toContain('sub/pages/foo/index')

    const limitedCandidates = await _collectAutoRouteCandidates(tempDir, [path.join(tempDir, 'sub')])
    const limitedKeys = Array.from(limitedCandidates.keys()).map(key => path.relative(tempDir, key))
    expect(limitedKeys).toContain('sub/pages/foo/index')
    expect(limitedKeys).not.toContain('pages/index/index')
  })
})
