import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs, createBaseFixture } from './helpers'
import { deferredMountFiles } from './helpers/deferredMount'

describe.each(['node', 'browser'] as const)('%s host rendering with deferred framework mounting', (provider) => {
  const tempDirs: string[] = []
  const sessions: Array<{ close: () => void }> = []

  afterEach(() => {
    for (const session of sessions.splice(0)) {
      session.close()
    }
    cleanupTempDirs(tempDirs)
  })

  function createSession() {
    if (provider === 'browser') {
      const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(deferredMountFiles) })
      sessions.push(session)
      return session
    }
    const projectPath = createBaseFixture()
    tempDirs.push(projectPath)
    for (const [file, source] of deferredMountFiles) {
      const output = path.join(projectPath, 'dist', file)
      fs.mkdirSync(path.dirname(output), { recursive: true })
      fs.writeFileSync(output, source)
    }
    const session = createHeadlessSession({ projectPath })
    sessions.push(session)
    return session
  }

  it.each(['allow', 'abort', 'reject'])('preserves initial host content until mounting is allowed: %s', async (outcome) => {
    const session = createSession()
    const page = session.reLaunch('/pages/index/index')
    const initial = session.renderCurrentPage().wxml
    expect(initial).toContain('>async guard<')
    expect(initial).toContain('>pending<')
    expect(session.getApp()?.globalData.events).toEqual(['guard:start'])

    await page.completeGuard(outcome)

    const rendered = session.renderCurrentPage().wxml
    expect(rendered).toContain('>async guard<')
    if (outcome === 'allow') {
      expect(rendered).toContain('guard:start &gt; guard:done &gt; mounted')
      expect(rendered).not.toContain('>pending<')
      expect(session.getApp()?.globalData.events).toEqual(['guard:start', 'guard:done', 'mounted'])
    }
    else {
      expect(rendered).toContain('>pending<')
      expect(session.getApp()?.globalData.events).toEqual(['guard:start', 'guard:done'])
    }
    expect(session.getDiagnostics()).toEqual([])
  })
})
