import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { importedTemplateFiles } from './helpers/importedTemplates'

describe('imported template scope', () => {
  const tempDirs: string[] = []
  afterEach(() => cleanupTempDirs(tempDirs))

  for (const provider of ['node', 'browser'] as const) {
    it(`renders direct imports with private dependencies in ${provider}`, () => {
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-template-imports-'))
      tempDirs.push(projectPath)
      for (const [relativePath, source] of importedTemplateFiles) {
        const target = path.join(projectPath, relativePath)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(importedTemplateFiles) })
      const page = session.reLaunch('/pages/index/index?source=router')
      expect(page.options).toEqual({ source: 'router' })
      expect(session.renderCurrentPage().wxml).toContain('router:router')
      expect(session.renderCurrentPage().wxml.match(/class="label"/g)).toHaveLength(2)
      expect(session.renderCurrentPage().wxml).not.toContain('not-exported')
      page.setData({ label: 'updated' })
      expect(session.renderCurrentPage().wxml.match(/>updated<\/text>/g)).toHaveLength(2)
    })
  }
})
