import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { cleanupTempDirs } from './helpers'
import { styleBindingFiles } from './helpers/styleBindings'

describe('rendered class and responsive style bindings', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  for (const provider of ['node', 'browser'] as const) {
    it(`replaces class, style and text together in ${provider}`, async () => {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-style-bindings-'))
      directories.push(projectPath)
      for (const [file, source] of styleBindingFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(styleBindingFiles) })
      const root = () => new HeadlessTestingNodeHandle(session.renderCurrentPage().root)
      try {
        const page = session.reLaunch('/pages/index/index')
        expect(await (await root().$('#style-probe[style*="18rpx"][style*="24rpx"]'))?.text()).toBe('Base')
        expect(await root().$$('.active, .ghost')).toHaveLength(0)
        page.activate()
        expect(await (await root().$('#style-probe.active.ghost[style*="999rpx"][style*="26rpx"]'))?.text()).toBe('All On')
        expect(await root().$$('[style*="18rpx"], [style*="24rpx"]')).toHaveLength(0)
        page.reset()
        expect(await (await root().$('#style-probe[style*="18rpx"][style*="24rpx"]'))?.text()).toBe('Base')
        expect(await root().$$('.active, .ghost, [style*="999rpx"]')).toHaveLength(0)
      }
      finally {
        session.close()
      }
    })
  }
})
