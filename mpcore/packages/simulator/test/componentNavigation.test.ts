import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { componentNavigationFiles } from './helpers/componentNavigation'

describe('component ownership across navigation', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  for (const provider of ['node', 'browser'] as const) {
    it(`retains hidden tab components and detaches only removed components in ${provider}`, async () => {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-navigation-'))
      directories.push(projectPath)
      for (const [file, source] of componentNavigationFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentNavigationFiles) })
      try {
        const page = session.reLaunch('/pages/a/index')
        session.renderCurrentPage()
        await Promise.resolve()
        expect(session.renderCurrentPage().wxml).toContain('hide=0 show=1')
        session.switchTab('/pages/b/index')
        expect(session.renderCurrentPage().wxml).toContain('other tab')
        session.switchTab('/pages/a/index')
        expect(session.renderCurrentPage().wxml).toContain('hide=1 show=2')
        expect(session.bootstrap().globalData).toEqual({ attached: 1, detached: 0 })
        page.setData({ visible: false })
        expect(session.renderCurrentPage().wxml).not.toContain('id="history"')
        expect(session.bootstrap().globalData).toEqual({ attached: 1, detached: 1 })
        page.setData({ visible: true })
        session.renderCurrentPage()
        session.reLaunch('/pages/b/index')
        session.renderCurrentPage()
        expect(session.bootstrap().globalData).toEqual({ attached: 2, detached: 2 })
      }
      finally {
        session.close()
      }
    })
  }
})
