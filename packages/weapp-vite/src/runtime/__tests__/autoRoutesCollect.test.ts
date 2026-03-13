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
    await fs.ensureDir(path.join(tempDir, 'components/pages/card'))
    await fs.ensureFile(path.join(tempDir, 'components/pages/card/index.ts'))
  })

  afterAll(async () => {
    await fs.remove(tempDir)
  })

  it('limits crawling to specified roots when provided', async () => {
    const allCandidates = await _collectAutoRouteCandidates(tempDir)
    const allKeys = Array.from(allCandidates.keys(), key => path.relative(tempDir, key))
    expect(allKeys).toContain('pages/index/index')
    expect(allKeys).not.toContain('sub/pages/foo/index')
    expect(allKeys).not.toContain('components/pages/card/index')

    const limitedCandidates = await _collectAutoRouteCandidates(tempDir, undefined, ['sub'], [path.join(tempDir, 'sub')])
    const limitedKeys = Array.from(limitedCandidates.keys(), key => path.relative(tempDir, key))
    expect(limitedKeys).toContain('sub/pages/foo/index')
    expect(limitedKeys).not.toContain('pages/index/index')
  })

  it('supports custom glob and regex include rules', async () => {
    await fs.ensureDir(path.join(tempDir, 'views/home'))
    await fs.ensureFile(path.join(tempDir, 'views/home/index.ts'))
    await fs.ensureDir(path.join(tempDir, 'features/cart/screens/detail'))
    await fs.ensureFile(path.join(tempDir, 'features/cart/screens/detail/index.ts'))

    const regex = /^features\/[^/]+\/screens\/.+$/
    const candidates = await _collectAutoRouteCandidates(tempDir, ['views/**', regex])
    const keys = Array.from(candidates.keys(), key => path.relative(tempDir, key))

    expect(keys).toContain('views/home/index')
    expect(keys).toContain('features/cart/screens/detail/index')
    expect(keys).not.toContain('pages/index/index')
  })
})
