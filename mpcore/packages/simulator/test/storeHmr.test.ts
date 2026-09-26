import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createStoreHmrFiles } from './helpers/storeHmr'

describe.each(['node', 'browser'] as const)('%s shared Store action replacement', (provider) => {
  it('updates the real HMR page binding and retains state across relaunch', async () => {
    const files = await createStoreHmrFiles()
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'store-hmr-'))
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'node'
      ? createHeadlessSession({ projectPath })
      : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
    try {
      const page = session.reLaunch('/pages/hmr/index')
      expect(session.renderCurrentPage().wxml).toContain('count: 0')
      expect(await page.runE2E()).toMatchObject({ ok: true })
      expect(session.renderCurrentPage().wxml).toContain('count: 3')
      page.increment()
      await expect.poll(() => session.renderCurrentPage().wxml).toContain('count: 5')
      session.reLaunch('/pages/hmr/index')
      expect(session.renderCurrentPage().wxml).toContain('count: 5')
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
