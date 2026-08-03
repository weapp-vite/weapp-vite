import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanupDevtoolsScreenshotArtifacts } from './ide-devtools-screenshot-cleanup'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => fs.rm(root, {
    recursive: true,
    force: true,
  })))
})

async function createTemporaryRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-devtools-screenshot-cleanup-'))
  temporaryRoots.push(root)
  return root
}

describe('cleanupDevtoolsScreenshotArtifacts', () => {
  it('removes only captureScreenshot PNG artifacts from active DevTools profiles', async () => {
    const root = await createTemporaryRoot()
    const activeTmp = path.join(
      root,
      'active/WeappSimulator/WeappFileSystem/open-id/app-id/tmp',
    )
    const backupTmp = path.join(
      root,
      'active.backup-2026/WeappSimulator/WeappFileSystem/open-id/app-id/tmp',
    )
    const screenshotName = `abcdefghijkl${'a'.repeat(32)}.png`
    await fs.mkdir(activeTmp, { recursive: true })
    await fs.mkdir(backupTmp, { recursive: true })
    await fs.writeFile(path.join(activeTmp, screenshotName), 'screenshot')
    await fs.writeFile(path.join(activeTmp, 'fixture.png'), 'fixture')
    await fs.writeFile(path.join(backupTmp, screenshotName), 'backup')

    const result = await cleanupDevtoolsScreenshotArtifacts({ rootDirs: [root] })

    expect(result).toEqual({ bytes: 10, files: 1 })
    await expect(fs.access(path.join(activeTmp, screenshotName))).rejects.toThrow()
    await expect(fs.readFile(path.join(activeTmp, 'fixture.png'), 'utf8')).resolves.toBe('fixture')
    await expect(fs.readFile(path.join(backupTmp, screenshotName), 'utf8')).resolves.toBe('backup')
  })

  it('returns an empty result when DevTools data roots are unavailable', async () => {
    await expect(cleanupDevtoolsScreenshotArtifacts({
      platform: 'linux',
    })).resolves.toEqual({ bytes: 0, files: 0 })
  })
})
