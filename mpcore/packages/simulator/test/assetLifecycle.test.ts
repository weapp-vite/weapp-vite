import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { templateUpdateFiles } from './helpers/templateUpdates'

describe.each(['node', 'browser'] as const)('%s static asset lifecycle', (provider) => {
  it('preserves page, app, input and event behavior across asset edits, removal and restoration', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-static-asset-'))
    const files = createBrowserVirtualFiles(templateUpdateFiles)
    for (const [file, source] of templateUpdateFiles) {
      const target = path.join(root, file)
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, source)
    }
    const session = provider === 'browser'
      ? createBrowserHeadlessSession({ files })
      : createHeadlessSession({ projectPath: root })
    try {
      const page = session.reLaunch('/pages/index/index?source=assets')
      const app = session.getApp()
      page.setData({ input: 'held-input' })
      page.increment()
      page.increment()
      for (const content of ['original', 'edited', undefined, 'original', 'second-edit', 'original']) {
        for (const file of ['resources/copied.png', 'public.data']) {
          if (provider === 'browser') {
            if (content === undefined) {
              files.delete(file)
            }
            else {
              files.set(file, content)
            }
          }
          else {
            const target = path.join(root, file)
            if (content === undefined) {
              fs.rmSync(target)
            }
            else {
              fs.mkdirSync(path.dirname(target), { recursive: true })
              fs.writeFileSync(target, content)
            }
          }
        }
        expect(session.renderCurrentPage().wxml).toContain('count: 2')
        expect(session.getCurrentPages()).toEqual([page])
        expect(session.getApp()).toBe(app)
        expect(page.data.input).toBe('held-input')
        expect(page.route).toBe('pages/index/index')
      }
      page.increment()
      expect(session.renderCurrentPage().wxml).toContain('count: 3')
    }
    finally {
      session.close()
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
