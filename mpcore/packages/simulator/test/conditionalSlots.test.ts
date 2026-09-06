import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { conditionalSlotFiles } from './helpers/conditionalSlots'

describe('conditional slot projection', () => {
  const tempDirs: string[] = []
  afterEach(() => cleanupTempDirs(tempDirs))

  for (const provider of ['node', 'browser'] as const) {
    it(`updates named and default slot branches in ${provider}`, () => {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-conditional-slots-'))
      tempDirs.push(projectPath)
      for (const [relativePath, source] of conditionalSlotFiles) {
        const target = path.join(projectPath, relativePath)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(conditionalSlotFiles) })
      const page = session.reLaunch('/pages/index/index')
      expect(session.renderCurrentPage().wxml).toContain('first-initial')
      expect(session.renderCurrentPage().wxml).toContain('header-initial')
      expect(session.renderCurrentPage().wxml).not.toContain('second-initial')
      page.setData({ branch: 1, open: false, label: 'updated' })
      expect(session.renderCurrentPage().wxml).not.toContain('id="first"')
      page.setData({ open: true })
      const updated = session.renderCurrentPage().wxml
      expect(updated).toContain('second-updated')
      expect(updated).not.toContain('id="first"')
      expect(updated).not.toContain('id="header"')
      expect(updated).not.toContain('id="third"')
      page.setData({ branch: 2 })
      expect(session.renderCurrentPage().wxml).toContain('third-updated')
      expect(session.renderCurrentPage().wxml).not.toContain('id="second"')
      page.setData({ branch: 0 })
      expect(session.renderCurrentPage().wxml).toContain('header-updated')
    })
  }
})
