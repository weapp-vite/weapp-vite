import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createStoreLifecycleFiles } from './helpers/storeLifecycle'

describe.each(['node', 'browser'] as const)('%s wevu Store lifecycle', (provider) => {
  it('keeps hidden page scopes, disposes child/page subscriptions and retains state and action callbacks', async () => {
    const files = await createStoreLifecycleFiles()
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'store-lifecycle-'))
    for (const [file, source] of files) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'browser'
      ? createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      : createHeadlessSession({ projectPath })
    try {
      const page = session.reLaunch('/pages/launch/index')
      await page.flush()
      await page.mutate()
      expect(page.snapshot()).toMatchObject({ page: 1, child: 1, detached: 1 })
      await page.remove()
      const hidden = session.navigateTo('/pages/result/index')
      await hidden.mutate()
      expect(hidden.snapshot()).toMatchObject({ count: 2, page: 2, child: 1, detached: 2 })
      page.start()
      const result = session.reLaunch('/pages/result/index')
      await result.mutate()
      await result.finish()
      expect(result.snapshot()).toMatchObject({ count: 3, doubled: 6, page: 2, child: 1, detached: 3, after: 1, errors: 1 })
      expect(session.renderCurrentPage().wxml).toContain('6')
      expect(result.dispose()).toBe(3)
    }
    finally {
      session.close()
      fs.rmSync(projectPath, { recursive: true, force: true })
    }
  })
})
