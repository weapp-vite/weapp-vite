import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, bench, describe } from 'vitest'
import { clearFileCaches, loadCache, pathExists, readFile } from '@/plugins/utils/cache'
import { defaultBenchOptions } from './utils'

describe('plugins/utils/cache', () => {
  const root = path.join(os.tmpdir(), 'weapp-vite-bench')
  const fixture = path.join(root, 'cache-fixture.txt')

  beforeAll(async () => {
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(fixture, 'hello world\n'.repeat(10_000), 'utf8')
    clearFileCaches()
    await readFile(fixture, { checkMtime: false })
    await pathExists(fixture, { ttlMs: 60_000 })
  })

  afterAll(async () => {
    try {
      await fs.rm(root, { recursive: true, force: true })
    }
    catch {}
  })

  bench(
    'loadCache.get (cache hit)',
    () => {
      loadCache.get(fixture)
    },
    defaultBenchOptions,
  )

  bench(
    'pathExists (cache hit)',
    async () => {
      await pathExists(fixture, { ttlMs: 60_000 })
    },
    defaultBenchOptions,
  )
})
