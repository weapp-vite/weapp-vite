import os from 'node:os'

import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { collectFiles } from './builder/shared'

const tempDirs: string[] = []

async function createTempDir() {
  const dir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'weapp-vite-builder-shared-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.map(dir => fs.remove(dir)))
  tempDirs.length = 0
})

describe('runtime npm builder shared helpers', () => {
  it('scans sibling directories concurrently when collecting files', async () => {
    const root = await createTempDir()
    const alphaDir = path.resolve(root, 'alpha')
    const betaDir = path.resolve(root, 'beta')
    await fs.ensureDir(alphaDir)
    await fs.ensureDir(betaDir)
    await fs.writeFile(path.resolve(alphaDir, 'index.js'), 'module.exports = "alpha"', 'utf8')
    await fs.writeFile(path.resolve(betaDir, 'index.js'), 'module.exports = "beta"', 'utf8')

    const originalReaddir = fs.readdir.bind(fs)
    const startedDirs = new Set<string>()
    let releaseFirstDir: (() => void) | undefined
    let resolveBothDirsStarted: (() => void) | undefined
    const bothDirsStarted = new Promise<void>((resolve) => {
      resolveBothDirsStarted = resolve
    })

    vi.spyOn(fs, 'readdir').mockImplementation(async (dir: any, ...args: any[]) => {
      const relPath = path.relative(root, String(dir)).replace(/\\/g, '/')
      if (relPath === 'alpha' || relPath === 'beta') {
        startedDirs.add(relPath)
        if (startedDirs.size === 2) {
          resolveBothDirsStarted?.()
        }
        if (!releaseFirstDir) {
          await new Promise<void>((resolve) => {
            releaseFirstDir = resolve
          })
        }
      }
      return originalReaddir(dir, ...args)
    })

    const collectPromise = collectFiles(root)
    const startResult = await Promise.race([
      bothDirsStarted.then(() => 'both-started'),
      new Promise(resolve => setTimeout(resolve, 50, 'timeout')),
    ])
    releaseFirstDir?.()
    const files = await collectPromise

    expect(startResult).toBe('both-started')
    expect(startedDirs).toEqual(new Set(['alpha', 'beta']))
    expect(files.map(file => path.relative(root, file).replace(/\\/g, '/')).sort()).toEqual([
      'alpha/index.js',
      'beta/index.js',
    ])
  })
})
