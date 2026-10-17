import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { componentEventReentryFiles } from './helpers/componentEventReentry'

describe.each(['node', 'browser'] as const)('%s conditional loop event reentry', (provider) => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  function createSession() {
    if (provider === 'browser') {
      return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentEventReentryFiles) })
    }
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-event-reentry-'))
    directories.push(projectPath)
    for (const [file, source] of componentEventReentryFiles) {
      const target = path.join(projectPath, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    return createHeadlessSession({ projectPath })
  }

  it('delivers one event when the parent synchronously appends and uses a replaced handler', () => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      const alpha = page.selectComponent!('#child-alpha')
      const beta = page.selectComponent!('#child-beta')
      expect(alpha).toBeTruthy()
      expect(beta).toBeTruthy()
      alpha.emit()
      expect(page.data.received).toEqual([{ row: 'alpha', handler: 'original' }])
      session.renderCurrentPage()
      session.renderCurrentPage()
      expect(page.selectComponent!('#child-alpha')).toBe(alpha)
      page.replaceHandler()
      expect(page.data.handlerReplaced).toBe(true)
      beta.emit()
      expect(page.data.received).toEqual([
        { row: 'alpha', handler: 'original' },
        { row: 'beta', handler: 'replacement' },
      ])
    }
    finally {
      session.close()
    }
  })

  it('does not duplicate delivery when the handler reorders or unmounts the loop', () => {
    const session = createSession()
    try {
      const page = session.reLaunch('/pages/index/index')
      page.setMode('reorder')
      page.emitRow('alpha')
      expect(page.data.rows).toEqual(['beta', 'alpha'])
      session.renderCurrentPage()
      page.emitRow('beta')
      expect(page.data.received).toEqual([
        { row: 'alpha', handler: 'original' },
        { row: 'beta', handler: 'original' },
      ])
      page.setMode('unmount')
      page.emitRow('alpha')
      session.renderCurrentPage()
      expect(page.data.received).toHaveLength(3)
      expect(page.selectComponent!('#child-alpha')).toBeNull()
      expect(page.selectComponent!('#child-beta')).toBeNull()
      page.restoreChildren()
      session.renderCurrentPage()
      page.emitRow('beta')
      expect(page.data.received.map((event: { row: string }) => event.row)).toEqual(['alpha', 'beta', 'alpha', 'beta'])
      session.reLaunch('/pages/empty/index')
      const reopened = session.reLaunch('/pages/index/index')
      expect(reopened.data.received).toEqual([])
      reopened.emitRow('alpha')
      expect(reopened.data.received).toEqual([{ row: 'alpha', handler: 'original' }])
    }
    finally {
      session.close()
    }
  })
})
