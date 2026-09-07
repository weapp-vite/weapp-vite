import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { omittedAppFiles } from './helpers/omittedApp'

describe('optional App registration', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  for (const provider of ['node', 'browser'] as const) {
    function createSession(appSource?: string) {
      const files = omittedAppFiles(appSource)
      if (provider === 'browser') {
        return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      }
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-omitted-app-'))
      directories.push(projectPath)
      for (const [file, source] of files) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      return createHeadlessSession({ projectPath })
    }

    it.each([
      { source: '', label: 'empty' },
      { source: 'require("./shared/entry")', label: 'entry' },
    ])(`creates one default app for $label entry in ${provider}`, ({ source, label }) => {
      const session = createSession(source)
      try {
        session.reLaunch('/pages/index/index')
        const app = session.getApp()
        expect(app).toBeDefined()
        expect(session.renderCurrentPage().wxml).toContain(`ready:1:${label}`)
        session.reLaunch('/packageA/pages/detail')
        expect(session.getApp()).toBe(app)
        expect(session.renderCurrentPage().wxml).toContain(`ready:2:${label}`)
        session.reLaunch('/pages/index/index')
        expect(session.bootstrap()).toBe(app)
        expect(session.renderCurrentPage().wxml).toContain(`ready:3:${label}`)
      }
      finally {
        session.close()
      }
    })

    it(`preserves an explicit App definition and invokes its lifecycle once in ${provider}`, () => {
      const session = createSession('App({ visits: 40, globalData: { launches: 0 }, onLaunch() { this.globalData.launches++ } })')
      try {
        session.reLaunch('/pages/index/index')
        expect(session.getApp()?.globalData.launches).toBe(1)
        expect(session.renderCurrentPage().wxml).toContain('ready:41:empty')
        session.reLaunch('/packageA/pages/detail')
        expect(session.bootstrap().globalData.launches).toBe(1)
        expect(session.renderCurrentPage().wxml).toContain('ready:42:empty')
      }
      finally {
        session.close()
      }
    })

    it(`does not replace a throwing app entry with a default app on retry in ${provider}`, () => {
      const session = createSession('throw new Error("app entry failed")')
      try {
        expect(() => session.bootstrap()).toThrow('app entry failed')
        expect(() => session.bootstrap()).toThrow('app entry failed')
        expect(session.getApp()).toBeNull()
        expect(session.getCurrentPages()).toEqual([])
      }
      finally {
        session.close()
      }
    })
  }
})
