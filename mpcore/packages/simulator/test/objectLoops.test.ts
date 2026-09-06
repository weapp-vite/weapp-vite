import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { objectLoopFiles } from './helpers/objectLoops'

describe('object iteration matches WeChat WXML', () => {
  const directories: string[] = []
  afterEach(() => cleanupTempDirs(directories))

  for (const provider of ['node', 'browser'] as const) {
    it(`renders object keys and values and removes obsolete entries in ${provider}`, () => {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-object-loop-'))
      directories.push(projectPath)
      for (const [file, source] of objectLoopFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(objectLoopFiles) })
      try {
        const page = session.reLaunch('/pages/index/index')
        expect(session.renderCurrentPage().wxml).toContain('>fetch=function</text>')
        expect(session.renderCurrentPage().wxml).toContain('>xmlHttpRequest=undefined</text>')
        page.setData({ apis: { response: 'function' } })
        expect(session.renderCurrentPage().wxml).toContain('>response=function</text>')
        expect(session.renderCurrentPage().wxml).not.toContain('api-fetch')
        page.setData({ apis: {} })
        expect(session.renderCurrentPage().wxml).not.toContain('<text')
      }
      finally {
        session.close()
      }
    })
  }
})
